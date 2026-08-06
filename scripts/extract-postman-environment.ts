#!/usr/bin/env ts-node
/**
 * Postman Environment Extractor
 * Extracts environment configurations from Postman environment files
 * and saves them to gateway-api-config.json for use by test runners
 * 
 * Usage: ts-node scripts/extract-postman-environment.ts [--env=qa]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

interface PostmanEnvironmentValue {
  key: string;
  value: string;
  enabled?: boolean;
}

interface PostmanEnvironment {
  name: string;
  values?: PostmanEnvironmentValue[];
  _postman_variable_scope?: string;
}

interface GatewayConfig {
  name: string;
  description: string;
  environment: string;
  updatedAt: string;
  config: Record<string, string>;
  notes: string;
  sources: Record<string, string>;
}

async function extractPostmanEnvironment(envName: string): Promise<GatewayConfig> {
  const postmanEnvPath = path.resolve(`api/postman/environment.${envName}.json`);
  const postmanEnvExamplePath = path.resolve(`api/postman/environment.${envName}.example.json`);

  console.log(`\n📖 Postman Environment Extractor\n`);
  console.log(`Looking for environment: ${envName}`);
  console.log(`📍 Path: ${postmanEnvPath}\n`);

  let postmanEnv: PostmanEnvironment | null = null;

  // Try to load from actual environment file
  try {
    const content = await fs.readFile(postmanEnvPath, 'utf8');
    postmanEnv = JSON.parse(content);
    console.log(`✅ Loaded Postman environment from: environment.${envName}.json`);
  } catch (e) {
    console.warn(`⚠️  Could not load environment.${envName}.json`);

    // Try example file
    try {
      const exampleContent = await fs.readFile(postmanEnvExamplePath, 'utf8');
      postmanEnv = JSON.parse(exampleContent);
      console.log(`✅ Loaded Postman environment from: environment.${envName}.example.json`);
    } catch (e2) {
      console.warn(`⚠️  Could not load example file either`);
    }
  }

  // Extract configuration values
  const config: Record<string, string> = {
    BASE_URL: 'https://fsp.rate.com/gateway',
    API_TOKEN: 'Bearer token-will-be-fetched-automatically',
    TIMEOUT: '10000',
    RETRY_COUNT: '0',
  };

  if (postmanEnv?.values) {
    console.log(`\n📋 Found ${postmanEnv.values.length} environment variables:\n`);

    postmanEnv.values.forEach((v: PostmanEnvironmentValue) => {
      if (v.enabled !== false && v.key && v.value) {
        // Convert placeholder syntax {{VAR}} to actual values if applicable
        let resolvedValue = v.value;

        // Map common Postman variables to our config
        if (v.key.toLowerCase() === 'gateway' || v.key.toLowerCase() === 'baseurl') {
          // Extract actual URL if it contains it, otherwise keep as is
          if (!resolvedValue.includes('{{')) {
            config.BASE_URL = resolvedValue;
          }
        } else if (v.key.toLowerCase() === 'accesstoken' || v.key.toLowerCase() === 'token') {
          if (!resolvedValue.includes('{{')) {
            config.API_TOKEN = resolvedValue;
          }
        } else if (v.key.toLowerCase() === 'tenantid') {
          if (!resolvedValue.includes('{{')) {
            config.TENANT_ID = resolvedValue;
          }
        } else if (v.key.toLowerCase() === 'customerid') {
          if (!resolvedValue.includes('{{')) {
            config.CUSTOMER_ID = resolvedValue;
          }
        }

        // Store any other custom variables
        const upperKey = v.key.toUpperCase();
        if (!config[upperKey]) {
          config[upperKey] = resolvedValue;
        }

        const isPlaceholder = resolvedValue.includes('{{');
        const display = isPlaceholder
          ? `${resolvedValue} (placeholder - will use env var)`
          : resolvedValue;
        console.log(`   ${v.key}: ${display}`);
      }
    });
  }

  // Find Postman collection path
  const collectionPaths = [
    'api/postman/mobile/Gateway-API-Latest-Jul-29-2026.postman_collection.json',
    'api/postman/collection.json',
  ];

  let foundCollectionPath = '';
  for (const collPath of collectionPaths) {
    try {
      await fs.access(collPath);
      foundCollectionPath = collPath;
      break;
    } catch {
      // File doesn't exist
    }
  }

  // Create config object
  const configObj: GatewayConfig = {
    name: `Gateway API - ${envName.toUpperCase()} Environment`,
    description: 'Auto-extracted from Postman environment files',
    environment: envName,
    updatedAt: new Date().toISOString(),
    config,
    notes:
      'This file is auto-generated from Postman environments. Edit BASE_URL and other values as needed, or re-run the environment extractor.',
    sources: {
      postmanEnvironment: `api/postman/environment.${envName}.json`,
      postmanCollection: foundCollectionPath || 'api/postman/mobile/Gateway-API-Latest-Jul-29-2026.postman_collection.json',
    },
  };

  return configObj;
}

async function main() {
  const envArg = process.argv.find((arg) => arg.startsWith('--env='))?.split('=')[1] || 'qa';

  try {
    const config = await extractPostmanEnvironment(envArg);

    // Create config directory if needed
    const configDir = path.resolve('api/api-configs');
    await fs.mkdir(configDir, { recursive: true });

    // Save config file
    const configPath = path.resolve(`api/api-configs/gateway-api-config.json`);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log(`\n✅ Configuration saved to: ${configPath}\n`);

    console.log(`📌 Configuration Summary:`);
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Base URL: ${config.config.BASE_URL}`);
    console.log(`   Tenant ID: ${config.config.TENANT_ID}`);
    console.log(`   Timeout: ${config.config.TIMEOUT}ms`);
    console.log(`   Retry Count: ${config.config.RETRY_COUNT}\n`);

    console.log(`📖 How to Use:`);
    console.log(`   1. Update values in: api/api-configs/gateway-api-config.json`);
    console.log(`   2. Or set environment variables (will override config file):`);
    console.log(`      export BASE_URL=https://your-gateway.com`);
    console.log(`   3. Run tests:`);
    console.log(`      npm run postman:runner:smoke\n`);

    console.log(`🔄 To Re-extract After Updating Postman Environment:`);
    console.log(`   npm run postman:extract-env\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

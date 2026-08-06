#!/usr/bin/env ts-node
/**
 * Postman Collection Test Runner
 * Runs APIs from the converted Postman collection with token management
 * Fetches Okta token first, then uses it for subsequent API calls
 * 
 * Usage: 
 *   BASE_URL=https://gateway.example.com ts-node scripts/postman-runner.ts
 *   BASE_URL=https://gateway.example.com ts-node scripts/postman-runner.ts --scenario=smoke
 *   BASE_URL=https://gateway.example.com ts-node scripts/postman-runner.ts --tags=graphql,critical
 */

import fs from 'node:fs/promises';
import path from 'node:path';

interface TestResult {
  apiId: string;
  name: string;
  status: 'pass' | 'fail';
  statusCode: number;
  duration: number;
  errors: string[];
}

interface ApiDefinition {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  tags: string[];
  headers?: Record<string, string>;
  body?: any;
  expected: { status: number };
}

interface ApiMapping {
  version: string;
  apis: ApiDefinition[];
  variables: Record<string, string>;
  testScenarios: Record<string, { apis: string[] }>;
}

// Store extracted variables like accessToken
const extractedVariables: Record<string, string> = {};

async function loadGatewayConfig(): Promise<Record<string, string>> {
  const configPath = path.resolve('api/api-configs/gateway-api-config.json');
  
  try {
    const content = await fs.readFile(configPath, 'utf8');
    const configFile = JSON.parse(content);
    
    // Merge config file values with environment variables
    // Environment variables take precedence over config file
    const merged: Record<string, string> = { ...configFile.config };
    
    // Override with environment variables if they exist
    for (const [key, value] of Object.entries(process.env)) {
      if (key.match(/^(BASE_URL|API_TOKEN|TENANT_ID|CUSTOMER_ID|TIMEOUT|RETRY_COUNT)$/) && value) {
        merged[key] = value;
      }
    }
    
    return merged;
  } catch (e) {
    // Config file not found, use environment variables only
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.match(/^(BASE_URL|API_TOKEN|TENANT_ID|CUSTOMER_ID|TIMEOUT|RETRY_COUNT)$/) && value) {
        env[key] = value;
      }
    }
    return env;
  }
}

async function loadGatewayMapping(): Promise<ApiMapping> {
  const mappingPath = path.resolve('api/api-mappings/mobile/gateway-api-mapping.json');
  const content = await fs.readFile(mappingPath, 'utf8');
  return JSON.parse(content);
}

function resolveUrl(endpoint: string, env: Record<string, string>): string {
  let url = endpoint;

  // Replace collection variables
  url = url.replace(/{{gateway}}/g, env.BASE_URL || 'http://localhost:8080');
  url = url.replace(/{{baseUrl}}/g, env.BASE_URL || 'http://localhost:8080');

  // Replace extracted variables (like {{accessToken}})
  for (const [key, value] of Object.entries(extractedVariables)) {
    url = url.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Replace environment variables
  url = url.replace(/{{(\w+)}}/g, (match, key) => {
    return env[key] || process.env[key] || match;
  });

  return url;
}

function resolveHeaders(
  headers: Record<string, string> | undefined,
  env: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (!headers) return resolved;

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      let resolvedValue = value;
      resolvedValue = resolvedValue.replace(/{{gateway}}/g, env.BASE_URL || 'http://localhost:8080');

      // Use extracted variables like accessToken
      for (const [varKey, varValue] of Object.entries(extractedVariables)) {
        resolvedValue = resolvedValue.replace(new RegExp(`{{${varKey}}}`, 'g'), varValue);
      }

      resolved[key] = resolvedValue;
    }
  }

  return resolved;
}

function resolveBody(body: any, env: Record<string, string>): string {
  if (!body) return '';

  if (typeof body === 'string') {
    return body;
  }

  return JSON.stringify(body);
}

// Extract token from GraphQL response
function extractTokenFromResponse(response: any, apiName: string): void {
  if (!response || !response.data) return;

  try {
    // For FetchOktaToken GraphQL query
    if (response.data.fetchOktaToken?.accessToken) {
      extractedVariables['accessToken'] = response.data.fetchOktaToken.accessToken;
      extractedVariables['accessToken_extracted_from'] = apiName;
      console.log(`\n✨ Extracted accessToken from ${apiName}`);
      console.log(`   Token: ${response.data.fetchOktaToken.accessToken.substring(0, 20)}...`);
    }

    // For other token responses
    if (response.data.sessionToken) {
      extractedVariables['sessionToken'] = response.data.sessionToken;
    }
    if (response.data.userId) {
      extractedVariables['userId'] = response.data.userId;
    }
  } catch (e) {
    // Silent fail - no token to extract
  }
}

async function testApi(
  api: ApiDefinition,
  env: Record<string, string>
): Promise<TestResult> {
  const url = resolveUrl(api.endpoint, env);
  const headers = resolveHeaders(api.headers, env);
  const body = resolveBody(api.body, env);

  const startTime = Date.now();
  const errors: string[] = [];
  let statusCode = 0;

  try {
    const options: RequestInit = {
      method: api.method,
      headers,
    };

    if (body && (api.method === 'POST' || api.method === 'PUT' || api.method === 'PATCH')) {
      options.body = body;
    }

    // Set timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    options.signal = controller.signal;

    const res = await fetch(url, options);
    clearTimeout(timeoutId);
    statusCode = res.status;

    // Try to extract token if this is a token-fetching API
    if (api.tags?.includes('auth') || api.id.includes('token')) {
      try {
        const responseText = await res.text();
        const responseJson = JSON.parse(responseText);
        extractTokenFromResponse(responseJson, api.name);
      } catch {
        // Not JSON, skip extraction
      }
    }

    if (statusCode !== api.expected.status) {
      errors.push(`Expected status ${api.expected.status}, got ${statusCode}`);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const duration = Date.now() - startTime;

  return {
    apiId: api.id,
    name: api.name,
    status: errors.length === 0 ? 'pass' : 'fail',
    statusCode,
    duration,
    errors,
  };
}

async function main() {
  const scenario = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
  const tagsArg = process.argv.find((arg) => arg.startsWith('--tags='))?.split('=')[1];
  const tags = tagsArg ? tagsArg.split(',') : [];

  console.log('\n🚀 Postman Collection Test Runner\n');

  // Load configuration from file and environment
  const env = await loadGatewayConfig();

  const configSource = process.env.BASE_URL 
    ? '📝 Config: api/api-configs/gateway-api-config.json + env override (BASE_URL)' 
    : '📝 Config: api/api-configs/gateway-api-config.json';

  console.log(configSource);
  console.log(`🔗 Base URL: ${env.BASE_URL || '(not set - use BASE_URL env var or update config file)'}\n`);

  if (!env.BASE_URL) {
    console.warn(`⚠️  BASE_URL not set. Either:`);
    console.warn(`   1. Set environment: export BASE_URL=https://your-gateway.com`);
    console.warn(`   2. Edit config: api/api-configs/gateway-api-config.json`);
    console.warn(`   Then run: npm run postman:runner\n`);
  }

  try {
    const mapping = await loadGatewayMapping();

    console.log(`📋 Loaded: ${mapping.apis.length} APIs from Postman collection`);
    if (scenario) console.log(`📍 Scenario: ${scenario}`);
    if (tags.length) console.log(`🏷️  Tags: ${tags.join(', ')}`);
    console.log('');

    // Filter APIs
    let apisToTest = mapping.apis;

    if (scenario && mapping.testScenarios[scenario]) {
      const scenarioApiIds = mapping.testScenarios[scenario].apis;
      apisToTest = apisToTest.filter((api) => scenarioApiIds.includes(api.id));
      console.log(`✓ Filtered to scenario: ${scenario} (${apisToTest.length} APIs)\n`);
    }

    if (tags.length > 0) {
      apisToTest = apisToTest.filter((api) => tags.some((tag) => api.tags.includes(tag)));
      console.log(`✓ Filtered by tags: ${tags.join(', ')} (${apisToTest.length} APIs)\n`);
    }

    console.log(`🔄 Running ${apisToTest.length} API test(s)...\n`);

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const api of apisToTest) {
      const result = await testApi(api, env);
      results.push(result);

      const statusEmoji = result.status === 'pass' ? '✅' : '❌';
      const statusText = result.status === 'pass' ? 'PASS' : 'FAIL';

      console.log(`${statusEmoji} [${statusText}] ${result.name}`);
      console.log(`    Method: ${api.method} | Status: ${result.statusCode} | Duration: ${result.duration}ms`);

      if (result.errors.length > 0) {
        result.errors.forEach((err) => console.log(`    ❌ ${err}`));
      }

      if (result.status === 'pass') {
        passed++;
      } else {
        failed++;
      }

      console.log('');
    }

    // Summary
    const total = passed + failed;
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

    console.log('━'.repeat(60));
    console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${total}`);
    console.log(`   Success Rate: ${percentage}%`);
    console.log('━'.repeat(60));

    // Report extracted variables
    if (Object.keys(extractedVariables).length > 0) {
      console.log('\n✨ Extracted Variables:');
      for (const [key, value] of Object.entries(extractedVariables)) {
        if (key !== 'accessToken_extracted_from') {
          const display = value.length > 30 ? `${value.substring(0, 30)}...` : value;
          console.log(`   ${key}: ${display}`);
        }
      }
    }

    // Save report
    const reportPath = path.resolve(`test-results/postman-test-report-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          metadata: {
            scenario: scenario || 'all',
            tags: tags,
            total: total,
            passed,
            failed,
            successRate: parseFloat(percentage),
            timestamp: new Date().toISOString(),
          },
          results,
          extractedVariables: Object.keys(extractedVariables).reduce(
            (acc, key) => {
              if (key !== 'accessToken_extracted_from') {
                acc[key] = extractedVariables[key].substring(0, 30) + '...';
              }
              return acc;
            },
            {} as Record<string, string>
          ),
        },
        null,
        2
      )
    );

    console.log(`\n📄 Report: ${reportPath}`);
    console.log('\n✅ Test run complete!\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

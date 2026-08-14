#!/usr/bin/env ts-node
/**
 * API Mapping Validation Script
 * Reads the API mapping JSON and validates each endpoint
 * Usage: ts-node scripts/validate-api-mapping.ts [--environment=qa|prod]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

interface ApiMapping {
  variables: Record<string, string>;
  apis: Array<{
    name: string;
    method: string;
    endpoint: string;
    headers?: Record<string, string>;
    body?: Record<string, any>;
    expected: {
      status: number;
      bodySchema?: Record<string, any>;
    };
  }>;
}

interface ValidationResult {
  name: string;
  method: string;
  url: string;
  status: number;
  statusCode: number;
  ok: boolean;
  error?: string;
  body?: string;
  duration: number;
}

async function resolveVariables(
  text: string,
  variables: Record<string, string>,
  env: Record<string, string>
): Promise<string> {
  let result = text;

  // First, resolve mapping variables (baseUrl -> {{BASE_URL}})
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Then, resolve environment variables ({{BASE_URL}} -> https://...)
  for (const [key, value] of Object.entries(env)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Finally, resolve process.env variables as fallback
  result = result.replace(/{{(\w+)}}/g, (match, key) => {
    return process.env[key] || match;
  });

  return result;
}

async function validateApi(
  mapping: ApiMapping,
  env: Record<string, string>,
  api: ApiMapping['apis'][0]
): Promise<ValidationResult> {
  const url = await resolveVariables(api.endpoint, mapping.variables, env);
  const headers = api.headers
    ? Object.fromEntries(
        await Promise.all(
          Object.entries(api.headers).map(async ([k, v]) => [
            k,
            await resolveVariables(v, mapping.variables, env),
          ])
        )
      )
    : {};

  const startTime = Date.now();
  let response: Response | null = null;
  let body: string = '';
  let error: string | undefined;

  try {
    const options: RequestInit = {
      method: api.method,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    };

    if (api.body && (api.method === 'POST' || api.method === 'PUT')) {
      options.body = JSON.stringify(api.body);
      headers['Content-Type'] = 'application/json';
    }

    response = await fetch(url, options);
    body = await response.text();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const duration = Date.now() - startTime;

  return {
    name: api.name,
    method: api.method,
    url,
    status: response?.status || 0,
    statusCode: response?.status || 0,
    ok: response?.status === api.expected.status,
    error,
    body: body?.length ? body.substring(0, 200) : undefined,
    duration,
  };
}

async function main() {
  const envArg = process.argv.find((arg) => arg.startsWith('--environment='))?.split('=')[1] || 'qa';
  const mappingPath = path.resolve('api/api-mappings/mobile/api-mapping.json');

  console.log(`🔍 Loading API mapping from: ${mappingPath}`);
  console.log(`📋 Using environment: ${envArg}`);
  console.log(`📌 Configuration from: process.env (shell environment variables)\n`);

  try {
    const mappingContent = await fs.readFile(mappingPath, 'utf8');
    const mapping: ApiMapping = JSON.parse(mappingContent);

    // Use process.env directly instead of JSON files
    const env = { ...process.env } as Record<string, string>;

    const results: ValidationResult[] = [];
    let passed = 0;
    let failed = 0;

    console.log(`📡 Validating ${mapping.apis.length} API endpoint(s)...\n`);

    for (const api of mapping.apis) {
      const result = await validateApi(mapping, env, api);
      results.push(result);

      const statusIcon = result.ok ? '✅' : '❌';
      console.log(`${statusIcon} ${result.name} (${result.method})`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Status: ${result.statusCode} (expected ${api.expected.status})`);
      console.log(`   Duration: ${result.duration}ms`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.body) {
        console.log(`   Response: ${result.body}${result.body.length === 200 ? '...' : ''}`);
      }

      result.ok ? passed++ : failed++;
      console.log();
    }

    // Summary
    console.log('━'.repeat(60));
    console.log(`📊 Summary: ${passed} passed, ${failed} failed`);
    console.log('━'.repeat(60));

    // Write JSON report
    const reportPath = path.resolve('test-results/api-validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}\n`);

    // Exit with code 1 if any test failed
    if (failed > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ Error:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});

#!/usr/bin/env ts-node
/**
 * Advanced API Test Runner
 * Supports multiple testing scenarios: smoke, contract, integration, performance
 * Usage: ts-node scripts/run-api-tests.ts [--scenario=smoke|contract|integration|performance] [--tags=tag1,tag2] [--environment=qa|prod]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';

interface ApiMapping {
  version: string;
  metadata: Record<string, any>;
  variables: Record<string, string>;
  globals: Record<string, any>;
  testScenarios: Record<string, { description: string; tags: string[]; apis: string[] }>;
  apis: Array<{
    id: string;
    name: string;
    description?: string;
    method: string;
    endpoint: string;
    tags: string[];
    headers?: Record<string, string>;
    body?: Record<string, any>;
    expected: {
      status: number;
      contentType?: string;
      schema?: Record<string, any>;
    };
    performance?: {
      maxResponseTime?: number;
      maxSize?: number;
    };
    uiMapping?: Record<string, any>;
  }>;
}

interface TestResult {
  apiId: string;
  name: string;
  status: 'pass' | 'fail';
  statusCode: number;
  expectedStatus: number;
  duration: number;
  size: number;
  errors: string[];
  warnings: string[];
  performance: {
    ok: boolean;
    maxResponseTime?: number;
    actual?: number;
  };
  timestamp: string;
}

async function loadMapping(envName: string): Promise<ApiMapping> {
  const mappingPath = path.resolve('api/api-mappings/mobile/api-mapping.json');
  const content = await fs.readFile(mappingPath, 'utf8');
  return JSON.parse(content);
}

async function loadEnvironment(envName: string): Promise<Record<string, string>> {
  // Try to load from config file first
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

function resolveUrl(
  endpoint: string,
  variables: Record<string, string>,
  env: Record<string, string>
): string {
  let url = endpoint;

  // Resolve mapping variables first
  for (const [key, value] of Object.entries(variables)) {
    url = url.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Then resolve environment variables
  for (const [key, value] of Object.entries(env)) {
    url = url.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Finally process.env as fallback
  url = url.replace(/{{(\w+)}}/g, (match, key) => {
    return process.env[key] || match;
  });

  return url;
}

async function testApi(
  api: ApiMapping['apis'][0],
  variables: Record<string, string>,
  env: Record<string, string>,
  globals: Record<string, any>
): Promise<TestResult> {
  const url = resolveUrl(api.endpoint, variables, env);
  const headers = api.headers ? { ...api.headers } : {};

  // Resolve headers
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      headers[key] = resolveUrl(value, variables, env);
    }
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let statusCode = 0;
  let body = '';
  let size = 0;

  try {
    const options: RequestInit = {
      method: api.method,
      headers: { 'Accept': 'application/json', ...headers },
    };

    if (api.body && (api.method === 'POST' || api.method === 'PUT')) {
      options.body = JSON.stringify(api.body);
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), globals.timeout || 10000);
    options.signal = controller.signal;

    const res = await fetch(url, options);
    clearTimeout(timeoutId);
    statusCode = res.status;
    body = await res.text();
    size = Buffer.byteLength(body);

    // Check status
    if (statusCode !== api.expected.status) {
      errors.push(`Expected status ${api.expected.status}, got ${statusCode}`);
    }

    // Check content type
    if (api.expected.contentType) {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes(api.expected.contentType)) {
        errors.push(`Expected content-type ${api.expected.contentType}, got ${contentType}`);
      }
    }

    // Validate JSON schema
    if (api.expected.schema && body) {
      try {
        const ajv = new Ajv();
        const validate = ajv.compile(api.expected.schema);
        const data = JSON.parse(body);

        if (!validate(data)) {
          errors.push(
            `Schema validation failed: ${ajv.errorsText(validate.errors)}`
          );
        }
      } catch (e) {
        errors.push(`Failed to parse response as JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Check performance
    const duration = Date.now() - startTime;
    const performanceOk =
      !api.performance?.maxResponseTime ||
      duration <= api.performance.maxResponseTime;

    if (!performanceOk) {
      warnings.push(
        `Response time ${duration}ms exceeded max ${api.performance?.maxResponseTime}ms`
      );
    }

    if (api.performance?.maxSize && size > api.performance.maxSize) {
      warnings.push(`Response size ${size} bytes exceeded max ${api.performance.maxSize}`);
    }

    return {
      apiId: api.id,
      name: api.name,
      status: errors.length === 0 ? 'pass' : 'fail',
      statusCode,
      expectedStatus: api.expected.status,
      duration,
      size,
      errors,
      warnings,
      performance: {
        ok: performanceOk,
        maxResponseTime: api.performance?.maxResponseTime,
        actual: duration,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return {
      apiId: api.id,
      name: api.name,
      status: 'fail',
      statusCode,
      expectedStatus: api.expected.status,
      duration: Date.now() - startTime,
      size,
      errors,
      warnings,
      performance: { ok: false },
      timestamp: new Date().toISOString(),
    };
  }
}

async function main() {
  const env = process.argv.find((arg) => arg.startsWith('--environment='))?.split('=')[1] || 'qa';
  const scenario = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
  const tagsArg = process.argv.find((arg) => arg.startsWith('--tags='))?.split('=')[1];
  const tags = tagsArg ? tagsArg.split(',') : [];

  console.log(`\n🚀 API Test Runner\n`);
  console.log(`Environment: ${env}`);
  if (scenario) console.log(`Scenario: ${scenario}`);
  if (tags.length) console.log(`Tags: ${tags.join(', ')}`);
  console.log('');

  try {
    const mapping = await loadMapping(env);
    const envVars = await loadEnvironment(env);

    console.log(`📋 Mapping Version: ${mapping.version}`);
    console.log(`📍 Base URL: ${envVars.BASE_URL || '(not set - use BASE_URL env var or update config file)'}`);
    
    const configSource = process.env.BASE_URL 
      ? '📝 Config: api/api-configs/gateway-api-config.json + env override (BASE_URL)' 
      : '📝 Config: api/api-configs/gateway-api-config.json';
    console.log(configSource + '\n');

    if (!envVars.BASE_URL) {
      console.warn(`⚠️  BASE_URL not set. Either:`);
      console.warn(`   1. Set environment: export BASE_URL=https://your-api.com`);
      console.warn(`   2. Edit config: api/api-configs/gateway-api-config.json`);
      console.warn(`   Then run: npm run test:api:smoke\n`);
    }

    // Filter APIs by scenario or tags
    let apisToTest = mapping.apis;

    if (scenario && mapping.testScenarios[scenario]) {
      const scenarioApiIds = mapping.testScenarios[scenario].apis;
      apisToTest = apisToTest.filter((api) => scenarioApiIds.includes(api.id));
      console.log(`✓ Running scenario: ${mapping.testScenarios[scenario].description}\n`);
    }

    if (tags.length > 0) {
      apisToTest = apisToTest.filter((api) =>
        tags.some((tag) => api.tags.includes(tag))
      );
      console.log(`✓ Filtered to APIs with tags: ${tags.join(', ')}\n`);
    }

    console.log(`🔄 Testing ${apisToTest.length} API(s)...\n`);

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const api of apisToTest) {
      const result = await testApi(api, mapping.variables, envVars, mapping.globals);
      results.push(result);

      const statusEmoji = result.status === 'pass' ? '✅' : '❌';
      const statusText = result.status === 'pass' ? 'PASS' : 'FAIL';

      console.log(`${statusEmoji} [${statusText}] ${result.name}`);
      console.log(`    Method: ${api.method} | Status: ${result.statusCode}/${result.expectedStatus}`);
      console.log(`    Duration: ${result.duration}ms | Size: ${result.size} bytes`);

      if (result.performance.ok === false && result.performance.maxResponseTime) {
        console.log(
          `    ⚠️  Performance: ${result.duration}ms > ${result.performance.maxResponseTime}ms`
        );
      }

      if (result.errors.length > 0) {
        result.errors.forEach((err) => console.log(`    ❌ ${err}`));
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach((warn) => console.log(`    ⚠️  ${warn}`));
      }

      result.status === 'pass' ? passed++ : failed++;
      console.log();
    }

    // Summary
    console.log('━'.repeat(60));
    console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${results.length}`);
    console.log(`   Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    console.log('━'.repeat(60));

    // Write detailed report
    const reportPath = path.resolve(`test-results/api-test-report-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          metadata: {
            environment: env,
            scenario,
            tags,
            totalTests: results.length,
            passed,
            failed,
            timestamp: new Date().toISOString(),
          },
          results,
        },
        null,
        2
      )
    );

    console.log(`\n📄 Detailed report: ${reportPath}\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('❌ Error:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();

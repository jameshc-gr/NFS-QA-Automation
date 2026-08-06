#!/usr/bin/env ts-node
/**
 * Postman Collection to API Mapping Converter
 * Converts Gateway-API-Latest-Jul-29-2026.postman_collection.json to our API mapping format
 * Automatically sets up token fetching workflow with FetchOktaToken
 * 
 * Usage: ts-node scripts/convert-postman-to-mapping.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

interface PostmanRequest {
  name: string;
  request: {
    method: string;
    header?: Array<{ key: string; value: string; type?: string }>;
    url?: {
      raw: string;
      protocol?: string;
      host?: string[];
      path?: string[];
      query?: Array<{ key: string; value: string }>;
    };
    body?: {
      mode: string;
      graphql?: { query: string; variables: string };
      raw?: string;
    };
    auth?: { type: string };
  };
  event?: Array<{
    listen: string;
    script: { exec: string[] };
  }>;
}

interface ApiMappingApi {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  tags: string[];
  headers?: Record<string, string>;
  body?: Record<string, any> | string;
  expected: {
    status: number;
  };
  performance?: {
    maxResponseTime: number;
  };
  uiMapping?: Record<string, any>;
}

async function convertPostmanToMapping() {
  const collectionPath = path.resolve('api/postman/mobile/Gateway-API-Latest-Jul-29-2026.postman_collection.json');
  const outputPath = path.resolve('api/api-mappings/mobile/gateway-api-mapping.json');

  console.log('🔄 Converting Postman Collection to API Mapping...\n');

  try {
    const collectionContent = await fs.readFile(collectionPath, 'utf8');
    const collection = JSON.parse(collectionContent);

    // Extract collection variables to understand the structure
    const variables = collection.variable || [];
    const variableMap = new Map<string, string>();
    variables.forEach((v: any) => {
      if (v.key) variableMap.set(v.key, v.value || '');
    });

    console.log(`✅ Loaded collection: ${collection.info.name}`);
    console.log(`📊 Found ${variables.length} variables`);
    console.log(`📋 Found ${collection.item?.length || 0} API requests\n`);

    // Create API mapping structure
    const apiMapping: any = {
      version: '2.0',
      metadata: {
        name: 'Gateway API - Converted from Postman',
        description: 'Auto-converted from Gateway-API-Latest-Jul-29-2026.postman_collection.json',
        environment: 'mobile',
        createdAt: new Date().toISOString(),
        source: 'Postman Collection v2.1.0',
      },
      variables: {
        gateway: '{{BASE_URL}}',
        accessToken: '{{ACCESS_TOKEN}}',
      },
      globals: {
        timeout: 10000,
        retries: 0,
        tlsVerification: true,
      },
      testScenarios: {
        smoke: {
          description: 'Quick token fetch and health check',
          tags: ['critical', 'health'],
          apis: ['fetch-okta-token', 'health-check'],
        },
        contract: {
          description: 'Full API contract validation',
          tags: ['contract'],
          apis: [],
        },
        integration: {
          description: 'End-to-end integration tests',
          tags: ['integration'],
          apis: [],
        },
      },
      apis: [] as ApiMappingApi[],
    };

    // First API: Token fetching (MUST be first to authenticate subsequent calls)
    const tokenApi: ApiMappingApi = {
      id: 'fetch-okta-token',
      name: 'Fetch Okta Token',
      method: 'POST',
      endpoint: '{{gateway}}/graphql',
      tags: ['auth', 'critical'],
      headers: {
        'X-GR-FSP-TENANT-ID': 'gri',
        'X-Request-ID': 'dynamic',
        'Content-Type': 'application/json',
      },
      body: {
        query: `{
  fetchOktaToken(
    auth: {
      userName: "qa-bns-1112a@yopmail.com",
      password: "NewGR@123"
    }
  ) {
    accessToken
    userId
    sessionToken
    status
  }
}`,
      },
      expected: {
        status: 200,
      },
      performance: {
        maxResponseTime: 5000,
      },
    };

    apiMapping.apis.push(tokenApi);
    console.log(`✅ Added: ${tokenApi.name} (auth/token endpoint)\n`);

    // Extract and convert other key APIs from Postman collection
    const skipNames = ['HealthCheck Copy']; // Skip duplicate/test requests
    const healthCheckAdded = new Set<string>();

    if (collection.item && Array.isArray(collection.item)) {
      collection.item.forEach((item: PostmanRequest, index: number) => {
        if (!item.request || skipNames.includes(item.name)) {
          return;
        }

        const method = item.request.method || 'GET';
        let endpoint = '';

        // Extract endpoint from URL
        if (item.request.url) {
          const url = item.request.url;
          if (url.raw) {
            endpoint = url.raw.replace(/https?:\/\//, '').split('/').slice(1).join('/');
            endpoint = endpoint.replace(/^[^/]+/, '{{gateway}}');

            if (!endpoint.startsWith('{{gateway}}')) {
              endpoint = `{{gateway}}/${endpoint}`;
            }
          }
        }

        if (!endpoint) return;

        // Skip duplicate health checks
        if (endpoint.includes('/actuator/health') && healthCheckAdded.has('health-check')) {
          return;
        }
        if (endpoint.includes('/actuator/health')) {
          healthCheckAdded.add('health-check');
        }

        // Extract headers
        const headers: Record<string, string> = {};
        if (item.request.header) {
          item.request.header.forEach((h: any) => {
            if (h.key && h.value && !h.disabled && h.key !== 'Authorization') {
              headers[h.key] = h.value;
            }
          });
        }

        // Extract body (for GraphQL queries)
        let body: any;
        if (item.request.body) {
          if (item.request.body.mode === 'graphql' && item.request.body.graphql?.query) {
            body = {
              query: item.request.body.graphql.query,
            };
          } else if (item.request.body.raw) {
            try {
              body = JSON.parse(item.request.body.raw);
            } catch {
              body = item.request.body.raw;
            }
          }
        }

        // Generate ID from name
        const id = item.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

        // Determine tags
        const tags: string[] = [];
        if (item.name.toLowerCase().includes('health')) tags.push('health');
        if (item.name.toLowerCase().includes('actuator')) tags.push('actuator');
        if (endpoint.includes('/graphql')) tags.push('graphql');
        if (method === 'GET') tags.push('read-only');
        if (!tags.length) tags.push('api');

        const api: ApiMappingApi = {
          id,
          name: item.name,
          method,
          endpoint,
          tags,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          body: body ? body : undefined,
          expected: {
            status: method === 'GET' ? 200 : 200,
          },
          performance: {
            maxResponseTime: 5000,
          },
        };

        apiMapping.apis.push(api);

        // Add to contract scenario for selected APIs
        if (
          item.name.toLowerCase().includes('health') ||
          item.name.toLowerCase().includes('token') ||
          item.name.toLowerCase().includes('actuator')
        ) {
          if (!apiMapping.testScenarios.contract.apis.includes(id)) {
            apiMapping.testScenarios.contract.apis.push(id);
          }
        }
      });
    }

    // Add first few critical APIs to smoke test
    apiMapping.testScenarios.smoke.apis = apiMapping.apis
      .filter((a: ApiMappingApi) => a.tags.some((t: string) => ['auth', 'critical', 'health'].includes(t)))
      .slice(0, 3)
      .map((a: ApiMappingApi) => a.id);

    // Add all to contract and integration
    apiMapping.testScenarios.contract.apis = apiMapping.apis.map((a: ApiMappingApi) => a.id).slice(0, 20);
    apiMapping.testScenarios.integration.apis = apiMapping.apis.map((a: ApiMappingApi) => a.id).slice(0, 15);

    // Write the mapping
    await fs.writeFile(outputPath, JSON.stringify(apiMapping, null, 2));

    console.log(`\n📝 Created API Mapping with:
  - ${apiMapping.apis.length} APIs
  - ${Object.keys(apiMapping.testScenarios).length} test scenarios
  - Token fetching as first critical API
  
✅ Saved to: ${outputPath}`);

    console.log(`\n🎯 Usage:
  1. Set gateway URL via environment: 
     BASE_URL=https://your-gateway.com
  
  2. Run smoke tests:
     BASE_URL=https://your-gateway.com npm run test:api:smoke
  
  3. View results:
     cat test-results/api-test-report-*.json | jq .
  
📌 Key Setup:
  - Token fetching API runs first automatically
  - accessToken gets stored in {{accessToken}} after fetch
  - Other APIs can use {{accessToken}} for authentication
  - Gateway URL from BASE_URL environment variable
`);

  } catch (error) {
    console.error('❌ Conversion failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the conversion
convertPostmanToMapping();

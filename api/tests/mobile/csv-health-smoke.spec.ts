import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type CsvCase = {
  id: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function loadCsvCases(): CsvCase[] {
  const csvPath = path.resolve(__dirname, 'test-cases.csv');
  const [headerLine, ...dataLines] = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const columnIndex = (name: string) => headers.indexOf(name);
  const selectedIds = new Set(['API-002', 'API-003']);

  return dataLines
    .filter(Boolean)
    .map((line) => parseCsvLine(line))
    .map((columns) => ({
      id: columns[columnIndex('Test Case ID')],
      endpoint: columns[columnIndex('API Endpoint')],
      method: columns[columnIndex('HTTP Method')],
      expectedStatus: Number(columns[columnIndex('Expected Status')])
    }))
    .filter((testCase) => selectedIds.has(testCase.id));
}

function loadBaseUrl(): string {
  const configuredBaseUrl = process.env.API_BASE_URL || process.env.BASE_URL;
  if (configuredBaseUrl && configuredBaseUrl !== 'undefined' && !configuredBaseUrl.includes('{{')) {
    return configuredBaseUrl;
  }

  const configPath = path.resolve(__dirname, '../../../api/api-configs/gateway-api-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { config?: { BASE_URL?: string } };
  return config.config?.BASE_URL || '';
}

const csvCases = loadCsvCases();

if (csvCases.length !== 2) {
  throw new Error(`Expected API-002 and API-003 in ${path.resolve(__dirname, 'test-cases.csv')}, found ${csvCases.length}.`);
}

test.describe('Mobile API CSV smoke tests', () => {
  for (const testCase of csvCases) {
    test(`${testCase.id}: ${testCase.endpoint}`, async ({ request }) => {
      // 1. Load the mobile API test case CSV and select API-002 and API-003.
      expect(testCase.id).toMatch(/^API-00[23]$/);

      // 2. Resolve the API base URL from API_BASE_URL, BASE_URL, or the extracted gateway config.
      const baseUrl = loadBaseUrl();
      expect(baseUrl, 'Set API_BASE_URL or BASE_URL, or provide a valid gateway-api-config.json BASE_URL.').toBeTruthy();
      expect(baseUrl, 'The API base URL must be absolute and must not contain unresolved Postman variables.').not.toMatch(/^\{\{|^[^:]+$/);

      const endpointPath = testCase.endpoint.replace(/^[A-Z]+\s+/, '').replace(/^\/+/, '');
      const url = new URL(endpointPath, `${baseUrl.replace(/\/$/, '')}/`).toString();

      // 3. Send GET requests to the CSV endpoints.
      expect(testCase.method).toBe('GET');
      const response = await request.get(url);

      // 4. Verify each response status matches the CSV Expected Status value.
      expect(response.status(), `${testCase.id} response from ${url}`).toBe(testCase.expectedStatus);
    });
  }
});

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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

test('validate all 50 mobile API CSV test cases', async ({ page }) => {
  // 1. Load api/tests/mobile/test-cases.csv.
  const csvPath = path.resolve(__dirname, 'test-cases.csv');
  const [headerLine, ...dataLines] = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const rows = dataLines.filter(Boolean).map((line) => parseCsvLine(line));
  const indexOf = (header: string) => headers.indexOf(header);
  void page;

  // 2. Verify it contains 50 API cases with unique API-001 through API-050 IDs.
  expect(rows).toHaveLength(50);
  const ids = rows.map((row) => row[indexOf('Test Case ID')]);
  expect(new Set(ids).size).toBe(50);
  expect(ids).toEqual(Array.from({ length: 50 }, (_, index) => `API-${String(index + 1).padStart(3, '0')}`));

  // 3. Verify every row has an endpoint, supported HTTP method, expected status, priority, and category.
  const supportedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  const supportedPriorities = new Set(['Critical', 'High', 'Medium', 'Low']);

  for (const row of rows) {
    expect(row[indexOf('API Endpoint')]).toMatch(/^(GET|POST|PUT|PATCH|DELETE)\s+\S+/);
    expect(supportedMethods.has(row[indexOf('HTTP Method')])).toBe(true);
    expect(Number(row[indexOf('Expected Status')])).toBeGreaterThanOrEqual(200);
    expect(Number(row[indexOf('Expected Status')])).toBeLessThan(600);
    expect(supportedPriorities.has(row[indexOf('Priority')])).toBe(true);
    expect(row[indexOf('Category')]).toBeTruthy();
  }

  // 4. This validation is intentionally offline and requires no API environment.
});

#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'test-data/solution-finder/HELOAN_102_scenarios_with_Fannie_Mae_personas.xlsx');
const destination = path.join(root, 'test-data/solution-finder/workbook-scenarios/scenarios.json');
const book = XLSX.readFile(source, { cellComments: true });
assert.ok(book.SheetNames.includes('Sheet1'), 'Source workbook must contain Sheet1');
const sheet = book.Sheets.Sheet1;
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
assert.deepEqual(rows[0], ['Scenario', 'Inquiry Request', 'Inquiry Response', 'UI offers']);
assert.equal(rows.length, 103, 'Expected exactly 102 scenario rows');
const scenarios = rows.slice(1).map((row, index) => {
  assert.equal(row.length, 4, `Unexpected columns at workbook row ${index + 2}`);
  assert.ok(row.every(value => typeof value === 'string' && value.trim()), `Incomplete workbook row ${index + 2}`);
  const request = JSON.parse(row[1]);
  const expectedResponse = JSON.parse(row[2]);
  assert.ok(request.applicationInquiryInput, `Missing inquiry input at row ${index + 2}`);
  assert.ok(Array.isArray(expectedResponse.offers) && expectedResponse.summary && expectedResponse.inquiryId);
  const comments = sheet[`A${index + 2}`]?.c || [];
  return {
    id: `NSF-${String(index + 1).padStart(3, '0')}`,
    name: row[0],
    workbookRow: index + 2,
    request,
    expectedResponse,
    expectedUi: row[3],
    notes: comments.map(comment => comment.t)
  };
});
const output = {
  schemaVersion: 1,
  sourceWorkbook: path.relative(root, source),
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
  baselineTenant: 'gri',
  scenarios
};
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`);
const saved = JSON.parse(fs.readFileSync(destination, 'utf8'));
assert.deepEqual(saved, output);
console.log(`Exported ${scenarios.length} scenarios with unchanged request, response and UI expectations to ${path.relative(root, destination)}`);

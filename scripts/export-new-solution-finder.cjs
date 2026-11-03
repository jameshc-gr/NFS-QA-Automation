#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'test-data/solution-finder/HELOAN_102_scenarios_with_Tri_Bureau_IR_profiles.xlsx');
const destination = path.join(root, 'test-data/solution-finder/workbook-scenarios/scenarios.json');
const book = XLSX.readFile(source, { cellComments: true });
assert.ok(book.SheetNames.includes('Sheet1'), 'Source workbook must contain Sheet1');
const sheet = book.Sheets.Sheet1;
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
assert.deepEqual(rows[0], ['Scenario', 'Inquiry Request', 'Inquiry Response', 'UI offers']);
assert.equal(rows.length, 103, 'Expected exactly 102 scenario rows');
assert.ok(book.SheetNames.includes('Comparison Metadata'), 'Explicit comparison metadata is required');
const metadataRows = XLSX.utils.sheet_to_json(book.Sheets['Comparison Metadata'], { header: 1, defval: '' });
assert.deepEqual(metadataRows[0], ['Scenario ID', 'Comparison Mode', 'Provenance JSON', 'Notes JSON']);
assert.equal(metadataRows.length, 103);
const scenarios = rows.slice(1).map((row, index) => {
  assert.equal(row.length, 4, `Unexpected columns at workbook row ${index + 2}`);
  const id = `NSF-${String(index + 1).padStart(3, '0')}`;
  const [metadataId, comparisonMode, provenanceJson, notesJson] = metadataRows[index + 1];
  assert.equal(metadataId, id);
  assert.ok(['workbook', 'actual-ui-api'].includes(comparisonMode), `Unknown comparison mode for ${id}`);
  assert.equal(comparisonMode, index < 50 ? 'workbook' : 'actual-ui-api', `Unexpected migration slot mode for ${id}`);
  assert.ok(row.slice(0, 2).every(value => typeof value === 'string' && value.trim()), `Incomplete workbook row ${index + 2}`);
  const request = JSON.parse(row[1]);
  assert.ok(request.applicationInquiryInput, `Missing inquiry input at row ${index + 2}`);
  let expectations = {};
  if (comparisonMode === 'workbook') {
    assert.ok(row[2] && row[3], `Workbook expectations required for ${id}`);
    const expectedResponse = JSON.parse(row[2]);
    assert.ok(Array.isArray(expectedResponse.offers) && expectedResponse.summary && expectedResponse.inquiryId);
    expectations = { expectedResponse, expectedUi: row[3] };
  } else {
    assert.equal(row[2], '', `Stale response baseline for ${id}`);
    assert.equal(row[3], '', `Stale UI baseline for ${id}`);
  }
  return {
    id,
    name: row[0],
    workbookRow: index + 2,
    request,
    ...expectations,
    notes: JSON.parse(notesJson),
    comparisonMode,
    provenance: JSON.parse(provenanceJson)
  };
});
const output = {
  schemaVersion: 2,
  sourceWorkbook: path.relative(root, source),
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
  baselineTenant: 'gri',
  migration: JSON.parse(book.Sheets.Migration.A2.v),
  scenarios
};
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`);
const saved = JSON.parse(fs.readFileSync(destination, 'utf8'));
assert.deepEqual(saved, output);
console.log(`Exported ${scenarios.length} scenarios: 50 workbook baselines, 52 explicit UI/API-only variants to ${path.relative(root, destination)}`);

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'test-data/solution-finder/HELOAN_test_scenarios.xlsx');
const destination = path.join(root, 'test-data/solution-finder/workbook-scenarios/original-scenarios.json');
const sheet = XLSX.readFile(source).Sheets.Sheet1;
assert.ok(sheet, 'Original workbook must contain Sheet1.');
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
assert.deepEqual(rows[0].slice(0, 4), ['Scenario #', 'Scenario', 'Is Subject Property = Primary property?', 'Inquiry Request']);
const starts = rows.flatMap((row, index) => /^\d+$/.test(String(row[0]).trim()) ? [index] : []);
assert.equal(starts.length, 23, 'Expected exactly 23 original scenarios.');
const pick = (object, keys) => Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));
function uiRequest(source) {
  const input = source.applicationInquiryInput;
  const property = input.propertyInputHeloc;
  const basic = input.basicInfoInput;
  return {
    type: source.type,
    applicationInquiryInput: {
      propertyInputHeloc: {
        ...pick(property, ['type', 'requestedLoanAmount']),
        address: pick(property.address, ['street', 'city', 'region', 'postalCode', 'country'])
      },
      basicInfoInput: {
        ...pick(basic, ['name', 'emailId', 'phoneNumber', 'residenceStartDate', 'isAgreed']),
        residenceAddress: pick(basic.residenceAddress, ['street', 'city', 'region', 'postalCode', 'country'])
      },
      basicInfoUpdateInput: input.basicInfoUpdateInput,
      incomeInput: input.incomeInput,
      existingMortgageAmount: input.existingMortgageAmount
    }
  };
}
const scenarios = starts.map((from, index) => {
  const number = Number(rows[from][0]);
  assert.equal(number, index + 1);
  const to = starts[index + 1] ?? rows.length;
  const raw = rows.slice(from, to).map(row => String(row[3])).filter(value => value.trim()).join('\n').trim();
  const notes = [];
  let sourceRequest = null;
  if (!raw || raw === 'N/A') notes.push('The original workbook has no Inquiry Request (N/A). Supply QA input manually; no borrower or DOB has been invented.');
  else {
    const csvQuoted = raw.startsWith('"') && raw.endsWith('"');
    sourceRequest = JSON.parse(csvQuoted ? raw.slice(1, -1).replace(/""/g, '"') : raw);
    if (csvQuoted) notes.push('Decoded CSV-style quote escaping in the original request cell.');
    notes.push('Prepared the original business inputs for the current browser form. Legacy LO/application routing, IP address and address-display/completeness metadata are not injected; selected tenant UI controls them. The original source JSON is shown separately.');
  }
  return {
    id: `SF-${number}-Original`, name: String(rows[from][1]).trim(),
    workbookRow: from + 1, sourceRequest,
    request: sourceRequest ? uiRequest(sourceRequest) : null, notes
  };
});
const output = {
  schemaVersion: 1, sourceWorkbook: path.relative(root, source),
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
  scenarios
};
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log(`Exported ${scenarios.length} original lab cases; ${scenarios.filter(item => item.request).length} have source requests. Source workbook unchanged.`);

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const XLSX = require('xlsx');
const { spawnSync } = require('node:child_process');
const { normalizeWorkbook, SOURCE, INPUT, OUTPUT, PRODUCTS } = require('../../../../../scripts/solution-finder/import-ir-profile-reference.cjs');
const root = path.resolve(__dirname, '../../../../..');
const bytes = fs.readFileSync(path.join(root, SOURCE));
const hash = createHash('sha256').update(bytes).digest('hex');
const normalized = JSON.parse(fs.readFileSync(path.join(root, INPUT), 'utf8'));
const book = () => XLSX.read(bytes, { type: 'buffer' });
function mutate(sheetName, column, value, row = 1) {
  const workbook = book(), sheet = workbook.Sheets[sheetName];
  const columns = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
  sheet[XLSX.utils.encode_cell({ r: row, c: columns.indexOf(column) })] = {
    t: typeof value === 'number' ? 'n' : 's', v: value
  };
  return workbook;
}
const parse = (w = book(), inputs = normalized) => normalizeWorkbook(w, inputs, hash);
test('all40 canonical references and120 exact chart offers, no private fields', () => {
  const data = parse();
  assert.equal(data.profiles.length, 40);
  assert.deepEqual(data.profiles.map(p => p.profileId), normalized.profiles.map(p => p.id));
  assert.equal(data.profiles.flatMap(p => p.offers).length, 120);
  assert.equal(data.sourceSha256, hash);
  assert.equal(data.observedOn, '2026-11-02');
  for (const p of data.profiles) {
    assert.deepEqual(Object.keys(p).sort(), ['profileId', 'lastFourSSN', 'expectedFico', 'returnedFico', 'creditReturned', 'eligibleProducts', 'offers'].sort());
    assert.match(p.lastFourSSN, /^\d{4}$/);
    assert.deepEqual([...p.offers.map(o => o.product)].sort(), [...PRODUCTS].sort());
    for (const offer of p.offers) assert.deepEqual(Object.keys(offer).sort(),
      ['product', 'status', 'applicationType', 'loanAmount', 'rate', 'apr', 'term', 'monthlyPayment', 'reasons'].sort());
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, OUTPUT), 'utf8')), data);
});
test('TB-007 has no usable credit; TB-026 preserves two waiting states', () => {
  const data = parse();
  const noCredit = data.profiles.find(p => p.profileId === 'TB-007');
  assert.equal(noCredit.creditReturned, false);
  assert.ok(Object.values(noCredit.returnedFico).every(v => v === null || v < 300 || v > 850));
  assert.deepEqual(noCredit.eligibleProducts, []);
  const waiting = data.profiles.find(p => p.profileId === 'TB-026');
  assert.equal(waiting.offers.filter(o => o.status === 'Pending' && o.reasons.includes('WAITING_FOR_INITIAL_OFFERS')).length, 2);
});
test('source expected scores remain distinct from actual returned scores', () => {
  const data = parse();
  assert.ok(data.profiles.some(p => JSON.stringify(p.expectedFico) !== JSON.stringify(p.returnedFico)));
  for (const p of data.profiles) assert.deepEqual(p.expectedFico, normalized.profiles.find(n => n.id === p.profileId).bureau);
});
test('row ordering is not a join or offer expectation', () => {
  const workbook = book();
  for (const name of ['Profile Results', 'Offer Details']) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null });
    workbook.Sheets[name] = XLSX.utils.aoa_to_sheet([rows[0], ...rows.slice(1).reverse()]);
  }
  const data = parse(workbook), original = parse();
  for (const p of data.profiles) {
    const expected = original.profiles.find(v => v.profileId === p.profileId);
    assert.deepEqual({ ...p, offers: [...p.offers].sort((a, b) => a.product.localeCompare(b.product)) },
      { ...expected, offers: [...expected.offers].sort((a, b) => a.product.localeCompare(b.product)) });
  }
});
test('numeric zero is not null for returned scores or pricing', () => {
  const workbook = mutate('Profile Results', 'Returned EFX', 0);
  let data = parse(workbook);
  const id = XLSX.utils.sheet_to_json(workbook.Sheets['Profile Results'])[0].Profile;
  assert.equal(data.profiles.find(p => p.profileId === id).returnedFico.EFX, 0);
  data = parse(mutate('Offer Details', 'Rate', 0));
  const detail = XLSX.utils.sheet_to_json(book().Sheets['Offer Details'])[0];
  assert.equal(data.profiles.find(p => p.profileId === detail.Profile).offers.find(o => o.product === detail.Product).rate, 0);
});
for (const [label, sheet, column, value, message] of [
  ['duplicate profile', 'Profile Results', 'Profile', 'TB-001', 'profile IDs/duplicates'],
  ['unknown profile', 'Profile Results', 'Profile', 'TB-999', 'profile IDs/duplicates'],
  ['name mismatch', 'Profile Results', 'First', 'PRIVATE_SENTINEL', 'identity join'],
  ['last-four mismatch', 'Profile Results', 'SSN', '123456789', 'last-four join'],
  ['source score mismatch', 'Profile Results', 'TU', 999, 'normalized source score'],
  ['invalid score', 'Profile Results', 'Returned TU', 'PRIVATE_SENTINEL', 'returned score'],
  ['credit flag conflict', 'Profile Results', 'Credit score returned (Y/N)', 'N', 'credit'],
  ['eligible summary conflict', 'Profile Results', 'Offers given (eligible)', 'HELOAN', 'eligible summary conflict'],
  ['decline summary conflict', 'Profile Results', 'Declined / pending products', 'None', 'declined/pending products conflict'],
  ['unknown detail profile', 'Offer Details', 'Profile', 'TB-999', 'offer profile ID'],
  ['unknown product', 'Offer Details', 'Product', 'PRIVATE_SENTINEL', 'product'],
  ['unknown status', 'Offer Details', 'Status', 'PRIVATE_SENTINEL', 'status'],
  ['unknown application type', 'Offer Details', 'Application type', 'PRIVATE_SENTINEL', 'application type'],
  ['unknown reason', 'Offer Details', 'Reasons', 'PRIVATE_SENTINEL', 'reasons'],
  ['invalid pricing', 'Offer Details', 'Rate', -1, 'rate'],
  ['detail credit conflict', 'Offer Details', 'Credit score returned (Y/N)', 'N', 'detail credit flag'],
  ['detail inquiry conflict', 'Offer Details', 'Inquiry ID', 'PRIVATE_SENTINEL', 'detail inquiry join']
]) test(`rejects ${label} without raw private values`, () => {
  assert.throws(() => parse(mutate(sheet, column, value)), error => {
    assert.match(error.message, new RegExp(message));
    assert.ok(!error.message.includes('PRIVATE_SENTINEL'));
    assert.ok(!error.message.includes('123456789'));
    return true;
  });
});
test('missing rows, missing sheets, duplicate/missing normalized IDs fail', () => {
  const workbook = book();
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Offer Details'], { header: 1 });
  workbook.Sheets['Offer Details'] = XLSX.utils.aoa_to_sheet(rows.slice(0, -1));
  assert.throws(() => parse(workbook), /layout\/count/);
  const missing = book(); missing.SheetNames.pop();
  assert.throws(() => parse(missing), /sheets/);
  const input = structuredClone(normalized);
  input.profiles[0].id = input.profiles[1].id;
  assert.throws(() => parse(book(), input), /normalized IDs/);
});
test('duplicate product, mismatched pending reason and all unusable scores fail', () => {
  const first = XLSX.utils.sheet_to_json(book().Sheets['Offer Details'])[0];
  const rows = XLSX.utils.sheet_to_json(book().Sheets['Offer Details']);
  const duplicateIndex = rows.findIndex((r, i) => i > 0 && r.Profile === first.Profile) + 1;
  assert.throws(() => parse(mutate('Offer Details', 'Product', first.Product, duplicateIndex)), /offer count\/duplicates/);
  const pendingIndex = rows.findIndex(r => r.Status === 'Pending') + 1;
  assert.throws(() => parse(mutate('Offer Details', 'Reasons', '', pendingIndex)), /details conflict/);
  const workbook = book(), sheet = workbook.Sheets['Profile Results'];
  const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
  for (const col of ['Returned TU', 'Returned XPN', 'Returned EFX']) {
    sheet[XLSX.utils.encode_cell({ r: 1, c: headers.indexOf(col) })] = { t: 'n', v: 0 };
  }
  assert.throws(() => parse(workbook), /usable credit conflict/);
});
test('runtime validates schema, joins, expected scores, and attaches references ONLY to new40', () => {
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', `
    const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
    const { isDeepStrictEqual } = require('node:util');
    const reference = require('./${OUTPUT}'), input = require('./${INPUT}');
    const catalogPath = require.resolve('./scripts/solution-finder/lab/catalog');
    const read = fs.readFileSync;
    let injected = reference;
    fs.readFileSync = function(file, ...args) {
      if (String(file).endsWith('.xlsx')) throw new Error('Runtime tried reading local raw workbook');
      if (path.basename(String(file)) === 'profile-reference.json') return JSON.stringify(injected);
      return read.call(this, file, ...args);
    };
    const load = () => { delete require.cache[catalogPath]; return require(catalogPath); };
    const cases = load().getLabCases();
    assert.equal(cases.length, 165);
    assert.equal(cases.filter(c => Object.hasOwn(c, 'profileReference')).length, 40);
    for (const c of cases.filter(c => c.id.startsWith('TB-'))) {
      const source = input.profiles.find(p => p.id === c.id);
      assert.ok(isDeepStrictEqual(c.request, source.request), 'Normalized request changed (values suppressed)');
      assert.ok(c.name === ['first','middle','last','suffix'].map(k => source.request.applicationInquiryInput.basicInfoInput.name[k]).filter(Boolean).join(' '), 'Normalized name changed (values suppressed)');
      assert.deepEqual(c.profileReference.expectedFico, source.bureau);
      for (const key of ['sourceWorkbook','sourceSha256','observedOn','context']) assert.equal(c.profileReference[key], reference[key]);
    }
    const changes = [
      r => r.profiles.pop(),
      r => r.profiles[0].profileId = r.profiles[1].profileId,
      r => r.profiles[0].profileId = 'TB-999',
      r => r.profiles[0].lastFourSSN = 'PRIVATE_SENTINEL',
      r => r.profiles[0].lastFourSSN = '9999',
      r => r.profiles[0].expectedFico.TU = 0,
      r => r.profiles[0].returnedFico.TU = -1,
      r => r.profiles[0].offers[0].status = 'PRIVATE_SENTINEL',
      r => r.profiles[0].offers[0].offerId = 'PRIVATE_SENTINEL',
      r => r.profiles[0].eligibleProducts = [],
      r => r.sourceWorkbook = 'PRIVATE_SENTINEL',
      r => r.sourceSha256 = 'invalid',
      r => r.schemaVersion = 2,
      r => r.profiles[0].creditReturned = !r.profiles[0].creditReturned
    ];
    for (const change of changes) {
      injected = structuredClone(reference); change(injected);
      assert.throws(load, e => /Invalid IR profile reference/.test(e.message) && !e.message.includes('PRIVATE_SENTINEL'));
    }
    console.log('runtime contract and 14 corruption guards passed');
  `], { cwd: root, env: { ...process.env, SF_LAB_PORTABLE: '0', SF_LAB_CATALOG: 'internal165' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /14 corruption guards passed/);
});
for (const mode of ['synthetic5', 'original125']) test(`${mode} never reads profile or reference datasets`, () => {
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', `
    const fs = require('node:fs'), read = fs.readFileSync, path = require('node:path');
    fs.readFileSync = function(file, ...args) {
      if (['profiles.json','profile-reference.json'].includes(path.basename(String(file))) || String(file).endsWith('.xlsx')) throw new Error('Forbidden private input read');
      return read.call(this, file, ...args);
    };
    const cases = require('./scripts/solution-finder/lab/catalog').getLabCases();
    if (cases.length !== ${mode === 'synthetic5' ? 5 : 125} || cases.some(c => Object.hasOwn(c,'profileReference'))) throw new Error('Catalog isolation failed');
    console.log('isolated');
  `], { cwd: root, env: { ...process.env, SF_LAB_PORTABLE: mode === 'synthetic5' ? '1' : '0', SF_LAB_CATALOG: mode }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /isolated/);
});

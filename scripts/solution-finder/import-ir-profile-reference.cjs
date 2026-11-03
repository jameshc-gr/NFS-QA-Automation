'use strict';
// The full chart is local input only. Never log rows or copy identity/offer IDs.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const XLSX = require('xlsx');
const { digits } = require('./tri-bureau-40.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = 'test-data/solution-finder/IR_profile-offer-table.xlsx';
const INPUT = 'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profiles.json';
const OUTPUT = 'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profile-reference.json';
const CONTEXT = 'Prior GRI QA screening; secondary occupancy, 50k request/70k mortgage/250k income, DOB1980 assumed; editing inputs/tenant may change outcomes. Reference only, not current results/eligibility approval.';
const PRODUCTS = ['HELOAN', 'FIXED_RATE_HELOC', 'VARIABLE_RATE_HELOC'];
const STATUSES = ['Eligible', 'Declined', 'Pending', 'Unclassified'];
const REASONS = [
  'Representative Credit Score < 660', 'NEAR_PRIME_OCCUPANCY_STATUS',
  'Your credit score is below our minimum requirement',
  'No credit profile match found; cannot generate offers without manual intervention/resubmission.',
  'Income Verification Type is not Investor - DSCR, And DTI Ratio = 0',
  'WAITING_FOR_INITIAL_OFFERS', 'TU Soft pull was not successful',
  'Credit utilization is above the threshold for which we extend credit'
];
const PROFILE_COLUMNS = ['Profile', 'First', 'Middle', 'Last', 'Street', 'City', 'State', 'Zip', 'SSN',
  'TU', 'XPN', 'EFX', 'Credit score returned (Y/N)', 'Returned TU', 'Returned XPN', 'Returned EFX',
  'Offers given (eligible)', 'Declined / pending products', 'Inquiry ID'];
const OFFER_COLUMNS = ['Profile', 'Credit score returned (Y/N)', 'Product', 'Status', 'Application type',
  'Loan amount', 'Rate', 'APR', 'Term (years)', 'Monthly payment', 'Reasons', 'Offer ID', 'Inquiry ID'];
const IDS = Array.from({ length: 40 }, (_, i) => `TB-${String(i + 1).padStart(3, '0')}`);
const fail = (id, field) => { throw new Error(`IR reference validation failed: ${IDS.includes(id) ? id : 'source'} ${field} (values suppressed).`); };
const text = value => String(value ?? '').trim();
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length &&
  [...a].sort().every((value, i) => value === [...b].sort()[i]);
function number(value, id, field, score = false) {
  if (value == null || ['', 'N/A', 'Not returned'].includes(text(value))) return null;
  if (!/^\d+(?:\.\d+)?$/.test(text(value))) fail(id, field);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (score && (!Number.isInteger(parsed) || parsed > 999))) fail(id, field);
  return parsed;
}
function reasons(value, id) {
  const raw = text(value);
  if (!raw) return [];
  // A known reason itself contains a semicolon; tokenize on "; " only after
  // protecting that entire sentence.
  const sentence = REASONS[3];
  const result = raw.replaceAll(sentence, '\u0001').split('; ').map(v => v === '\u0001' ? sentence : v);
  if (!result.every(v => REASONS.includes(v)) || new Set(result).size !== result.length) fail(id, 'reasons');
  return result;
}
function readRows(workbook, name, columns, count) {
  const sheet = workbook.Sheets[name];
  if (!sheet) fail(null, 'sheet');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  if (rows.length !== count + 1 || JSON.stringify(rows[0]) !== JSON.stringify(columns)) fail(null, 'layout/count');
  return rows.slice(1).map(row => Object.fromEntries(columns.map((key, i) => [key, row[i]])));
}
function normalizeWorkbook(workbook, normalized, sourceSha256) {
  if (!sameSet(workbook.SheetNames, ['Profile Results', 'Offer Details', 'Read Me'])) fail(null, 'sheets');
  const rows = readRows(workbook, 'Profile Results', PROFILE_COLUMNS, 40);
  const details = readRows(workbook, 'Offer Details', OFFER_COLUMNS, 120);
  const inputs = new Map((normalized.profiles ?? []).map(p => [p.id, p]));
  if (normalized.profiles?.length !== 40 || !sameSet([...inputs.keys()], IDS)) fail(null, 'normalized IDs');
  if (!sameSet(rows.map(row => row.Profile), IDS)) fail(null, 'profile IDs/duplicates');
  if (rows.some(row => !text(row['Inquiry ID'])) ||
    new Set(rows.map(row => text(row['Inquiry ID']))).size !== 40) fail(null, 'inquiry join');
  const byId = new Map(rows.map(row => [row.Profile, row]));
  const offersById = new Map(IDS.map(id => [id, []]));
  for (const row of details) {
    const id = row.Profile;
    if (!inputs.has(id)) fail(null, 'offer profile ID');
    if (text(row['Inquiry ID']) !== text(byId.get(id)['Inquiry ID'])) fail(id, 'detail inquiry join');
    if (!PRODUCTS.includes(row.Product)) fail(id, 'product');
    if (!STATUSES.includes(row.Status)) fail(id, 'status');
    if (row['Credit score returned (Y/N)'] !== byId.get(id)['Credit score returned (Y/N)']) fail(id, 'detail credit flag');
    const applicationType = ['', 'Not returned'].includes(text(row['Application type'])) ? null : row['Application type'];
    if (applicationType !== null && !['HELOAN', 'FIGURE_HELOC'].includes(applicationType)) fail(id, 'application type');
    const offer = { product: row.Product, status: row.Status, applicationType };
    for (const [key, column] of Object.entries({
      loanAmount: 'Loan amount', rate: 'Rate', apr: 'APR', term: 'Term (years)', monthlyPayment: 'Monthly payment'
    })) offer[key] = number(row[column], id, key);
    offer.reasons = reasons(row.Reasons, id);
    offersById.get(id).push(offer);
  }
  const profiles = IDS.map(id => {
    const row = byId.get(id), input = inputs.get(id), a = input.request?.applicationInquiryInput;
    if (!a) fail(id, 'normalized input');
    for (const [column, key] of [['First', 'first'], ['Middle', 'middle'], ['Last', 'last']]) {
      if (text(row[column]) !== text(a.basicInfoInput.name[key])) fail(id, 'identity join');
    }
    let lastFourSSN;
    try { lastFourSSN = digits(row.SSN, 9).slice(-4); } catch { fail(id, 'SSN format'); }
    if (lastFourSSN !== a.basicInfoUpdateInput.lastFourSSN) fail(id, 'last-four join');
    const expectedFico = {}, returnedFico = {};
    for (const bureau of ['TU', 'XPN', 'EFX']) {
      expectedFico[bureau] = number(row[bureau], id, 'source score', true);
      returnedFico[bureau] = number(row[`Returned ${bureau}`], id, 'returned score', true);
      if (expectedFico[bureau] !== input.bureau?.[bureau]) fail(id, 'normalized source score');
    }
    const flag = row['Credit score returned (Y/N)'];
    if (!['Y', 'N'].includes(flag)) fail(id, 'credit flag');
    const creditReturned = flag === 'Y';
    if (creditReturned !== Object.values(returnedFico).some(v => v !== null && v >= 300 && v <= 850)) fail(id, 'usable credit conflict');
    const offers = offersById.get(id);
    if (!sameSet(offers.map(o => o.product), PRODUCTS)) fail(id, 'offer count/duplicates');
    const eligibleProducts = text(row['Offers given (eligible)']) === 'None' ? [] : text(row['Offers given (eligible)']).split('; ');
    if (!sameSet(eligibleProducts, offers.filter(o => o.status === 'Eligible').map(o => o.product))) fail(id, 'eligible summary conflict');
    const summary = text(row['Declined / pending products']) === 'None' ? [] :
      text(row['Declined / pending products']).split(/\r?\n/).map(line => {
        const match = /^([A-Z_]+) \[([A-Za-z]+)\]: (.*)$/.exec(line);
        if (!match || !PRODUCTS.includes(match[1]) || !STATUSES.includes(match[2]) || match[2] === 'Eligible') fail(id, 'declined/pending summary');
        return { product: match[1], status: match[2], reasons: reasons(match[3], id) };
      });
    const nonEligible = offers.filter(o => o.status !== 'Eligible');
    if (!sameSet(summary.map(o => o.product), nonEligible.map(o => o.product))) fail(id, 'declined/pending products conflict');
    for (const item of summary) {
      const offer = nonEligible.find(o => o.product === item.product);
      if (offer.status !== item.status || !sameSet(offer.reasons, item.reasons)) fail(id, 'declined/pending details conflict');
    }
    return { profileId: id, lastFourSSN, expectedFico, returnedFico, creditReturned, eligibleProducts, offers };
  });
  return { schemaVersion: 1, sourceWorkbook: SOURCE, sourceSha256, observedOn: '2026-11-02', context: CONTEXT, profiles };
}
function importReference() {
  const bytes = fs.readFileSync(path.join(ROOT, SOURCE));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const fixture = normalizeWorkbook(XLSX.read(bytes, { type: 'buffer' }),
    JSON.parse(fs.readFileSync(path.join(ROOT, INPUT), 'utf8')), sha256);
  fs.writeFileSync(path.join(ROOT, OUTPUT), JSON.stringify(fixture, null, 2) + '\n');
  return fixture;
}
module.exports = { normalizeWorkbook, importReference, SOURCE, INPUT, OUTPUT, CONTEXT, PRODUCTS, STATUSES, REASONS };
if (require.main === module) {
  try {
    const fixture = importReference();
    console.log(`Imported ${fixture.profiles.length} sanitized IR references; ${fixture.profiles.reduce((n, p) => n + p.offers.length, 0)} offers. Private values suppressed.`);
  } catch (error) {
    console.error(error.message.startsWith('IR reference validation failed:')
      ? error.message : 'IR reference import failed (private values suppressed). Check local source availability/layout.');
    process.exitCode = 1;
  }
}

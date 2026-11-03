// Bounded, offline source migration. Never submits inquiries or imports full SSNs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const XLSX = require('xlsx');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const input = path.join(root, 'test-data/solution-finder');
const archive = path.join(root, 'test-results/2026-11-02/solution-finder/workbook-scenarios/profile-migration');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fileHash = file => hash(fs.readFileSync(file));
const oldWorkbook = path.join(input, 'HELOAN_102_scenarios_with_Fannie_Mae_personas.xlsx');
const newWorkbook = path.join(input, 'HELOAN_102_scenarios_with_Tri_Bureau_IR_profiles.xlsx');
const scenarioFile = path.join(input, 'workbook-scenarios/scenarios.json');
assert.ok(fs.existsSync(oldWorkbook), 'Migration requires the old active workbook; already migrated or missing.');
const resume = process.argv.includes('--resume');
assert.ok(resume || !fs.existsSync(newWorkbook), 'Refuse to overwrite an existing migrated workbook.');
const old = JSON.parse(fs.readFileSync(resume ? path.join(archive, 'scenarios.json') : scenarioFile));
const profilesFile = path.join(input, 'workbook-scenarios/tri-bureau-40/profiles.json');
const profiles = JSON.parse(fs.readFileSync(profilesFile));
assert.equal(profiles.profiles.length, 40);
assert.equal(fileHash(path.join(root, profiles.sourceWorkbook)), profiles.sourceSha256);
const originalFile = path.join(input, 'workbook-scenarios/original-scenarios.json');
const original = JSON.parse(fs.readFileSync(originalFile));
fs.mkdirSync(archive, { recursive: true });
for (const file of [oldWorkbook, path.join(input, 'fannie-mae-personas.json'), scenarioFile]) {
  if (resume && file === scenarioFile) continue;
  const target = path.join(archive, path.basename(file));
  if (fs.existsSync(target)) assert.equal(fileHash(target), fileHash(file), 'Archive collision');
  else fs.copyFileSync(file, target);
}
const migration = {
  date: '2026-11-02',
  mappingRule: 'NSF-063..102 -> TB-001..040; NSF-051..062 -> TB-001..012 (repeat first twelve, preserving financial variants).',
  sourceWorkbook: profiles.sourceWorkbook, sourceSha256: profiles.sourceSha256,
  normalizedProfiles: path.relative(root, profilesFile), normalizedProfilesSha256: fileHash(profilesFile),
  observationSummary: 'test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/summary.json',
  observationSummarySha256: fileHash(path.join(root, 'test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/summary.json')),
  observationsAreVariantBaselines: false,
  preservedFirst50Sha256: hash(JSON.stringify(old.scenarios.slice(0, 50))),
  original23JsonSha256: fileHash(originalFile),
  original23WorkbookSha256: fileHash(path.join(root, original.sourceWorkbook)),
  archive: path.relative(root, archive)
};
const scenarios = old.scenarios.map((s, index) => {
  if (index < 50) return { ...s, comparisonMode: 'workbook', provenance: { kind: 'unchanged-workbook' } };
  const p = profiles.profiles[index < 62 ? index - 50 : index - 62];
  const request = structuredClone(s.request);
  const a = request.applicationInquiryInput;
  const ir = p.request.applicationInquiryInput;
  a.basicInfoInput.name = structuredClone(ir.basicInfoInput.name);
  a.basicInfoInput.residenceAddress = structuredClone(ir.basicInfoInput.residenceAddress);
  a.basicInfoInput.emailId = ir.basicInfoInput.emailId;
  a.basicInfoInput.phoneNumber = ir.basicInfoInput.phoneNumber;
  a.basicInfoUpdateInput.lastFourSSN = ir.basicInfoUpdateInput.lastFourSSN;
  // DOB and residence-start remain the existing scenario's synthetic calendar intent.
  const subjectChanged = a.propertyInputHeloc.type === 'PRIMARY';
  if (subjectChanged) a.propertyInputHeloc.address = structuredClone(ir.basicInfoInput.residenceAddress);
  let variation = s.name;
  if (index < 56) variation = `${a.propertyInputHeloc.type.toLowerCase()} control variant ${index % 2 ? 'B' : 'A'}${subjectChanged ? ' (IR subject replaces prior property)' : ''}`;
  else if (index >= 59 && index < 85) variation = 'single-borrower financial variant';
  else if (index >= 92 && index < 100) variation = `${a.propertyInputHeloc.type.toLowerCase()} mortgage/loan amount probe ${index - (index < 96 ? 92 : 96) + 1} (prior CLTV threshold unverified)`;
  const provenance = {
    kind: 'tri-bureau-ir', profileId: p.id, profileWorkbookRow: p.workbookRow,
    baselineStatus: 'pending-approved-variant-baseline',
    dob: { value: a.basicInfoUpdateInput.dateOfBirth, source: 'preserved-synthetic-scenario-intent', certifiedByIrWorkbook: false },
    subjectPropertyChanged: subjectChanged,
    preservedFields: ['occupancy', 'requestedLoanAmount', 'existingMortgageAmount', 'incomeInput', 'dateOfBirth', 'residenceStartDate'],
    contactSource: 'normalized-profile-QA-contact-not-IR-workbook',
    identitySource: 'IR-workbook-name-residence-last-four',
    priorCreditAndFinancialExpectationsInvalidated: true
  };
  return {
    id: s.id, name: `${p.id}: ${variation}`, workbookRow: s.workbookRow, request,
    notes: [
      `Tri-Bureau IR ${p.id}; last-four-only identity mapping. All 40 profiles included regardless of screening outcome.`,
      'No approved baseline for this financial variant. Prior identity scores, freezes, credit events, offers and UI expectations invalidated; screening responses are not copied.',
      `DOB ${a.basicInfoUpdateInput.dateOfBirth} is preserved synthetic scenario intent, NOT supplied or certified by the IR workbook. Residence start is also synthetic; contact uses normalized QA values.`,
      subjectChanged ? 'PRIMARY requires subject/residence equality: subject changed to IR residence. Prior property/AVM/CLTV baselines are invalid.' : 'Subject property and financial inputs retained. Identity/residence changes invalidate prior credit, DTI, eligibility and pricing baselines.',
      'Financial amounts remain sensitivity probes, not verified score/freeze/DTI/CLTV thresholds. Full browser checkpoints and actual UI/API comparison remain required.'
    ],
    comparisonMode: 'actual-ui-api', provenance
  };
});
const book = XLSX.readFile(oldWorkbook, { cellComments: true });
const sheet = book.Sheets.Sheet1;
for (const [index, s] of scenarios.entries()) {
  if (index < 50) continue;
  const row = index + 2;
  for (const [col, value] of [['A', s.name], ['B', JSON.stringify(s.request)], ['C', ''], ['D', '']]) {
    sheet[`${col}${row}`] = { t: 's', v: value };
  }
  sheet[`A${row}`].c = [{ a: 'QA migration', t: s.notes.join('\n') }];
}
delete book.Sheets.Personas;
book.SheetNames = ['Sheet1'];
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
  ['Scenario ID', 'Comparison Mode', 'Provenance JSON', 'Notes JSON'],
  ...scenarios.map(s => [s.id, s.comparisonMode, JSON.stringify(s.provenance), JSON.stringify(s.notes)])
]), 'Comparison Metadata');
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
  ['Last-four-only IR profiles; source bureau scores are NOT variant baselines', 'Profile JSON'],
  ...profiles.profiles.map(p => [p.id, JSON.stringify({
    id: p.id, workbookRow: p.workbookRow, name: p.request.applicationInquiryInput.basicInfoInput.name,
    residence: p.request.applicationInquiryInput.basicInfoInput.residenceAddress,
    lastFourSSN: p.request.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN,
    contact: { email: p.request.applicationInquiryInput.basicInfoInput.emailId, phone: p.request.applicationInquiryInput.basicInfoInput.phoneNumber, synthetic: true },
    sourceBureauScoresNotBaseline: p.bureau
  })])
]), 'IR Profiles Last Four');
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Migration JSON'], [JSON.stringify(migration)]]), 'Migration');
XLSX.writeFile(book, newWorkbook);
execFileSync(process.execPath, [path.join(root, 'scripts/export-new-solution-finder.cjs')], { stdio: 'inherit' });
const exported = JSON.parse(fs.readFileSync(scenarioFile));
assert.ok(JSON.stringify(exported.scenarios) === JSON.stringify(scenarios), 'Round-trip scenarios mismatch (records suppressed).');
assert.equal(exported.sourceSha256, fileHash(newWorkbook));
assert.equal(fileHash(originalFile), migration.original23JsonSha256);
assert.equal(fileHash(profilesFile), migration.normalizedProfilesSha256);
assert.equal(fileHash(path.join(root, profiles.sourceWorkbook)), profiles.sourceSha256);
fs.unlinkSync(oldWorkbook);
fs.unlinkSync(path.join(input, 'fannie-mae-personas.json'));
console.log('Migrated exactly 52 slots; all 40 IR IDs represented; preserved 50 baselines and original23. Historical assets archived; no submissions.');

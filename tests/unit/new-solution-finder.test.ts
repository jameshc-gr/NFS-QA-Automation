import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { scenarios as allScenarios, workbookScenarios as scenarios, scenarioSchema, type InquiryResponse, type UiCard } from '../projects/solution-finder/workbook-scenarios/helpers/contracts';
import { resolveScenarioComparison } from '../projects/solution-finder/workbook-scenarios/helpers/scenario';
import {
  compareRun, compareUiToApi, differences, normalizeResponse, normalizeUi, productTitles, qaComments
} from '../projects/solution-finder/workbook-scenarios/helpers/comparison';

function cardsFromExpected(ui: string): UiCard[] {
  const result: UiCard[] = [];
  const titles = new Set<string>(Object.values(productTitles));
  for (const line of ui.split('\n')) {
    if (titles.has(line.trim())) result.push({ title: line.trim(), text: line, testId: 'offline' });
    else if (result.length) result[result.length - 1].text += `\n${line}`;
  }
  return result.map(card => ({ ...card, text: card.text.trim() }));
}

test('all 102 workbook cases have one independently selectable spec and valid regression contracts', () => {
  const folder = resolve(__dirname, '../projects/solution-finder/workbook-scenarios');
  const files = readdirSync(folder).filter(name => /^NSF-\d{3}\.spec\.ts$/.test(name));
  assert.equal(files.length, 102);
  for (const scenario of allScenarios) {
    assert.ok(readFileSync(resolve(folder, `${scenario.id}.spec.ts`), 'utf8').includes(`defineScenario('${scenario.id}')`));
  }
  assert.equal(scenarios.length, 50);
  for (const scenario of scenarios) {
    const comparison = compareRun(scenario.expectedResponse, cardsFromExpected(scenario.expectedUi), scenario.expectedUi, scenario);
    assert.deepEqual(comparison, { apiBaseline: [], uiApi: [], uiBaseline: [] }, scenario.id);
  }
});

test('generated inquiry/offer/application IDs and product ordering do not create failures', () => {
  const original = scenarios[0].expectedResponse;
  const actual = structuredClone(original);
  actual.inquiryId = 'c3954e4c-c7ae-492a-b40c-c6389f710c97';
  actual.offers.reverse();
  for (const offer of actual.offers) { offer.offerId = 'new-offer'; offer.extAppUuid = 'new-external'; offer.internalAppId = 'new-internal'; }
  assert.deepEqual(differences(normalizeResponse(actual), normalizeResponse(original)), []);
  const cards = cardsFromExpected(scenarios[0].expectedUi).reverse();
  assert.deepEqual(compareUiToApi(cards, actual), []);
  const normalized = normalizeUi(scenarios[0].expectedUi);
  assert.deepEqual(normalizeUi(scenarios[0].expectedUi.replace(/TU 804 \| Experian 824/, 'Experian 824 | TU 804')), normalized);
});

test('rates, payment, amount, credit, ratio, eligibility and product changes fail the baseline', () => {
  const baseline = scenarios[0].expectedResponse;
  const changes: ((value: InquiryResponse) => void)[] = [
    value => { value.offers[0].apr = 99; },
    value => { value.offers[0].rate = 8.499; },
    value => { value.offers[0].monthlyPayment = 1; },
    value => { value.offers[0].loanAmount = 1; },
    value => { value.summary.fico.TRANSUNION = 500; },
    value => { value.summary.highestDti = 80; },
    value => { value.offers[0].ineligibleReasons = ['Unexpected decline']; },
    value => { value.offers.pop(); },
    value => { value.offers[0].productType = 'CES'; }
  ];
  for (const change of changes) {
    const actual = structuredClone(baseline);
    change(actual);
    assert.ok(differences(normalizeResponse(actual), normalizeResponse(baseline)).length);
  }
});

test('only APR hundredths/thousandths are ignored; tenths boundaries, missing and invalid APR still fail', () => {
  for (const [actual, expected] of [[8.471, 8.449], [8.499, 8.4], [8.2, 8.299], [11.166, 11.139], [0.099, 0]]) {
    assert.deepEqual(differences({ apr: actual }, { apr: expected }, 'response.offers[0]'), []);
  }
  for (const actual of [8.5, 8.399, 9.449, null, undefined, '8.471', Infinity, -8.449]) {
    assert.equal(differences({ apr: actual }, { apr: 8.449 }, 'response.offers[0]').length, 1);
  }
  assert.equal(differences({ rate: 8.471 }, { rate: 8.449 }, 'response.offers[0]').length, 1);
  assert.equal(differences({ apr: 8.471 }, { apr: 8.449 }, 'unrelated').length, 1);
});

test('APR drift cannot change offer pairing when products are reordered', () => {
  const expected = structuredClone(scenarios[0].expectedResponse);
  expected.offers.forEach((offer, index) => { offer.apr = 8.44 + index * 0.001; });
  const actual = structuredClone(expected);
  actual.offers.reverse().forEach((offer, index) => { offer.apr = 8.47 + index * 0.001; });
  assert.deepEqual(differences(normalizeResponse(actual), normalizeResponse(expected)), []);
});

test('small APR baseline changes pass only when the UI still exactly matches the actual API', () => {
  const scenario = scenarios.find(value => value.id === 'NSF-029');
  assert.ok(scenario);
  const actual = structuredClone(scenario.expectedResponse);
  const offer = actual.offers.find(value => value.productType === 'HELOAN');
  assert.ok(offer);
  assert.equal(offer.apr, 8.449);
  offer.apr = 8.471;
  const ui = scenario.expectedUi.replace(/8\.449%(?=\s+APR\b)/, '8.471%');
  assert.notEqual(ui, scenario.expectedUi);
  const comparison = compareRun(actual, cardsFromExpected(ui), ui, scenario);
  assert.deepEqual(comparison, { apiBaseline: [], uiApi: [], uiBaseline: [] });
  assert.ok(qaComments(scenario, 'gri', actual, comparison).some(value => value.includes('IGNORED APR PRECISION: HELOAN expected 8.449%, actual 8.471%')));
  const mismatchedUi = ui.replace(/8\.471%(?=\s+APR\b)/, '8.472%');
  const mismatch = compareRun(actual, cardsFromExpected(mismatchedUi), mismatchedUi, scenario);
  assert.deepEqual(mismatch.apiBaseline, []);
  assert.deepEqual(mismatch.uiBaseline, []);
  assert.ok(mismatch.uiApi.some(value => value.path === 'ui.HELOAN.apr'));
});

test('AVM source ordering is ignored but changed or unexpected displayed data is not', () => {
  const ui = scenarios[0].expectedUi;
  const pair = ui.match(/(Figure AVM\s+\$648,749)\s+(House Canary\s+\$649,649)/);
  assert.ok(pair);
  const reversed = ui.replace(pair[0], `${pair[2]}\n${pair[1]}`);
  assert.notEqual(reversed, ui);
  assert.deepEqual(normalizeUi(reversed), normalizeUi(ui));
  assert.notDeepEqual(normalizeUi(ui.replace('$648,749', '$648,748')), normalizeUi(ui));
  assert.notDeepEqual(normalizeUi(ui.replace('FICO:', 'FICO:\nEquifax 700 |')), normalizeUi(ui));
});

test('UI product relabeling, missing cards, amounts and decline reasons fail', () => {
  const scenario = scenarios[0];
  const cards = cardsFromExpected(scenario.expectedUi);
  const relabeled = structuredClone(cards);
  relabeled[0].title = 'HELOAN';
  assert.ok(compareUiToApi(relabeled, scenario.expectedResponse).length);
  assert.ok(compareUiToApi(cards.slice(1), scenario.expectedResponse).length);
  const changed = structuredClone(cards);
  changed[0].text = changed[0].text.replace('$75,000', '$74,999');
  assert.ok(compareUiToApi(changed, scenario.expectedResponse).some(diff => diff.path.endsWith('loanAmount')));
  const declined = scenarios.find(value => value.expectedResponse.offers.some(offer => offer.ineligibleReasons?.length));
  assert.ok(declined);
  const declineCards = cardsFromExpected(declined.expectedUi);
  const offer = declined.expectedResponse.offers.find(value => value.ineligibleReasons?.length);
  assert.ok(offer?.ineligibleReasons);
  const card = declineCards.find(value => value.title === productTitles[offer.productType]);
  assert.ok(card);
  card.text = card.text.replace(offer.ineligibleReasons[0], 'Incorrect reason');
  assert.ok(compareUiToApi(declineCards, declined.expectedResponse).some(diff => diff.path.includes('.reason.')));
});

test('an absent product may have only an explicitly inactive no-offer placeholder', () => {
  // Synthetic parser probe, not a baseline for any migrated request.
  const response = structuredClone(scenarios[0].expectedResponse);
  const removed = response.offers.pop();
  assert.ok(removed);
  const cards = cardsFromExpected(scenarios[0].expectedUi);
  const placeholder = cards.find(card => card.title === productTitles[removed.productType]);
  assert.ok(placeholder);
  placeholder.text = `${placeholder.title}\nNo offer was returned for this product.`;
  assert.deepEqual(compareUiToApi(cards, response), []);
  placeholder.text += '\nSend offer to client\nLoan Amount\n$100,000';
  assert.ok(compareUiToApi(cards, response).some(diff => diff.path.endsWith('placeholderAction')));
  assert.ok(compareUiToApi(cards, response).some(diff => diff.path.endsWith('placeholderAmount')));
});

test('missing APR requires Unknown payment even when API contains a payment', () => {
  const response = structuredClone(scenarios[0].expectedResponse);
  const offer = response.offers[0];
  assert.ok(offer.apr != null && offer.monthlyPayment != null);
  const previousApr = offer.apr;
  offer.apr = null;
  const cards = cardsFromExpected(scenarios[0].expectedUi);
  const card = cards.find(value => value.title === productTitles[offer.productType]);
  assert.ok(card);
  card.text = card.text.replace(new RegExp(`${previousApr.toFixed(3).replace('.', '\\.')}%\\s+APR`), 'Unknown\nAPR')
    .replace(/Monthly payment\s+[^\n]+/, 'Monthly payment\nUnknown');
  assert.deepEqual(compareUiToApi(cards, response), []);
  card.text = card.text.replace(/Monthly payment\s+Unknown/, 'Monthly payment\n$123.45');
  assert.ok(compareUiToApi(cards, response).some(diff => diff.path.endsWith('monthlyPayment')));
});

test('QA comments disclose source-profile, tenant, DTI and execution limitations', () => {
  assert.ok(qaComments(scenarios[0], 'owning', scenarios[0].expectedResponse).some(value => value.includes('no independently approved baseline')));
  assert.ok(qaComments(scenarios[0], 'gri', undefined, undefined, 'HTTP 500').some(value => value.includes('HTTP 500')));
  const dti = structuredClone(scenarios[0].expectedResponse);
  dti.summary.highestDti = 55;
  assert.ok(qaComments(scenarios[0], 'gri', dti).some(value => value.includes('violation is not confirmed')));
});

test('comparison modes reject malformed baselines, unknown modes, conflicts and stale IR expectations before browser flow', () => {
  const baseline = scenarios[0];
  const ir = allScenarios[50];
  assert.ok(ir.comparisonMode === 'actual-ui-api');
  assert.equal(resolveScenarioComparison(baseline).compareWorkbook, true);
  assert.equal(resolveScenarioComparison(ir).compareWorkbook, false);
  assert.equal(resolveScenarioComparison(ir, false).workbookScenario, undefined);
  for (const invalid of [
    { ...baseline, expectedResponse: undefined },
    { ...baseline, expectedResponse: {} },
    { ...baseline, expectedUi: '' },
    { ...baseline, comparisonMode: 'unknown' },
    { ...ir, expectedResponse: baseline.expectedResponse },
    { ...ir, provenance: undefined },
    { ...ir, provenance: { ...ir.provenance, profileId: 'TB-040' } },
    { ...ir, provenance: { ...ir.provenance, profileWorkbookRow: 99 } },
    { ...ir, provenance: { ...ir.provenance, dob: { ...ir.provenance.dob, value: '1970-01-01' } } },
    { ...ir, provenance: { ...ir.provenance, subjectPropertyChanged: !ir.provenance.subjectPropertyChanged } },
    { ...ir, comparisonMode: undefined }
  ]) {
    assert.equal(scenarioSchema.safeParse(invalid).success, false);
    assert.throws(() => resolveScenarioComparison(invalid as never));
  }
  assert.throws(() => resolveScenarioComparison(baseline, false), /conflicts/);
  assert.throws(() => resolveScenarioComparison(ir, true), /conflicts/);
  const legacy = { ...baseline };
  delete (legacy as Partial<typeof legacy>).comparisonMode;
  delete (legacy as Partial<typeof legacy>).provenance;
  assert.equal(scenarioSchema.parse(legacy).comparisonMode, 'workbook');
  assert.equal(resolveScenarioComparison(legacy).compareWorkbook, true);
  const runner = readFileSync(resolve(__dirname, '../projects/solution-finder/workbook-scenarios/helpers/scenario.ts'), 'utf8');
  assert.ok(runner.includes("compareWorkbook: scenario.comparisonMode === 'workbook'"));
  for (const checkpoint of ['assertSubmittedInput', "basicInfoUpdateInput).toEqual", "Submit", 'compareUiToApi(cards, response)', "page.screenshot", 'if (failure) throw failure']) {
    assert.ok(runner.includes(checkpoint), checkpoint);
  }
});

test('IR migration has exact mapping, preserved source identities and financial intent, 50 unchanged baselines and round-trip SHA', t => {
  const root = resolve(__dirname, '../..');
  const read = (file: string) => readFileSync(resolve(root, file));
  const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
  const fixturePath = 'test-data/solution-finder/workbook-scenarios/scenarios.json';
  const data = JSON.parse(read(fixturePath).toString());
  const migration = data.migration;
  const profiles = JSON.parse(read(migration.normalizedProfiles).toString());
  const XLSX = require('xlsx');
  if (existsSync(resolve(root, migration.sourceWorkbook))) {
   const irBook = XLSX.read(read(migration.sourceWorkbook), { type: 'buffer' });
   const irRows = XLSX.utils.sheet_to_json(irBook.Sheets.Sheet1, { header: 1, raw: false, defval: '' });
   for (const [i, profile] of profiles.profiles.entries()) {
    const source = irRows[i + 1];
    const a = profile.request.applicationInquiryInput;
    assert.ok(JSON.stringify(a.basicInfoInput.name) === JSON.stringify({ first: source[0], middle: source[1], last: source[2], suffix: '' }), profile.id);
    assert.ok(JSON.stringify(a.basicInfoInput.residenceAddress) === JSON.stringify({
      street: [source[3]], city: source[4], region: source[5], postalCode: String(source[6]).padStart(5, '0'), country: 'US'
    }), profile.id);
    assert.ok(a.basicInfoUpdateInput.lastFourSSN === String(source[7]).replace(/[ -]/g, '').padStart(9, '0').slice(-4), profile.id);
   }
   assert.equal(hash(read(migration.sourceWorkbook)), migration.sourceSha256);
  } else t.diagnostic('Restricted IR source workbook not installed; normalized profile/migration checks still run.');
  const original = JSON.parse(read('test-data/solution-finder/workbook-scenarios/original-scenarios.json').toString());
  assert.equal(hash(read(migration.normalizedProfiles)), migration.normalizedProfilesSha256);
  if (existsSync(resolve(root, migration.observationSummary))) assert.equal(hash(read(migration.observationSummary)), migration.observationSummarySha256);
  else t.diagnostic('Historical screening evidence not installed; no captured response is used as a variant baseline.');
  assert.equal(hash(read('test-data/solution-finder/workbook-scenarios/original-scenarios.json')), migration.original23JsonSha256);
  if (existsSync(resolve(root, original.sourceWorkbook))) assert.equal(hash(read(original.sourceWorkbook)), migration.original23WorkbookSha256);
  else t.diagnostic('Restricted original workbook not installed; original23 normalized source hash is checked.');
  const unchanged = data.scenarios.slice(0, 50).map(({ comparisonMode, provenance, ...s }: Record<string, unknown>) => s);
  assert.equal(hash(JSON.stringify(unchanged)), migration.preservedFirst50Sha256);
  const changed = allScenarios.slice(50);
  assert.equal(changed.length, 52);
  const ids = new Set<string>();
  const archived = resolve(root, migration.archive, 'scenarios.json');
  const prior = existsSync(archived) ? JSON.parse(readFileSync(archived, 'utf8')) : null;
  for (const [i, s] of changed.entries()) {
    assert.equal(s.comparisonMode, 'actual-ui-api');
    if (s.comparisonMode !== 'actual-ui-api') throw new Error('Unexpected mode');
    const p = profiles.profiles[i < 12 ? i : i - 12];
    assert.equal(s.provenance.profileId, p.id);
    ids.add(p.id);
    assert.ok(!('expectedResponse' in s) && !('expectedUi' in s));
    const a = s.request.applicationInquiryInput;
    const ir = p.request.applicationInquiryInput;
    assert.deepEqual(a.basicInfoInput.name, ir.basicInfoInput.name, s.id);
    assert.deepEqual(a.basicInfoInput.residenceAddress, ir.basicInfoInput.residenceAddress, s.id);
    assert.equal(a.basicInfoInput.emailId, ir.basicInfoInput.emailId, s.id);
    assert.equal(a.basicInfoInput.phoneNumber, ir.basicInfoInput.phoneNumber, s.id);
    assert.equal(a.basicInfoUpdateInput.lastFourSSN, ir.basicInfoUpdateInput.lastFourSSN, s.id);
    assert.equal(s.provenance.dob.certifiedByIrWorkbook, false);
    assert.equal(s.provenance.dob.value, a.basicInfoUpdateInput.dateOfBirth);
    assert.equal(s.provenance.subjectPropertyChanged, a.propertyInputHeloc.type === 'PRIMARY');
    if (a.propertyInputHeloc.type === 'PRIMARY') assert.deepEqual(a.propertyInputHeloc.address, a.basicInfoInput.residenceAddress, s.id);
    if (prior) {
      const before = prior.scenarios[i + 50].request.applicationInquiryInput;
      const permitted = structuredClone(before);
      permitted.basicInfoInput.name = a.basicInfoInput.name;
      permitted.basicInfoInput.residenceAddress = a.basicInfoInput.residenceAddress;
      permitted.basicInfoInput.emailId = a.basicInfoInput.emailId;
      permitted.basicInfoInput.phoneNumber = a.basicInfoInput.phoneNumber;
      permitted.basicInfoUpdateInput.lastFourSSN = a.basicInfoUpdateInput.lastFourSSN;
      if (a.propertyInputHeloc.type === 'PRIMARY') permitted.propertyInputHeloc.address = a.propertyInputHeloc.address;
      assert.deepEqual(a, permitted, s.id);
    }
    assert.equal(/fannie|fictitious|freeze/i.test(JSON.stringify(s.provenance)), false);
  }
  assert.equal(ids.size, 40);
  assert.ok(ids.has('TB-007') && ids.has('TB-026'));
  assert.equal(/fannie/i.test(read(fixturePath).toString()), false);
  assert.equal(existsSync(resolve(root, 'test-data/solution-finder/fannie-mae-personas.json')), false);
  assert.equal(existsSync(resolve(root, 'test-data/solution-finder/HELOAN_102_scenarios_with_Fannie_Mae_personas.xlsx')), false);
  const activeBook = XLSX.read(read(data.sourceWorkbook), { type: 'buffer', cellComments: true });
  assert.equal(activeBook.SheetNames.includes('Personas'), false);
  assert.equal(/fannie/i.test(JSON.stringify(activeBook)), false);
  assert.equal(/"ssn"\s*:/i.test(read(fixturePath).toString()), false);
  assert.equal(hash(read(data.sourceWorkbook)), data.sourceSha256);
  const before = read(fixturePath);
  execFileSync(process.execPath, ['scripts/export-new-solution-finder.cjs'], { cwd: root });
  assert.deepEqual(read(fixturePath), before);
  execFileSync(process.execPath, ['scripts/generate-new-solution-finder-specs.cjs'], { cwd: root });
});

test('pricing drift gets a specific QA comment without hiding a failed expectation', () => {
  const actual = structuredClone(scenarios[0].expectedResponse);
  actual.offers[0].apr = 99;
  const comparison = {
    apiBaseline: [{ path: 'response.offers[0].apr', expected: 8.449, actual: 8.549 }],
    uiApi: [], uiBaseline: []
  };
  const comments = qaComments(scenarios[0], 'gri', actual, comparison, 'Baseline mismatch\nLarge detailed diff');
  assert.ok(comments.some(value => value.includes('expected 8.449, actual 8.549')));
  assert.ok(comments.some(value => value.includes('before classifying this as a UI defect')));
  assert.ok(comments.some(value => value.includes('FAILED CHECKPOINT')));
  assert.ok(comments.every(value => !value.includes('Large detailed diff')));
  assert.equal(comparison.apiBaseline.length, 1);
});

test('every runner rejects an obsolete all-workbook or reordered catalog before browser work', () => {
  const root = resolve(__dirname, '../..');
  for (const change of [
    `data.scenarios = data.scenarios.map(s => ({...s, comparisonMode:'workbook', provenance:{kind:'unchanged-workbook'}, expectedResponse:data.scenarios[0].expectedResponse, expectedUi:data.scenarios[0].expectedUi}));`,
    `[data.scenarios[0],data.scenarios[1]]=[data.scenarios[1],data.scenarios[0]];`
  ]) {
    const script = `
      const fs=require('node:fs'),path=require('node:path');
      const file=path.resolve('test-data/solution-finder/workbook-scenarios/scenarios.json');
      const read=fs.readFileSync,data=JSON.parse(read(file,'utf8'));
      ${change}
      fs.readFileSync=function(f,...args){return path.resolve(String(f))===file?JSON.stringify(data):read(f,...args);};
      require('./tests/projects/solution-finder/workbook-scenarios/helpers/contracts');
    `;
    assert.throws(() => execFileSync(process.execPath, ['--require', 'ts-node/register', '-e', script], { cwd: root }),
      (error: unknown) => error instanceof Error && 'stderr' in error &&
        String(error.stderr).includes('50 workbook baselines and 52 IR UI/API scenarios'));
  }
});

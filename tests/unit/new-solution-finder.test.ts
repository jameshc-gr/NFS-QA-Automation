import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarios, type InquiryResponse, type UiCard } from '../projects/solution-finder/workbook-scenarios/helpers/contracts';
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
  for (const scenario of scenarios) {
    assert.ok(readFileSync(resolve(folder, `${scenario.id}.spec.ts`), 'utf8').includes(`defineScenario('${scenario.id}')`));
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
  const scenario = scenarios.find(value => value.expectedResponse.offers.length === 2);
  assert.ok(scenario);
  const cards = cardsFromExpected(scenario.expectedUi);
  assert.deepEqual(compareUiToApi(cards, scenario.expectedResponse), []);
  const apiTitles = new Set<string>(scenario.expectedResponse.offers.map(offer => productTitles[offer.productType]));
  const placeholder = cards.find(card => !apiTitles.has(card.title));
  assert.ok(placeholder);
  placeholder.text += '\nSend offer to client\nLoan Amount\n$100,000';
  assert.ok(compareUiToApi(cards, scenario.expectedResponse).some(diff => diff.path.endsWith('placeholderAction')));
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
  const fannie = scenarios.find(value => value.notes.some(note => note.includes('Fictitious Fannie Mae test identity')));
  assert.ok(fannie);
  assert.ok(qaComments(fannie, 'gri', fannie.expectedResponse).some(value => value.includes('NOT exercised')));
  assert.ok(qaComments(fannie, 'owning', fannie.expectedResponse).some(value => value.includes('no independently approved baseline')));
  assert.ok(qaComments(fannie, 'gri', undefined, undefined, 'HTTP 500').some(value => value.includes('HTTP 500')));
  const dti = structuredClone(scenarios[0].expectedResponse);
  dti.summary.highestDti = 55;
  assert.ok(qaComments(scenarios[0], 'gri', dti).some(value => value.includes('violation is not confirmed')));
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

/* global document, fetch, setTimeout, clearTimeout, URLSearchParams, location */
'use strict';
const $ = id => document.getElementById(id);
const suiteId = new URLSearchParams(location.search).get('suite');
const validId = /^sf-suite-\d{8}T\d{9}Z-[a-f0-9]{8}$/;
const runCache = new Map();
const cards = new Map();
let timer;
let loading = false;
const pretty = value => JSON.stringify(value, null, 2);
const money = value => value == null ? 'Not returned' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
async function get(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function detail(label, value, openLabels) {
  const details = node('details');
  details.dataset.label = label; details.open = openLabels.has(label);
  details.append(node('summary', label), node('pre', typeof value === 'string' ? value : pretty(value) ?? 'Not captured.'));
  return details;
}
function renderCase(item, run) {
  let card = cards.get(item.caseId);
  if (!card) {
    card = { element: node('article', undefined, 'panel suite-report-case'), signature: null };
    card.element.dataset.caseId = item.caseId;
    cards.set(item.caseId, card); $('suite-report-cases').append(card.element);
  }
  const signature = pretty({ item, run });
  if (card.signature === signature) return;
  card.signature = signature;
  const openLabels = new Set([...card.element.querySelectorAll('details[open]')].map(element => element.dataset.label));
  const heading = node('h2', `${item.caseId}: ${item.name}`);
  const status = node('span', item.status.toUpperCase(), `status ${item.status}`);
  const title = node('div', undefined, 'section-title'); title.append(heading, status);
  card.element.replaceChildren(title);
  if (item.error || run?.error) card.element.append(node('p', item.error || run.error, 'report-failure'));
  if (!run) {
    card.element.append(node('p', item.status === 'skipped' ? 'Not executed. No request was submitted for this case.' : 'Waiting for this scenario to start.'));
    return;
  }
  const profile = run.profile;
  const result = run.result;
  const execution = result?.execution;
  const identifiers = node('dl');
  const rows = [
    ['Run ID', run.id], ['Borrower', profile?.borrower],
    [profile?.emailSource === 'submitted' ? 'Submitted email' : 'Input email (submission not captured)', profile?.email],
    ['Loan ID', profile?.loanIds.join(', ') || 'Not returned by API'],
    ['Application ID (internalAppId)', profile?.internalAppIds.join(', ') || 'Not returned'],
    ['Inquiry ID', profile?.inquiryId],
    ['Requested Loan Amount', profile ? money(profile.requestedAmount) : 'Not captured'],
    ['Endpoint / HTTP status', `${execution?.endpoint || 'Not captured'} / ${execution?.httpStatus ?? 'Not captured'}`]
  ];
  for (const [label, value] of rows) identifiers.append(node('dt', label), node('dd', value ?? 'Not captured'));
  card.element.append(identifiers);
  const parsed = result?.parsed;
  card.element.append(node('p', parsed ? `${parsed.eligibleOfferCount} eligible offer(s)` :
    run.status === 'running' ? 'Browser is running. Offers will appear when captured.' : 'No valid response captured.', 'case-offer-count'));
  const offers = node('div', undefined, 'offers');
  for (const offer of parsed?.offers || []) {
    const offerCard = node('article', undefined, `offer ${offer.eligible ? '' : 'declined'}`);
    offerCard.append(node('h3', `${offer.product.replaceAll('_', ' ')} / ${offer.eligible ? 'OFFER RETURNED' : 'NO OFFER'}`));
    offerCard.append(node('p', offer.eligible
      ? `Amount: ${money(offer.loanAmount)} | APR: ${offer.apr ?? 'Unknown'}${offer.apr == null ? '' : '%'} | Term: ${offer.term ?? 'Unknown'} years | Monthly: ${offer.apr == null ? 'Unknown' : money(offer.monthlyPayment)}`
      : offer.reasons.join(' | ')));
    offers.append(offerCard);
  }
  card.element.append(offers);
  card.element.append(
    detail('Actual inquiry request JSON', result?.actualRequest, openLabels),
    detail('Actual inquiry response JSON', result?.response, openLabels),
    detail('Parsed offers / credit / ratios', parsed, openLabels),
    detail('Captured UI offers and comparison', { ui: result?.ui, comparison: result?.comparison }, openLabels),
    detail('Runner logs / failure details', run.logs || run.error || 'Waiting for runner output...', openLabels)
  );
  const links = node('div', undefined, 'artifact-links');
  for (const artifact of run.artifacts) {
    const link = node('a', artifact.name);
    link.href = artifact.url; link.target = '_blank'; link.rel = 'noreferrer'; links.append(link);
  }
  card.element.append(links);
  const screenshot = run.artifacts.find(artifact => artifact.name === 'offers.png');
  if (screenshot) {
    const link = node('a'); link.href = screenshot.url; link.target = '_blank'; link.rel = 'noreferrer';
    const image = node('img'); image.src = screenshot.url; image.loading = 'lazy';
    image.alt = `${item.caseId} captured Navigator offers page`; image.className = 'suite-report-screenshot';
    link.append(image); card.element.append(node('h3', 'Captured Navigator page'), link);
  }
}
async function refresh() {
  if (loading) return;
  clearTimeout(timer); loading = true; $('report-refresh').disabled = true;
  $('error').hidden = true;
  try {
    if (!validId.test(suiteId || '')) throw new Error('Choose a suite in the lab and use Open all suite results. A valid suite ID is required.');
    const { suite } = await get(`/api/suites/${suiteId}`);
    $('suite-report-summary').textContent = `${suite.tenant.toUpperCase()} / ${suite.status.toUpperCase()} / ${suite.counts.passed} passed, ${suite.counts.failed} failed, ${suite.counts.skipped} skipped, ${suite.counts.pending} pending, ${suite.counts.running} running${suite.stopRequested ? ' / Stop requested' : ''}${suite.error ? ` / ${suite.error}` : ''}`;
    $('suite-report-id').textContent = `${suite.id} / ${new Date(suite.startedAt).toLocaleString()}`;
    for (const item of suite.items) {
      let run = item.runId ? runCache.get(item.runId) : null;
      if (item.runId && (!run || run.status === 'running')) {
        run = (await get(`/api/runs/${item.runId}`)).run;
        runCache.set(item.runId, run);
      }
      renderCase(item, run);
    }
    if (suite.status === 'running') timer = setTimeout(refresh, 1500);
  } catch (error) {
    $('error').textContent = `Unable to refresh suite results: ${error.message || String(error)}. Check the lab server, then use Refresh results.`;
    $('error').hidden = false;
  } finally { loading = false; $('report-refresh').disabled = false; }
}
$('report-refresh').addEventListener('click', refresh);
refresh();

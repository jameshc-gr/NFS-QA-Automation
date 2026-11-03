/* global document, fetch, setTimeout, URL */
'use strict';
const $ = id => document.getElementById(id);
let bootstrap;
let selectedRun;
let activeRun;
let timer;
let suiteTimer;
let activeSuiteId = null;
let selectedSuiteId = null;
let followedRun = null;
let suiteLaunching = false;
let loadedCaseId = null;
let saving = false;
let pendingActions = 0;
let editorRequest = null;
let fieldCounter = 0;
const money = value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const addressText = address => [...address.street, address.city, address.region, address.postalCode].filter(Boolean).join(', ');
const occupancyText = value => ({ PRIMARY: 'Primary', SECONDARY: 'Secondary', INVESTMENT: 'Investment' })[value];
const pretty = value => JSON.stringify(value, null, 2);
const failure = error => {
  $('error').textContent = error.message || String(error);
  $('error').hidden = false;
};
async function api(url, value) {
  const response = await fetch(url, value === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SF-Lab-Token': bootstrap.token },
    body: pretty(value)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function action(work) {
  return async () => {
    $('error').hidden = true;
    pendingActions++; if (bootstrap) controls();
    try { await work(); } catch (error) { failure(error); }
    finally { pendingActions--; if (bootstrap) controls(); }
  };
}
function request() {
  try { return JSON.parse($('request').value); }
  catch (error) { throw new Error(`Inquiry request is not valid JSON: ${error.message}`); }
}
function tenantChanged(value = $('tenant').value) {
  const tenant = bootstrap.tenants.find(tenant => tenant.tenant === value);
  $('tenant').value = value;
  $('suite-tenant').value = value;
  $('entry').href = tenant.intakeUrl;
  $('confirm').checked = false;
  $('suite-confirm').checked = false;
}
function controls() {
  const busy = !!activeRun || !!activeSuiteId || suiteLaunching;
  $('reset').disabled = !bootstrap || busy || saving || pendingActions > 0;
  $('launch').disabled = busy || saving || pendingActions > 0 || !$('confirm').checked;
  for (const id of ['tenant', 'suite-tenant', 'fresh-email', 'template-name']) $(id).disabled = busy || saving;
  for (const id of ['scenario', 'load']) $(id).disabled = busy || saving || pendingActions > 0;
  for (const id of ['request', 'format', 'validate', 'confirm']) $(id).disabled = saving;
  $('request-fields').disabled = saving || !editorRequest;
  $('save-template').disabled = busy || saving || pendingActions > 0 || !bootstrap;
  const selected = $('suite-cases').querySelectorAll('input:checked').length;
  const suitesAvailable = Array.isArray(bootstrap?.suites);
  for (const id of ['suite-cases', 'suite-group', 'suite-select-group', 'suite-clear', 'suite-confirm']) {
    $(id).disabled = busy || saving || !suitesAvailable;
  }
  $('suite-launch').disabled = busy || saving || !suitesAvailable || !selected || !$('suite-confirm').checked;
  $('suite-stop').disabled = !activeSuiteId;
  $('suite-selection').textContent = `${selected} scenario(s) selected / Tenant: ${$('tenant').value.toUpperCase()}.`;
}
function resetWorkspace() {
  if ($('reset').disabled) return;
  clearTimeout(timer); clearTimeout(suiteTimer);
  selectedRun = null; selectedSuiteId = null; followedRun = null; loadedCaseId = null;
  editorRequest = null; fieldCounter = 0;
  for (const id of ['request', 'template-name', 'scenario', 'suite-group', 'history', 'suite-history']) $(id).value = '';
  for (const input of $('suite-cases').querySelectorAll('input')) input.checked = false;
  $('fresh-email').checked = true;
  tenantChanged(bootstrap.tenants[0].tenant);
  for (const id of ['property-fields', 'borrower-fields', 'income-fields', 'notes', 'history-profile',
    'identifiers', 'offers', 'artifacts']) $(id).replaceChildren();
  for (const id of ['error', 'template-notice', 'source-request', 'save-status', 'result-summary',
    'response-json', 'parsed-json', 'actual-request', 'ui-json']) $(id).textContent = '';
  for (const id of ['error', 'template-notice', 'source-section', 'save-status', 'results',
    'navigator', 'screenshot-section', 'suite-report-link']) $(id).hidden = true;
  for (const id of ['navigator', 'screenshot-link', 'suite-report-link']) $(id).removeAttribute('href');
  $('screenshot').removeAttribute('src');
  $('screenshot-title').textContent = 'Captured browser page';
  $('source-section').open = false; $('preview-section').open = true;
  $('editor-notice').textContent = 'Select a scenario and click Load, or paste complete JSON above, to populate the request editor.';
  renderProfileReference(null);
  $('preview').textContent = 'Validate a request to preview its borrower, property, income and amounts.';
  $('suite-results').tBodies[0].replaceChildren();
  $('suite-summary').textContent = 'No suite selected.';
  $('status').className = 'status'; $('status').textContent = 'READY';
  $('step').textContent = 'Validate JSON, then launch a run.';
  $('logs').textContent = 'Browser checkpoints and runner output will appear here.';
  controls();
}
const referenceScore = (value, missing = 'N/A') => value == null ? missing : String(value);
function caseLabel(scenario) {
  const label = `${scenario.id}: ${scenario.name}`;
  const reference = scenario.profileReference;
  if (!reference) return label;
  const scores = ['TU', 'XPN', 'EFX'].map(bureau => `${bureau} ${referenceScore(reference.expectedFico[bureau])}`).join(' / ');
  const pending = reference.offers.filter(offer => offer.status === 'Pending').length;
  return `${label} | Chart SSN last 4 ${reference.lastFourSSN} | Source ${scores} | Prior offers: ${reference.eligibleProducts.join(', ') || 'None'}${pending ? `; ${pending} pending` : ''}`;
}
function renderProfileReference(reference) {
  $('profile-reference').hidden = !reference;
  $('profile-reference-values').replaceChildren();
  $('profile-reference-offers').tBodies[0].replaceChildren();
  if (!reference) return;
  $('profile-reference-title').textContent = `${reference.profileId} - IR chart reference`;
  $('profile-reference-context').textContent = `Selected source template only: click Load to use its inputs. Historical chart results are not current-run results or guaranteed offers. ${reference.context} Source: ${reference.sourceWorkbook.split('/').pop()} (${reference.observedOn}).`;
  const scoreLine = (values, missing = 'N/A') => ['TU', 'XPN', 'EFX'].map(bureau => `${bureau}: ${referenceScore(values[bureau], missing)}`).join(' / ');
  const values = [
    ['Chart SSN scenario (last four only)', reference.lastFourSSN],
    ['Source workbook TU / XPN / EFX', scoreLine(reference.expectedFico)],
    ['Previously returned TU / XPN / EFX', scoreLine(reference.returnedFico, 'Not returned')],
    ['Previously returned usable credit score', reference.creditReturned ? 'Y' : 'N'],
    ['Previously eligible offers', reference.eligibleProducts.join(', ') || 'None']
  ];
  for (const [label, value] of values) {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    $('profile-reference-values').append(term, detail);
  }
  for (const offer of reference.offers) {
    const row = $('profile-reference-offers').tBodies[0].insertRow();
    row.insertCell().textContent = `${offer.product} / ${offer.status}${offer.applicationType ? ` / ${offer.applicationType}` : ''}`;
    row.insertCell().textContent = [
      offer.loanAmount == null ? null : `Amount: ${money(offer.loanAmount)}`,
      offer.rate == null ? null : `Rate: ${offer.rate}%`,
      offer.apr == null ? null : `APR: ${offer.apr}%`,
      offer.term == null ? null : `Term: ${offer.term} years`,
      offer.monthlyPayment == null ? null : `Monthly: ${offer.monthlyPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ].filter(Boolean).join('\n') || 'No priced offer returned';
    row.insertCell().textContent = offer.reasons.join('\n') || 'None returned';
  }
}
function caseOption(scenario) {
  if (typeof scenario.id !== 'string' || !scenario.id.trim() ||
      typeof scenario.name !== 'string' || !scenario.name.trim()) {
    throw new Error('The lab server returned a scenario without an ID or name. Restart the lab server and refresh this page.');
  }
  const groupLabel = scenario.group || (/^NSF-\d{3}$/.test(scenario.id) ? 'Additional 102 scenarios' :
    /^SF-\d+-Original$/.test(scenario.id) ? 'Original 23 scenarios' : 'Saved templates');
  let group = [...$('scenario').children].find(element => element.tagName === 'OPTGROUP' && element.label === groupLabel);
  if (!group) {
    group = document.createElement('optgroup'); group.label = groupLabel; $('scenario').append(group);
  }
  const label = caseLabel(scenario);
  const option = new Option(label, scenario.id); option.title = label; group.append(option);
  let suiteGroup = [...$('suite-cases').children].find(element => element.dataset.group === groupLabel);
  if (!suiteGroup) {
    suiteGroup = document.createElement('div'); suiteGroup.dataset.group = groupLabel;
    const heading = document.createElement('h3'); heading.textContent = groupLabel; suiteGroup.append(heading);
    $('suite-cases').append(suiteGroup);
    $('suite-group').append(new Option(groupLabel, groupLabel));
  }
  const suiteLabel = document.createElement('label'); suiteLabel.className = 'suite-case';
  const suiteOption = document.createElement('input'); suiteOption.type = 'checkbox'; suiteOption.value = scenario.id;
  suiteOption.disabled = scenario.runnable === false;
  const text = document.createElement('span'); text.textContent = label;
  suiteLabel.title = scenario.unavailableReason || '';
  suiteLabel.append(suiteOption, text); suiteGroup.append(suiteLabel);
  if (scenario.runnable === false) {
    $('suite-unavailable').textContent += `${scenario.id} unavailable: ${scenario.unavailableReason} `;
  }
}
function suiteHistoryOption(suite) {
  let option = [...$('suite-history').options].find(option => option.value === suite.id);
  if (!option) { option = new Option('', suite.id); $('suite-history').prepend(option); }
  option.textContent = `${suite.tenant.toUpperCase()} / ${suite.status} / ${suite.items.length} scenarios / ${new Date(suite.startedAt).toLocaleString()}`;
}
function renderSuite(suite) {
  suiteHistoryOption(suite); $('suite-history').value = suite.id;
  $('suite-report-link').href = `/suite-results.html?suite=${encodeURIComponent(suite.id)}`;
  $('suite-report-link').hidden = false;
  $('suite-summary').textContent = `${suite.tenant.toUpperCase()} / ${suite.status.toUpperCase()} / ${suite.counts.passed} passed, ${suite.counts.failed} failed, ${suite.counts.skipped} skipped, ${suite.counts.pending} pending, ${suite.counts.running} running${suite.stopRequested ? ' / Stop requested' : ''}${suite.error ? ` / ${suite.error}` : ''}`;
  const table = $('suite-results').tBodies[0]; table.replaceChildren();
  for (const item of suite.items) {
    const row = table.insertRow();
    row.insertCell().textContent = `${item.caseId}: ${item.name} / ${item.status.toUpperCase()}${item.error ? ` / ${item.error}` : ''}`;
    const profile = item.profile;
    row.insertCell().textContent = [
      profile?.borrower, profile?.email,
      profile?.loanIds.length ? `Loan ID: ${profile.loanIds.join(', ')}` : 'Loan ID not returned',
      profile?.internalAppIds.length ? `App ID: ${profile.internalAppIds.join(', ')}` : '',
      profile?.inquiryId ? `Inquiry ID: ${profile.inquiryId}` : '',
      item.offers ? `${item.offers.eligibleOfferCount} eligible offer(s)` : ''
    ].filter(Boolean).join(' / ');
    const evidence = row.insertCell();
    if (item.runId) {
      const button = document.createElement('button'); button.className = 'text'; button.textContent = 'View run details';
      button.addEventListener('click', action(async () => {
        followedRun = null; selectedRun = item.runId; clearTimeout(timer); await poll();
      }));
      evidence.append(button);
    }
    for (const artifact of item.artifacts) {
      if (!['offers.png', 'actual-inquiry-request.json', 'actual-inquiry-response.json', 'actual-ui-offers.json', 'qa-comment.txt'].includes(artifact.name)) continue;
      const link = document.createElement('a'); link.href = artifact.url; link.textContent = artifact.name;
      link.target = '_blank'; link.rel = 'noreferrer'; evidence.append(link);
    }
  }
}
async function pollSuite() {
  if (!selectedSuiteId) return;
  const id = selectedSuiteId;
  const { suite } = await api(`/api/suites/${id}`);
  if (selectedSuiteId !== id) return;
  renderSuite(suite);
  if (suite.id === activeSuiteId && suite.status !== 'running') { activeSuiteId = null; activeRun = null; }
  if (suite.status === 'running') {
    const current = suite.items.find(item => item.status === 'running');
    if (current?.runId && (!selectedRun || selectedRun === followedRun)) {
      followedRun = current.runId; selectedRun = current.runId;
      render((await api(`/api/runs/${current.runId}`)).run);
    }
  } else if (selectedRun && selectedRun === followedRun) {
    render((await api(`/api/runs/${selectedRun}`)).run);
  }
  if (activeSuiteId && id !== activeSuiteId) {
    const active = (await api(`/api/suites/${activeSuiteId}`)).suite;
    suiteHistoryOption(active);
    if (active.status !== 'running') { activeSuiteId = null; activeRun = null; }
  }
  controls();
  if (suite.status === 'running' || activeSuiteId) suiteTimer = setTimeout(() => { pollSuite().catch(failure); }, 1000);
}
function historyOption(run) {
  let option = [...$('history').options].find(option => option.value === run.id);
  if (!option) { option = new Option('', run.id); $('history').prepend(option); }
  const profile = run.profile;
  const id = profile?.loanIds.length ? `Loan ID: ${profile.loanIds.join(', ')}` :
    profile?.internalAppIds.length ? `App ID: ${profile.internalAppIds.join(', ')}` :
      profile?.inquiryId ? `Inquiry ID: ${profile.inquiryId}` : 'ID not returned';
  option.textContent = [
    run.tenant.toUpperCase(), run.status, profile?.borrower, profile?.email,
    profile?.emailSource === 'input' ? '(input email; submitted email not captured)' : '', id,
    new Date(run.startedAt).toLocaleString()
  ].filter(Boolean).join(' / ');
}
function changed() {
  $('confirm').checked = false; controls();
  $('preview').textContent = 'Input changed. Validate again to refresh this preview.';
  $('notes').replaceChildren(); $('save-status').hidden = true;
}
function formChanged() {
  $('request').value = pretty(editorRequest); changed();
}
function editField(table, labelText, object, key, settings = {}) {
  const row = table.insertRow();
  const heading = document.createElement('th'); heading.scope = 'row';
  const label = document.createElement('label');
  const id = `request-field-${++fieldCounter}`;
  label.htmlFor = id; label.textContent = labelText; heading.append(label);
  const cell = document.createElement('td');
  const control = document.createElement(settings.options ? 'select' : 'input');
  control.id = id;
  const value = object[key] ?? '';
  if (settings.options) {
    for (const [value, text] of settings.options) control.append(new Option(text, value));
    if (![...control.options].some(option => option.value === String(value))) {
      control.append(new Option(`${value} (unsupported)`, String(value)));
    }
  } else {
    control.type = settings.type || 'text';
    if (settings.type === 'number') { control.min = '0'; control.step = '1'; }
    if (settings.maxLength) control.maxLength = settings.maxLength;
    if (settings.numeric) control.inputMode = 'numeric';
  }
  control.value = String(value);
  control.addEventListener('input', () => {
    if (settings.optionalStreet && control.value === '') object.splice(Number(key), 1);
    else object[key] = settings.type === 'number' ? (control.value === '' ? null : Number(control.value)) :
      settings.nullable && control.value === '' ? null : control.value;
    if (settings.onChange) settings.onChange();
    formChanged();
    if (settings.onChange || settings.rerender) renderEditor();
  });
  cell.append(control); row.append(heading, cell);
}
function addressFields(table, prefix, address) {
  editField(table, `${prefix} street line 1`, address.street, 0);
  editField(table, `${prefix} street line 2`, address.street, 1, { optionalStreet: true });
  for (const [key, label] of [['city', 'city'], ['region', 'state'], ['postalCode', 'ZIP'], ['country', 'country']]) {
    editField(table, `${prefix} ${label}`, address, key);
  }
}
function renderEditor() {
  for (const id of ['property-fields', 'borrower-fields', 'income-fields']) $(id).replaceChildren();
  fieldCounter = 0; editorRequest = null;
  let value;
  try { value = request(); }
  catch (error) {
    $('editor-notice').textContent = `Request editor unavailable: ${error.message}`; controls(); return;
  }
  const fields = value?.applicationInquiryInput;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!record(fields) || !record(fields.propertyInputHeloc) || !record(fields.basicInfoInput) ||
      !record(fields.basicInfoInput.name) || !record(fields.basicInfoUpdateInput) ||
      ![fields.propertyInputHeloc.address, fields.basicInfoInput.residenceAddress]
        .every(address => record(address) && Array.isArray(address.street)) ||
      !Array.isArray(fields.incomeInput) || !fields.incomeInput.every(record)) {
    $('editor-notice').textContent = 'Request editor unavailable: load a scenario or supply complete borrower, property, address and income structures in Advanced JSON.';
    controls(); return;
  }
  editorRequest = value;
  const property = fields.propertyInputHeloc;
  $('editor-notice').textContent = property.type === 'PRIMARY'
    ? 'Edit any valid subject property. For PRIMARY occupancy, Navigator uses that subject as the borrower residence; validation updates the request and preview automatically.'
    : 'Edit the request tables below. Validate to refresh the readable preview; unsupported data still requires correction.';
  addressFields($('property-fields'), 'Subject', property.address);
  editField($('property-fields'), 'Occupancy Type', property, 'type', {
    options: [['', 'Select occupancy'], ['PRIMARY', 'Primary'], ['SECONDARY', 'Secondary'], ['INVESTMENT', 'Investment']],
    rerender: true
  });
  editField($('property-fields'), 'Existing Mortgage Amount', fields, 'existingMortgageAmount', { type: 'number' });
  editField($('property-fields'), 'Requested Loan Amount', property, 'requestedLoanAmount', { type: 'number' });
  const basic = fields.basicInfoInput;
  for (const [key, label] of [['first', 'First'], ['middle', 'Middle'], ['last', 'Last'], ['suffix', 'Suffix']]) {
    editField($('borrower-fields'), `Borrower ${label} Name`, basic.name, key);
  }
  editField($('borrower-fields'), 'Borrower email', basic, 'emailId', { type: 'email' });
  editField($('borrower-fields'), 'Borrower phone', basic, 'phoneNumber', { type: 'tel', numeric: true, maxLength: 10 });
  editField($('borrower-fields'), 'Borrower date of birth', fields.basicInfoUpdateInput, 'dateOfBirth', { type: 'date' });
  editField($('borrower-fields'), 'Borrower SSN (last 4)', fields.basicInfoUpdateInput, 'lastFourSSN', { numeric: true, maxLength: 4 });
  addressFields($('borrower-fields'), 'Borrower', basic.residenceAddress);
  editField($('borrower-fields'), 'Residence start date', basic, 'residenceStartDate', { type: 'date' });
  fields.incomeInput.forEach((income, index) => {
    const block = document.createElement('div'); block.className = 'income-block';
    const table = document.createElement('table'); table.className = 'request-table';
    const rows = table.createTBody();
    editField(rows, `Income ${index + 1} source`, income, 'incomeSource', {
      options: [['', 'Select income source'], ['EMPLOYED_FULL_TIME', 'Employed full time'],
        ['EMPLOYED_PART_TIME', 'Employed part time'], ['SELF_EMPLOYED', 'Self employed'], ['RETIRED_SSI', 'Retired SSI (age 62+)']],
      onChange: () => { income.incomeType = income.incomeSource === 'RETIRED_SSI' ? 'SOCIAL_SECURITY' : null; }
    });
    editField(rows, `Income ${index + 1} annual amount`, income, 'annualIncome', { type: 'number' });
    editField(rows, `Income ${index + 1} type`, income, 'incomeType', {
      options: income.incomeSource === 'RETIRED_SSI' ? [['SOCIAL_SECURITY', 'Social Security']] : [['', 'Not specified (null)']],
      nullable: true
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'text'; remove.textContent = `Remove income ${index + 1}`;
    remove.disabled = fields.incomeInput.length <= 1;
    remove.addEventListener('click', () => {
      fields.incomeInput.splice(index, 1); formChanged(); renderEditor();
    });
    block.append(table, remove); $('income-fields').append(block);
  });
  $('add-income').disabled = fields.incomeInput.length >= 10;
  controls();
}
function renderPreview(parsed) {
  const rows = [
    ['Subject Property', addressText(parsed.subjectProperty)],
    ['Occupancy Type', occupancyText(parsed.occupancy)],
    ['Existing Mortgage Amount', money(parsed.existingMortgage)],
    ['Requested Loan Amount', money(parsed.requestedAmount)],
    ['Borrower Name', parsed.borrower],
    ['Borrower Address', addressText(parsed.primaryResidence)],
    ['Borrower SSN (last 4)', parsed.lastFourSSN],
    ['Annual Income', money(parsed.annualIncome)]
  ];
  $('preview').replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('p'); row.textContent = `${label} = ${value}`; return row;
  }));
}
function field(name, value) {
  const dt = document.createElement('dt'); dt.textContent = name;
  const dd = document.createElement('dd'); dd.textContent = value == null ? 'Not returned' : String(value);
  $('identifiers').append(dt, dd);
}
function render(run) {
  $('status').className = `status ${run.status}`;
  $('status').textContent = run.status.toUpperCase();
  $('step').textContent = run.progress ? `${run.progress.name} / ${run.progress.status}` : run.status === 'running' ? 'Starting browser...' : 'Runner finished.';
  $('logs').textContent = run.logs || run.error || 'Waiting for runner output...';
  historyOption(run); $('history').value = run.id;
  $('history-profile').replaceChildren();
  const profile = run.profile;
  const profileRows = profile ? [
    ['Borrower', profile.borrower], [profile.emailSource === 'submitted' ? 'Submitted email' : 'Input email (fresh email may change at submission)', profile.email],
    ['Subject Property', addressText(profile.subjectProperty)], ['Occupancy Type', occupancyText(profile.occupancy)],
    ['Requested Loan Amount', money(profile.requestedAmount)], ['Annual Income', money(profile.annualIncome)],
    ['Loan ID', profile.loanIds.join(', ') || 'Not returned by API'],
    ['Application ID (internalAppId)', profile.internalAppIds.join(', ') || 'Not returned'],
    ['Inquiry ID', profile.inquiryId || 'Not returned']
  ] : [['Profile', 'Not captured for this run. Inspect available logs and artifacts.']];
  for (const [label, value] of profileRows) {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value; $('history-profile').append(dt, dd);
  }
  const result = run.result;
  $('results').hidden = !result;
  if (!result) return;
  const parsed = result.parsed;
  const execution = result.execution;
  $('result-summary').textContent = run.error || `${run.tenant.toUpperCase()}: ${parsed?.eligibleOfferCount ?? 0} eligible offer(s). Actual UI/API check ${run.status}.`;
  $('response-json').textContent = pretty(result.response) || 'No response captured.';
  $('parsed-json').textContent = pretty(parsed) || 'No valid inquiry response available.';
  $('actual-request').textContent = pretty(result.actualRequest) || 'No submitted request captured.';
  $('ui-json').textContent = pretty({ ui: result.ui, comparison: result.comparison });
  $('identifiers').replaceChildren();
  field('Inquiry ID', parsed?.inquiryId);
  field('Submitted email', execution?.email);
  field('Endpoint / HTTP status', `${execution?.endpoint || 'Not captured'} / ${execution?.httpStatus ?? 'Not captured'}`);
  for (const offer of parsed?.offers || []) {
    if (offer.internalAppId) field(`${offer.product} internalAppId`, offer.internalAppId);
    if (offer.extAppUuid) field(`${offer.product} extAppUuid`, offer.extAppUuid);
    if (offer.offerId) field(`${offer.product} offerId`, offer.offerId);
  }
  $('offers').replaceChildren();
  for (const offer of parsed?.offers || []) {
    const card = document.createElement('article');
    card.className = `offer ${offer.eligible ? '' : 'declined'}`;
    const heading = document.createElement('h3');
    heading.textContent = `${offer.product.replaceAll('_', ' ')} / ${offer.eligible ? 'OFFER RETURNED' : 'NO OFFER'}`;
    const line = document.createElement('p');
    line.textContent = offer.eligible
      ? `Amount: ${offer.loanAmount?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} | APR: ${offer.apr ?? 'Unknown'}${offer.apr == null ? '' : '%'} | Term: ${offer.term} years | Monthly: ${offer.apr == null ? 'Unknown' : offer.monthlyPayment ?? 'Unknown'}`
      : offer.reasons.join(' | ');
    card.append(heading, line); $('offers').append(card);
  }
  const tenant = bootstrap.tenants.find(value => value.tenant === run.tenant);
  let navigatorUrl;
  if (execution?.navigatorUrl) {
    const url = new URL(execution.navigatorUrl);
    if (url.origin === tenant.baseURL && url.pathname.startsWith('/inquiry/')) navigatorUrl = url.href;
  }
  $('navigator').hidden = !navigatorUrl;
  if (navigatorUrl) $('navigator').href = navigatorUrl;
  $('artifacts').replaceChildren();
  for (const artifact of run.artifacts) {
    const link = document.createElement('a');
    link.href = artifact.url; link.textContent = artifact.name;
    link.target = '_blank'; link.rel = 'noreferrer';
    $('artifacts').append(link);
  }
  const screenshot = run.artifacts.find(artifact => artifact.name === 'offers.png');
  $('screenshot-section').hidden = !screenshot;
  if (screenshot) {
    $('screenshot').src = screenshot.url; $('screenshot-link').href = screenshot.url;
    $('screenshot-title').textContent = run.status === 'passed' ? 'Actual Navigator offers page' : 'Captured browser page (check failed step)';
  }
}
async function poll() {
  if (!selectedRun) return;
  const id = selectedRun;
  const { run } = await api(`/api/runs/${id}`);
  if (id !== selectedRun) return;
  render(run);
  if (run.id === activeRun && run.status !== 'running') activeRun = null;
  if (activeRun && run.id !== activeRun) {
    const active = (await api(`/api/runs/${activeRun}`)).run;
    historyOption(active);
    if (active.status !== 'running') activeRun = null;
  }
  controls();
  if (run.status === 'running' || activeRun) timer = setTimeout(() => { poll().catch(failure); }, 1500);
}
$('tenant').addEventListener('change', () => { tenantChanged(); controls(); });
$('reset').addEventListener('click', resetWorkspace);
$('suite-tenant').addEventListener('change', () => { tenantChanged($('suite-tenant').value); controls(); });
$('confirm').addEventListener('change', controls);
$('suite-confirm').addEventListener('change', controls);
$('suite-cases').addEventListener('change', () => { $('suite-confirm').checked = false; controls(); });
$('fresh-email').addEventListener('change', () => { $('suite-confirm').checked = false; });
$('suite-select-group').addEventListener('click', () => {
  for (const option of $('suite-cases').querySelectorAll('input')) {
    option.checked = !option.disabled && (!$('suite-group').value || option.parentElement.parentElement.dataset.group === $('suite-group').value);
  }
  $('suite-confirm').checked = false; controls();
});
$('suite-clear').addEventListener('click', () => {
  for (const option of $('suite-cases').querySelectorAll('input')) option.checked = false;
  $('suite-confirm').checked = false; controls();
});
$('suite-launch').addEventListener('click', action(async () => {
  suiteLaunching = true; controls();
  try {
    const { suite } = await api('/api/suites', {
      tenant: $('tenant').value,
      caseIds: [...$('suite-cases').querySelectorAll('input:checked')].map(option => option.value),
      preserveEmail: !$('fresh-email').checked, confirmed: $('suite-confirm').checked
    });
    activeSuiteId = suite.status === 'running' ? suite.id : null; selectedSuiteId = suite.id;
    selectedRun = null; followedRun = null; $('suite-confirm').checked = false;
    clearTimeout(timer); clearTimeout(suiteTimer); renderSuite(suite); await pollSuite();
  } finally { suiteLaunching = false; controls(); }
}));
$('suite-stop').addEventListener('click', action(async () => {
  if (!activeSuiteId) return;
  const { suite } = await api(`/api/suites/${activeSuiteId}/stop`, {});
  if (selectedSuiteId === suite.id) renderSuite(suite);
}));
$('suite-history').addEventListener('change', action(async () => {
  clearTimeout(suiteTimer); selectedSuiteId = $('suite-history').value || activeSuiteId;
  if (!selectedSuiteId) {
    $('suite-summary').textContent = 'No suite selected.'; $('suite-results').tBodies[0].replaceChildren();
    $('suite-report-link').hidden = true; return;
  }
  await pollSuite();
}));
$('copy-address').addEventListener('click', () => {
  const fields = editorRequest.applicationInquiryInput;
  fields.basicInfoInput.residenceAddress = structuredClone(fields.propertyInputHeloc.address);
  formChanged(); renderEditor();
});
$('add-income').addEventListener('click', () => {
  editorRequest.applicationInquiryInput.incomeInput.push({ annualIncome: null, incomeSource: '', incomeType: null });
  formChanged(); renderEditor();
});
$('format').addEventListener('click', action(async () => { $('request').value = pretty(request()); }));
$('load').addEventListener('click', action(async () => {
  if (!$('scenario').value) throw new Error('Choose a scenario to load.');
  const selectedCaseId = $('scenario').value;
  const data = await api(`/api/cases/${selectedCaseId}`);
  loadedCaseId = selectedCaseId; $('scenario').value = selectedCaseId;
  const scenario = bootstrap.cases.find(item => item.id === loadedCaseId);
  $('template-name').value = `${scenario.name.slice(0, 115)} copy`;
  $('save-status').hidden = true;
  $('request').value = data.request ? pretty(data.request) : '';
  renderEditor();
  renderProfileReference(data.profileReference);
  $('template-notice').textContent = data.notes.join('\n');
  $('template-notice').hidden = !data.notes.length;
  $('source-section').hidden = !data.sourceRequest;
  $('source-request').textContent = data.sourceRequest ? pretty(data.sourceRequest) : '';
  $('preview').textContent = 'Loaded a scenario. Validate to refresh the parsed preview.';
  $('confirm').checked = false; controls();
}));
$('validate').addEventListener('click', action(async () => {
  const source = $('request').value;
  const data = await api('/api/preview', { request: request() });
  if ($('request').value !== source) throw new Error('Input changed during validation. Validate again to refresh the preview.');
  $('request').value = pretty(data.request);
  renderEditor(); renderPreview(data.parsed);
  $('notes').replaceChildren(...data.notes.map(text => {
    const li = document.createElement('li'); li.textContent = text; return li;
  }));
  $('preview-section').open = true;
}));
$('save-template').addEventListener('click', action(async () => {
  saving = true; controls(); $('save-status').hidden = true;
  try {
    const { template } = await api('/api/templates', {
      name: $('template-name').value, request: request(), sourceCaseId: loadedCaseId
    });
    bootstrap.cases.push(template); caseOption(template);
    $('request').value = pretty(template.request);
    renderEditor();
    renderProfileReference(template.profileReference);
    $('scenario').value = template.id; loadedCaseId = template.id;
    $('template-name').value = `${template.name.slice(0, 115)} copy`;
    $('source-section').hidden = true; $('source-request').textContent = '';
    $('template-notice').textContent = 'Saved a reusable input copy. Original scenarios are unchanged; no inquiry was created.';
    $('template-notice').hidden = false;
    $('save-status').textContent = `Saved "${template.name}". Available under Saved templates, including after a restart.`;
    $('save-status').hidden = false;
    $('confirm').checked = false;
  } finally { saving = false; controls(); }
}));
$('launch').addEventListener('click', action(async () => {
  $('launch').disabled = true;
  try {
    const data = await api('/api/runs', {
      tenant: $('tenant').value, request: request(),
      preserveEmail: !$('fresh-email').checked, confirmed: $('confirm').checked
    });
    activeRun = data.run.status === 'running' ? data.run.id : null;
    selectedRun = data.run.id;
    $('confirm').checked = false;
    clearTimeout(timer); render(data.run); await poll();
  } finally { controls(); }
}));
$('history').addEventListener('change', action(async () => {
  clearTimeout(timer); selectedRun = $('history').value; await poll();
}));
$('request').addEventListener('input', () => {
  changed(); renderEditor();
});
$('scenario').addEventListener('change', () => {
  renderProfileReference(bootstrap.cases.find(scenario => scenario.id === $('scenario').value)?.profileReference);
});
action(async () => {
  bootstrap = await api('/api/bootstrap');
  if (bootstrap.protocolVersion !== 1 || !Array.isArray(bootstrap.suites)) {
    $('server-notice').textContent = 'This lab server is running an older version. Restart npm run solution-finder:lab, then refresh this page to enable the full scenario catalog and latest save/profile features.';
    $('server-notice').hidden = false;
  } else if (bootstrap.internalDistribution) {
    $('server-notice').textContent = 'Restricted internal QA copy: original scenarios, financial variations and named IR profiles are included, with original inquiry data. Select a case and click Load, or use the suite checkboxes. Authorized internal recipients only; do not publish or expose this lab. SF-12 and SF-22 retain their documented lab-specific adjustments.';
    $('server-notice').hidden = false;
  } else if (bootstrap.portable) {
    $('server-notice').textContent = 'Standalone privacy-safe copy: five synthetic starter scenarios are available. Original workbook/customer inputs, credentials and prior runs are not included. Select a starter and click Load; replace placeholder identities/addresses with company-approved QA data before live submission.';
    $('server-notice').hidden = false;
  }
  for (const tenant of bootstrap.tenants) {
    for (const id of ['tenant', 'suite-tenant']) $(id).append(new Option(`${tenant.tenantLabel} / QA`, tenant.tenant));
  }
  for (const scenario of bootstrap.cases) caseOption(scenario);
  for (const run of [...bootstrap.history].reverse()) historyOption(run);
  for (const suite of [...(bootstrap.suites || [])].reverse()) suiteHistoryOption(suite);
  activeSuiteId = bootstrap.activeSuite || null;
  activeRun = bootstrap.activeRun; tenantChanged(); controls();
  if (activeSuiteId) { selectedSuiteId = activeSuiteId; await pollSuite(); }
  if (activeRun) { selectedRun = activeRun; await poll(); }
})().catch(failure);

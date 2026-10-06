const $ = selector => document.querySelector(selector);
const state = { bootstrap: null, runId: null, poller: null, lastLogCount: 0, selectedTemplateId: '', builderSource: null };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
  return value;
}

function selectedCase() { return state.bootstrap.cases.find(test => test.id === $('#test-case').value); }
function selectedOfficer() { return state.bootstrap.loanOfficers.find(officer => officer.id === $('#loan-officer').value); }
function selectedTarget() { return state.bootstrap.entryTargets.find(target => target.id === $('#dmx-target').value); }
function readScenario() {
  try { return JSON.parse($('#scenario').value); }
  catch (error) { throw new Error(`Scenario JSON: ${error.message}`); }
}

function populateCases(cases) {
  $('#test-case').innerHTML = cases.map(test => `<option value="${esc(test.id)}" ${!test.automated ? 'disabled' : ''}>${esc(test.id)} · ${esc(test.title)}</option>`).join('');
  const complete = cases.filter(test => test.category === 'complete-application').length;
  const resumes = cases.filter(test => test.category === 'incomplete-resume' || test.category === 'incomplete-relogin').length;
  $('#case-coverage').textContent = `${complete} complete-loan cases · ${resumes} resume/relogin cases · ${state.bootstrap.entryTargets.length} tenant entry checks (read-only)`;
  $('#test-case').addEventListener('change', () => {
    const test = selectedCase();
    const scenario = state.bootstrap.scenarios.find(item => item.id === test.scenarioRef);
    if (scenario) $('#scenario').value = JSON.stringify(scenario, null, 2);
    renderTargetLink();
  });
}

function populateTemplates(templates) {
  $('#template').innerHTML = '<option value="">Choose a template…</option>' + templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  $('#template').onchange = () => {
    const template = templates.find(t => t.id === $('#template').value);
    state.selectedTemplateId = template?.id || '';
    if (!template) return;
    $('#template-name').value = template.name;
    if (template.testId) $('#test-case').value = template.testId;
    $('#scenario').value = JSON.stringify(template.scenario, null, 2);
    validateScenarioJson();
  };
}

function validateScenarioJson() {
  const status = $('#json-state');
  try {
    readScenario();
    status.className = 'json-state valid';
    status.textContent = 'VALID JSON';
    return true;
  } catch (error) {
    status.className = 'json-state invalid';
    status.textContent = error.message.replace(/^Scenario JSON: /, '').slice(0, 60);
    return false;
  }
}

function labelFor(key) {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, char => char.toUpperCase());
}

function fieldControl(value, fieldPath) {
  const pathValue = esc(JSON.stringify(fieldPath));
  if (typeof value === 'boolean') {
    return `<select data-builder-path="${pathValue}" data-value-type="boolean"><option value="true" ${value ? 'selected' : ''}>Yes</option><option value="false" ${!value ? 'selected' : ''}>No</option></select>`;
  }
  if (Array.isArray(value)) return `<input data-builder-path="${pathValue}" data-value-type="array" value="${esc(value.join(', '))}" placeholder="Comma-separated values">`;
  if (typeof value === 'number') return `<input type="number" step="any" data-builder-path="${pathValue}" data-value-type="number" value="${esc(value)}">`;
  const text = value == null ? '' : String(value);
  return `<input data-builder-path="${pathValue}" data-value-type="string" value="${esc(text)}">`;
}

function renderBuilderValue(key, value, fieldPath) {
  if (Array.isArray(value) && value.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
  const items = value.map((item, index) => `<div class="array-item"><div class="array-item-title"><strong>${esc(labelFor(key))} ${index + 1}</strong><button type="button" class="remove-array-item" data-array-path="${esc(JSON.stringify(fieldPath))}" data-index="${index}" aria-label="Remove ${esc(labelFor(key))} ${index + 1}">Remove</button></div><div class="builder-grid">${Object.entries(item).map(([childKey, childValue]) => builderField(childKey, childValue, [...fieldPath, index, childKey])).join('')}</div></div>`).join('');
    const addLabel = key === 'assets' ? 'Add asset' : `Add ${labelFor(key).replace(/s$/, '')}`;
    return `<fieldset class="builder-group builder-array"><legend>${esc(labelFor(key))}</legend>${items}<button type="button" class="add-array-item" data-array-path="${esc(JSON.stringify(fieldPath))}">+ ${esc(addLabel)}</button></fieldset>`;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `<fieldset class="builder-group"><legend>${esc(labelFor(key))}</legend><div class="builder-grid">${Object.entries(value).map(([childKey, childValue]) => builderField(childKey, childValue, [...fieldPath, childKey])).join('')}</div></fieldset>`;
  }
  return builderField(key, value, fieldPath);
}

function builderField(key, value, fieldPath) {
  if (key === 'profile') return `<label class="builder-field"><span>${esc(labelFor(key))}</span><input data-builder-path="${esc(JSON.stringify(fieldPath))}" data-value-type="string" value="${esc(value)}" readonly title="Credit profile is provided by the source test case"></label>`;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `<fieldset class="builder-group builder-nested"><legend>${esc(labelFor(key))}</legend><div class="builder-grid">${Object.entries(value).map(([childKey, childValue]) => childValue && typeof childValue === 'object' ? renderBuilderValue(childKey, childValue, [...fieldPath, childKey]) : builderField(childKey, childValue, [...fieldPath, childKey])).join('')}</div></fieldset>`;
  }
  return `<label class="builder-field"><span>${esc(labelFor(key))}</span>${fieldControl(value, fieldPath)}</label>`;
}

function renderBuilderFields() {
  const scenario = state.builderSource;
  if (!scenario) return;
  const entries = Object.entries(scenario).filter(([key]) => !['id', 'title', 'product'].includes(key));
  const addCoborrower = scenario.coBorrower ? '' : '<button type="button" id="add-coborrower" class="add-section">+ Add co-borrower</button>';
  $('#builder-fields').innerHTML = entries.map(([key, value]) => renderBuilderValue(key, value, [key])).join('') + addCoborrower;
  $('#field-count').textContent = $('#builder-fields').querySelectorAll('[data-builder-path]').length;
}

function setAtPath(root, path, value) {
  let target = root;
  for (const part of path.slice(0, -1)) target = target[part];
  target[path[path.length - 1]] = value;
}

function applyBuilderInputs() {
  for (const input of $('#builder-fields').querySelectorAll('[data-builder-path]')) {
    const path = JSON.parse(input.dataset.builderPath);
    let value = input.value;
    if (input.dataset.valueType === 'number') value = value === '' ? 0 : Number(value);
    if (input.dataset.valueType === 'boolean') value = input.value === 'true';
    if (input.dataset.valueType === 'array') value = input.value.split(',').map(item => item.trim()).filter(Boolean);
    setAtPath(state.builderSource, path, value);
  }
}

function readBuilderScenario() {
  applyBuilderInputs();
  const scenario = JSON.parse(JSON.stringify(state.builderSource));
  scenario.id = $('#builder-id').value.trim();
  scenario.title = $('#builder-title').value.trim();
  scenario.product = $('#builder-product').value;
  return scenario;
}

function resetScenarioEditor() {
  const test = selectedCase();
  const scenario = state.bootstrap.scenarios.find(item => item.id === test?.scenarioRef);
  if (scenario) {
    $('#scenario').value = JSON.stringify(scenario, null, 2);
    validateScenarioJson();
  }
}

function startTemplateBuilder() {
  const test = selectedCase();
  const source = state.bootstrap.scenarios.find(scenario => scenario.id === test?.scenarioRef) || state.bootstrap.scenarios[0];
  if (!source) return showError(new Error('No DMX scenario is available to prefill the template.'));
  state.builderSource = JSON.parse(JSON.stringify(source));
  $('#builder-source').value = test?.id || '';
  $('#builder-name').value = '';
  $('#builder-title').value = `${source.title} (custom)`;
  $('#builder-id').value = `${source.id}-custom-${Date.now().toString().slice(-4)}`;
  $('#builder-product').value = source.product;
  $('#template-builder').hidden = false;
  $('.intro').hidden = true;
  $('.workspace').hidden = true;
  renderBuilderFields();
  window.scrollTo(0, 0);
}

function closeTemplateBuilder() {
  $('#template-builder').hidden = true;
  $('.intro').hidden = false;
  $('.workspace').hidden = false;
}

// Read Me modal logic
const readmeBtn = document.getElementById('readme-btn');
const readmeModal = document.getElementById('readme-modal');
const readmeExit = document.getElementById('readme-exit');
const readmeClose = document.getElementById('readme-close');
const readmeText = document.getElementById('readme-text');

if (readmeBtn) {
  readmeBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('README.md');
      if (!res.ok) throw new Error(`Guide not found (${res.status})`);
      const text = await res.text();
      readmeText.textContent = text;
      readmeModal.hidden = false;
    } catch (e) {
      readmeText.textContent = 'Could not load the guide.';
      readmeModal.hidden = false;
    }
  });

  const closeReadme = () => {
    readmeModal.hidden = true;
  };

  readmeExit?.addEventListener('click', closeReadme);
  readmeClose.addEventListener('click', closeReadme);
}

function populateBuilderSources() {
  $('#builder-source').innerHTML = state.bootstrap.cases
    .filter(test => test.automated && test.category !== 'entry' && state.bootstrap.scenarios.some(scenario => scenario.id === test.scenarioRef))
    .map(test => `<option value="${esc(test.id)}">${esc(test.id)} · ${esc(test.title)}</option>`).join('');
  $('#builder-source').onchange = () => {
    const test = state.bootstrap.cases.find(item => item.id === $('#builder-source').value);
    const source = state.bootstrap.scenarios.find(item => item.id === test?.scenarioRef);
    if (!source) return;
    $('#test-case').value = test.id;
    state.builderSource = JSON.parse(JSON.stringify(source));
    $('#builder-title').value = `${source.title} (custom)`;
    $('#builder-id').value = `${source.id}-custom-${Date.now().toString().slice(-4)}`;
    $('#builder-product').value = source.product;
    renderBuilderFields();
    resetScenarioEditor();
  };
}

function renderResult(result) {
  if (!result) return;
  $('#result-panel').hidden = false;
  const passed = result.status === 'complete' || result.status === 'resumed-complete' || result.status === 'passed';
  const entrySmoke = result.loanCreated === false;
  const hasDiagnostic = !passed && Boolean(result.diagnostic);
  $('#result-panel').className = `result-panel panel ${passed ? 'passed' : 'failed'}`;
  $('#result-kicker').textContent = entrySmoke ? '03 / ENTRY CHECK' : passed ? '03 / LOAN CREATED' : '03 / RUN FAILED';
  $('#result-heading').textContent = entrySmoke ? 'Tenant entry verified' : passed ? 'Loan created' : 'Loan creation failed';
  $('#result-mark').textContent = passed ? '✓' : '!';
  $('#run-status').className = `status-chip ${passed ? 'passed' : 'failed'}`;
  $('#run-status').innerHTML = `<i></i> ${entrySmoke && passed ? 'ENTRY READY' : passed ? 'PASSED' : entrySmoke ? 'ENTRY FAILED' : 'FAILED'}`;
  $('#result-email').textContent = result.email || '—';
  $('#result-password').textContent = result.password || '—';
  $('#result-status').textContent = result.status || '—';
  const duplicateEmail = Boolean(result.email && state.bootstrap?.history?.some(item => item.result?.email?.toLowerCase() === result.email.toLowerCase()));
  if (duplicateEmail && !$('#result-status').textContent.includes('existing account email')) $('#result-status').textContent += ' · existing account email';
  $('#result-number').textContent = entrySmoke ? 'Not applicable (read-only check)' : result.loanNumber ? `#${result.loanNumber}` : (passed ? 'Not captured' : 'Not created');
  $('#result-guid').textContent = result.dashboardLoanGuid || 'Not captured';
  $('#result-resume-guid').textContent = result.resumeGuid || 'Not applicable';
  const link = $('#result-link');
  const safeUrl = /^https:\/\/my\.gr-dev\.com\/loan\/[0-9a-f-]{36}\/overview$/.test(result.dashboardUrl || '') ? result.dashboardUrl : '';
  link.href = safeUrl || '#';
  link.hidden = !safeUrl;
  const failure = $('#failure-details');
  failure.hidden = passed || (entrySmoke && !hasDiagnostic);
  if (!passed) {
    $('#failed-page').textContent = result.failedPage || result.diagnostic?.page || result.landedUrl || 'Page URL was not captured';
    let landedPath = '';
    try { landedPath = result.landedUrl ? new URL(result.landedUrl).pathname : ''; } catch { /* Invalid or unavailable landing URL. */ }
    $('#failed-route').textContent = result.failedRoute || result.diagnostic?.route || landedPath || 'Route was not captured';
    $('#failure-error').textContent = result.note || result.diagnostic?.error || (entrySmoke ? 'Tenant entry page failed the configured smoke check.' : 'The run ended without a completed loan.');
    const screenshotUrl = result.screenshotUrl || result.diagnostic?.screenshotUrl || '';
    $('#screenshot-link').href = screenshotUrl || '#';
    $('#screenshot-link').hidden = !screenshotUrl;
    $('#failure-screenshot').src = screenshotUrl;
  }
  if (entrySmoke) {
    $('#result-email').textContent = `${result.environment} · ${result.tenant}`;
    $('#result-password').textContent = 'Not used';
    $('#result-status').textContent = passed ? 'Entry ready' : 'Entry check failed';
    $('#result-guid').textContent = result.pageTitle || result.landedUrl || 'Not captured';
    $('#result-resume-guid').textContent = result.landedUrl || result.url || '—';
    $('#result-link').href = /^https:\/\//.test(result.landedUrl || '') ? result.landedUrl : result.url;
    $('#result-link').hidden = false;
    $('#result-link').innerHTML = 'Open tenant application entry <span>↗</span>';
    $('#result-link').className = 'result-link';
  } else if (result.tenant) {
    $('#result-email').textContent = `${result.tenant} · ${result.loanOfficerLabel || 'DEV'}`;
  }
  if (!entrySmoke) $('#result-link').className = 'result-link';
  if (entrySmoke && !passed) {
    $('#result-panel').className = 'result-panel panel failed';
    $('#result-kicker').textContent = '03 / ENTRY CHECK FAILED';
    $('#result-heading').textContent = 'Tenant entry check failed';
  }
}

function renderHistory(history) {
  $('#history-count').textContent = history.length;
  $('#history-list').innerHTML = history.length ? history.map(item => {
    const result = item.result || {};
    const passed = item.status === 'passed';
    const readOnly = result.loanCreated === false;
    const loan = result.loanNumber ? `Loan #${esc(result.loanNumber)}` : (readOnly ? 'Read-only entry check' : passed ? 'Passed' : 'No loan created');
    const safeUrl = /^https:\/\/my\.gr-dev\.com\/loan\/[0-9a-f-]{36}\/overview$/.test(result.dashboardUrl || '') ? result.dashboardUrl : '';
    const screenshotUrl = item.diagnostic?.screenshotUrl || result.screenshotUrl;
    const screenshot = screenshotUrl ? `<a href="${esc(screenshotUrl)}" target="_blank" rel="noreferrer">View failure screenshot</a>` : '';
    const account = result.email ? `<span>Account: ${esc(result.email)} · Password: ${esc(result.password || '—')}</span>` : '';
    const link = safeUrl ? `<a href="${esc(safeUrl)}" target="_blank" rel="noreferrer">Open overview · ${esc(result.email)}</a>` : '';
    const tenant = result.tenant ? `<span>${esc(result.tenant)} · ${esc(result.loanOfficerLabel || result.environment || '')}</span>` : (readOnly ? `<span>${esc(result.environment || '')} · ${esc(result.tenant || '')}</span>` : '');
    const guid = result.dashboardLoanGuid || result.resumeGuid;
    const guidLine = guid ? `<span>GR-loan-guid: ${esc(guid)}</span>` : '';
    const failedAt = !passed && result.failedRoute ? `<span>Failed at ${esc(result.failedRoute)}</span>` : '';
    const openLink = safeUrl ? `<a href="${esc(safeUrl)}" target="_blank" rel="noreferrer">Open overview · ${esc(result.email)}</a>` : '';
    return `<div class="history-row ${passed ? 'passed' : 'failed'}"><strong>${esc(item.testId)}</strong><span class="history-status">${passed ? 'PASS' : 'FAIL'}</span><span>${loan} · ${new Date(item.finishedAt).toLocaleString()}</span>${tenant}${account}${guidLine}${failedAt}${link}${screenshot}</div>`;
  }).join('') : '<div class="history-empty">Completed loans will be listed here.</div>';
}

function renderRun(run) {
  if (!run) return;
  state.runId = run.id;
  const status = $('#run-status');
  status.className = `status-chip ${run.status === 'running' ? 'running' : run.status}`;
  status.innerHTML = `<i></i> ${run.kind === 'entry-smoke' && run.status === 'passed' ? 'ENTRY READY' : esc(run.status.toUpperCase())}`;
  $('#progress-value').textContent = `${run.progress}%`;
  $('#progress-bar').style.width = `${run.progress}%`;
  $('#progress-label').textContent = run.currentStep || run.testId;
  if (run.loanOfficerLabel) $('#progress-label').textContent = `${run.loanOfficerLabel} · ${run.currentStep || run.testId}`;
  $('#elapsed').textContent = formatTime(run.elapsedSeconds || 0);
  $('#remaining').textContent = run.estimatedSecondsRemaining == null ? '--:--' : formatTime(run.estimatedSecondsRemaining);
  $('#active-step').textContent = run.currentStep || '—';
  const logs = $('#logs');
  const items = run.logs || [];
  if (items.length !== state.lastLogCount) {
    logs.innerHTML = items.map(line => `<div class="log-line ${esc(line.kind)}"><time>${new Date(line.time).toLocaleTimeString()}</time><span>${esc(line.text)}</span></div>`).join('') || '<div class="empty-log">Runner output will appear here.</div>';
    state.lastLogCount = items.length;
    logs.scrollTop = logs.scrollHeight;
  }
  $('#log-count').textContent = `${items.length} EVENTS`;
  const running = run.status === 'running';
  $('#start-run').disabled = running || !selectedTarget()?.supportsLoanCreation || selectedTarget()?.id !== 'dev-gri-enhanced' || selectedOfficer()?.id !== 'lo-b';
  $('#smoke-target').disabled = running || !selectedTarget()?.available || (selectedTarget()?.environment === 'PROD' && $('#prod-confirm-input').value !== 'READ-ONLY');
  $('#stop-run').hidden = !running;
  if (run.diagnostic && run.result) run.result.diagnostic = run.diagnostic;
  if (run.result) renderResult(run.result);
  if (!running) {
    clearInterval(state.poller);
    state.poller = null;
    refreshBootstrap();
  }
}

function formatTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

async function refreshBootstrap() {
  try {
    state.bootstrap = await api('/api/bootstrap');
    populateTemplates(state.bootstrap.templates);
    $('#dmx-target').innerHTML = state.bootstrap.entryTargets.map(target => `<option value="${esc(target.id)}" ${!target.available ? 'disabled' : ''}>${esc(target.label)}${target.flowVariant ? ` · ${esc(target.flowVariant)}` : ''}${target.available ? '' : ' · entry check unavailable'}</option>`).join('');
    $('#dmx-target').value = 'dev-gri-enhanced';
    $('#dmx-target').onchange = renderTargetLink;
    $('#loan-officer').innerHTML = state.bootstrap.loanOfficers.map(officer => `<option value="${esc(officer.id)}">${esc(officer.label)} · emp-id=${esc(officer.empId)}</option>`).join('');
    $('#loan-officer').value = 'lo-b';
    $('#loan-officer').onchange = () => { renderOfficerLink(); renderTargetLink(); };
    $('#loan-officer').addEventListener('change', renderTargetLink);
    renderOfficerLink();
    renderTargetLink();
    renderHistory(state.bootstrap.history);
    if (state.bootstrap.activeRun?.status === 'running') {
      renderRun(state.bootstrap.activeRun);
      if (!state.poller) state.poller = setInterval(pollRun, 1000);
    }
  } catch (error) { showError(error); }
}

function renderOfficerLink() {
  const officer = selectedOfficer();
  const link = $('#officer-entry-link');
  if (officer) {
    link.href = officer.url;
    link.textContent = `Open ${officer.label} DEV entry link ↗`;
  }
}

function renderTargetLink() {
  const target = selectedTarget();
  const officer = selectedOfficer();
  const link = $('#tenant-entry-link');
  if (target) {
    link.href = target.url;
    link.textContent = `Open ${target.label} entry page ↗`;
    $('#prod-confirm').hidden = target.environment !== 'PROD';
    $('#smoke-target').disabled = !target.available || (target.environment === 'PROD' && $('#prod-confirm-input').value !== 'READ-ONLY');
    const canCreateLoan = target.supportsLoanCreation && target.id === 'dev-gri-enhanced' && officer?.id === 'lo-b';
    $('#start-run').disabled = !canCreateLoan;
    $('#start-run').title = canCreateLoan ? '' : 'Loan creation is restricted to GRI Enhanced DEV with validated LO-B. Other targets support entry checks only.';
    if (!canCreateLoan) $('#progress-label').textContent = 'Entry smoke only · loan creation unavailable for this target';
  }
}

async function pollRun() {
  try { renderRun((await api('/api/run')).run); } catch (error) { showError(error); }
}

function showError(error) {
  const logs = $('#logs');
  logs.innerHTML = `<div class="log-line error"><time>ERROR</time><span>${esc(error.message)}</span></div>`;
}

$('#format-json').onclick = () => {
  try { $('#scenario').value = JSON.stringify(readScenario(), null, 2); }
  catch (error) { showError(error); }
  validateScenarioJson();
};

$('#scenario').addEventListener('input', validateScenarioJson);

$('#new-template').onclick = () => {
  startTemplateBuilder();
};

$('#cancel-template').onclick = closeTemplateBuilder;
$('#cancel-template-bottom').onclick = closeTemplateBuilder;

  $('#builder-fields').addEventListener('click', event => {
  const remove = event.target.closest('.remove-array-item');
  const add = event.target.closest('.add-array-item');
  const addCoborrower = event.target.closest('#add-coborrower');
  if (remove || add || addCoborrower) {
    applyBuilderInputs();
  }
  if (remove) {
    const list = state.builderSource[JSON.parse(remove.dataset.arrayPath)];
    list.splice(Number(remove.dataset.index), 1);
    renderBuilderFields();
  }
  if (add) {
    const list = state.builderSource[JSON.parse(add.dataset.arrayPath)];
    const template = list[0] ? JSON.parse(JSON.stringify(list[0])) : { type: '', institution: '', balance: 0 };
    for (const key of Object.keys(template)) template[key] = typeof template[key] === 'number' ? 0 : '';
    list.push(template);
    renderBuilderFields();
  }
  if (addCoborrower) {
    state.builderSource.coBorrower = {
      firstName: '', lastName: '', phone: '(312) 658-4001', ssn: '', dob: '', maritalStatus: 'Married', sameAddress: true,
      employment: { employer: '', title: '', city: '', state: '', phone: '(312) 658-4101', start: '', annualSalary: 0 },
    };
    renderBuilderFields();
  }
});

$('#create-template').onclick = async () => {
  try {
    const name = $('#builder-name').value.trim();
    const scenario = readBuilderScenario();
    if (!name) throw new Error('Enter a name for the new template.');
    if (!scenario.id || !scenario.title) throw new Error('Scenario ID and description are required.');
    if (!scenario.borrower || !scenario.residence || !scenario.employment || !scenario.property || !scenario.loan) throw new Error('The scenario is missing a required DMX section.');
    const { template } = await api('/api/templates', { method: 'POST', body: JSON.stringify({ name, testId: $('#builder-source').value, scenario }) });
    await refreshBootstrap();
    populateBuilderSources();
    $('#template').value = template.id;
    $('#test-case').value = template.testId;
    state.selectedTemplateId = template.id;
    const savedTemplate = state.bootstrap.templates.find(item => item.id === template.id);
    $('#scenario').value = JSON.stringify(savedTemplate.scenario, null, 2);
    validateScenarioJson();
    $('#template-name').value = template.name;
    closeTemplateBuilder();
  } catch (error) {
    $('#builder-message').textContent = error.message;
    $('#builder-message').className = 'builder-error';
  }
};

$('#save-template').onclick = async () => {
  try {
    if (!$('#template-name').value.trim()) throw new Error('Enter a template name first.');
    const test = selectedCase();
    const { template } = await api('/api/templates', { method: 'POST', body: JSON.stringify({ id: state.selectedTemplateId || undefined, name: $('#template-name').value, testId: test.id, scenario: readScenario() }) });
    await refreshBootstrap();
    $('#template').value = template.id;
    state.selectedTemplateId = template.id;
    const savedTemplate = state.bootstrap.templates.find(item => item.id === template.id);
    $('#scenario').value = JSON.stringify(savedTemplate.scenario, null, 2);
    validateScenarioJson();
    $('#json-state').textContent = 'SAVED LOCALLY';
    $('#json-state').className = 'json-state valid';
  } catch (error) { showError(error); }
};

$('#start-run').onclick = async () => {
  $('#result-panel').hidden = true;
  state.lastLogCount = 0;
  try {
    const test = selectedCase();
    if (!test?.automated) throw new Error('Choose an automated test case.');
    if (!validateScenarioJson()) throw new Error('Fix the JSON syntax before starting the run.');
    const scenario = readScenario();
    const officer = selectedOfficer();
    const target = selectedTarget();
    if (!target?.supportsLoanCreation || target.id !== 'dev-gri-enhanced' || officer?.id !== 'lo-b') throw new Error('Loan creation currently supports GRI Enhanced DEV with LO-B only. Select “Check entry page only” for other tenants/environments.');
    const { run } = await api('/api/run', { method: 'POST', body: JSON.stringify({ testId: test.id, scenario, email: $('#email').value, password: $('#password').value, loanOfficerId: officer?.id, targetId: target.id }) });
    run.loanOfficerLabel = officer?.label;
    renderRun(run);
    clearInterval(state.poller);
    state.poller = setInterval(pollRun, 1000);
  } catch (error) { showError(error); }
};

$('#stop-run').onclick = async () => {
  try { await api('/api/stop', { method: 'POST', body: '{}' }); } catch (error) { showError(error); }
};

$('#smoke-target').onclick = async () => {
  try {
    const target = selectedTarget();
    const isProd = target.environment === 'PROD';
    if (isProd && $('#prod-confirm-input').value !== 'READ-ONLY') throw new Error('Type READ-ONLY to run a production entry check.');
    const { run } = await api('/api/entry-smoke', { method: 'POST', headers: isProd ? { 'x-dmx-prod-smoke-confirm': 'read-only-entry-check' } : {}, body: JSON.stringify({ targetId: target.id }) });
    run.kind = 'entry-smoke';
    state.lastLogCount = 0;
    $('#result-panel').hidden = true;
    renderRun(run);
    clearInterval(state.poller);
    state.poller = setInterval(pollRun, 1000);
  } catch (error) { showError(error); }
};

$('#prod-confirm-input').addEventListener('input', renderTargetLink);

async function init() {
  await refreshBootstrap();
  populateCases(state.bootstrap.cases);
  populateBuilderSources();
  const first = selectedCase();
  const scenario = state.bootstrap.scenarios.find(item => item.id === first?.scenarioRef);
  $('#scenario').value = JSON.stringify(scenario, null, 2);
  renderTargetLink();
}
init().catch(showError);

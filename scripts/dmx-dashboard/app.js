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
function readScenario() {
  try { return JSON.parse($('#scenario').value); }
  catch (error) { throw new Error(`Scenario JSON: ${error.message}`); }
}

function populateCases(cases) {
  $('#test-case').innerHTML = cases.map(test => `<option value="${esc(test.id)}" ${!test.automated ? 'disabled' : ''}>${esc(test.id)} · ${esc(test.title)}</option>`).join('');
  $('#test-case').addEventListener('change', () => {
    const test = selectedCase();
    const scenario = state.bootstrap.scenarios.find(item => item.id === test.scenarioRef);
    if (scenario) $('#scenario').value = JSON.stringify(scenario, null, 2);
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

function renderHistory(history) {
  $('#history-count').textContent = history.length;
  $('#history-list').innerHTML = history.length ? history.map(item => {
    const result = item.result || {};
    const passed = item.status === 'passed';
    const loan = result.loanNumber ? `Loan #${esc(result.loanNumber)}` : (passed ? 'Passed' : 'No loan created');
    const safeUrl = /^https:\/\/my\.gr-dev\.com\/loan\/[0-9a-f-]{36}\/overview$/.test(result.dashboardUrl || '') ? result.dashboardUrl : '';
  const screenshot = item.diagnostic?.screenshotUrl ? `<a href="${esc(item.diagnostic.screenshotUrl)}" target="_blank" rel="noreferrer">View failure screenshot</a>` : '';
    const link = safeUrl ? `<a href="${esc(safeUrl)}" target="_blank" rel="noreferrer">Open overview · ${esc(result.email)}</a>` : `<span>${esc(result.email || '')}</span>`;
    const account = result.email ? `<span>Account: ${esc(result.email)} · Password: ${esc(result.password || '—')}</span>` : '';
    const guid = result.dashboardLoanGuid || result.resumeGuid;
    const guidLine = guid ? `<span>GR-loan-guid: ${esc(guid)}</span>` : '';
    const failedAt = !passed && item.diagnostic ? `<span>Failed at ${esc(item.diagnostic.route || item.diagnostic.page || 'unknown page')}</span>` : '';
    return `<div class="history-row ${passed ? 'passed' : 'failed'}"><strong>${esc(item.testId)}</strong><span class="history-status">${passed ? 'PASS' : 'FAIL'}</span><span>${loan} · ${new Date(item.finishedAt).toLocaleString()}</span>${account}${guidLine}${failedAt}${link}${screenshot}</div>`;
  }).join('') : '<div class="history-empty">Completed loans will be listed here.</div>';
}

function renderResult(result) {
  if (!result) return;
  $('#result-panel').hidden = false;
  const passed = result.status === 'complete' || result.status === 'resumed-complete' || result.status === 'passed';
  $('#result-panel').className = `result-panel panel ${passed ? 'passed' : 'failed'}`;
  $('#result-kicker').textContent = passed ? '03 / LOAN CREATED' : '03 / RUN FAILED';
  $('#result-heading').textContent = passed ? 'Loan created' : 'Loan creation failed';
  $('#result-mark').textContent = passed ? '✓' : '!';
  $('#run-status').className = `status-chip ${passed ? 'passed' : 'failed'}`;
  $('#run-status').innerHTML = `<i></i> ${passed ? 'PASSED' : 'FAILED'}`;
  $('#result-email').textContent = result.email || '—';
  $('#result-password').textContent = result.password || '—';
  $('#result-status').textContent = result.status || '—';
  $('#result-number').textContent = result.loanNumber ? `#${result.loanNumber}` : (passed ? 'Not captured' : 'Not created');
  $('#result-guid').textContent = result.dashboardLoanGuid || 'Not captured';
  $('#result-resume-guid').textContent = result.resumeGuid || 'Not applicable';
  const link = $('#result-link');
  const safeUrl = /^https:\/\/my\.gr-dev\.com\/loan\/[0-9a-f-]{36}\/overview$/.test(result.dashboardUrl || '') ? result.dashboardUrl : '';
  link.href = safeUrl || '#';
  link.hidden = !safeUrl;
  const failure = $('#failure-details');
  failure.hidden = passed;
  if (!passed) {
    $('#failed-page').textContent = result.failedPage || result.diagnostic?.page || 'Page URL was not captured';
    $('#failed-route').textContent = result.failedRoute || result.diagnostic?.route || 'Route was not captured';
    $('#failure-error').textContent = result.note || result.diagnostic?.error || 'The run ended without a completed loan.';
    const screenshotUrl = result.screenshotUrl || result.diagnostic?.screenshotUrl || '';
    $('#screenshot-link').href = screenshotUrl || '#';
    $('#screenshot-link').hidden = !screenshotUrl;
    $('#failure-screenshot').src = screenshotUrl;
  }
}

function renderRun(run) {
  if (!run) return;
  state.runId = run.id;
  const status = $('#run-status');
  status.className = `status-chip ${run.status === 'running' ? 'running' : run.status}`;
  status.innerHTML = `<i></i> ${esc(run.status.toUpperCase())}`;
  $('#progress-value').textContent = `${run.progress}%`;
  $('#progress-bar').style.width = `${run.progress}%`;
  $('#progress-label').textContent = run.currentStep || run.testId;
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
  $('#start-run').disabled = running;
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
    renderHistory(state.bootstrap.history);
    if (state.bootstrap.activeRun?.status === 'running') {
      renderRun(state.bootstrap.activeRun);
      if (!state.poller) state.poller = setInterval(pollRun, 1000);
    }
  } catch (error) { showError(error); }
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
    const { run } = await api('/api/run', { method: 'POST', body: JSON.stringify({ testId: test.id, scenario, email: $('#email').value, password: $('#password').value }) });
    renderRun(run);
    clearInterval(state.poller);
    state.poller = setInterval(pollRun, 1000);
  } catch (error) { showError(error); }
};

$('#stop-run').onclick = async () => {
  try { await api('/api/stop', { method: 'POST', body: '{}' }); } catch (error) { showError(error); }
};

async function init() {
  await refreshBootstrap();
  populateCases(state.bootstrap.cases);
  populateBuilderSources();
  const first = selectedCase();
  const scenario = state.bootstrap.scenarios.find(item => item.id === first?.scenarioRef);
  $('#scenario').value = JSON.stringify(scenario, null, 2);
}
init().catch(showError);

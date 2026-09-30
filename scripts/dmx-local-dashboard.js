#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('ts-node/register/transpile-only');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.DMX_DASHBOARD_PORT || 4179);
const CASES_FILE = path.join(ROOT, 'test-data/DMX/dmx-test-cases.csv');
const TEMPLATES_FILE = path.join(ROOT, 'test-data/DMX/dmx-dashboard-templates.json');
const RESULTS_FILE = path.join(ROOT, 'test-data/DMX/dmx-dashboard-results.json');
const RUN_CONFIG = path.join(ROOT, 'test-data/DMX/dmx-dashboard-run.json');
const { loadScenarios } = require('../tests/projects/DMX/dmx-data.ts');
const { DMX_ENTRY_TARGETS } = require('../tests/projects/DMX/dmx-environments.ts');
const publicDir = path.join(__dirname, 'dmx-dashboard');
const LOAN_OFFICERS = [
  { id: 'lo-a', label: 'DMX Testlo (LO-A)', empId: '12657', url: 'https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=12657', expectedName: 'Testlo' },
  { id: 'lo-b', label: 'DMX Testlo (LO-B)', empId: '4723', url: 'https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=4723', expectedName: 'John Sample' },
  { id: 'lo-c', label: 'DMX Indu (LO-C)', empId: '6068', url: 'https://apply-gri.dev.saas.rate.com/apply/lo-selection?emp-id=6068', expectedName: 'Indu' },
];

let activeRun = null;
let queue = Promise.resolve();

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...body] = rows;
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function safeEqualOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${HOST}:${PORT}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) { reject(new Error('Request body is too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request')); }
    });
  });
}

function publicRun(run) {
  if (!run) return null;
  const { child, password, accountRowsAtStart, ...safe } = run;
  if (!run.finishedAt) {
    safe.elapsedSeconds = Math.floor((Date.now() - run.startedAt) / 1000);
    safe.estimatedSecondsRemaining = run.progress > 0
      ? Math.max(0, Math.ceil(safe.elapsedSeconds / (run.progress / 100) - safe.elapsedSeconds))
      : null;
  }
  return safe;
}

function addLog(run, text, kind = 'info') {
  const line = String(text).replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (!line) return;
  const diagnosticLine = line.match(/DMX_DASHBOARD_DIAGNOSTIC:(\{.*\})/);
  if (diagnosticLine) {
    try {
      run.diagnostic = JSON.parse(diagnosticLine[1]);
      if (run.diagnostic.screenshot) {
        if (run.outputDir && path.isAbsolute(run.diagnostic.screenshot)) run.diagnostic.screenshot = path.relative(ROOT, run.diagnostic.screenshot);
        run.diagnostic.screenshotUrl = `/api/runs/${run.id}/screenshot`;
      }
    } catch { /* Preserve the raw log line if a diagnostic is malformed. */ }
  }
  const route = /\[[^\]]+\] step (\d+): (.+)$/.exec(line);
  if (route) {
    run.steps = Math.max(run.steps, Number(route[1]) + 1);
    run.currentStep = route[2];
    run.progress = Math.min(94, Math.max(run.progress, Math.round(run.steps / 40 * 94)));
  } else if (/Running|starting|Register|registered|abandoned|complete|loan #|MFA enrollment/i.test(line)) {
    run.progress = Math.min(94, Math.max(run.progress, run.progress + 2));
  }
  const elapsedSeconds = Math.max(1, (Date.now() - run.startedAt) / 1000);
  run.elapsedSeconds = Math.floor(elapsedSeconds);
  if (run.progress > 0 && run.progress < 95) {
    run.estimatedSecondsRemaining = Math.max(0, Math.ceil(elapsedSeconds / (run.progress / 100) - elapsedSeconds));
  }
  run.logs.push({ time: new Date().toISOString(), text: line, kind });
  if (run.logs.length > 1200) run.logs.splice(0, run.logs.length - 1200);
}

function finishRun(run, code, signal) {
  if (run.finishedAt) return;
  run.finishedAt = new Date().toISOString();
  run.exitCode = code;
  run.status = code === 0 ? 'passed' : 'failed';
  run.progress = code === 0 ? 100 : run.progress;
  run.estimatedSecondsRemaining = 0;
  run.currentStep = code === 0 ? 'Complete' : 'Failed';
  if (signal) addLog(run, `Runner stopped by ${signal}`, 'error');
  const diagnosticFile = run.outputDir ? path.join(ROOT, run.outputDir, 'dmx-dashboard-diagnostic.json') : '';
  run.diagnostic = diagnosticFile ? readJson(diagnosticFile, run.diagnostic) : run.diagnostic;
  if (run.diagnostic) run.diagnostic.screenshotUrl = `/api/runs/${run.id}/screenshot`;
  if (run.diagnostic && run.outputDir) {
    const diagnosticFile = path.join(ROOT, run.outputDir, 'dmx-dashboard-diagnostic.json');
    fs.mkdirSync(path.dirname(diagnosticFile), { recursive: true });
    fs.writeFileSync(diagnosticFile, JSON.stringify(run.diagnostic, null, 2), { mode: 0o600 });
  }
  run.result = {
    email: run.email,
    password: run.password,
    status: run.status,
    tenant: run.targetLabel || '',
    environment: 'DEV',
    loanOfficerLabel: run.loanOfficerLabel || '',
    resumeGuid: '',
    dashboardLoanGuid: '',
    loanNumber: '',
    dashboardUrl: '',
    note: run.diagnostic?.error || '',
    failedPage: run.diagnostic?.page || '',
    failedRoute: run.diagnostic?.route || '',
    screenshotUrl: run.diagnostic?.screenshotUrl || '',
  };
  try {
    const rows = parseCsv(fs.readFileSync(path.join(ROOT, 'test-data/DMX/dmx-created-accounts.csv'), 'utf8'));
    const matching = rows.slice(run.accountRowsAtStart).filter(row => row.email === run.email && row.scenarioId === run.testId);
    const latest = matching[matching.length - 1];
    if (latest) {
      run.result = {
        email: latest.email,
        password: run.password,
        status: latest.status,
        resumeGuid: latest.stoppedAt ? latest.loanGuid : '',
        dashboardLoanGuid: latest.dashboardUrl ? /\/loan\/([^/]+)\/overview/.exec(latest.dashboardUrl)?.[1] || '' : (!latest.stoppedAt ? latest.loanGuid : ''),
        loanNumber: latest.loanNumber,
        dashboardUrl: latest.dashboardUrl,
        note: run.diagnostic?.error || latest.note,
        failedPage: run.diagnostic?.page || '',
        failedRoute: run.diagnostic?.route || '',
        screenshotUrl: run.diagnostic?.screenshotUrl || '',
      };
    }
    if (code === 0 && !['complete', 'resumed-complete'].includes(run.result?.status)) {
      run.status = 'failed';
      run.result.status = 'failed';
      run.result.note ||= 'The test ended without completing the loan.';
    } else if (code === 0) run.status = 'passed';
    run.result.status = run.status === 'passed' ? (run.result.status || 'complete') : 'failed';
  } catch (error) { addLog(run, `Could not read run result: ${error.message}`, 'error'); }
  run.currentStep = run.status === 'passed' ? 'Complete' : 'Failed';
  run.result.status = run.status === 'passed' ? (run.result.status || 'complete') : 'failed';
  const history = readJson(RESULTS_FILE, []);
  history.unshift({
    id: run.id, testId: run.testId, title: run.title, status: run.status,
    finishedAt: run.finishedAt, result: run.result || null, diagnostic: run.diagnostic || null,
  });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(history.slice(0, 30), null, 2), { mode: 0o600 });
  addLog(run, `Run ${run.status}${run.result?.loanNumber ? `: loan #${run.result.loanNumber}` : ''}`, code === 0 ? 'success' : 'error');
  try { fs.unlinkSync(RUN_CONFIG); } catch {}
  run.child = null;
}

function launchRun(run, scenario, password, loanOfficer, target) {
  const config = {
    testId: run.testId, email: run.email, password, scenario,
    loanOfficerId: loanOfficer.id, loanOfficerLabel: loanOfficer.label, loanOfficerName: loanOfficer.expectedName, entryUrl: loanOfficer.url,
    targetId: target.id, environment: target.environment, tenant: target.tenant,
  };
  fs.writeFileSync(RUN_CONFIG, JSON.stringify(config), { mode: 0o600 });
  const spec = path.resolve(ROOT, run.specFile);
  const runDate = new Date().toISOString().slice(0, 10);
  const output = `test-results/${runDate}/DMX/runs/${run.id}`;
  run.outputDir = output;
  const args = ['test', spec, '--project=chromium', '--workers=1', `--output=${output}`];
  const env = {
    ...process.env,
    TEST_PROJECT: 'DMX',
    RUN_ID: run.id,
    DMX_DASHBOARD_RUN_CONFIG: RUN_CONFIG,
    DMX_DASHBOARD_OUTPUT_DIR: output,
  };
  delete env.DMX_MFA_MANUAL;
  const child = spawn(path.join(ROOT, 'node_modules/.bin/playwright'), args, {
    cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  run.child = child;
  addLog(run, `Launching ${run.testId} with one Chromium worker; account ${run.email}`);
  let buffers = { stdout: '', stderr: '' };
  for (const [stream, kind] of [[child.stdout, 'info'], [child.stderr, 'error']]) {
    stream.on('data', chunk => {
      const key = stream === child.stdout ? 'stdout' : 'stderr';
      buffers[key] += chunk.toString();
      const lines = buffers[key].split(/\r?\n/);
      buffers[key] = lines.pop() || '';
      for (const line of lines) addLog(run, line, kind);
    });
  }
  child.on('error', error => { addLog(run, error.message, 'error'); finishRun(run, 1); });
  child.on('close', (code, signal) => {
    for (const text of Object.values(buffers)) if (text) addLog(run, text, 'info');
    finishRun(run, code ?? 1, signal);
  });
}

function launchEntrySmoke(run) {
  const target = DMX_ENTRY_TARGETS.find(entry => entry.id === run.target.id);
  const runDate = new Date().toISOString().slice(0, 10);
  const output = `test-results/${runDate}/DMX/entry-smoke/${run.id}`;
  run.outputDir = output;
  const spec = path.join(ROOT, 'tests/projects/DMX/DMX-TENANT-ENTRY-SMOKE.spec.ts');
  const args = ['test', spec, '--project=chromium', '--workers=1', `--output=${output}`];
  const child = spawn(path.join(ROOT, 'node_modules/.bin/playwright'), args, {
    cwd: ROOT, env: { ...process.env, TEST_PROJECT: 'DMX', RUN_ID: run.id, DMX_ENTRY_TARGET_ID: target.id }, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  run.child = child;
  addLog(run, `Read-only smoke check: ${target.label} · ${target.url}`);
  let buffers = { stdout: '', stderr: '' };
  for (const [stream, kind] of [[child.stdout, 'info'], [child.stderr, 'error']]) {
    stream.on('data', chunk => {
      const key = stream === child.stdout ? 'stdout' : 'stderr';
      buffers[key] += chunk.toString();
      const lines = buffers[key].split(/\r?\n/);
      buffers[key] = lines.pop() || '';
      for (const line of lines) {
        const result = line.match(/DMX_ENTRY_SMOKE_RESULT:(\{.*\})/);
        if (result) { try { run.smokeResult = JSON.parse(result[1]); } catch {} }
        const diagnostic = line.match(/DMX_ENTRY_SMOKE_DIAGNOSTIC:(\{.*\})/);
        if (diagnostic) { try { run.diagnostic = JSON.parse(diagnostic[1]); } catch {} }
        const testResult = line.match(/(\d+) passed(?: \((\d+)\))?/);
        if (testResult && run.smokeResult) run.smokeStatus = 'passed';
        if (/\bfailed\b|timed out/i.test(line)) run.smokeStatus = 'failed';
        addLog(run, line, kind);
      }
    });
  }
  child.on('error', error => { addLog(run, error.message, 'error'); finishEntrySmoke(run, 1); });
  child.on('close', (code, signal) => {
    for (const text of Object.values(buffers)) if (text) {
      const result = text.match(/DMX_ENTRY_SMOKE_RESULT:(\{.*\})/);
      if (result) { try { run.smokeResult = JSON.parse(result[1]); } catch {} }
      const diagnostic = text.match(/DMX_ENTRY_SMOKE_DIAGNOSTIC:(\{.*\})/);
      if (diagnostic) { try { run.diagnostic = JSON.parse(diagnostic[1]); } catch {} }
      const testResult = text.match(/(\d+) passed(?: \((\d+)\))?/);
      if (testResult && run.smokeResult) run.smokeStatus = 'passed';
      if (/\d+ failed|\bfailed\b|timed out/i.test(text)) run.smokeStatus = 'failed';
      addLog(run, text, 'info');
    }
    finishEntrySmoke(run, code ?? 1, signal);
  });
}

function finishEntrySmoke(run, code, signal) {
  if (run.finishedAt) return;
  run.finishedAt = new Date().toISOString();
  run.exitCode = code;
  run.status = code === 0 && run.smokeResult && run.smokeResult.status === 'entry-ready' && run.smokeStatus === 'passed' ? 'passed' : 'failed';
  run.progress = run.status === 'passed' ? 100 : run.progress;
  run.estimatedSecondsRemaining = 0;
  run.currentStep = run.status === 'passed' ? 'Entry page verified; no loan created' : 'Entry check failed';
  if (signal) addLog(run, `Smoke check stopped by ${signal}`, 'error');
  run.diagnostic = run.diagnostic || (run.outputDir ? readJson(path.join(ROOT, run.outputDir, 'dmx-dashboard-diagnostic.json'), null) : null);
  if (run.outputDir && run.target && run.status === 'failed' && !run.diagnostic) {
    const screenshot = path.join(run.outputDir, `${run.target.id}-entry-page.png`);
    if (fs.existsSync(path.join(ROOT, screenshot))) run.diagnostic = { screenshot, screenshotUrl: `/api/runs/${run.id}/screenshot`, page: run.target.url, route: new URL(run.target.url).pathname, error: `Expected ${run.target.brand} entry page on ${run.target.appHost} at ${run.target.routePattern}` };
  }
  if (run.diagnostic) run.diagnostic.screenshotUrl = `/api/runs/${run.id}/screenshot`;
  run.result = {
    status: run.status, tenant: run.target.tenant, environment: run.target.environment,
    url: run.target.url, landedUrl: run.smokeResult?.landedUrl || run.diagnostic?.page || '',
    pageTitle: run.smokeResult?.title || '', loanCreated: false,
    failedPage: run.status === 'failed' ? run.diagnostic?.page || run.target.url : '',
    failedRoute: run.status === 'failed' ? run.diagnostic?.route || new URL(run.diagnostic?.page || run.target.url).pathname : '',
    note: run.status === 'failed' ? run.diagnostic?.error || `Expected ${run.target.brand} entry page on ${run.target.appHost} at ${run.target.routePattern}` : '',
    screenshotUrl: run.diagnostic?.screenshotUrl || '',
    diagnostic: run.diagnostic,
  };
  const history = readJson(RESULTS_FILE, []);
  history.unshift({ id: run.id, testId: run.testId, title: run.title, status: run.status, finishedAt: run.finishedAt, result: run.result, diagnostic: run.diagnostic });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(history.slice(0, 30), null, 2), { mode: 0o600 });
  addLog(run, `Read-only entry check ${run.status}; no loan was created`, run.status === 'passed' ? 'success' : 'error');
  run.child = null;
}

async function route(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname.startsWith('/api/') && !safeEqualOrigin(req)) return send(res, 403, { error: 'Cross-origin requests are not accepted.' });
  const screenshotRoute = /^\/api\/runs\/(dmx-[\w-]+)\/screenshot$/.exec(url.pathname);
  if (screenshotRoute && req.method === 'GET') {
    const runId = screenshotRoute[1];
    const historyItem = readJson(RESULTS_FILE, []).find(item => item.id === runId);
    const diagnostic = activeRun?.id === runId ? activeRun.diagnostic : historyItem?.diagnostic;
    const relative = diagnostic?.screenshot;
    if (!relative || !relative.startsWith(`test-results/`) || !/\.(png|jpe?g)$/.test(relative)) return send(res, 404, { error: 'No diagnostic screenshot was captured for this run.' });
    const full = path.resolve(ROOT, relative);
    const expectedPrefix = path.resolve(ROOT, 'test-results') + path.sep;
    if (!full.startsWith(expectedPrefix) || !fs.existsSync(full)) return send(res, 404, { error: 'Failure screenshot is unavailable.' });
    const contentType = relative.endsWith('.png') ? 'image/png' : 'image/jpeg';
    res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    return fs.createReadStream(full).pipe(res);
  }
  if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
    const cases = parseCsv(fs.readFileSync(CASES_FILE, 'utf8')).map(row => ({
      id: row.test_id, title: row.title, category: row.category, product: row.product,
      scenarioRef: row.scenario_ref, specFile: row.spec_file, stopAt: row.stop_at_route,
      automated: row.automated === 'yes' && row.category !== 'entry', expected: row.expected_result,
    }));
    return send(res, 200, {
      cases, scenarios: loadScenarios(),
      loanOfficers: LOAN_OFFICERS,
      entryTargets: DMX_ENTRY_TARGETS,
      templates: readJson(TEMPLATES_FILE, []),
      history: readJson(RESULTS_FILE, []),
      activeRun: publicRun(activeRun),
    });
  }
  if (url.pathname === '/api/templates' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.name?.trim() || !body.scenario || typeof body.scenario !== 'object') return send(res, 400, { error: 'Template name and scenario data are required.' });
    const templates = readJson(TEMPLATES_FILE, []).filter(t => t.id !== body.id);
    const template = { id: body.id || `template-${Date.now()}`, name: body.name.trim().slice(0, 80), testId: body.testId, scenario: body.scenario, updatedAt: new Date().toISOString() };
    templates.unshift(template);
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates.slice(0, 50), null, 2), { mode: 0o600 });
    return send(res, 200, { template });
  }
  if (url.pathname === '/api/run' && req.method === 'POST') {
    if (activeRun && !activeRun.finishedAt) return send(res, 409, { error: 'A DMX run is already active. Wait for it to finish.' });
    const body = await readBody(req);
    if (activeRun && !activeRun.finishedAt) return send(res, 409, { error: 'A DMX run is already active. Wait for it to finish.' });
    const target = DMX_ENTRY_TARGETS.find(entry => entry.id === body.targetId);
    if (!target || target.id !== 'dev-gri-enhanced' || !target.supportsLoanCreation || body.loanOfficerId !== 'lo-b' || !LOAN_OFFICERS.some(officer => officer.id === body.loanOfficerId)) {
      return send(res, 400, { error: 'Loan creation is restricted to GRI Enhanced DEV with LO-B. Other targets are read-only entry checks.' });
    }
    const testCase = parseCsv(fs.readFileSync(CASES_FILE, 'utf8')).find(row => row.test_id === body.testId);
    if (!testCase || testCase.automated !== 'yes' || !testCase.spec_file || !/^tests\/projects\/DMX\/[\w.-]+\.spec\.ts$/.test(testCase.spec_file)) {
      return send(res, 400, { error: 'Select an automated test case from the catalog.' });
    }
    const scenario = body.scenario;
    if (!scenario || !['purchase', 'refinance', 'preapproval'].includes(scenario.product) || !scenario.borrower || !scenario.employment || !scenario.property || !scenario.loan || !scenario.residence) {
      return send(res, 400, { error: 'The selected scenario is missing required DMX data.' });
    }
    const email = String(body.email || '').trim() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Enter a valid email address.' });
    const password = String(body.password || 'Test123!');
    if (password.length < 8 || password.length > 128) return send(res, 400, { error: 'Password must contain 8 to 128 characters.' });
    const loanOfficer = LOAN_OFFICERS.find(officer => officer.id === body.loanOfficerId);
  const run = {
      id: `dmx-${Date.now()}`, testId: testCase.test_id, title: testCase.title,
      specFile: testCase.spec_file, email: email || '', password, status: 'running', loanOfficerId: loanOfficer.id, loanOfficerLabel: loanOfficer.label, loanOfficerName: loanOfficer.expectedName,
      targetId: target.id, targetLabel: target.label,
      progress: 0, estimatedSecondsRemaining: null, startedAt: Date.now(),
      elapsedSeconds: 0, currentStep: 'Starting browser', steps: 0, logs: [],
    };
    try {
      run.accountRowsAtStart = parseCsv(fs.readFileSync(path.join(ROOT, 'test-data/DMX/dmx-created-accounts.csv'), 'utf8')).length;
    } catch { run.accountRowsAtStart = 0; }
    if (!run.email) {
      const tag = testCase.test_id.split('-').slice(0, 2).join('').toLowerCase();
      run.email = `my-dmx-${tag}${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}--ra@yopmail.com`;
    }
    activeRun = run;
    queue = queue.then(() => launchRun(run, { ...scenario, id: testCase.scenario_ref || testCase.test_id }, password, loanOfficer, target));
    return send(res, 202, { run: publicRun(run) });
  }
  if (url.pathname === '/api/run' && req.method === 'GET') return send(res, 200, { run: publicRun(activeRun) });
  if (url.pathname === '/api/entry-smoke' && req.method === 'POST') {
    if (activeRun && !activeRun.finishedAt) return send(res, 409, { error: 'A DMX run is already active.' });
    const body = await readBody(req);
    const target = DMX_ENTRY_TARGETS.find(entry => entry.id === body.targetId && entry.available);
    if (!target) return send(res, 400, { error: 'Select an approved DMX environment and tenant.' });
    if (target.environment === 'PROD' && req.headers['x-dmx-prod-smoke-confirm'] !== 'read-only-entry-check') {
      return send(res, 400, { error: 'For production, confirm a read-only entry check by typing READ-ONLY in the dashboard first.' });
    }
    const run = {
      id: `dmx-${Date.now()}`, kind: 'entry-smoke', testId: `ENTRY-${target.id}`, title: `${target.label} read-only entry smoke`,
      status: 'running', progress: 0, estimatedSecondsRemaining: null, startedAt: Date.now(),
      elapsedSeconds: 0, currentStep: `Checking ${target.label}`, steps: 0, logs: [], target,
    };
    activeRun = run;
    queue = queue.then(() => launchEntrySmoke(run));
    return send(res, 202, { run: publicRun(run) });
  }
  if (url.pathname === '/api/stop' && req.method === 'POST') {
    if (!activeRun?.child || activeRun.finishedAt) return send(res, 409, { error: 'There is no active run to stop.' });
    activeRun.child.kill('SIGTERM');
    addLog(activeRun, 'Stop requested', 'warning');
    return send(res, 202, { ok: true });
  }
  if (req.method === 'GET') {
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const file = url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
    const full = path.join(publicDir, file);
    if (path.dirname(full) !== publicDir || !fs.existsSync(full)) return send(res, 404, { error: 'Not found' });
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    return fs.createReadStream(full).pipe(res);
  }
  send(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(error => {
    if (!res.headersSent) send(res, 500, { error: error.message });
    else res.end();
  });
});
server.listen(PORT, HOST, () => console.log(`DMX local runner: http://${HOST}:${PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (activeRun?.child && !activeRun.finishedAt) activeRun.child.kill('SIGTERM');
    try { fs.unlinkSync(RUN_CONFIG); } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}

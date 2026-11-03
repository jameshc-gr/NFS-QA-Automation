import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, realpathSync, renameSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { z } from 'zod';
import { root, tenants, parseLabRequest, labRequestSchema, parsedInput, parsedResponse, labDirectory, runIdPattern } from './contracts';
import { requestSchema, responseSchema } from '../../../tests/projects/solution-finder/workbook-scenarios/helpers/contracts';
import { getLabCases } from './catalog';

type Artifact = { name: string; path: string; url: string };
type Run = {
  id: string; date: string; tenant: string; status: 'running' | 'passed' | 'failed';
  startedAt: string; finishedAt?: string; error?: string; logs: string;
  artifacts: Artifact[]; result?: Record<string, unknown>; ownerPid?: number;
};
const selection = z.object({
  tenant: z.enum(['gri', 'owning', 'citywide', 'certainty', 'onq']),
  request: z.unknown(), preserveEmail: z.boolean().default(false), confirmed: z.literal(true)
}).strict();
const suiteSelection = selection.omit({ request: true }).extend({
  caseIds: z.array(z.string().min(1).max(100)).min(1).max(500)
    .refine(ids => new Set(ids).size === ids.length, 'Choose each scenario only once.')
}).strict();
const suiteIdPattern = /^sf-suite-\d{8}T\d{9}Z-[a-f0-9]{8}$/;
const suiteSchema = z.object({
  id: z.string().regex(suiteIdPattern), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tenant: selection.shape.tenant, preserveEmail: z.boolean(),
  status: z.enum(['running', 'passed', 'failed', 'stopped']),
  startedAt: z.string(), finishedAt: z.string().optional(), ownerPid: z.number().int().positive(),
  stopRequested: z.boolean(), error: z.string().optional(),
  items: z.array(z.object({
    caseId: z.string(), name: z.string(), request: requestSchema,
    status: z.enum(['pending', 'running', 'passed', 'failed', 'skipped']),
    runId: z.string().regex(runIdPattern).optional(), error: z.string().optional()
  })).min(1)
}).strict();
type Suite = z.infer<typeof suiteSchema>;
const templateName = z.string().trim().min(1, 'Enter a template name.').max(120)
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'Template names cannot contain control characters.');
const templateInput = z.object({
  name: templateName, request: z.unknown(), sourceCaseId: z.string().min(1).max(100).nullable().default(null)
}).strict();
const savedTemplate = z.object({
  id: z.string().regex(/^SF-CUSTOM-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  name: templateName, createdAt: z.string().datetime(),
  sourceCaseId: z.string().nullable(), request: labRequestSchema
}).strict();
const artifacts = [
  'actual-inquiry-request.json', 'actual-inquiry-response.json', 'actual-ui-offers.json',
  'actual-ui-offers.txt', 'actual-response-body.txt', 'comparison.json', 'run-result.json',
  'qa-comment.txt', 'offers.png', 'page-source.html', 'trace.zip', 'test-failed-1.png'
];
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
class InputError extends Error {}
function processExists(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
    throw error;
  }
}
const json = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
function save(file: string, value: unknown) {
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}
function findFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? findFiles(file) : entry.isFile() ? [file] : [];
  });
}
async function body(request: IncomingMessage) {
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 512_000) throw new InputError('Request JSON exceeds 512 KB.');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export function createLabServer(options: {
  launch?: (directory: string, tenant: string) => ChildProcess;
  templateDirectory?: string;
} = {}) {
  const token = randomBytes(32).toString('hex');
  const publicAssets = new Map(['index.html', 'app.js', 'style.css', 'suite-results.html', 'suite-results.js'].map(name =>
    [name, readFileSync(join(__dirname, 'public', name))]));
  const templateDirectory = options.templateDirectory ??
    join(root, 'test-data/solution-finder/workbook-scenarios/lab-templates');
  function readTemplates() {
    if (!existsSync(templateDirectory)) return [];
    return readdirSync(templateDirectory).filter(name => name.endsWith('.json')).map(name => {
      try {
        const file = realpathSync(join(templateDirectory, name));
        if (!file.startsWith(realpathSync(templateDirectory) + sep)) throw new Error('Template is outside its input directory.');
        const template = savedTemplate.parse(json(file));
        if (name !== `${template.id}.json`) throw new Error('Template filename does not match its ID.');
        return {
          ...template, group: 'Saved templates', sourceRequest: null,
          notes: [`Saved reusable QA input${template.sourceCaseId ? `; copied from ${template.sourceCaseId}` : ''}. Saving does not execute a test or certify offers.`]
        };
      } catch (error) {
        throw new Error(`Cannot load saved template ${name}: ${errorText(error)}`);
      }
    }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
  const reference = (scenario: object | undefined) =>
    scenario && 'profileReference' in scenario ? scenario.profileReference : null;
  const cases = () => {
    const builtins = getLabCases();
    return [...builtins, ...readTemplates().map(template => ({
      ...template, profileReference: reference(builtins.find(scenario => scenario.id === template.sourceCaseId))
    }))];
  };
  const runs = new Map<string, Run>();
  const directories = new Map<string, string>();
  const suites = new Map<string, Suite>();
  let activeSuite: Suite | undefined;
  let closing = false;
  const suiteDirectory = (suite: Suite) => {
    if (!suiteIdPattern.test(suite.id) || !/^\d{4}-\d{2}-\d{2}$/.test(suite.date)) throw new Error('Invalid suite identifier/date.');
    return join(root, 'test-results', suite.date, 'solution-finder/lab', suite.id);
  };
  const persistSuite = (suite: Suite) => save(join(suiteDirectory(suite), 'suite.json'), suite);
  let active: { run: Run; child: ChildProcess } | undefined;
  const results = join(root, 'test-results');
  if (existsSync(results)) {
    for (const date of readdirSync(results).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))) {
      const base = join(results, date, 'solution-finder/lab');
      if (!existsSync(base)) continue;
      for (const id of readdirSync(base).filter(id => suiteIdPattern.test(id))) {
        const suite = suiteSchema.parse(json(join(base, id, 'suite.json')));
        if (suite.id !== id || suite.date !== date) throw new Error('Suite directory does not match saved state.');
        if (suite.status === 'running') {
          if (processExists(suite.ownerPid)) throw new Error(`Solution Finder Lab suite ${id} is still owned by process ${suite.ownerPid}. Wait for it to finish.`);
          suite.status = 'failed'; suite.finishedAt = new Date().toISOString();
          suite.error = 'Lab restarted before this suite completed. No pending scenarios were resumed; inspect existing evidence before starting another suite.';
          for (const item of suite.items) {
            if (item.status === 'running') { item.status = 'failed'; item.error = suite.error; }
            if (item.status === 'pending') { item.status = 'skipped'; item.error = suite.error; }
          }
          persistSuite(suite);
        }
        suites.set(id, suite);
      }
      for (const id of readdirSync(base).filter(id => runIdPattern.test(id))) {
        const directory = labDirectory(id, date);
        const state = join(directory, 'lab-run.json');
        if (!existsSync(state)) continue;
        const run = z.object({
          id: z.literal(id), date: z.literal(date), tenant: z.string(),
          status: z.enum(['running', 'passed', 'failed']), startedAt: z.string(),
          ownerPid: z.number().int().positive().optional(),
          logs: z.string(), artifacts: z.array(z.object({ name: z.string(), path: z.string(), url: z.string() }))
        }).passthrough().parse(json(state)) as Run;
        if (run.status === 'running') {
          if (run.ownerPid && processExists(run.ownerPid)) {
            throw new Error(`Solution Finder Lab run ${id} is still owned by process ${run.ownerPid}. Wait for that lab to finish; do not start a second instance.`);
          }
          run.status = 'failed'; run.error = 'Lab restarted before this run completed; review saved evidence before resubmitting.';
          run.finishedAt = new Date().toISOString(); save(state, run);
        }
        runs.set(id, run); directories.set(id, directory);
      }
    }
  }
  const profile = (run: Run) => {
    const captured = run.result?.actualRequest;
    const directory = directories.get(run.id);
    const inputFile = directory ? join(directory, 'input.json') : undefined;
    const input = captured ?? (inputFile && existsSync(inputFile)
      ? z.object({ request: requestSchema }).passthrough().parse(json(inputFile)).request : undefined);
    if (!input) return null;
    const inquiry = requestSchema.parse(input);
    const parsed = parsedInput(inquiry);
    const response = responseSchema.safeParse(run.result?.response);
    const identifier = (value: unknown) => typeof value === 'string' && value.trim() ? value :
      typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    const loanIds = response.success
      ? [response.data.loanId, ...response.data.offers.map(offer => offer.loanId)].map(identifier).filter(value => value !== null) : [];
    return {
      borrower: parsed.borrower, email: inquiry.applicationInquiryInput.basicInfoInput.emailId,
      emailSource: captured ? 'submitted' : 'input',
      subjectProperty: parsed.subjectProperty, occupancy: parsed.occupancy,
      requestedAmount: parsed.requestedAmount, annualIncome: parsed.annualIncome,
      loanIds: [...new Set(loanIds)],
      internalAppIds: response.success ? [...new Set(response.data.offers.flatMap(offer => {
        const id = identifier(offer.internalAppId); return id ? [id] : [];
      }))] : [],
      inquiryId: response.success ? response.data.inquiryId : null
    };
  };
  const snapshot = (run: Run) => {
    const directory = directories.get(run.id);
    if (!directory) throw new Error('Run directory missing.');
    const progress = join(directory, 'progress.json');
    return { ...run, profile: profile(run), progress: existsSync(progress) ? json(progress) : null };
  };
  const persist = (run: Run) => {
    const directory = directories.get(run.id);
    if (!directory) throw new Error('Run directory missing.');
    save(join(directory, 'lab-run.json'), run);
  };
  const suiteSnapshot = (suite: Suite) => ({
    id: suite.id, tenant: suite.tenant, status: suite.status, startedAt: suite.startedAt,
    finishedAt: suite.finishedAt, stopRequested: suite.stopRequested, error: suite.error,
    counts: Object.fromEntries(['pending', 'running', 'passed', 'failed', 'skipped']
      .map(status => [status, suite.items.filter(item => item.status === status).length])),
    items: suite.items.map(({ request: _request, ...item }) => {
      const run = item.runId ? runs.get(item.runId) : undefined;
      return {
        ...item, profile: run ? profile(run) : null,
        offers: run?.result?.parsed, artifacts: run?.artifacts ?? []
      };
    })
  });
  function advanceSuite() {
    const suite = activeSuite;
    if (!suite || active) return;
    for (const item of suite.items) {
      if (item.status !== 'running' || !item.runId) continue;
      const run = runs.get(item.runId);
      if (!run?.finishedAt) return;
      item.status = run.status === 'passed' ? 'passed' : 'failed'; item.error = run.error;
    }
    const failed = suite.items.some(item => item.status === 'failed');
    if (failed || suite.stopRequested || closing) {
      for (const item of suite.items.filter(item => item.status === 'pending')) {
        item.status = 'skipped'; item.error = failed ? 'Not executed: suite stopped at the first failure.' : 'Not executed: suite was stopped.';
      }
    }
    const next = suite.items.find(item => item.status === 'pending');
    if (!next) {
      suite.status = failed ? 'failed' : suite.stopRequested || closing ? 'stopped' : 'passed';
      suite.finishedAt = new Date().toISOString();
      persistSuite(suite);
      save(join(suiteDirectory(suite), 'suite-summary.json'), suiteSnapshot(suite));
      activeSuite = undefined; return;
    }
    next.status = 'running';
    try {
      const run = startRun(suite.tenant, next.request, suite.preserveEmail);
      next.runId = run.id; persistSuite(suite);
    } catch (error) {
      next.status = 'failed'; next.error = `Could not start scenario: ${errorText(error)}`;
      console.error(next.error); advanceSuite();
    }
  }
  function finish(run: Run, directory: string, code: number | null, error?: string) {
    if (run.finishedAt) return;
    try {
      const files = findFiles(join(directory, 'artifacts'));
      run.artifacts = artifacts.flatMap(name => {
        const file = files.find(file => file.endsWith(sep + name) && !file.includes(`${sep}attachments${sep}`));
        return file ? [{ name, path: relative(directory, file), url: `/api/runs/${run.id}/artifacts/${name}` }] : [];
      });
      const readArtifact = (name: string) => {
        const artifact = run.artifacts.find(artifact => artifact.name === name);
        return artifact ? json(join(directory, artifact.path)) : undefined;
      };
      const outcome = readArtifact('run-result.json');
      const response = readArtifact('actual-inquiry-response.json');
      const parsed = responseSchema.safeParse(response);
      const execution = z.object({ status: z.string(), error: z.string().optional(), navigatorUrl: z.string().optional() })
        .passthrough().safeParse(outcome);
      run.result = {
        execution: outcome, actualRequest: readArtifact('actual-inquiry-request.json'),
        response, parsed: parsed.success ? parsedResponse(parsed.data) : null,
        ui: readArtifact('actual-ui-offers.json'), comparison: readArtifact('comparison.json')
      };
      run.status = code === 0 && execution.success && execution.data.status === 'PASS' && parsed.success ? 'passed' : 'failed';
      if (run.status === 'failed') run.error = error || (execution.success && execution.data.error) ||
        `Runner exited ${code}; a complete, validated UI/API result was not produced. Inspect logs and artifacts.`;
    } catch (failure) {
      run.status = 'failed'; run.error = `Result collection failed: ${errorText(failure)}`;
      console.error(run.error);
    }
    run.finishedAt = new Date().toISOString();
    persist(run);
    if (active?.run.id === run.id) active = undefined;
  }
  const launch = options.launch ?? ((directory, tenant) => spawn(process.execPath, [
    join(root, 'node_modules/@playwright/test/cli.js'), 'test',
    '--config', join(__dirname, __filename.endsWith('.js') ? 'playwright.config.js' : 'playwright.config.ts')
  ], {
    cwd: root, env: { ...process.env, SF_TENANT: tenant, SF_LAB_RUN_DIR: directory, FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  }));
  function startRun(tenant: string, inquiry: z.infer<typeof requestSchema>, preserveEmail: boolean) {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const id = `sf-lab-${now.toISOString().replace(/[-:.]/g, '')}-${randomUUID().slice(0, 8)}`;
    const directory = labDirectory(id, date);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    save(join(directory, 'input.json'), { request: inquiry, preserveEmail });
    const run: Run = { id, date, tenant, status: 'running', startedAt: now.toISOString(),
      logs: '', artifacts: [], ownerPid: process.pid };
    runs.set(id, run); directories.set(id, directory); persist(run);
    try {
      const child = launch(directory, tenant);
      active = { run, child };
      const log = (chunk: Buffer) => {
        run.logs = (run.logs + chunk.toString().replace(/\x1b\[[0-9;]*m/g, '')).slice(-60000);
        writeFileSync(join(directory, 'runner.log'), run.logs, { mode: 0o600 });
      };
      child.stdout?.on('data', log); child.stderr?.on('data', log);
      child.once('error', error => {
        run.error = `Runner could not start: ${error.message}`; console.error(run.error);
      });
      child.once('close', (code, signal) => {
        finish(run, directory, code, run.error || (signal ? `Runner stopped by ${signal}.` : undefined));
        advanceSuite();
      });
    } catch (error) {
      finish(run, directory, null, `Runner launch failed: ${errorText(error)}`);
      queueMicrotask(advanceSuite);
    }
    return run;
  }
  async function route(request: IncomingMessage, response: ServerResponse) {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Lab listener unavailable.');
    const origin = `http://127.0.0.1:${address.port}`;
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (request.headers.host !== new URL(origin).host ||
        (request.headers.origin && request.headers.origin !== origin) ||
        (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(request.headers['sec-fetch-site'])))) {
      return send(403, { error: 'Only same-origin loopback requests are accepted.' });
    }
    const url = new URL(request.url || '/', origin);
    if (request.method === 'POST' && (request.headers['x-sf-lab-token'] !== token ||
        !request.headers['content-type']?.startsWith('application/json'))) {
      return send(403, { error: 'Use the lab page to authorize JSON requests.' });
    }
    if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
      return send(200, {
        protocolVersion: 1, portable: process.env.SF_LAB_PORTABLE === '1',
        internalDistribution: ['internal-125', 'internal-165'].includes(process.env.SF_LAB_DISTRIBUTION || ''),
        token, tenants, cases: cases().map(scenario => {
          const { id, name, group, request } = scenario;
          const checked = labRequestSchema.safeParse(request);
          return { id, name, group, profileReference: reference(scenario), runnable: checked.success,
            unavailableReason: checked.success ? null : request === null
              ? 'No Inquiry Request is available. Supply valid input and save it as a new template first.'
              : checked.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
        }),
        history: [...runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, 100).map(run => ({
            id: run.id, tenant: run.tenant, status: run.status, startedAt: run.startedAt, profile: profile(run)
          })),
        activeRun: active?.run.id ?? null, activeSuite: activeSuite?.id ?? null,
        suites: [...suites.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, 100).map(suiteSnapshot)
      });
    }
    const template = /^\/api\/cases\/([^/]+)$/.exec(url.pathname);
    if (template && request.method === 'GET') {
      const scenario = cases().find(value => value.id === template[1]);
      return scenario ? send(200, { request: scenario.request, sourceRequest: scenario.sourceRequest, notes: scenario.notes, profileReference: reference(scenario) })
        : send(404, { error: 'Unknown scenario.' });
    }
    if (url.pathname === '/api/templates' && request.method === 'POST') {
      const input = templateInput.parse(await body(request));
      const inquiry = parseLabRequest(input.request);
      const catalog = cases();
      if (input.sourceCaseId && !catalog.some(item => item.id === input.sourceCaseId)) {
        return send(400, { error: 'The source scenario no longer exists. Reload a scenario or save pasted JSON without a source.' });
      }
      if (catalog.some(item => item.group === 'Saved templates' && item.name.toLowerCase() === input.name.toLowerCase())) {
        return send(409, { error: 'A saved template already has this name. Choose a new name to save a separate copy.' });
      }
      const template = savedTemplate.parse({
        id: `SF-CUSTOM-${randomUUID()}`, name: input.name, request: inquiry,
        sourceCaseId: input.sourceCaseId, createdAt: new Date().toISOString()
      });
      mkdirSync(templateDirectory, { recursive: true, mode: 0o700 });
      save(join(templateDirectory, `${template.id}.json`), template);
      return send(201, { template: { id: template.id, name: template.name, group: 'Saved templates', request: template.request,
        profileReference: reference(catalog.find(scenario => scenario.id === input.sourceCaseId)) } });
    }
    if (url.pathname === '/api/preview' && request.method === 'POST') {
      const requestBody = z.object({ request: z.unknown() }).strict().parse(await body(request));
      const inquiry = parseLabRequest(requestBody.request);
      return send(200, {
        request: inquiry, parsed: parsedInput(inquiry),
        notes: [
          ...(inquiry.applicationInquiryInput.propertyInputHeloc.type === 'PRIMARY' ? [
            'PRIMARY occupancy: Navigator uses the subject property as the borrower residence. The request and preview use your entered subject address for both; no manual address matching is required.'
          ] : []),
          'Creates a real QA inquiry through Navigator, not a direct API replay or a completed loan.',
          'Consent, channel, type and loan-officer/cost-center routing are controlled by the selected tenant UI; pasted routing metadata is not injected.',
          'No placeholder response expectations are used. Actual submitted inputs and UI/API values are checked.'
        ]
      });
    }
    if (url.pathname === '/api/runs' && request.method === 'POST') {
      const selected = selection.parse(await body(request));
      const inquiry = parseLabRequest(selected.request);
      if (active || activeSuite || closing) return send(409, { error: 'One inquiry or suite is already running. Wait for it to finish.' });
      const run = startRun(selected.tenant, inquiry, selected.preserveEmail);
      return send(202, { run: snapshot(run) });
    }
    if (url.pathname === '/api/suites' && request.method === 'POST') {
      const selected = suiteSelection.parse(await body(request));
      if (active || activeSuite || closing) return send(409, { error: 'One inquiry or suite is already running. Wait for it to finish.' });
      const catalog = cases();
      const items = selected.caseIds.map(id => {
        const scenario = catalog.find(item => item.id === id);
        if (!scenario) throw new InputError(`Unknown scenario: ${id}`);
        const checked = labRequestSchema.safeParse(scenario.request);
        if (!checked.success) throw new InputError(`${id} is not runnable: ${checked.error.message}`);
        return { caseId: id, name: scenario.name, request: parseLabRequest(scenario.request), status: 'pending' as const };
      });
      const now = new Date();
      const suite: Suite = {
        id: `sf-suite-${now.toISOString().replace(/[-:.]/g, '')}-${randomUUID().slice(0, 8)}`,
        date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        tenant: selected.tenant, preserveEmail: selected.preserveEmail,
        status: 'running', startedAt: now.toISOString(), ownerPid: process.pid, stopRequested: false, items
      };
      mkdirSync(suiteDirectory(suite), { recursive: true, mode: 0o700 });
      persistSuite(suite); suites.set(suite.id, suite); activeSuite = suite;
      advanceSuite();
      return send(202, { suite: suiteSnapshot(suite) });
    }
    const suiteRoute = /^\/api\/suites\/(sf-suite-[\w-]+)(\/stop)?$/.exec(url.pathname);
    if (suiteRoute) {
      const suite = suites.get(suiteRoute[1]);
      if (!suite) return send(404, { error: 'Unknown suite.' });
      if (request.method === 'POST' && suiteRoute[2]) {
        z.object({}).strict().parse(await body(request));
        if (suite.status !== 'running') return send(409, { error: 'This suite has already finished.' });
        suite.stopRequested = true; persistSuite(suite); advanceSuite();
        return send(200, { suite: suiteSnapshot(suite) });
      }
      if (request.method === 'GET' && !suiteRoute[2]) return send(200, { suite: suiteSnapshot(suite) });
    }
    const runRoute = /^\/api\/runs\/(sf-lab-[\w-]+)(?:\/artifacts\/([\w.-]+))?$/.exec(url.pathname);
    if (runRoute && request.method === 'GET') {
      const run = runs.get(runRoute[1]);
      const directory = directories.get(runRoute[1]);
      if (!run || !directory) return send(404, { error: 'Unknown run.' });
      if (!runRoute[2]) return send(200, { run: snapshot(run) });
      const artifact = run.artifacts.find(value => value.name === runRoute[2]);
      if (!artifact) return send(404, { error: 'Artifact unavailable. The run may still be capturing evidence.' });
      const file = realpathSync(resolve(directory, artifact.path));
      if (!file.startsWith(realpathSync(directory) + sep)) return send(403, { error: 'Artifact is outside its run.' });
      const content = readFileSync(file);
      response.setHeader('Content-Type', artifact.name.endsWith('.png') ? 'image/png' : artifact.name.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8');
      if (artifact.name.endsWith('.html') || artifact.name.endsWith('.zip')) {
        response.setHeader('Content-Disposition', `attachment; filename="${artifact.name}"`);
      }
      response.end(content); return;
    }
    if (request.method === 'GET' && ['/', '/app.js', '/style.css', '/suite-results.html', '/suite-results.js'].includes(url.pathname)) {
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      response.setHeader('Content-Type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'application/javascript' : 'text/css');
      response.end(publicAssets.get(name)); return;
    }
    send(404, { error: 'Not found.' });
  }
  const server = createServer((request, response) => {
    route(request, response).catch(error => {
      console.error(`Solution Finder Lab: ${errorText(error)}`);
      if (!response.headersSent) response.writeHead(error instanceof z.ZodError || error instanceof SyntaxError || error instanceof InputError ? 400 : 500,
        { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: errorText(error) }));
    });
  });
  return {
    server,
    async close() {
      closing = true;
      if (activeSuite) { activeSuite.stopRequested = true; persistSuite(activeSuite); }
      if (active) {
        const child = active.child;
        await new Promise<void>(resolve => { child.once('close', () => resolve()); child.kill('SIGINT'); });
      }
      advanceSuite();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}

export function startLabServer() {
  const port = Number(process.env.SF_LAB_PORT ?? 4180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SF_LAB_PORT must be 1-65535.');
  const lab = createLabServer();
  lab.server.once('error', error => { console.error(error.message); process.exitCode = 1; });
  lab.server.listen(port, '127.0.0.1', () => console.log(`Solution Finder Lab: http://127.0.0.1:${port}`));
  const shutdown = () => { void lab.close().catch(error => { console.error(error); process.exitCode = 1; }); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}

if (require.main === module) startLabServer();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { checkRepositoryRoot } = require('./check-repository-root');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-root-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('preserves intentional root configs, local environments and source folders', t => {
  const root = fixture(t);
  for (const name of ['README.md', 'auth.json', 'package.json', 'environment.qa.json',
    'playwright.new-solution-finder.config.ts', 'codegen.cjs', '.env', '.env.qa.local']) {
    fs.writeFileSync(path.join(root, name), '');
  }
  for (const name of ['test-data', 'tests', 'scripts', 'test-results']) {
    fs.mkdirSync(path.join(root, name));
  }
  fs.mkdirSync(path.join(root, 'test-results', '2026-10-30'));
  assert.doesNotThrow(() => checkRepositoryRoot(root));
});

test('rejects root diagnostics regardless of extension or tracking status', t => {
  const root = fixture(t);
  for (const name of ['firebase-debug.log', 'response.json', 'capture.png',
    'results.csv', 'trace.zip', 'report.html', 'notes.txt', '.last-run.json']) {
    const file = path.join(root, name);
    fs.writeFileSync(file, '');
    assert.throws(() => checkRepositoryRoot(root), error =>
      error.message.includes(name) && error.message.includes('test-results/'));
    fs.unlinkSync(file);
  }
});

test('rejects default browser and reporter output directories', t => {
  const root = fixture(t);
  for (const name of ['.playwright-mcp', 'allure-results', 'allure-report',
    'playwright-report', 'blob-report']) {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    assert.throws(() => checkRepositoryRoot(root), error => error.message.includes(name));
    fs.rmdirSync(dir);
  }
});

test('reports all offending names in deterministic order without reading contents', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'z.json'), 'private payload');
  fs.writeFileSync(path.join(root, 'a.log'), 'private payload');
  assert.throws(() => checkRepositoryRoot(root), error =>
    error.message.indexOf('a.log') < error.message.indexOf('z.json') &&
    !error.message.includes('private payload'));
});

function runWrapper(statuses, rejectAfterRun = false) {
  const calls = [];
  let runs = 0;
  const exit = new Error('process.exit');
  const source = fs.readFileSync(path.join(__dirname, 'run-playwright.js'), 'utf8');
  const context = {
    require(name) {
      if (name === './check-repository-root') {
        return { checkRepositoryRoot() {
          calls.push('check');
          if (rejectAfterRun && runs) throw new Error('unexpected root artifact');
        } };
      }
      if (name === 'child_process') {
        return { spawnSync() {
          calls.push('run');
          return { status: statuses[runs++] };
        } };
      }
      return require(name);
    },
    process: {
      argv: ['node', 'run-playwright.js', 'first.spec.ts', 'second.spec.ts'],
      env: {},
      exit(code) { exit.code = code; throw exit; },
    },
    console: { log() {} },
  };
  let error;
  try { vm.runInNewContext(source, context); } catch (caught) { error = caught; }
  return { calls, error };
}

test('shared runner checks before execution and after each successful batch', () => {
  const result = runWrapper([0, 0]);
  assert.ifError(result.error);
  assert.deepEqual(result.calls, ['check', 'run', 'check', 'run', 'check']);
});

test('shared runner checks after failure and preserves the failing exit status', () => {
  const result = runWrapper([7]);
  assert.equal(result.error.code, 7);
  assert.deepEqual(result.calls, ['check', 'run', 'check']);
});

test('shared runner stops subsequent batches when output pollutes the root', () => {
  const result = runWrapper([0], true);
  assert.match(result.error.message, /unexpected root artifact/);
  assert.deepEqual(result.calls, ['check', 'run', 'check']);
});

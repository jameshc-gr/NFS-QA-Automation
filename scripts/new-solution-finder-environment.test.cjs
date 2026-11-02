const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  resolveNewSolutionFinderEnvironment,
  newSolutionFinderOutputDirectory,
  assertNewSolutionFinderOutputPath
} = require('./new-solution-finder-environment');

test('all five tenant URLs match the supplied intake routes', () => {
  const expected = {
    gri: 'https://falcon.qa.fsp.rate.com/inquiry/intake/?playwright=true',
    owning: 'https://falcon.qa.fsp.owning.com/inquiry/intake/?playwright=true',
    citywide: 'https://falcon.qa.fsp.citywidehm.com/inquiry/intake/?playwright=true',
    certainty: 'https://falcon.qa.fsp.certaintyhomelending.com/inquiry/?playwright=true',
    onq: 'https://falcon.qa.fsp.onqhomeloans.com/inquiry/intake/?playwright=true'
  };
  for (const [tenant, url] of Object.entries(expected)) {
    assert.equal(resolveNewSolutionFinderEnvironment(tenant.toUpperCase()).intakeUrl, url);
    assert.equal(resolveNewSolutionFinderEnvironment(tenant).baseURL, new URL(url).origin);
  }
});

test('unknown or empty tenants fail instead of silently choosing GRI', () => {
  assert.throws(() => resolveNewSolutionFinderEnvironment('unknown'), /Unknown SF_TENANT/);
  assert.throws(() => resolveNewSolutionFinderEnvironment(''), /Unknown SF_TENANT/);
});

test('the environment variable selects a tenant, defaults only when absent, and rejects explicit blanks', () => {
  const saved = process.env.SF_TENANT;
  try {
    delete process.env.SF_TENANT;
    assert.equal(resolveNewSolutionFinderEnvironment().tenant, 'gri');
    process.env.SF_TENANT = 'Certainty';
    assert.equal(resolveNewSolutionFinderEnvironment().tenant, 'certainty');
    process.env.SF_TENANT = '';
    assert.throws(() => resolveNewSolutionFinderEnvironment(), /Unknown SF_TENANT/);
  } finally {
    if (saved === undefined) delete process.env.SF_TENANT;
    else process.env.SF_TENANT = saved;
  }
});

test('workbook outputs stay under Solution Finder, isolated by tenant and restricted to test-results', () => {
  const root = path.resolve(__dirname, '..');
  const gri = newSolutionFinderOutputDirectory(root, 'gri', 'unit-run');
  const owning = newSolutionFinderOutputDirectory(root, 'owning', 'unit-run');
  const segments = path.relative(path.join(root, 'test-results'), gri).split(path.sep);
  assert.match(segments[0], /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(segments.slice(1), ['solution-finder', 'workbook-scenarios', 'gri', 'unit-run']);
  assert.notEqual(gri, owning);
  assert.equal(assertNewSolutionFinderOutputPath(root, path.join(gri, 'offers.png')), path.join(gri, 'offers.png'));
  for (const candidate of [root, path.join(root, 'test-results'), path.join(root, 'test-results-other/offers.png'), path.join(root, 'test-data/offers.png')]) {
    assert.throws(() => assertNewSolutionFinderOutputPath(root, candidate), /inside/);
  }
  for (const runId of ['../elsewhere', '..', '.', '/tmp/result', '']) {
    assert.throws(() => newSolutionFinderOutputDirectory(root, 'gri', runId), /RUN_ID/);
  }
});

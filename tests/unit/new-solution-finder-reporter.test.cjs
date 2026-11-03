const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, rmSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { randomUUID } = require('node:crypto');
const Reporter = require('../../scripts/new-solution-finder-reporter').default;
const { scenarios } = require('../projects/solution-finder/workbook-scenarios/helpers/contracts');

test('all102 report rows expose the active comparison mode and IR profile without claiming financial approval', () => {
  const directory = resolve(__dirname, '../../test-results', new Date().toISOString().slice(0, 10),
    'solution-finder/workbook-scenarios/gri', `reporter-unit-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  try {
    const reporter = new Reporter({ outputDirectory: directory });
    reporter.onBegin({ metadata: { tenant: 'gri', tenantLabel: 'GRI' } }, { allTests: () => scenarios });
    for (const scenario of scenarios) {
      reporter.onTestEnd({ title: `${scenario.id} - ${scenario.name}`, id: scenario.id }, {
        status: 'passed', duration: 0, errors: [], attachments: [
          { name: 'qa-comment', body: Buffer.from('Controlled offline report test; no inquiry submitted.') }
        ]
      });
    }
    reporter.onEnd({ status: 'passed', startTime: new Date(), duration: 0 });
    const summary = JSON.parse(readFileSync(join(directory, 'run-summary.json'), 'utf8'));
    const html = readFileSync(join(directory, 'index.html'), 'utf8');
    assert.equal(summary.selectedTests, 102);
    assert.equal(summary.scenarios.filter(row => row.comparisonMode === 'workbook' && row.profileId === null).length, 50);
    assert.equal(summary.scenarios.filter(row => row.comparisonMode === 'actual-ui-api').length, 52);
    for (const row of summary.scenarios.slice(50)) {
      const slot = Number(row.id.slice(4)), number = slot >= 63 ? slot - 62 : slot - 50;
      assert.equal(row.profileId, `TB-${String(number).padStart(3, '0')}`);
      assert.ok(html.includes(row.profileId));
    }
    assert.match(html, /a pass does not approve eligibility or pricing/);
    assert.match(html, /Comparison \/ profile/);
    assert.equal((html.match(/Variant baseline pending approval/g) || []).length, 52);
    assert.throws(() => reporter.onTestEnd({ title: 'NSF-999', id: 'invalid' },
      { status: 'passed', duration: 0, errors: [], attachments: [] }), /active Solution Finder scenario/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

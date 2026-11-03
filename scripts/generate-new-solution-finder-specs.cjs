#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'test-data/solution-finder/workbook-scenarios/scenarios.json'), 'utf8'));
assert.equal(dataset.scenarios.length, 102);
assert.equal(new Set(dataset.scenarios.map(scenario => scenario.id)).size, 102);
assert.equal(dataset.scenarios.filter(s => s.comparisonMode === 'workbook').length, 50);
assert.equal(dataset.scenarios.filter(s => s.comparisonMode === 'actual-ui-api').length, 52);
const folder = path.join(root, 'tests/projects/solution-finder/workbook-scenarios');
fs.mkdirSync(folder, { recursive: true });
for (const scenario of dataset.scenarios) {
  assert.match(scenario.id, /^NSF-\d{3}$/);
  if (scenario.comparisonMode === 'workbook') {
    assert.ok(scenario.expectedResponse?.offers && scenario.expectedUi, `Missing baseline for ${scenario.id}`);
  } else {
    assert.equal(scenario.comparisonMode, 'actual-ui-api', `Unknown comparison mode for ${scenario.id}`);
    assert.ok(!('expectedResponse' in scenario) && !('expectedUi' in scenario), `Stale baseline for ${scenario.id}`);
    assert.equal(scenario.provenance?.baselineStatus, 'pending-approved-variant-baseline');
  }
  fs.writeFileSync(path.join(folder, `${scenario.id}.spec.ts`),
    `import { defineScenario } from './helpers/scenario';\n\ndefineScenario('${scenario.id}');\n`);
}
console.log(`Generated ${dataset.scenarios.length} New Solution Finder scenario specs.`);

#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'test-data/solution-finder/workbook-scenarios/scenarios.json'), 'utf8'));
assert.equal(dataset.scenarios.length, 102);
assert.equal(new Set(dataset.scenarios.map(scenario => scenario.id)).size, 102);
const folder = path.join(root, 'tests/projects/solution-finder/workbook-scenarios');
fs.mkdirSync(folder, { recursive: true });
for (const scenario of dataset.scenarios) {
  assert.match(scenario.id, /^NSF-\d{3}$/);
  fs.writeFileSync(path.join(folder, `${scenario.id}.spec.ts`),
    `import { defineScenario } from './helpers/scenario';\n\ndefineScenario('${scenario.id}');\n`);
}
console.log(`Generated ${dataset.scenarios.length} New Solution Finder scenario specs.`);

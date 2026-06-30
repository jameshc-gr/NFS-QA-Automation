#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--jira') {
      args.jira = argv[i + 1];
      i += 1;
    }
    if (value === '--summary') {
      args.summary = argv[i + 1];
      i += 1;
    }
    if (value === '--description') {
      args.description = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function buildFallbackSpec(jiraKey, summary, description) {
  return `import { test, expect } from '@playwright/test';\nimport { loadProfile, runRefinanceFlow } from '../test-setup';\n\ntest.setTimeout(240000);\n\nconst PROFILE = 'LK1';\nloadProfile(PROFILE);\n\ntest.describe('${jiraKey} generated scenario', () => {\n  test('${summary.replace(/'/g, "\\'")}', async ({ page }) => {\n    await runRefinanceFlow(page, PROFILE);\n    await expect(page).toHaveURL(/offers|lendkey|earnest|splash|no-offer/i);\n    // Notes from ticket:\n    // ${description.replace(/\n/g, '\n    // ').replace(/`/g, '')}\n  });\n});\n`;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.jira) {
    console.error('Usage: node scripts/generate-test.js --jira PROJ-123 [--summary "..."] [--description "..."]');
    process.exit(1);
  }

  const jiraKey = args.jira;
  const summary = args.summary || `Generated test for ${jiraKey}`;
  const description = args.description || 'No ticket description provided.';

  const generatedDir = path.resolve(process.cwd(), 'tests/projects/student-loan-refi/generated');
  fs.mkdirSync(generatedDir, { recursive: true });

  const fileName = `${jiraKey.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.spec.ts`;
  const outputFile = path.join(generatedDir, fileName);

  const fallbackSpec = buildFallbackSpec(jiraKey, summary, description);
  fs.writeFileSync(outputFile, fallbackSpec, 'utf8');

  console.log(`Generated fallback spec: ${outputFile}`);
  console.log('Tip: wire scripts/generate-test.ts to ai/agents/agents/test_generator/index.ts when API key + JIRA integration are available.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/fetch_jira_and_generate_test.js TICKET-KEY');
    process.exit(2);
  }
  const ticket = argv[0];

  const envPath = path.join(process.cwd(), 'jira.env');
  if (!fs.existsSync(envPath)) {
    console.error('jira.env not found. Please create jira.env with JIRA_USER, JIRA_TOKEN, JIRA_INSTANCE');
    process.exit(1);
  }

  dotenv.config({ path: envPath });

  const { JIRA_USER, JIRA_TOKEN, JIRA_INSTANCE } = process.env;
  if (!JIRA_USER || !JIRA_TOKEN || !JIRA_INSTANCE) {
    console.error('Missing required env vars in jira.env (JIRA_USER, JIRA_TOKEN, JIRA_INSTANCE)');
    process.exit(1);
  }

  const apiUrl = `${JIRA_INSTANCE.replace(/\/$/, '')}/rest/api/3/issue/${ticket}`;

  const auth = Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64');

  console.log('Fetching', apiUrl);

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to fetch ticket:', res.status, text);
    process.exit(1);
  }

  const data = await res.json();
  const summary = data.fields.summary || '';
  const description = (data.fields.description && (typeof data.fields.description === 'string' ? data.fields.description : JSON.stringify(data.fields.description))) || '';

  const targetDir = path.join(process.cwd(), 'Jira', 'student-refi', 'jira-tickets', ticket);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const plannerContent = `# Ticket: ${ticket}\n\nSummary: ${summary}\n\nDescription:\n${description}\n\n## Generated Test Cases\n\n1. Happy path: placeholder steps\n\n`;
  const plannerPath = path.join(targetDir, 'jira_planner.generated.md');
  await fs.promises.writeFile(plannerPath, plannerContent, 'utf8');

  // Generate a simple Playwright test file
  const testsDir = path.join(process.cwd(), 'tests', 'generated');
  await fs.promises.mkdir(testsDir, { recursive: true });
  const testFileName = `${ticket.toLowerCase()}.spec.ts`;
  const testFilePath = path.join(testsDir, testFileName);

  const testContent = `import { test, expect } from '@playwright/test';\n\n// Generated from Jira ticket ${ticket}\n// Summary: ${summary}\n\ntest.describe('${ticket} - ${summary.replace(/'/g, "\\'")}', () => {\n  test('Happy path placeholder', async ({ page }) => {\n    // TODO: Replace with generated steps from planner at ${plannerPath}\n    await page.goto(process.env.BASE_URL || 'http://localhost');\n    expect(await page.title()).toBeTruthy();\n  });\n});\n`;

  await fs.promises.writeFile(testFilePath, testContent, 'utf8');

  console.log('Wrote planner:', plannerPath);
  console.log('Wrote test:', testFilePath);
  console.log('To run the generated test: npx playwright test', testFilePath);
}

main().catch(err => { console.error(err); process.exit(1); });

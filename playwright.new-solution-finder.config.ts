import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import {
  newSolutionFinderOutputDirectory,
  resolveNewSolutionFinderEnvironment
} from './scripts/new-solution-finder-environment';

dotenv.config();
const environment = resolveNewSolutionFinderEnvironment();
const runId = process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
process.env.RUN_ID = runId;
const runDirectory = newSolutionFinderOutputDirectory(__dirname, environment.tenant, runId);
const metadata = { ...environment, baselineTenant: 'gri' };

export default defineConfig({
  testDir: './tests/projects/solution-finder/workbook-scenarios',
  testMatch: 'NSF-*.spec.ts',
  outputDir: join(runDirectory, 'artifacts'),
  timeout: 5 * 60 * 1000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env.CI,
  metadata,
  reporter: [
    ['list'],
    ['html', { outputFolder: join(runDirectory, 'playwright-report'), open: 'never' }],
    ['json', { outputFile: join(runDirectory, 'playwright-results.json') }],
    ['./scripts/new-solution-finder-reporter.ts', { outputDirectory: runDirectory }]
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: environment.baseURL,
    headless: true,
    viewport: { width: 1440, height: 1100 },
    actionTimeout: 15000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off'
  },
  projects: [{ name: 'solution-finder', metadata }]
});

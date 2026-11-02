import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { root, validateLabDirectory } from './contracts';
import { resolveNewSolutionFinderEnvironment } from '../../new-solution-finder-environment';

const directory = validateLabDirectory(process.env.SF_LAB_RUN_DIR || '');
const environment = resolveNewSolutionFinderEnvironment();
export default defineConfig({
  testDir: join(root, 'tests/projects/solution-finder/lab'),
  testMatch: __filename.endsWith('.js') ? 'inquiry.spec.js' : 'inquiry.spec.ts',
  outputDir: join(directory, 'artifacts'),
  workers: 1, retries: 0, timeout: 5 * 60 * 1000, forbidOnly: true,
  expect: { timeout: 15000 },
  reporter: [['list'], ['json', { outputFile: join(directory, 'playwright-results.json') }]],
  use: {
    ...devices['Desktop Chrome'], headless: true,
    viewport: { width: 1440, height: 1100 }, actionTimeout: 15000,
    navigationTimeout: 60000, screenshot: 'only-on-failure', trace: 'retain-on-failure'
  },
  projects: [{ name: 'solution-finder', metadata: { ...environment, baselineTenant: 'gri' } }]
});

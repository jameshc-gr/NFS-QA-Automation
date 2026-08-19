import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config();

process.env.API_BASE_URL = process.env.API_BASE_URL || process.env.BASE_URL;
process.env.API_BEARER_TOKEN = process.env.API_BEARER_TOKEN || process.env.API_TOKEN;

const now = new Date();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const yyyy = String(now.getFullYear());
const HH = String(now.getHours()).padStart(2, '0');
const MM = String(now.getMinutes()).padStart(2, '0');
const SS = String(now.getSeconds()).padStart(2, '0');
const runDate = `${yyyy}-${mm}-${dd}`;
const runStamp = process.env.RUN_ID || `${runDate}-${HH}-${MM}-${SS}`;
const testProject = process.env.TEST_PROJECT || 'student-loan-refi';
const testSuiteDir = process.env.TEST_SUITE_DIR || 'tests';

function buildApiHeaders() {
  const headers: Record<string, string> = {};
  const bearerToken = process.env.API_TOKEN || process.env.API_BEARER_TOKEN;
  if (bearerToken) {
    headers.Authorization = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  }

  const apiKey = process.env.API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const tenantId = process.env.TENANT_ID || process.env.API_TENANT_ID || process.env.POSTMAN_TENANT_ID;
  if (tenantId) {
    headers['X-GR-FSP-TENANT-ID'] = tenantId;
  }

  return headers;
}

export default defineConfig({
  testDir: `./${testSuiteDir}`,
  outputDir: `./test-results/${runDate}/runs`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: (() => {
    const base = [
      ['html', {
        outputFolder: `./test-results/${runDate}/reports/${testProject}/test-report-${runStamp}`,
        open: 'never'
      }],
      ['./scripts/playwright-date-type-reporter.js', {}]
    ];
    try {
      require.resolve('allure-playwright');
      base.splice(1, 0, ['allure-playwright', { outputFolder: `./test-results/${runDate}/allure/${testProject}/${runStamp}` }]);
    } catch (e) {
      // allure-playwright not installed; skip adding it so local dry-runs succeed
      // Users who want Allure should install `allure-playwright` as a devDependency.
    }
    return base;
  })(),
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 90000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: false }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'solution-finder',
      testDir: './tests/projects/solution-finder',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        baseURL: process.env.SOLUTION_FINDER_BASE_URL || undefined
      }
    },
    {
      name: 'api-tests',
      testDir: './api/tests',
      use: {
        baseURL: process.env.API_BASE_URL || undefined,
        extraHTTPHeaders: buildApiHeaders()
      }
    }
  ]
});

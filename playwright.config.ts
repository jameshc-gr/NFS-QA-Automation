import { defineConfig, devices } from '@playwright/test';

const now = new Date();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const yyyy = String(now.getFullYear());
const HH = String(now.getHours()).padStart(2, '0');
const MM = String(now.getMinutes()).padStart(2, '0');
const SS = String(now.getSeconds()).padStart(2, '0');
const runDate = `${mm}${dd}${yyyy}`;
const runStamp = `${runDate}-${HH}-${MM}-${SS}`;
const testProject = process.env.TEST_PROJECT || 'student-loan-refi';
const testSuiteDir = process.env.TEST_SUITE_DIR || 'tests';

export default defineConfig({
  testDir: `./${testSuiteDir}`,
  outputDir: `./test-results/${runDate}/runs`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [
      'html',
      {
        outputFolder: `./test-results/${runDate}/reports/${testProject}/test-report-${runStamp}`,
        open: 'never'
      }
    ]
  ],
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
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});

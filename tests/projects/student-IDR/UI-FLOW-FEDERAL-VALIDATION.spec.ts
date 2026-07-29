import { test, expect } from '@playwright/test';
import {
  activateProfile,
  getEnv,
  setEnvValue,
  fillWelcome,
  fillIncome,
  fillFederal,
} from './test-setup';

test.setTimeout(240000);
test.describe.configure({ mode: 'serial' });

const scenarios = [
  {
    id: 'FED-VAL-CHART-01',
    name: 'Pass - two loans (30000/45000)',
    loans: '30000|3|25000|5000;45000|5|35000|10000',
    expected: 'pass',
  },
  {
    id: 'FED-VAL-CHART-02',
    name: 'Pass - two loans (25000/50000)',
    loans: '25000|4.5|20000|5000;50000|6|40000|10000',
    expected: 'pass',
  },
  {
    id: 'FED-VAL-CHART-03',
    name: 'Pass - three loans',
    loans: '15000|3|12000|3000;25000|5|20000|5000;35000|6.8|30000|5000',
    expected: 'pass',
  },
  {
    id: 'FED-VAL-CHART-04',
    name: 'Fail - balance mismatch pair A',
    loans: '30000|3|25000|4000;45000|5|35000|9000',
    expected: 'fail',
  },
  {
    id: 'FED-VAL-CHART-05',
    name: 'Fail - balance mismatch pair B',
    loans: '30000|3|50000|20000;45000|5|60000|15000',
    expected: 'fail',
  },
  {
    id: 'FED-VAL-CHART-06',
    name: 'Fail - zero balance mismatch',
    loans: '0|3|25000|5000',
    expected: 'fail',
  },
  {
    id: 'FED-VAL-CHART-07',
    name: 'Fail - negative APR',
    loans: '30000|-1|25000|5000',
    expected: 'fail',
  },
  {
    id: 'FED-VAL-CHART-08',
    name: 'Fail - APR required',
    loans: '30000||25000|5000',
    expected: 'fail',
  },
];

for (const scenario of scenarios) {
  test(`Student IDR - ${scenario.id} - ${scenario.name}`, async ({ page }) => {
    // Reuse an existing federal profile for baseline person/income data and
    // override only the federal loan rows based on the validation chart.
    activateProfile('FED-VAL-01');

    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    setEnvValue('APPLICANT_LOANS', scenario.loans);

    const baseEmail = getEnv('EMAIL');
    const [local = 'federal.validation', domain = 'example.test'] = baseEmail.split('@');
    const seed = `${Date.now().toString(36)}.${Math.floor(Math.random() * 10000)}`;
    const uniqueEmail = `${local}.${seed}@${domain}`;
    setEnvValue('EMAIL', uniqueEmail);

    await test.step('Complete welcome and income pages', async () => {
      await fillWelcome(page);
      await fillIncome(page);
    });

    await test.step('Fill federal page using Enter individually and validate result', async () => {
      await fillFederal(page);

      if (scenario.expected === 'pass') {
        await expect(page).toHaveURL(/\/forgiveness\/repayment/);
      } else {
        await expect(page).toHaveURL(/\/forgiveness\/federal/);
      }
    });
  });
}

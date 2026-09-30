import { test, expect } from './test-setup';
import fs from 'fs';

const nonCustomGoalTypes = [
  'Getting Married',
  'Buying a Home',
  'Moving Out of Parent/Relative',
  'Moving In w/ Parent/Relative',
  'Buying an Investment Property',
  'Having a Child',
  'Purchasing a Vehicle',
  'Moving',
  'Expected Decrease in Income',
  'Beginning Part-time Work',
  'Expected Increase in Income',
  'Receiving an Inheritance',
  'Go on Vacation',
];

test.describe('RW-GOAL-TYPES-ZERO: non-custom goal zero-value inputs', () => {
  const testEmail = process.env.RW_TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;
  const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

  test.beforeEach(async ({ loginPage }) => {
    test.skip(
      !storageState && (!testEmail || !testPassword),
      'RW_TEST_EMAIL and TEST_PASSWORD or PLAYWRIGHT_STORAGE_STATE are required for authenticated Rate Wealth tests',
    );

    if (!storageState) {
      await loginPage.navigate();
      await loginPage.login(testEmail!, testPassword!);
    }
  });

  test('discovers and tests every available non-custom goal type with zero inputs', async ({ page }) => {
    const outDir = 'test-results/goal-type-zero';
    fs.mkdirSync(outDir, { recursive: true });

    const scenarioResults: Array<Record<string, unknown>> = [];

    for (const [index, goalLabel] of nonCustomGoalTypes.entries()) {
      await page.goto('https://wealth.dev.fitbux.com/plan-select', { waitUntil: 'domcontentloaded' });
      await expect(
        page,
        'Authenticated account must reach plan selection before testing non-custom goals',
      ).toHaveURL(/\/plan-select/);

      const manualPlan = page.locator('button.euiCard__titleButton').filter({ hasText: /Manually/i }).first();
      await expect(manualPlan).toBeVisible();
      await manualPlan.click();

      const planName = page.locator('input:visible').first();
      await expect(planName).toBeVisible();
      await planName.fill(`ZeroPlan-${Date.now()}-${index}`);
      await page.getByRole('button', { name: /Next|Continue|Save and Continue|Start/i }).first().click();

      const addGoal = page.locator('text=Add Life Event/Goal').first();
      await expect(addGoal, 'The plan must expose the life-event/goal picker').toBeVisible();
      await addGoal.click();

      const option = page.getByText(goalLabel, { exact: true }).first();
      await expect(option, `Goal option should be selectable: ${goalLabel}`).toBeVisible();
      await option.click();

      const fields = page.locator('input[type="text"]:visible, input[type="number"]:visible');
      const fieldMetadata = await fields.evaluateAll((elements) =>
        elements.map((element) => ({
          name: element.getAttribute('name'),
          placeholder: element.getAttribute('placeholder'),
          ariaLabel: element.getAttribute('aria-label'),
          type: element.getAttribute('type'),
          valueBefore: (element as HTMLInputElement).value,
        })),
      );

      const count = await fields.count();
      for (let i = 0; i < count; i++) {
        const field = fields.nth(i);
        const name = (await field.getAttribute('name')) || '';
        if (!name.includes('date') && !name.includes('year') && !name.includes('month')) {
          await field.fill('0');
        }
      }

      const screenshotPath = `${outDir}/${String(index + 1).padStart(2, '0')}-${goalLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const saveBtn = page.getByRole('button', { name: /Save|Add|Submit/i }).first();
      const canSave = await saveBtn.isVisible();
      let postSaveUrl = '';
      let validationErrors: string[] = [];

      if (canSave) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        postSaveUrl = page.url();
        validationErrors = await page.locator('.euiFormErrorText:visible, [role="alert"]:visible').allInnerTexts();
      }

      scenarioResults.push({
        goalLabel,
        fieldMetadata,
        canSave,
        postSaveUrl,
        validationErrors,
        screenshotPath,
      });
    }

    fs.writeFileSync(
      `${outDir}/results.json`,
      JSON.stringify({ scenarioResults, testedValue: '0', nonCustomGoalTypes }, null, 2),
    );
  });
});

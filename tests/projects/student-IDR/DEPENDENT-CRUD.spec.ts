import { expect, test } from '@playwright/test';
import {
  activateProfile,
  clickWhenEnabled,
  fillWelcome,
  getEnv,
  resilientFill,
  selectButtonToggle,
} from './test-setup';

test.setTimeout(120000);

const PROFILE = 'SCN-007';

test('CRUD-DEPENDENT-001: add edit delete re-add and save dependents', async ({ page }) => {
  activateProfile(PROFILE);
  await fillWelcome(page);
  await page.waitForURL(/\/forgiveness\/income/);

  await resilientFill(page, 'input[name="agiOrIncome"]', getEnv('APPLICANT_AGI'));
  await selectButtonToggle(page, /marital status/i, 'Single');
  const stateInputs = page.locator('input[name="state"], input#state, input[name="a"], input#gma, input[placeholder*="state" i], input[aria-label*="state" i]');
  const stateInput = stateInputs.first();
  await stateInput.click();
  await stateInput.fill(getEnv('STATE_OF_RESIDENCE'));
  await page.locator('.pac-item').first().click().catch(async () => {
    await stateInput.press('ArrowDown').catch(() => null);
    await stateInput.press('Enter').catch(() => null);
  });
  await stateInput.blur();

  const addChild = page.getByRole('button', { name: /add child/i }).first();
  await expect(addChild).toBeVisible();
  await addChild.click();
  await addChild.click();

  const childInputs = page.getByLabel(/child's age/i);
  await expect(childInputs).toHaveCount(2);
  await childInputs.nth(0).fill('2');
  await childInputs.nth(1).fill('17');

  const firstChildRow = childInputs.nth(0).locator('xpath=ancestor::div[.//button][1]');
  let deleteChild = firstChildRow.getByRole('button', { name: /delete|remove|trash/i }).first();
  if (!(await deleteChild.isVisible().catch(() => false))) {
    deleteChild = firstChildRow.locator('button').last();
  }
  await expect(deleteChild).toBeVisible();
  await deleteChild.click();
  await expect(childInputs).toHaveCount(1);
  await expect(childInputs.first()).toHaveValue('17');

  await addChild.click();
  await expect(childInputs).toHaveCount(2);
  await childInputs.nth(1).fill('2');

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
  await expect(page).toHaveURL(/\/forgiveness\/(federal|repayment|partner-student-loans|assets)/);
});

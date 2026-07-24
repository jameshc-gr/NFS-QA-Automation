import { test, expect } from '@playwright/test';
import { getEnv, loadProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'SCN-018';
loadProfile(PROFILE);

test('Student IDR - SCN-018 - Married toggle back to single', async ({ page }) => {
  // This test assumes the user is already authenticated and lands on the income page.
  await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/income');

  await page.locator('input[name="agiOrIncome"]').fill(getEnv('APPLICANT_AGI'));

  // Select Married and fill spouse fields
  await page.locator('button').filter({ hasText: /^Married$/i }).first().click();
  await page.locator('input[name="spouseFirstName"]').fill(getEnv('SPOUSE_FIRST_NAME'));
  await page.locator('input[name="spouseLastName"]').fill(getEnv('SPOUSE_LAST_NAME'));
  await page.locator('input[name="spouseAgiOrIncome"]').fill(getEnv('SPOUSE_AGI'));

  // Toggle back to Single
  await page.locator('button').filter({ hasText: /^Single$/i }).first().click();

  // Spouse fields should be hidden/cleared
  await expect(page.locator('input[name="spouseFirstName"]').first()).toBeHidden();
  await expect(page.locator('input[name="spouseLastName"]').first()).toBeHidden();
  await expect(page.locator('input[name="spouseAgiOrIncome"]').first()).toBeHidden();
});

import { test, expect } from '@playwright/test';
import { getEnv, loadProfile, fillWelcome, selectButtonToggle } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'SCN-018';
loadProfile(PROFILE);

test('Student IDR - SCN-018 - Married toggle back to single', async ({ page }) => {
  // Sign up so we have an authenticated session on the income page.
  await fillWelcome(page);
  if (!page.url().includes('/forgiveness/income')) {
    await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/income');
    await page.waitForTimeout(3000);
  }
  await page.waitForSelector('input[name="agiOrIncome"]', { state: 'visible', timeout: 15000 });

  await page.locator('input[name="agiOrIncome"]').fill(getEnv('APPLICANT_AGI'));

  // Select Married and fill spouse fields
  await selectButtonToggle(page, /marital status/i, 'Married');
  await page.locator('input[name="spouseFirstName"]').fill(getEnv('SPOUSE_FIRST_NAME'));
  await page.locator('input[name="spouseLastName"]').fill(getEnv('SPOUSE_LAST_NAME'));
  await page.locator('input[name="spouseAgiOrIncome"]').fill(getEnv('SPOUSE_AGI'));

  // Toggle back to Single
  await selectButtonToggle(page, /marital status/i, 'Single');

  // Spouse fields should be hidden/cleared
  await expect(page.locator('input[name="spouseFirstName"]').first()).toBeHidden();
  await expect(page.locator('input[name="spouseLastName"]').first()).toBeHidden();
  await expect(page.locator('input[name="spouseAgiOrIncome"]').first()).toBeHidden();
});

import { test, expect } from '@playwright/test';
import { getEnv, loadProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'SCN-016';
loadProfile(PROFILE);

test('Student IDR - SCN-016 - Welcome page password validation smoke', async ({ page }) => {
  await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');

  await expect(page).toHaveTitle(/Student Loans/);
  await expect(page.locator('input[name="firstName"]')).toBeVisible();
  await expect(page.locator('input[name="lastName"]')).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('#termsCheckbox')).toBeVisible();

  // The static password requirements copy is present.
  await expect(page.getByText(/Passwords must be at least 8 characters/i)).toBeVisible();

  await page.locator('input[name="firstName"]').fill(getEnv('FIRST_NAME'));
  await page.locator('input[name="lastName"]').fill(getEnv('LAST_NAME'));
  await page.locator('input[name="email"]').fill(getEnv('EMAIL'));
  await page.locator('#termsCheckbox').check();

  // Weak password attempt should not advance past the welcome page.
  await page.locator('input[name="password"]').fill('abc12345!');
  await page.locator('button[data-testid="button"]').first().click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/forgiveness\/welcome/);

  // Valid strong password enables the Continue button.
  await page.locator('input[name="password"]').fill('SecurePass123!');
  const continueButton = page.locator('button[data-testid="button"]').first();
  await expect(continueButton).toBeEnabled();
});

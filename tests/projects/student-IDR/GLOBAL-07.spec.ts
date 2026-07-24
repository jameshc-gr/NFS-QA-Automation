import { test, expect } from '@playwright/test';
import { loadProfile } from './test-setup';

test.setTimeout(120000);

loadProfile('BASE');

test('Student IDR - GLOBAL-07 - Terms checkbox unchecked disables Continue', async ({ page }) => {
  await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');

  await page.locator('input[name="firstName"]').fill('Alex');
  await page.locator('input[name="lastName"]').fill('Morgan');
  await page.locator('input[name="email"]').fill('alex.morgan@example.test');
  await page.locator('input[name="password"]').fill('SecurePass123!');

  // Leave terms unchecked.
  const continueButton = page.locator('button[data-testid="button"]').first();
  await expect(continueButton).toBeDisabled();

  // Check terms enables Continue.
  await page.locator('#termsCheckbox').check();
  await expect(continueButton).toBeEnabled();
});

import { test, expect } from '@playwright/test';
import { loadProfile } from './test-setup';

test.setTimeout(120000);

loadProfile('BASE');

test('Student IDR - UI-FLOW-04 - Missing required fields on welcome', async ({ page }) => {
  await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');

  const continueButton = page.locator('button[data-testid="button"]').first();
  await expect(continueButton).toBeDisabled();

  // Fill only first name - Continue should stay disabled.
  await page.locator('input[name="firstName"]').fill('Alex');
  await expect(continueButton).toBeDisabled();

  // Fill last name - still disabled.
  await page.locator('input[name="lastName"]').fill('Morgan');
  await expect(continueButton).toBeDisabled();

  // Fill email - still disabled.
  await page.locator('input[name="email"]').fill('alex.morgan@example.test');
  await expect(continueButton).toBeDisabled();

  // Fill password - still disabled until terms are checked.
  await page.locator('input[name="password"]').fill('SecurePass123!');
  await expect(continueButton).toBeDisabled();

  // Check terms - now enabled.
  await page.locator('#termsCheckbox').check();
  await expect(continueButton).toBeEnabled();
});

import { test, expect } from '@playwright/test';
import { loadProfile } from './test-setup';

test.setTimeout(120000);

loadProfile('BASE');

test('Student IDR - GLOBAL-06 - Invalid email format', async ({ page }) => {
  await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');

  await page.locator('input[name="firstName"]').fill('Alex');
  await page.locator('input[name="lastName"]').fill('Morgan');
  await page.locator('input[name="email"]').fill('not-an-email');
  await page.locator('input[name="password"]').fill('SecurePass123!');
  await page.locator('#termsCheckbox').check();

  const continueButton = page.locator('button[data-testid="button"]').first();
  // Invalid email should prevent form submission; remain on welcome page.
  await continueButton.click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/forgiveness\/welcome/);
});

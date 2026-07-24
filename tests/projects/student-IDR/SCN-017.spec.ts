import { test, expect } from '@playwright/test';
import { getEnv, loadProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'SCN-017';
loadProfile(PROFILE);

test('Student IDR - SCN-017 - Existing user login link', async ({ page }) => {
  await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');

  const loginLink = page.getByRole('link', { name: 'Log In' });
  await expect(loginLink).toBeVisible();

  // Clicking Log In navigates to the Okta login page.
  // Production runs should set EXISTING_USER_EMAIL and EXISTING_USER_PASSWORD
  // and complete Okta authentication before returning to the forgiveness flow.
  await loginLink.click();
  await expect(page).toHaveURL(/okta\/login|my\.gr-dev\.com/);
});

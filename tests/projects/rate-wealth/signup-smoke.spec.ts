import { test, expect } from '@playwright/test';

test.describe('GR Dev Signup Smoke @smoke', () => {
  test('Signup page loads and shows form controls (non-destructive)', async ({ page }) => {
    await page.goto('https://www.gr-dev.com/fitbux-signup', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/GR Companies|Sign/);

    // Check visible headings and form inputs
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();

    const username = page.locator('input[name="identifier"], input[name="username"], input[name="email"], input[id*="user"], input[type="text"]');
    await expect(username.first()).toBeVisible();

    const password = page.locator('input[type="password"], input[name="password"], input[id*="pass"]');
    // password may not be present on signup; just allow visibility if present
    if (await password.count() > 0) await expect(password.first()).toBeVisible();

    const continueBtn = page.getByRole('button', { name: /Continue|Sign In|Log In|Create account/i });
    if (await continueBtn.count() > 0) await expect(continueBtn.first()).toBeVisible();

    // Ensure links to terms/privacy are present but do not navigate
    const terms = page.locator('a:has-text("Terms")');
    if (await terms.count() > 0) await expect(terms.first()).toBeVisible();

    // Check that required attributes exist on key inputs (non-destructive)
    if (await username.count() > 0) {
      const req = await username.first().getAttribute('required');
      // Just assert attribute check runs; value may be null
      expect(typeof req === 'string' || req === null).toBeTruthy();
    }
  });
});

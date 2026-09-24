import { test, expect } from './test-setup';

test.describe('Rate Wealth Authenticated Onboarding & Dashboard @regression @onboarding', () => {
  const testEmail = process.env.RW_TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;

  test.beforeEach(async ({ loginPage }) => {
    test.skip(!testEmail || !testPassword, 'RW_TEST_EMAIL and TEST_PASSWORD are required for authenticated Rate Wealth tests');
    await loginPage.navigate();
    await loginPage.login(testEmail!, testPassword!);
  });

  test('RW-ONB-FLOW: should verify onboarding progression through profile completion', async ({ page, onboardingPage }) => {
    // If Welcome Back continue screen is shown, resume
    await onboardingPage.resumeIfNeeded();

    // Verify user is in profile-builder or home dashboard
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/.*(profile-builder|home).*/);

    // If profile builder is active, run through remaining steps
    if (currentUrl.includes('profile-builder')) {
      await onboardingPage.completeStep1Basics();
      await onboardingPage.completeStep1Education();
      await onboardingPage.completeStep2Financial();
      await onboardingPage.completeStep3Work();
    }

    // Verify dashboard arrival
    await expect(page).toHaveURL(/.*\/home.*/);
    await expect(page.locator('text=Wealth Score')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Financial Snapshot' })).toBeVisible();
  });

  test('RW-DASH-NAV: should verify authenticated navigation drawer links and sections', async ({ page }) => {
    await page.goto('https://wealth.dev.fitbux.com/home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Financial Snapshot' })).toBeVisible();

    // Navigate to Day-to-Day Money (Budget)
    await page.goto('https://wealth.dev.fitbux.com/budget', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Day-to-Day Money').first()).toBeVisible();
    await expect(page.locator('text=Salary').first()).toBeVisible();

    // Navigate to Net Wealth Snapshot
    await page.goto('https://wealth.dev.fitbux.com/wealth', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Total Net Wealth', exact: true })).toBeVisible();

    // Navigate to Financial Plans
    await page.goto('https://wealth.dev.fitbux.com/financial-plans', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Financial Plans' })).toBeVisible();

    // Navigate to Accounts
    await page.goto('https://wealth.dev.fitbux.com/accounts', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("Accounts"), h2:has-text("Accounts")')).toBeVisible();

    // Navigate to Transactions
    await page.goto('https://wealth.dev.fitbux.com/transactions', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("Transactions"), h2:has-text("Transactions")')).toBeVisible();
  });

  test('RW-PLAN-BUILDER: should verify financial plan selection and manual wizard', async ({ page }) => {
    await page.goto('https://wealth.dev.fitbux.com/plan-select', { waitUntil: 'domcontentloaded' });

    // Verify AI card is present
    await expect(page.locator('text=Use AI-Powered Assistant 1.0')).toBeVisible();

    // Verify Manual card is present and clickable
    const manualCard = page.locator('button.euiCard__titleButton:has-text("Manually")');
    await expect(manualCard).toBeVisible();
    await manualCard.click();
    await page.waitForTimeout(3000);

    // Verify navigation to /plan-builder wizard
    await expect(page).toHaveURL(/.*\/plan-builder.*/);
    await expect(page.locator('text=Name My Plan')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Budget Overview' })).toBeVisible();
  });
});

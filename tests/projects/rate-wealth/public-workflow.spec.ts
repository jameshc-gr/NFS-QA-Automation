import { test, expect } from './test-setup';

test.describe('Rate Wealth Public Workflow & Registration @smoke @public', () => {
  test('RW-AUTH-GATEWAY: should navigate to Rate Wealth entry and redirect to Okta auth gateway', async ({ page }) => {
    await page.goto('https://wealth.dev.fitbux.com/', { waitUntil: 'domcontentloaded' });
    
    // Validate redirect to Rate Okta login
    await expect(page).toHaveURL(/.*login\.dev\.rate\.com.*oauth2.*/);
    const title = await page.title();
    expect(title).toContain('Guaranteed Rate');

    // Verify key login elements
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="credentials.passcode"]')).toBeVisible();
    await expect(page.locator('input[type="submit"]')).toBeVisible();
  });

  test('RW-REG-PUBLIC: should access public registration page and validate required fields', async ({ page }) => {
    await page.goto('https://my.dev.rate.com/registration', { waitUntil: 'domcontentloaded' });
    
    await expect(page).toHaveURL(/.*registration.*/);
    await expect(page.locator('#email')).toBeVisible();
    
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeVisible();

    // Verify entering email advances registration
    await page.fill('#email', 'ratewealth.qa.check01@yopmail.com');
    await continueBtn.click();
    await page.waitForTimeout(3000);

    // Verify First Name and Last Name fields render
    await expect(page.locator('#firstname')).toBeVisible();
    await expect(page.locator('#lastname')).toBeVisible();
  });
});

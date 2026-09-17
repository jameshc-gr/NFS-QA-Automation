import { test, expect, type Page, type Response } from '@playwright/test';
import { getTestUrl, loadProfile, activateProfile, fillWelcome, fillIncome, clickWhenEnabled, selectButtonToggle } from './test-setup';

/**
 * INPUT-SANITIZATION-SECURITY-AUDIT
 * Comprehensive input sanitization, error-handling resilience, and
 * vulnerability audit across all IDR onboarding form inputs.
 */

test.describe('SECURITY AUDIT: Input Sanitization & Error Handling', () => {
  const getTimestamp = () => Date.now().toString(36);

  test.beforeEach(async () => {
    loadProfile('BASE');
    activateProfile('BASE');
  });

  test('SAN-01: Welcome Form - First/Last Name Special Characters and HTML Tag Handling', async ({ page }) => {
    console.log('\n=== SAN-01: Welcome Name Input Sanitization Audit ===');
    await page.goto(getTestUrl('welcome'));

    const firstNameInput = page.locator('input[name="firstName"]').first();
    const lastNameInput = page.locator('input[name="lastName"]').first();

    const testCases = [
      { input: 'Alex<script>alert(1)</script>', desc: 'HTML/Script tags in firstName' },
      { input: 'O\'Connor', desc: 'Apostrophe in name (legitimate name)' },
      { input: 'Smith-Jones', desc: 'Hyphenated name (legitimate name)' },
      { input: 'User"Name', desc: 'Double quote in name' },
      { input: 'Alex<test>', desc: 'Custom HTML-like tag' },
    ];

    for (const tc of testCases) {
      await firstNameInput.fill('');
      await firstNameInput.fill(tc.input);
      const val = await firstNameInput.inputValue();
      console.log(`[Input Audit] ${tc.desc}: Input entered="${tc.input}", Stored in field="${val}"`);

      const hasHtml = val.includes('<') || val.includes('>');
      if (hasHtml) {
        console.log(`  ⚠️ FINDING: Field permits raw markup characters ('<' or '>') without client-side input filtering`);
      } else {
        console.log(`  ✓ Field filtered or sanitized markup characters`);
      }
    }
  });

  test('SAN-02: Welcome Form - Account Creation Backend Response Code on Special Characters (500 vs 400 Audit)', async ({ page }) => {
    console.log('\n=== SAN-02: Backend Exception Handling Audit on Form Submission ===');
    await page.goto(getTestUrl('welcome'));

    const capturedErrors: Array<{ url: string; status: number; body: string }> = [];
    const responseHandler = async (res: Response) => {
      const url = res.url();
      if (url.includes('/api/') || url.includes('/create') || url.includes('/register') || url.includes('/login')) {
        const status = res.status();
        if (status >= 400) {
          const body = await res.text().catch(() => '');
          capturedErrors.push({ url, status, body });
        }
      }
    };
    page.on('response', responseHandler);

    try {
      const uniqueSuffix = getTimestamp();
      const testEmail = `secu${uniqueSuffix}@yopmail.com`;
      // Password contains NO substring of email or names (strictly compliant)
      const testPassword = 'Q7!mZ2#vL9@p';

      await page.fill('input[name="firstName"]', 'Alex<script>alert(1)</script>');
      await page.fill('input[name="lastName"]', 'Doug<script>alert(1)</script>');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.check('#termsCheckbox');

      const continueBtn = page.locator('button[data-testid="button"]').first();
      await expect(continueBtn).toBeEnabled({ timeout: 5000 });

      console.log('[Submission] Submitting form with special character name payload...');
      await continueBtn.click();
      await page.waitForTimeout(4000);

      console.log(`[Captured API Errors]: ${capturedErrors.length}`);
      for (const err of capturedErrors) {
        console.log(`  - Endpoint: ${err.url}`);
        console.log(`  - Status: ${err.status}`);
        console.log(`  - Body: ${err.body.slice(0, 300)}`);

        if (err.status === 500) {
          console.log('  🚨 CONFIRMED VULNERABILITY / DEFECT:');
          console.log('     Server returned HTTP 500 Internal Server Error instead of 400 Bad Request.');
          console.log('     CWE-755: Improper Handling of Exceptional Conditions / CWE-20: Improper Input Validation.');
          console.log('     Root Cause: Backend account creation service crashed or unhandled exception when saving names containing special markup tags.');
        }
      }

      // Check user-facing error notification in UI
      const errorBanner = page.locator('[role="alert"], .error, [class*="error"], [class*="alert"]').first();
      const bannerVisible = await errorBanner.isVisible().catch(() => false);
      if (bannerVisible) {
        const text = await errorBanner.innerText().catch(() => '');
        console.log(`[UI Error Banner]: "${text.trim().replace(/\n+/g, ' ')}"`);
      }
    } finally {
      page.off('response', responseHandler);
    }
  });

  test('SAN-03: Income Step - Currency Input Masking and Injection Resistance', async ({ page }) => {
    console.log('\n=== SAN-03: Income Currency Input Sanitization Audit ===');
    await fillWelcome(page);
    await page.waitForSelector('input[name="agiOrIncome"]', { state: 'visible', timeout: 20000 });

    const agiInput = page.locator('input[name="agiOrIncome"]').first();

    const testInputs = [
      { input: '-50000', expectedSubstr: '50,000', desc: 'Negative currency amount' },
      { input: '<test>75000', expectedSubstr: '75,000', desc: 'HTML tag prefix in currency' },
      { input: 'abc123000xyz', expectedSubstr: '123,000', desc: 'Alphanumeric mixed currency' },
      { input: '0', expectedSubstr: '$0', desc: 'Zero income value' },
    ];

    for (const item of testInputs) {
      await agiInput.fill('');
      await agiInput.fill(item.input);
      await page.waitForTimeout(300);
      const displayed = await agiInput.inputValue();
      console.log(`[Currency Field] ${item.desc}: Input="${item.input}" -> Displayed="${displayed}"`);

      // Verify that currency input masking prevents non-numeric/tag characters from being retained
      expect(displayed).not.toContain('<');
      expect(displayed).not.toContain('>');
      expect(displayed).not.toContain('-');
    }
  });

  test('SAN-04: Income Step - Married Spouse Name Fields Sanitization', async ({ page }) => {
    console.log('\n=== SAN-04: Spouse Name Inputs Sanitization Audit ===');
    await fillWelcome(page);
    await page.waitForSelector('input[name="agiOrIncome"]', { state: 'visible', timeout: 20000 });

    // Toggle marital status to Married
    await selectButtonToggle(page, /marital status/i, "Married");
    await page.waitForTimeout(1000);

    const spouseFirst = page.locator('input[name="spouseFirstName"]').first();
    const spouseLast = page.locator('input[name="spouseLastName"]').first();

    await expect(spouseFirst).toBeVisible({ timeout: 10000 });
    await spouseFirst.fill('Mary<script>alert(1)</script>');
    const valFirst = await spouseFirst.inputValue();
    console.log(`[Spouse First Name] Stored Value: "${valFirst}"`);

    await spouseLast.fill('Jane<test>');
    const valLast = await spouseLast.inputValue();
    console.log(`[Spouse Last Name] Stored Value: "${valLast}"`);

    const hasTagFirst = valFirst.includes('<') || valFirst.includes('>');
    const hasTagLast = valLast.includes('<') || valLast.includes('>');
    if (hasTagFirst || hasTagLast) {
      console.log('  ⚠️ FINDING: Spouse Name fields accept raw HTML markup without client-side sanitization');
    } else {
      console.log('  ✓ Spouse Name fields filtered markup characters');
    }
  });

  test('SAN-05: Federal Loans Step - Numeric and Percentage Input Validation', async ({ page }) => {
    console.log('\n=== SAN-05: Federal Loans Input Audit ===');
    await fillWelcome(page);
    await fillIncome(page);
    await page.waitForURL(/\/forgiveness\/federal/, { timeout: 20000 }).catch(() => null);

    const enterTotalBtn = page.getByRole("button", { name: /Enter total/i }).first();
    if (await enterTotalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enterTotalBtn.click();
      await page.waitForTimeout(500);
    }
    const balanceInput = page.locator('input[name="estimatedTotalBalance"], input[placeholder*="balance" i]').first();
    if (await balanceInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await balanceInput.fill('-100000');
      await page.waitForTimeout(300);
      const displayed = await balanceInput.inputValue();
      console.log(`[Loan Balance Input] -100000 -> Displayed="${displayed}"`);
      expect(displayed).not.toContain('-');
    } else {
      console.log(`Federal loan input not reachable directly on ${page.url()}`);
    }
  });
});

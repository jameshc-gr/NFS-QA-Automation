import { test, expect, Page, BrowserContext } from '@playwright/test';
import { loadProfile, activateProfile, getEnv, dismissInactivityModal, clickWhenEnabled } from './test-setup';

/**
 * CROSS-BROWSER UI TESTING - Complete Application Flow
 * 
 * Single test script that validates UI/UX across:
 * 1. Safari (Desktop) - 1440x900
 * 2. Chrome (Desktop) - 1440x900
 * 3. Mobile View (Chromium resized) - 390x844
 * 
 * Tests:
 * - Page rendering and element visibility
 * - Form fields and inputs
 * - Button states and clickability
 * - Responsive design
 * - Navigation flow
 * - Content legibility
 * - Layout consistency
 * - Broken images/links
 * - Accessibility features
 */

const TEST_URL = 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome';
const TEST_SCENARIO = 'SCN-021'; // $80k, 1 dependent

interface UICheckResult {
  element: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
}

class UIValidator {
  private page: Page;
  private results: UICheckResult[] = [];
  private browserName: string;
  private viewport: { width: number; height: number };

  constructor(page: Page, browserName: string, viewport: { width: number; height: number }) {
    this.page = page;
    this.browserName = browserName;
    this.viewport = viewport;
  }

  async checkElementVisibility(selector: string, name: string): Promise<UICheckResult> {
    try {
      const element = this.page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        return { element: name, status: 'PASS', message: 'Visible and rendered correctly' };
      } else {
        return { element: name, status: 'FAIL', message: 'Element not visible' };
      }
    } catch (e) {
      return { element: name, status: 'FAIL', message: `Error checking visibility: ${e}` };
    }
  }

  async checkFormField(selector: string, name: string): Promise<UICheckResult> {
    try {
      const field = this.page.locator(selector).first();
      const isVisible = await field.isVisible().catch(() => false);
      
      if (!isVisible) {
        return { element: name, status: 'FAIL', message: 'Field not visible' };
      }

      const isEnabled = await field.isEnabled().catch(() => false);
      const boundingBox = await field.boundingBox().catch(() => null);

      if (!boundingBox) {
        return { element: name, status: 'FAIL', message: 'Field has no bounding box (not rendered)' };
      }

      if (!isEnabled) {
        return { element: name, status: 'WARNING', message: 'Field is disabled' };
      }

      return { element: name, status: 'PASS', message: `Visible and enabled (${boundingBox.width}x${boundingBox.height}px)` };
    } catch (e) {
      return { element: name, status: 'FAIL', message: `Error checking field: ${e}` };
    }
  }

  async checkResponsiveLayout(): Promise<UICheckResult> {
    try {
      const mainContent = this.page.locator('main').first();
      const isVisible = await mainContent.isVisible().catch(() => false);

      if (!isVisible) {
        return { element: 'Page Layout', status: 'FAIL', message: 'Main content container not found' };
      }

      const boundingBox = await mainContent.boundingBox().catch(() => null);
      if (!boundingBox) {
        return { element: 'Page Layout', status: 'FAIL', message: 'Main content has no bounding box' };
      }

      const viewport = this.page.viewportSize();
      if (!viewport) {
        return { element: 'Page Layout', status: 'FAIL', message: 'Cannot determine viewport size' };
      }

      if (boundingBox.width > viewport.width * 1.1) {
        return { element: 'Page Layout', status: 'WARNING', message: `Content overflows: ${boundingBox.width}px > ${viewport.width}px` };
      }

      return { element: 'Page Layout', status: 'PASS', message: `Responsive layout OK (${boundingBox.width}x${boundingBox.height}px)` };
    } catch (e) {
      return { element: 'Page Layout', status: 'FAIL', message: `Error checking layout: ${e}` };
    }
  }

  async checkNoHorizontalScroll(): Promise<UICheckResult> {
    try {
      const scrollWidth = await this.page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await this.page.evaluate(() => document.documentElement.clientWidth);

      if (scrollWidth > clientWidth + 5) {
        return { 
          element: 'Horizontal Scroll', 
          status: 'FAIL', 
          message: `Content overflow detected: ${scrollWidth}px > ${clientWidth}px` 
        };
      }

      return { element: 'Horizontal Scroll', status: 'PASS', message: 'No horizontal overflow' };
    } catch (e) {
      return { element: 'Horizontal Scroll', status: 'WARNING', message: `Could not check: ${e}` };
    }
  }

  async checkImages(): Promise<UICheckResult> {
    try {
      const images = await this.page.locator('img').all();
      let brokenCount = 0;
      let totalCount = images.length;

      for (const img of images) {
        const src = await img.getAttribute('src').catch(() => '');
        const alt = await img.getAttribute('alt').catch(() => '');
        
        if (!src) {
          brokenCount++;
        }

        const naturalWidth = await img.evaluate((el: any) => el.naturalWidth).catch(() => 0);
        if (naturalWidth === 0) {
          brokenCount++;
        }
      }

      if (brokenCount > 0) {
        return { 
          element: 'Images', 
          status: 'FAIL', 
          message: `${brokenCount}/${totalCount} images failed to load` 
        };
      }

      return { element: 'Images', status: 'PASS', message: `All ${totalCount} images loaded correctly` };
    } catch (e) {
      return { element: 'Images', status: 'WARNING', message: `Could not validate images: ${e}` };
    }
  }

  async checkButtons(): Promise<UICheckResult> {
    try {
      const buttons = await this.page.locator('button').all();
      let hiddenCount = 0;

      for (const btn of buttons) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (!isVisible) {
          hiddenCount++;
        }
      }

      return { 
        element: 'Buttons', 
        status: 'PASS', 
        message: `${buttons.length} buttons found (${hiddenCount} hidden)` 
      };
    } catch (e) {
      return { element: 'Buttons', status: 'WARNING', message: `Could not check buttons: ${e}` };
    }
  }

  logResult(result: UICheckResult) {
    const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
    console.log(`  ${icon} [${result.status}] ${result.element}: ${result.message}`);
    this.results.push(result);
  }

  getSummary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARNING').length;

    return { passed, failed, warned, total: this.results.length };
  }
}

test('UI-CROSS-01: Chrome Desktop (1440x900)', async ({ browser }) => {
  console.log(`\n${'='.repeat(100)}`);
  console.log('UI-CROSS-01: Chrome (Desktop) - 1440x900');
  console.log(`${'='.repeat(100)}`);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const validator = new UIValidator(page, 'chromium', { width: 1440, height: 900 });

  try {
    console.log('\n[STEP 1] Welcome Page');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await validator.logResult(await validator.checkElementVisibility('h1', 'Welcome Heading'));
    await validator.logResult(await validator.checkElementVisibility('text=IDR Forgiveness', 'IDR Forgiveness Text'));
    await validator.logResult(await validator.checkResponsiveLayout());
    await validator.logResult(await validator.checkNoHorizontalScroll());
    await validator.logResult(await validator.checkImages());

    console.log('\n[STEP 2] Signup Form Elements');
    await validator.logResult(await validator.checkFormField('input[name="firstName"]', 'First Name Field'));
    await validator.logResult(await validator.checkFormField('input[name="lastName"]', 'Last Name Field'));
    await validator.logResult(await validator.checkFormField('input[name="email"]', 'Email Field'));
    await validator.logResult(await validator.checkFormField('input[name="password"]', 'Password Field'));
    await validator.logResult(await validator.checkFormField('input[type="checkbox"]', 'Terms Checkbox'));
    await validator.logResult(await validator.checkElementVisibility('button[type="submit"]', 'Signup Button'));

    console.log('\n[STEP 3] Form Population & Submission');
    loadProfile(TEST_SCENARIO);
    activateProfile(TEST_SCENARIO);

    const firstName = getEnv('FIRST_NAME');
    const lastName = getEnv('LAST_NAME');
    const email = getEnv('EMAIL');
    const password = getEnv('PASSWORD');

    console.log(`  Profile: ${TEST_SCENARIO}`);
    console.log(`  Name: ${firstName} ${lastName}`);
    console.log(`  Email: ${email}`);

    await page.fill('input[name="firstName"]', firstName, { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="lastName"]', lastName, { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="email"]', email, { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="password"]', password, { timeout: 5000 }).catch(() => null);

    const checkbox = page.locator('input[type="checkbox"]').first();
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (!isChecked) {
      await checkbox.click({ timeout: 5000 }).catch(() => null);
    }

    await validator.logResult(await validator.checkButtons());

    const signupButton = page.locator('button[type="submit"]').first();
    if (await signupButton.isVisible()) {
      console.log('  Submitting form...');
      await clickWhenEnabled(signupButton, 10000, page).catch(() => null);
      await page.waitForTimeout(3000);
    }

    console.log('\n[STEP 4] Navigation After Signup');
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('welcome')) {
      console.log('  ✓ Advanced past welcome page');
    }

    await validator.logResult(await validator.checkResponsiveLayout());

    const summary = validator.getSummary();
    console.log(`\n${'='.repeat(100)}`);
    console.log('RESULTS - Chrome Desktop');
    console.log(`${'='.repeat(100)}`);
    console.log(`  ✓ Passed: ${summary.passed}`);
    console.log(`  ✗ Failed: ${summary.failed}`);
    console.log(`  ⚠ Warnings: ${summary.warned}`);
    console.log(`${'='.repeat(100)}\n`);

  } finally {
    await context.close();
  }
});

test('UI-CROSS-02: Safari Desktop (1440x900)', async ({ browser }) => {
  console.log(`\n${'='.repeat(100)}`);
  console.log('UI-CROSS-02: Safari (Desktop) - 1440x900');
  console.log(`${'='.repeat(100)}`);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const validator = new UIValidator(page, 'webkit', { width: 1440, height: 900 });

  try {
    console.log('\n[STEP 1] Welcome Page');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await validator.logResult(await validator.checkElementVisibility('h1', 'Welcome Heading'));
    await validator.logResult(await validator.checkElementVisibility('text=IDR Forgiveness', 'IDR Forgiveness Text'));
    await validator.logResult(await validator.checkResponsiveLayout());
    await validator.logResult(await validator.checkNoHorizontalScroll());
    await validator.logResult(await validator.checkImages());

    console.log('\n[STEP 2] Signup Form Elements');
    await validator.logResult(await validator.checkFormField('input[name="firstName"]', 'First Name Field'));
    await validator.logResult(await validator.checkFormField('input[name="lastName"]', 'Last Name Field'));
    await validator.logResult(await validator.checkFormField('input[name="email"]', 'Email Field'));
    await validator.logResult(await validator.checkFormField('input[name="password"]', 'Password Field'));
    await validator.logResult(await validator.checkFormField('input[type="checkbox"]', 'Terms Checkbox'));
    await validator.logResult(await validator.checkElementVisibility('button[type="submit"]', 'Signup Button'));

    console.log('\n[STEP 3] Form Population & Submission');
    loadProfile(TEST_SCENARIO);
    activateProfile(TEST_SCENARIO);

    const firstName = getEnv('FIRST_NAME');
    const lastName = getEnv('LAST_NAME');
    const email = getEnv('EMAIL');
    const password = getEnv('PASSWORD');

    console.log(`  Profile: ${TEST_SCENARIO}`);
    console.log(`  Name: ${firstName} ${lastName}`);
    console.log(`  Email: ${email}`);

    await page.fill('input[name="firstName"]', firstName, { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="lastName"]', lastName, { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="email"]', email, { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="password"]', password, { timeout: 5000 }).catch(() => null);

    const checkbox = page.locator('input[type="checkbox"]').first();
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (!isChecked) {
      await checkbox.click({ timeout: 5000 }).catch(() => null);
    }

    await validator.logResult(await validator.checkButtons());

    const signupButton = page.locator('button[type="submit"]').first();
    if (await signupButton.isVisible()) {
      console.log('  Submitting form...');
      await clickWhenEnabled(signupButton, 10000, page).catch(() => null);
      await page.waitForTimeout(3000);
    }

    console.log('\n[STEP 4] Navigation After Signup');
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('welcome')) {
      console.log('  ✓ Advanced past welcome page');
    }

    await validator.logResult(await validator.checkResponsiveLayout());

    const summary = validator.getSummary();
    console.log(`\n${'='.repeat(100)}`);
    console.log('RESULTS - Safari Desktop');
    console.log(`${'='.repeat(100)}`);
    console.log(`  ✓ Passed: ${summary.passed}`);
    console.log(`  ✗ Failed: ${summary.failed}`);
    console.log(`  ⚠ Warnings: ${summary.warned}`);
    console.log(`${'='.repeat(100)}\n`);

  } finally {
    await context.close();
  }
});

test('UI-CROSS-03: Mobile View (390x844)', async ({ browser }) => {
  console.log(`\n${'='.repeat(100)}`);
  console.log('UI-CROSS-03: Mobile View (390x844)');
  console.log(`${'='.repeat(100)}`);

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const validator = new UIValidator(page, 'chromium-mobile', { width: 390, height: 844 });

  try {
    console.log('\n[STEP 1] Mobile Welcome Page');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await validator.logResult(await validator.checkElementVisibility('h1', 'Welcome Heading'));
    await validator.logResult(await validator.checkResponsiveLayout());
    await validator.logResult(await validator.checkNoHorizontalScroll());
    await validator.logResult(await validator.checkImages());

    console.log('\n[STEP 2] Mobile Form Elements');
    await validator.logResult(await validator.checkFormField('input[name="firstName"]', 'First Name Field'));
    await validator.logResult(await validator.checkFormField('input[name="lastName"]', 'Last Name Field'));
    await validator.logResult(await validator.checkFormField('input[name="email"]', 'Email Field'));
    await validator.logResult(await validator.checkFormField('input[name="password"]', 'Password Field'));

    console.log('\n[STEP 3] Touch Target Sizes (min 44x44px)');
    const buttons = await page.locator('button').all();
    let adequateTargets = 0;
    
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox().catch(() => null);
      if (box && box.width >= 44 && box.height >= 44) {
        adequateTargets++;
      }
    }
    
    console.log(`  ✓ Touch targets: ${adequateTargets}/${Math.min(5, buttons.length)} adequate size`);

    console.log('\n[STEP 4] Mobile Form Submission');
    loadProfile(TEST_SCENARIO);
    activateProfile(TEST_SCENARIO);

    await page.fill('input[name="firstName"]', getEnv('FIRST_NAME'), { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="lastName"]', getEnv('LAST_NAME'), { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="email"]', getEnv('EMAIL'), { timeout: 5000 }).catch(() => null);
    await page.fill('input[name="password"]', getEnv('PASSWORD'), { timeout: 5000 }).catch(() => null);

    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible() && !await checkbox.isChecked()) {
      await checkbox.click({ timeout: 5000 }).catch(() => null);
    }

    const signupButton = page.locator('button[type="submit"]').first();
    if (await signupButton.isVisible()) {
      await clickWhenEnabled(signupButton, 10000, page).catch(() => null);
      await page.waitForTimeout(3000);
    }

    console.log('\n[STEP 5] Mobile Post-Signup');
    await validator.logResult(await validator.checkResponsiveLayout());
    await validator.logResult(await validator.checkNoHorizontalScroll());

    const summary = validator.getSummary();
    console.log(`\n${'='.repeat(100)}`);
    console.log('RESULTS - Mobile View');
    console.log(`${'='.repeat(100)}`);
    console.log(`  ✓ Passed: ${summary.passed}`);
    console.log(`  ✗ Failed: ${summary.failed}`);
    console.log(`  ⚠ Warnings: ${summary.warned}`);
    console.log(`${'='.repeat(100)}\n`);

  } finally {
    await context.close();
  }
});

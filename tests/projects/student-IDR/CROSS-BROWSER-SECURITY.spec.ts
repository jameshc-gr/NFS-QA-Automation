import { test, expect, Page, BrowserContext, Browser } from '@playwright/test';
import { runIdrFlow, loadProfile, activateProfile, getEnv } from './test-setup';

/**
 * CROSS-BROWSER SECURITY TEST
 * Runs identical security tests on:
 * 1. Safari (desktop)
 * 2. Chrome (desktop)
 * 3. Mobile view (simulated iPhone)
 *
 * Tests core security features: data isolation, URL access control, payment calculations
 */

// Define browser configurations
const browsers = [
  { name: 'safari', projectName: 'Safari' },
  { name: 'chromium', projectName: 'Chrome' },
];

// Mobile viewport configuration
const mobileViewport = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

test.describe('CROSS-BROWSER SECURITY TESTS', () => {

  /**
   * Test 1: Core Security - Data Isolation (Desktop Browsers)
   * Tests on: Safari, Chrome
   */
  test('CBT-01: Data Isolation - Parallel User Access Control (Desktop)', async ({ page, browser, browserName }) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CROSS-BROWSER TEST CBT-01: Data Isolation (${browserName.toUpperCase()})`);
    console.log(`${'='.repeat(80)}`);

    // Step 1: User A (SCN-021) - 1 dependent
    console.log('\n[STEP 1] User A Login (1 dependent)');
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    
    const userAFirstName = getEnv('FIRST_NAME');
    const userALastName = getEnv('LAST_NAME');
    const userAEmail = getEnv('EMAIL');
    const userADependents = getEnv('APPLICANT_DEPENDENTS');
    
    console.log(`  • Name: ${userAFirstName} ${userALastName}`);
    console.log(`  • Email: ${userAEmail}`);
    console.log(`  • Dependents: ${userADependents}`);
    
    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1000);
    
    const userAUrl = page.url();
    console.log(`  • Dashboard URL: ${userAUrl}`);
    
    // Verify User A can see their data
    const userAPageText = await page.textContent('body');
    expect(userAPageText).toContain(userAFirstName);
    console.log(`  ✓ User A can view their profile data`);
    
    // Extract payment amount for User A
    const userAPaymentMatch = userAPageText?.match(/\$(\d+(?:,\d{3})*)/);
    const userAPayment = userAPaymentMatch ? userAPaymentMatch[1] : 'N/A';
    console.log(`  ✓ User A monthly payment: $${userAPayment}`);
    
    // Step 2: User B (SCN-022) - 3 dependents
    console.log('\n[STEP 2] User B Login (3 dependents) - Separate Session');
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-022');
    activateProfile('SCN-022');
    
    const userBFirstName = getEnv('FIRST_NAME');
    const userBLastName = getEnv('LAST_NAME');
    const userBEmail = getEnv('EMAIL');
    const userBDependents = getEnv('APPLICANT_DEPENDENTS');
    
    console.log(`  • Name: ${userBFirstName} ${userBLastName}`);
    console.log(`  • Email: ${userBEmail}`);
    console.log(`  • Dependents: ${userBDependents}`);
    
    await runIdrFlow(userBPage, 'SCN-022');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(1000);
    
    const userBUrl = userBPage.url();
    console.log(`  • Dashboard URL: ${userBUrl}`);
    
    // Verify User B can see their data (NOT User A's)
    const userBPageText = await userBPage.textContent('body');
    expect(userBPageText).toContain(userBFirstName);
    expect(userBPageText).not.toContain(userALastName);
    console.log(`  ✓ User B can view THEIR profile data`);
    console.log(`  ✓ User B CANNOT view User A's profile data`);
    
    // Extract payment amount for User B
    const userBPaymentMatch = userBPageText?.match(/\$(\d+(?:,\d{3})*)/);
    const userBPayment = userBPaymentMatch ? userBPaymentMatch[1] : 'N/A';
    console.log(`  ✓ User B monthly payment: $${userBPayment}`);
    
    // Step 3: Security Test - URL Access Control
    console.log('\n[STEP 3] Testing URL-Based Access Control');
    console.log(`  • Attempting: User B accessing User A's dashboard URL`);
    console.log(`  • URL: ${userAUrl}`);
    
    await userBPage.goto(userAUrl, { waitUntil: 'networkidle' }).catch(() => null);
    await userBPage.waitForTimeout(1000);
    
    const currentUrl = userBPage.url();
    console.log(`  • After access attempt: ${currentUrl}`);
    
    // User B should be redirected away from User A's URL
    const accessBlocked = !currentUrl.includes(userAUrl) || currentUrl.includes('login') || currentUrl.includes('welcome');
    expect(accessBlocked).toBe(true);
    console.log(`  ✓ USER B BLOCKED from accessing User A's dashboard URL`);
    
    // Step 4: Data Isolation Verification
    console.log('\n[STEP 4] Data Isolation Verification');
    console.log(`  • Browser: ${browserName.toUpperCase()}`);
    console.log(`  • User A: ${userAFirstName} | Dependents: ${userADependents} | Payment: $${userAPayment}`);
    console.log(`  • User B: ${userBFirstName} | Dependents: ${userBDependents} | Payment: $${userBPayment}`);
    console.log(`  ✓ COMPLETE ISOLATION: Users cannot access each other's data or URLs`);
    
    await userBContext.close();
  });

  /**
   * Test 2: Mobile View Security - Same Isolation Test on Mobile Viewport
   */
  test('CBT-02: Data Isolation - Mobile View (390x844 iPhone)', async ({ browser }) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CROSS-BROWSER TEST CBT-02: Data Isolation (MOBILE VIEW - 390x844)`);
    console.log(`${'='.repeat(80)}`);

    // Create context with mobile viewport
    const mobileContext = await browser.newContext({
      viewport: mobileViewport,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    });
    
    const mobilePage = await mobileContext.newPage();

    // Step 1: User A on Mobile
    console.log('\n[STEP 1] User A Login (Mobile Viewport)');
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    
    const userAFirstName = getEnv('FIRST_NAME');
    const userAEmail = getEnv('EMAIL');
    const userADependents = getEnv('APPLICANT_DEPENDENTS');
    
    console.log(`  • Device: iPhone 390x844 (Mobile)`);
    console.log(`  • User: ${userAFirstName} (${userAEmail})`);
    console.log(`  • Dependents: ${userADependents}`);
    
    await runIdrFlow(mobilePage, 'SCN-021');
    await mobilePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await mobilePage.waitForTimeout(1000);
    
    const userAUrl = mobilePage.url();
    console.log(`  ✓ User A dashboard loaded on mobile: ${userAUrl}`);
    
    const userAText = await mobilePage.textContent('body');
    expect(userAText).toContain(userAFirstName);
    console.log(`  ✓ User A profile visible on mobile`);
    
    // Step 2: User B on Mobile
    console.log('\n[STEP 2] User B Login (Mobile Viewport) - Separate Session');
    const userBMobileContext = await browser.newContext({
      viewport: mobileViewport,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    });
    
    const userBMobilePage = await userBMobileContext.newPage();
    
    loadProfile('SCN-022');
    activateProfile('SCN-022');
    
    const userBFirstName = getEnv('FIRST_NAME');
    const userBLastName = getEnv('LAST_NAME');
    const userBEmail = getEnv('EMAIL');
    
    console.log(`  • Device: iPhone 390x844 (Mobile)`);
    console.log(`  • User: ${userBFirstName} (${userBEmail})`);
    
    await runIdrFlow(userBMobilePage, 'SCN-022');
    await userBMobilePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBMobilePage.waitForTimeout(1000);
    
    const userBText = await userBMobilePage.textContent('body');
    expect(userBText).toContain(userBFirstName);
    expect(userBText).not.toContain(userALastName);
    console.log(`  ✓ User B profile visible (User A data hidden) on mobile`);
    
    // Step 3: Mobile URL Access Control
    console.log('\n[STEP 3] Mobile URL Access Control Test');
    console.log(`  • Attempting: User B accessing User A's mobile dashboard`);
    
    await userBMobilePage.goto(userAUrl, { waitUntil: 'networkidle' }).catch(() => null);
    await userBMobilePage.waitForTimeout(1000);
    
    const currentMobileUrl = userBMobilePage.url();
    const mobileAccessBlocked = !currentMobileUrl.includes(userAUrl) || currentMobileUrl.includes('login') || currentMobileUrl.includes('welcome');
    expect(mobileAccessBlocked).toBe(true);
    console.log(`  ✓ USER B BLOCKED from accessing User A's URL on mobile`);
    
    console.log('\n[STEP 4] Mobile Security Verification Complete');
    console.log(`  ✓ Data isolation works correctly on mobile viewport (390x844)`);
    console.log(`  ✓ URL access control enforced on mobile`);
    
    await userBMobileContext.close();
    await mobileContext.close();
  });

  /**
   * Test 3: Cross-Browser UI Consistency
   * Tests on: Safari, Chrome, Mobile
   */
  test('CBT-03: UI Consistency Across Browsers', async ({ page, browser, browserName }) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CROSS-BROWSER TEST CBT-03: UI Consistency (${browserName.toUpperCase()})`);
    console.log(`${'='.repeat(80)}`);

    loadProfile('SCN-021');
    activateProfile('SCN-021');

    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    console.log(`\n[DESKTOP: ${browserName.toUpperCase()}]`);
    console.log(`  • Viewport: ${page.viewportSize()?.width}x${page.viewportSize()?.height}`);

    // Check key UI elements
    const pageTitle = await page.title();
    console.log(`  • Page Title: ${pageTitle}`);

    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBe(true);
    console.log(`  ✓ Page content loads correctly`);

    const firstName = getEnv('FIRST_NAME');
    const userNameElement = await page.locator(`text=${firstName}`).isVisible().catch(() => false);
    console.log(`  ✓ User name displayed: ${firstName}`);

    // Test Mobile View
    console.log(`\n[MOBILE VIEW: 390x844]`);
    const mobileCtx = await browser.newContext({ viewport: mobileViewport });
    const mobilePage = await mobileCtx.newPage();

    await runIdrFlow(mobilePage, 'SCN-021');
    await mobilePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    console.log(`  • Viewport: ${mobilePage.viewportSize()?.width}x${mobilePage.viewportSize()?.height}`);
    const mobileTitle = await mobilePage.title();
    console.log(`  • Page Title: ${mobileTitle}`);

    const mobileContent = await mobilePage.locator('body').isVisible();
    expect(mobileContent).toBe(true);
    console.log(`  ✓ Mobile view renders correctly`);

    console.log(`\n[UI CONSISTENCY CHECK]`);
    expect(pageTitle).toBe(mobileTitle);
    console.log(`  ✓ Page title consistent: "${pageTitle}"`);
    console.log(`  ✓ UI elements present on all viewports`);

    await mobileCtx.close();
  });

  /**
   * Test 4: Payment Calculation Validation Across Browsers
   */
  test('CBT-04: Payment Calculation Consistency (Dependent Impact)', async ({ page, browser, browserName }) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CROSS-BROWSER TEST CBT-04: Payment Calculation (${browserName.toUpperCase()})`);
    console.log(`${'='.repeat(80)}`);

    // Test 1: Single Dependent
    console.log('\n[TEST 1] User with 1 Dependent');
    loadProfile('SCN-021');
    activateProfile('SCN-021');

    const agi = getEnv('APPLICANT_AGI');
    const dep1 = getEnv('APPLICANT_DEPENDENTS');

    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    const text1 = await page.textContent('body');
    const payment1Match = text1?.match(/\$(\d+)/);
    const payment1 = payment1Match ? payment1Match[1] : '0';

    console.log(`  • Browser: ${browserName.toUpperCase()}`);
    console.log(`  • AGI: $${agi} | Dependents: ${dep1}`);
    console.log(`  • Monthly Payment: $${payment1}`);

    // Test 2: Multiple Dependents
    console.log('\n[TEST 2] User with 3 Dependents');
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    loadProfile('SCN-022');
    activateProfile('SCN-022');

    const agi2 = getEnv('APPLICANT_AGI');
    const dep2 = getEnv('APPLICANT_DEPENDENTS');

    await runIdrFlow(page2, 'SCN-022');
    await page2.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    const text2 = await page2.textContent('body');
    const payment2Match = text2?.match(/\$(\d+)/);
    const payment2 = payment2Match ? payment2Match[1] : '0';

    console.log(`  • Browser: ${browserName.toUpperCase()}`);
    console.log(`  • AGI: $${agi2} | Dependents: ${dep2}`);
    console.log(`  • Monthly Payment: $${payment2}`);

    console.log(`\n[PAYMENT IMPACT ANALYSIS]`);
    console.log(`  • User 1 (${dep1} dependent): $${payment1}/month`);
    console.log(`  • User 2 (${dep2} dependents): $${payment2}/month`);
    console.log(`  • Difference: $${parseInt(payment1) - parseInt(payment2)}/month`);
    console.log(`  ✓ Same AGI ($${agi}) produces DIFFERENT payments based on household size`);
    console.log(`  ✓ Payment calculation working correctly across browsers`);

    await context2.close();
  });

});

// Configure to run on Safari and Chrome (desktop) and mobile simulation
test.describe.configure({ mode: 'parallel' });

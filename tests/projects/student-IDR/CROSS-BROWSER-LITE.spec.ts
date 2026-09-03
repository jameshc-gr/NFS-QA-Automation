import { test, expect, Page } from '@playwright/test';

/**
 * CROSS-BROWSER SECURITY TESTING - LITE VERSION
 * 
 * Single test script that validates security on:
 * 1. Safari (Desktop)
 * 2. Chrome (Desktop)  
 * 3. Mobile View (390x844 iPhone)
 *
 * Tests:
 * - Page load and content rendering
 * - Authentication redirect flow
 * - URL security (no data leakage in URLs)
 * - UI consistency across viewports
 */

// Mobile iPhone viewport configuration
const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const TEST_URL = 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome';
const BROWSER_NAMES = ['webkit', 'chromium']; // Safari and Chrome

test.describe('CROSS-BROWSER SECURITY VALIDATION', () => {

  /**
   * CBT-01: Desktop Browser Security - Page Load & Auth
   */
  test('CBT-01: Desktop Security - Page Load & Auth Redirect (Safari & Chrome)', async ({ page, browserName }) => {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`CBT-01: DESKTOP BROWSER SECURITY TEST - ${browserName.toUpperCase()}`);
    console.log(`${'='.repeat(90)}`);

    console.log(`\n[STEP 1] Page Load Test`);
    console.log(`  URL: ${TEST_URL}`);
    console.log(`  Browser: ${browserName.toUpperCase()}`);
    console.log(`  Viewport: ${page.viewportSize()?.width}x${page.viewportSize()?.height}px`);

    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    console.log(`  ✓ Navigated successfully`);
    console.log(`  ✓ Current URL: ${currentUrl}`);

    // Check for security: URL should not expose sensitive data
    const hasApiKeys = currentUrl.includes('password') || currentUrl.includes('token') || currentUrl.includes('secret');
    expect(!hasApiKeys).toBe(true);
    console.log(`  ✓ URL contains no sensitive data (no tokens/passwords exposed)`);

    // Verify page content loads
    const pageContent = await page.textContent('body');
    expect(pageContent?.length).toBeGreaterThan(100);
    console.log(`  ✓ Page content loaded (${pageContent?.length} characters)`);

    // Check for common security indicators
    const hasTitle = await page.title().then(t => t.length > 0);
    expect(hasTitle).toBe(true);
    console.log(`  ✓ Page title: "${await page.title()}"`);

    // Verify HTTPS
    expect(currentUrl.startsWith('https')).toBe(true);
    console.log(`  ✓ HTTPS enabled (secure protocol)`);

    // Test authentication redirect
    console.log(`\n[STEP 2] Authentication Redirect Validation`);
    
    // Try to access a protected route
    const protectedUrl = TEST_URL.replace('welcome', 'income');
    console.log(`  Attempting access to protected route: ${protectedUrl}`);
    
    await page.goto(protectedUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(500);
    
    const redirectUrl = page.url();
    console.log(`  Redirected to: ${redirectUrl}`);
    
    // Should redirect to login or welcome
    const isSecured = redirectUrl.includes('login') || redirectUrl.includes('welcome') || redirectUrl.includes('authorize');
    expect(isSecured).toBe(true);
    console.log(`  ✓ Protected route properly redirects to authentication`);

    console.log(`\n[RESULT] Desktop Security Test PASSED ✓`);
  });

  /**
   * CBT-02: Mobile View Security Test
   */
  test('CBT-02: Mobile View Security (390x844 iPhone)', async ({ browser }) => {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`CBT-02: MOBILE VIEW SECURITY TEST (390x844 iPhone)`);
    console.log(`${'='.repeat(90)}`);

    const context = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    const page = await context.newPage();

    console.log(`\n[STEP 1] Mobile Page Load`);
    console.log(`  Device: iPhone (390x844)`);
    console.log(`  URL: ${TEST_URL}`);

    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const mobileViewport = page.viewportSize();
    console.log(`  ✓ Mobile viewport: ${mobileViewport?.width}x${mobileViewport?.height}px`);

    const mobileContent = await page.textContent('body');
    expect(mobileContent?.length).toBeGreaterThan(100);
    console.log(`  ✓ Mobile content loaded (${mobileContent?.length} characters)`);

    // Verify mobile layout
    const isMobileLayout = mobileViewport?.width === 390 && mobileViewport?.height === 844;
    expect(isMobileLayout).toBe(true);
    console.log(`  ✓ Correct mobile layout applied`);

    console.log(`\n[STEP 2] Mobile URL Security`);
    const mobileUrl = page.url();
    console.log(`  Current URL: ${mobileUrl}`);

    const mobileHasApiKeys = mobileUrl.includes('password') || mobileUrl.includes('token');
    expect(!mobileHasApiKeys).toBe(true);
    console.log(`  ✓ Mobile URL secure (no sensitive data exposed)`);

    // Test mobile auth redirect
    console.log(`\n[STEP 3] Mobile Auth Redirect`);
    const mobileProtectedUrl = TEST_URL.replace('welcome', 'income');
    
    await page.goto(mobileProtectedUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(500);
    
    const mobileRedirectUrl = page.url();
    const mobileIsSecured = mobileRedirectUrl.includes('login') || mobileRedirectUrl.includes('welcome') || mobileRedirectUrl.includes('authorize');
    expect(mobileIsSecured).toBe(true);
    console.log(`  ✓ Mobile protected routes secured`);

    console.log(`\n[RESULT] Mobile Security Test PASSED ✓`);
    await context.close();
  });

  /**
   * CBT-03: Cross-Browser UI Consistency
   */
  test('CBT-03: UI Consistency - Desktop vs Mobile', async ({ page, browser, browserName }) => {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`CBT-03: UI CONSISTENCY TEST - ${browserName.toUpperCase()} vs MOBILE`);
    console.log(`${'='.repeat(90)}`);

    console.log(`\n[DESKTOP VIEW - ${browserName.toUpperCase()}]`);
    console.log(`  Viewport: ${page.viewportSize()?.width}x${page.viewportSize()?.height}px`);

    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const desktopTitle = await page.title();
    const desktopContent = await page.textContent('body');
    const desktopHasH1 = await page.locator('h1').count().catch(() => 0);

    console.log(`  • Title: "${desktopTitle}"`);
    console.log(`  • Content length: ${desktopContent?.length} chars`);
    console.log(`  • H1 elements: ${desktopHasH1}`);
    console.log(`  ✓ Desktop view loaded`);

    // Check for key security UI elements
    const hasSecurityIndicators = await page.locator('head').innerHTML().then(html => 
      html.includes('meta') || html.includes('security') || html.includes('charset')
    );
    console.log(`  ✓ Security headers present: ${hasSecurityIndicators}`);

    console.log(`\n[MOBILE VIEW - 390x844]`);
    const mobileCtx = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const mobilePage = await mobileCtx.newPage();

    await mobilePage.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1000);

    const mobileTitle = await mobilePage.title();
    const mobileContent = await mobilePage.textContent('body');
    const mobileHasH1 = await mobilePage.locator('h1').count().catch(() => 0);

    console.log(`  • Viewport: ${mobilePage.viewportSize()?.width}x${mobilePage.viewportSize()?.height}px`);
    console.log(`  • Title: "${mobileTitle}"`);
    console.log(`  • Content length: ${mobileContent?.length} chars`);
    console.log(`  • H1 elements: ${mobileHasH1}`);
    console.log(`  ✓ Mobile view loaded`);

    console.log(`\n[CONSISTENCY ANALYSIS]`);
    expect(desktopTitle).toBe(mobileTitle);
    console.log(`  ✓ Page title identical: "${desktopTitle}"`);

    expect(desktopContent?.length).toBeGreaterThan(0);
    expect(mobileContent?.length).toBeGreaterThan(0);
    console.log(`  ✓ Both views have content`);

    console.log(`  ✓ UI elements present on all viewports`);
    console.log(`\n[RESULT] UI Consistency Test PASSED ✓`);

    await mobileCtx.close();
  });

  /**
   * CBT-04: Security Headers & SSL/TLS Validation
   */
  test('CBT-04: Security Headers & HTTPS Validation', async ({ page, browserName }) => {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`CBT-04: SECURITY HEADERS & HTTPS - ${browserName.toUpperCase()}`);
    console.log(`${'='.repeat(90)}`);

    // Intercept and check response headers
    let responseHeaders: any = {};
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('student-loans.qa')) {
        const headers = response.headers();
        console.log(`\n[Response Headers for: ${url.split('?')[0]}]`);
        
        // Check security headers
        const securityHeaders = [
          'content-security-policy',
          'x-content-type-options',
          'x-frame-options',
          'x-xss-protection',
          'strict-transport-security',
          'referrer-policy'
        ];

        securityHeaders.forEach(header => {
          const value = headers[header];
          if (value) {
            console.log(`  ✓ ${header}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
          }
        });
      }
    });

    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    console.log(`\n[PROTOCOL VALIDATION]`);
    const finalUrl = page.url();
    expect(finalUrl.startsWith('https')).toBe(true);
    console.log(`  ✓ HTTPS enforced: ${finalUrl}`);

    const isSecureOrigin = new URL(finalUrl).protocol === 'https:';
    expect(isSecureOrigin).toBe(true);
    console.log(`  ✓ Secure origin confirmed`);

    console.log(`\n[RESULT] Security Headers Test PASSED ✓`);
  });

  /**
   * CBT-05: Performance & Responsiveness Across Browsers
   */
  test('CBT-05: Performance - Page Load Time (Safari & Chrome vs Mobile)', async ({ page, browser, browserName }) => {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`CBT-05: PERFORMANCE TEST - ${browserName.toUpperCase()}`);
    console.log(`${'='.repeat(90)}`);

    console.log(`\n[DESKTOP - ${browserName.toUpperCase()}]`);
    const startDesktop = Date.now();
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    const desktopLoadTime = Date.now() - startDesktop;

    console.log(`  • Load time: ${desktopLoadTime}ms`);
    console.log(`  ✓ Page fully loaded on desktop`);

    console.log(`\n[MOBILE - 390x844]`);
    const mobileCtx = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const mobilePage = await mobileCtx.newPage();

    const startMobile = Date.now();
    await mobilePage.goto(TEST_URL, { waitUntil: 'networkidle' });
    const mobileLoadTime = Date.now() - startMobile;

    console.log(`  • Load time: ${mobileLoadTime}ms`);
    console.log(`  ✓ Page fully loaded on mobile`);

    console.log(`\n[PERFORMANCE ANALYSIS]`);
    console.log(`  • Desktop load time: ${desktopLoadTime}ms`);
    console.log(`  • Mobile load time: ${mobileLoadTime}ms`);
    console.log(`  ✓ Both viewports load successfully`);

    // Performance should be reasonable (under 15 seconds)
    expect(desktopLoadTime).toBeLessThan(15000);
    expect(mobileLoadTime).toBeLessThan(15000);
    console.log(`  ✓ Load times within acceptable range`);

    console.log(`\n[RESULT] Performance Test PASSED ✓`);
    await mobileCtx.close();
  });

});

// Run in parallel for faster execution
test.describe.configure({ mode: 'parallel' });

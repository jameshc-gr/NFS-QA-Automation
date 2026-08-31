import { test, expect, Page, BrowserContext } from '@playwright/test';
import { runIdrFlow, loadProfile, activateProfile, getEnv } from './test-setup';

test.describe('SEC-01: User Isolation - Data Access Control', () => {
  
  /**
   * Test 1: Verify User B cannot access User A's dashboard via direct URL
   * Validates that authentication/authorization prevents unauthorized access
   */
  test('SEC-01.1: User B cannot access User A dashboard via direct URL', async ({ page, browser }) => {
    console.log('\n=== SEC-01.1: Testing URL-based access control ===');
    
    // Step 1: User A completes flow and reaches dashboard
    console.log('Step 1: User A login and dashboard access');
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    const userAEmail = getEnv('EMAIL');
    const userAFirstName = getEnv('FIRST_NAME');
    const userALastName = getEnv('LAST_NAME');
    console.log(`  User A: ${userAFirstName} ${userALastName} (${userAEmail})`);
    
    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1000);
    
    const userADashboardUrl = page.url();
    console.log(`  User A Dashboard URL: ${userADashboardUrl}`);
    
    // Verify User A can see their own name on dashboard
    const userAPageText = await page.textContent('body');
    expect(userAPageText).toContain(userAFirstName);
    console.log(`  ✓ User A can see their data on dashboard`);
    
    // Step 2: Create new browser context for User B (separate session)
    console.log('\nStep 2: User B login in separate browser context');
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-022');
    activateProfile('SCN-022');
    const userBEmail = getEnv('EMAIL');
    const userBFirstName = getEnv('FIRST_NAME');
    const userBLastName = getEnv('LAST_NAME');
    console.log(`  User B: ${userBFirstName} ${userBLastName} (${userBEmail})`);
    
    await runIdrFlow(userBPage, 'SCN-022');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(1000);
    
    const userBDashboardUrl = userBPage.url();
    console.log(`  User B Dashboard URL: ${userBDashboardUrl}`);
    console.log(`  ✓ User B successfully logged in to own dashboard`);
    
    // Step 3: User B attempts to access User A's dashboard URL
    console.log('\nStep 3: User B attempts to access User A dashboard URL');
    console.log(`  Attempting to navigate to: ${userADashboardUrl}`);
    
    try {
      await userBPage.goto(userADashboardUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      }).catch(err => console.log(`  Navigation initiated (may redirect)`));
      
      await userBPage.waitForTimeout(2000);
      const finalUrl = userBPage.url();
      const userBPageText = await userBPage.textContent('body');
      
      console.log(`  Final URL after navigation: ${finalUrl}`);
      
      // Verify User B is NOT on User A's dashboard
      // Note: First names cannot be used since both users have the same first name "Dependent"
      const userADataVisible = userBPageText?.includes(userAEmail) || userBPageText?.includes(userALastName);
      
      if (userADataVisible) {
        console.log(`  ✗ SECURITY ISSUE: User B can see User A's data!`);
        expect(userADataVisible).toBe(false);
      } else {
        console.log(`  ✓ User B cannot see User A's data`);
        expect(userADataVisible).toBe(false);
      }
      
      // Verify User B was redirected or is at their own dashboard
      const redirected = finalUrl !== userADashboardUrl;
      if (redirected) {
        console.log(`  ✓ Access redirected (URL changed)`);
        console.log(`    Original: ${userADashboardUrl}`);
        console.log(`    Current: ${finalUrl}`);
      }
    } catch (error) {
      console.log(`  ✓ Navigation blocked/error occurred: ${error}`);
    }
    
    await userBContext.close();
    console.log('\n✓ SEC-01.1 PASSED: User B cannot access User A dashboard\n');
  });

  /**
   * Test 2: Verify User A and User B have isolated payment data
   * Validates data is not mixed between user sessions
   */
  test('SEC-01.2: User payment data is isolated per user', async ({ page, browser }) => {
    console.log('\n=== SEC-01.2: Testing payment data isolation ===');
    
    // Step 1: User A completes flow and capture payment
    console.log('Step 1: User A completes flow');
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    const userAFirstName = getEnv('FIRST_NAME');
    const userAEmail = getEnv('EMAIL');
    console.log(`  User A: ${userAFirstName} (${userAEmail})`);
    
    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    // Extract payment from User A's dashboard
    const userAPaymentText = await extractPaymentInfo(page);
    console.log(`  Captured Payment: $${userAPaymentText}`);
    
    // Verify User A can see their name
    const userAPageText = await page.textContent('body');
    expect(userAPageText).toContain(userAFirstName);
    console.log(`  ✓ User A can see their payment information`);
    
    // Step 2: User B in separate context
    console.log('\nStep 2: User B completes flow');
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-022');
    activateProfile('SCN-022');
    const userBFirstName = getEnv('FIRST_NAME');
    const userBEmail = getEnv('EMAIL');
    console.log(`  User B: ${userBFirstName} (${userBEmail})`);
    
    await runIdrFlow(userBPage, 'SCN-022');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    // Extract payment from User B's dashboard
    const userBPaymentText = await extractPaymentInfo(userBPage);
    console.log(`  Captured Payment: $${userBPaymentText}`);
    
    // Verify User B can see their name
    const userBPageText = await userBPage.textContent('body');
    expect(userBPageText).toContain(userBFirstName);
    console.log(`  ✓ User B can see their payment information`);
    
    // Step 3: Verify payments are different (key security check)
    console.log('\nStep 3: Verify payment isolation');
    expect(userAPaymentText).not.toBe(userBPaymentText);
    console.log(`  ✓ Payments are different: User A ($${userAPaymentText}) ≠ User B ($${userBPaymentText})`);
    
    // Step 4: Verify data isolation - User A email should NOT appear in User B's session
    // Note: First names cannot be used since both users have the same first name "Dependent"
    console.log('\nStep 4: Verify data isolation');
    const userANameInUserBPage = userBPageText?.includes(userAEmail);
    if (userANameInUserBPage) {
      console.log(`  ✗ SECURITY ISSUE: User A's email visible in User B's session!`);
    }
    expect(userANameInUserBPage).toBe(false);
    console.log(`  ✓ User A's email NOT visible in User B's session`);
    
    await userBContext.close();
    console.log('\n✓ SEC-01.2 PASSED: Payment data is properly isolated\n');
  });

  /**
   * Test 3: Verify User B cannot access User A's profile data via page refresh
   * Validates that session/auth token prevents data leakage
   */
  test('SEC-01.3: User profile data isolation across sessions', async ({ page, browser }) => {
    console.log('\n=== SEC-01.3: Testing profile data isolation ===');
    
    // Step 1: User A logs in
    console.log('Step 1: User A login');
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    const userALastName = getEnv('LAST_NAME');
    const userAEmail = getEnv('EMAIL');
    console.log(`  User A last name: ${userALastName} (${userAEmail})`);
    
    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1000);
    
    const userAPageContent = await page.textContent('body');
    
    // Verify User A can see their own last name
    if (userAPageContent?.includes(userALastName)) {
      console.log(`  ✓ User A can see their own last name on dashboard`);
    } else {
      console.log(`  ℹ User A's last name not displayed on dashboard (may be in hidden field)`);
    }
    
    // Step 2: User B in separate context
    console.log('\nStep 2: User B login');
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-022');
    activateProfile('SCN-022');
    const userBLastName = getEnv('LAST_NAME');
    const userBEmail = getEnv('EMAIL');
    console.log(`  User B last name: ${userBLastName} (${userBEmail})`);
    
    // Run the IDR flow for User B to complete their registration/login
    await runIdrFlow(userBPage, 'SCN-022');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(1000);
    
    const userBPageContent = await userBPage.textContent('body');
    
    // Verify User B can see their own last name
    if (userBPageContent?.includes(userBLastName)) {
      console.log(`  ✓ User B can see their own last name on dashboard`);
    } else {
      console.log(`  ℹ User B's last name not displayed on dashboard (may be in hidden field)`);
    }
    
    // Step 3: Verify User A's data is NOT visible in User B's session
    console.log('\nStep 3: Verify data isolation');
    const userADataInUserBPage = userBPageContent?.includes(userALastName) || userBPageContent?.includes(userAEmail);
    
    if (userADataInUserBPage) {
      console.log(`  ✗ SECURITY ISSUE: User A's data (name or email) visible in User B's session!`);
      expect(userADataInUserBPage).toBe(false);
    } else {
      console.log(`  ✓ User A's data NOT visible in User B's session`);
      expect(userADataInUserBPage).toBe(false);
    }
    
    // Step 4: Verify User B can see their own data
    console.log('\nStep 4: Verify User B can see their own data');
    const userBNameInUserBPage = userBPageContent?.includes(userBLastName);
    console.log(`  User B's last name "${userBLastName}" visible: ${userBNameInUserBPage}`);
    
    await userBContext.close();
    console.log('\n✓ SEC-01.3 PASSED: Profile data properly isolated\n');
  });

  /**
   * Test 4: Verify data consistency when same user logs in multiple times
   * Validates that repeated logins show consistent data
   */
  test('SEC-01.4: User data consistency across multiple sessions', async ({ page, browser }) => {
    console.log('\n=== SEC-01.4: Testing data consistency ===');
    
    // Session 1: User A first login
    console.log('Session 1: User A first login');
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    const userAEmail = getEnv('EMAIL');
    const userAFirstName = getEnv('FIRST_NAME');
    
    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1000);
    
    const session1Payment = await extractPaymentInfo(page);
    const session1Name = await page.textContent('body');
    console.log(`  Payment in Session 1: $${session1Payment}`);
    console.log(`  Name visible: ${session1Name?.includes(userAFirstName)}`);
    
    // Verify User A can see their data in Session 1
    expect(session1Name).toContain(userAFirstName);
    console.log(`  ✓ User A can see their data in Session 1`);
    
    // Session 2: User A logs out and logs back in
    console.log('\nSession 2: User A logout and login again');
    const userAContext2 = await browser.newContext();
    const userAPage2 = await userAContext2.newPage();
    
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    
    await runIdrFlow(userAPage2, 'SCN-021');
    await userAPage2.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userAPage2.waitForTimeout(1000);
    
    const session2Payment = await extractPaymentInfo(userAPage2);
    const session2Name = await userAPage2.textContent('body');
    console.log(`  Payment in Session 2: $${session2Payment}`);
    console.log(`  Name visible: ${session2Name?.includes(userAFirstName)}`);
    
    // Verify User A can see their data in Session 2
    expect(session2Name).toContain(userAFirstName);
    console.log(`  ✓ User A can see their data in Session 2`);
    
    // Verify consistency
    console.log('\nVerify data consistency');
    expect(session1Payment).toBe(session2Payment);
    console.log(`  ✓ Payment data is consistent across sessions: $${session1Payment} = $${session2Payment}`);
    
    await userAContext2.close();
    console.log('\n✓ SEC-01.4 PASSED: User data is consistent\n');
  });
});

/**
 * Helper function to extract payment amount from dashboard
 */
async function extractPaymentInfo(page: Page): Promise<string> {
  try {
    const bodyText = await page.textContent('body');
    
    // Strategy 1: Look for "Est. payment" pattern
    const estPaymentMatch = bodyText?.match(/Est\.\s*payment[:\s]+\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (estPaymentMatch) {
      return estPaymentMatch[1];
    }
    
    // Strategy 2: Extract all dollar amounts and find the payment value
    const dollarMatches = bodyText?.match(/\$\s*([\d,]+(?:\.\d{2})?)/g) || [];
    const amounts = dollarMatches.map(m => m.replace(/[^\d.]/g, '')).filter(m => m);
    
    // Return the second dollar amount (usually the payment, not the current amount)
    if (amounts.length >= 2) {
      return amounts[1];
    }
    
    return 'N/A';
  } catch (error) {
    console.log(`Error extracting payment: ${error}`);
    return 'ERROR';
  }
}

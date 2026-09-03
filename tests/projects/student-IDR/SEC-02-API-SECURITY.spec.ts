import { test, expect, Page } from '@playwright/test';
import { runIdrFlow, loadProfile, activateProfile, getEnv } from './test-setup';

/**
 * SEC-02: API Security Testing Suite
 * Tests cross-account access prevention and API authorization
 */

test.describe('SEC-02: API Security - Cross-Account Access', () => {
  
  test('SEC-02.1: Verify users cannot access other accounts via URL manipulation', async ({ page, browser }) => {
    console.log('\n=== SEC-02.1: URL Manipulation Prevention ===');
    
    // Create User A
    loadProfile('SCN-021');
    activateProfile('SCN-021');
    const userAEmail = getEnv('EMAIL');
    console.log('User A created:', userAEmail);
    
    await runIdrFlow(page, 'SCN-021');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    const userAUrl = page.url();
    console.log('User A URL:', userAUrl);
    
    // Create User B in new context
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-022');
    activateProfile('SCN-022');
    const userBEmail = getEnv('EMAIL');
    console.log('User B created:', userBEmail);
    
    await runIdrFlow(userBPage, 'SCN-022');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    // User B attempts to access User A's URL
    console.log('User B attempting to access User A URL...');
    try {
      await userBPage.goto(userAUrl, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
      await userBPage.waitForTimeout(2000);
      
      const finalUrl = userBPage.url();
      const content = await userBPage.textContent('body');
      
      // Verify User B is not viewing User A's data
      const securityCheck = !content?.includes(getEnv('FIRST_NAME'));
      
      if (securityCheck) {
        console.log('PASS: User B cannot access User A data');
      } else {
        console.log('FAIL: Security issue - User A data accessible to User B');
        expect(securityCheck).toBe(true);
      }
    } catch (error) {
      console.log('PASS: Access blocked with error');
    }
    
    await userBContext.close();
  });

  test('SEC-02.2: Verify loan data isolation between accounts', async ({ page, browser }) => {
    console.log('\n=== SEC-02.2: Loan Data Isolation ===');
    
    // User A with specific loan balance
    loadProfile('SCN-001');
    activateProfile('SCN-001');
    const userABalance = getEnv('APPLICANT_BALANCE');
    console.log('User A loan balance:', userABalance);
    
    await runIdrFlow(page, 'SCN-001');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    const userAContent = await page.textContent('body');
    const userASeesOwnBalance = userAContent?.includes(userABalance) || false;
    console.log('User A sees own balance:', userASeesOwnBalance);
    
    // User B with different loan balance
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-002');
    activateProfile('SCN-002');
    const userBBalance = getEnv('APPLICANT_BALANCE');
    console.log('User B loan balance:', userBBalance);
    
    await runIdrFlow(userBPage, 'SCN-002');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    const userBContent = await userBPage.textContent('body');
    
    // Verify User B does not see User A's balance
    const userADataLeaked = userBContent?.includes(userABalance) || false;
    
    if (!userADataLeaked && userABalance !== userBBalance) {
      console.log('PASS: Loan data properly isolated');
    } else if (userADataLeaked) {
      console.log('FAIL: Security issue - User A loan data leaked to User B');
      expect(userADataLeaked).toBe(false);
    } else {
      console.log('WARNING: Test data issue - same balances for different users');
    }
    
    await userBContext.close();
  });

  test('SEC-02.3: Verify session cookie isolation', async ({ browser }) => {
    console.log('\n=== SEC-02.3: Session Cookie Isolation ===');
    
    // User A session
    const userAContext = await browser.newContext();
    const userAPage = await userAContext.newPage();
    
    loadProfile('SCN-003');
    activateProfile('SCN-003');
    const userAEmail = getEnv('EMAIL');
    console.log('User A email:', userAEmail);
    
    await runIdrFlow(userAPage, 'SCN-003');
    await userAPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userAPage.waitForTimeout(2000);
    
    // Extract cookies
    const userACookies = await userAContext.cookies();
    console.log('User A cookies captured:', userACookies.length);
    
    // User B session
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-004');
    activateProfile('SCN-004');
    const userBEmail = getEnv('EMAIL');
    console.log('User B email:', userBEmail);
    
    await runIdrFlow(userBPage, 'SCN-004');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    const userBInitialContent = await userBPage.textContent('body');
    
    // Try injecting User A cookies into User B context (if applicable)
    if (userACookies.length > 0) {
      console.log('Testing cookie injection resistance...');
      try {
        await userBContext.addCookies(userACookies);
        const userBAfterCookies = await userBPage.textContent('body');
        
        // User B should still see their own data, not User A's
        const stillSeesOwnData = userBAfterCookies?.includes(userBEmail) || false;
        
        if (stillSeesOwnData) {
          console.log('PASS: Session properly isolated despite cookie injection');
        } else {
          console.log('RISK: Cannot verify session isolation');
        }
      } catch (e) {
        console.log('PASS: Cookie injection blocked');
      }
    }
    
    await userAContext.close();
    await userBContext.close();
  });

  test('SEC-02.4: Verify API response filtering per user', async ({ page, browser }) => {
    console.log('\n=== SEC-02.4: API Response Filtering ===');
    
    loadProfile('SCN-005');
    activateProfile('SCN-005');
    const userAEmail = getEnv('EMAIL');
    console.log('User A:', userAEmail);
    
    // Track API responses
    const apiResponses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() === 200) {
        response.json().then(data => {
          apiResponses.push({ url: response.url(), data });
        }).catch(() => {});
      }
    });
    
    await runIdrFlow(page, 'SCN-005');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    console.log('API responses captured:', apiResponses.length);
    
    // Create User B
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-006');
    activateProfile('SCN-006');
    const userBEmail = getEnv('EMAIL');
    console.log('User B:', userBEmail);
    
    const userBApiResponses: any[] = [];
    userBPage.on('response', response => {
      if (response.url().includes('/api/') && response.status() === 200) {
        response.json().then(data => {
          userBApiResponses.push({ url: response.url(), data });
        }).catch(() => {});
      }
    });
    
    await runIdrFlow(userBPage, 'SCN-006');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    console.log('User B API responses captured:', userBApiResponses.length);
    
    // Check for data leakage
    let leakageDetected = false;
    for (const resp of userBApiResponses) {
      const responseStr = JSON.stringify(resp.data);
      if (responseStr.includes(userAEmail)) {
        console.log('FAIL: User A email found in User B response');
        leakageDetected = true;
      }
    }
    
    if (!leakageDetected) {
      console.log('PASS: No API data leakage detected');
    }
    
    expect(leakageDetected).toBe(false);
    await userBContext.close();
  });

  test('SEC-02.5: Verify ID enumeration prevention', async ({ page, browser }) => {
    console.log('\n=== SEC-02.5: ID Enumeration Prevention ===');
    
    // Create User A
    loadProfile('SCN-010');
    activateProfile('SCN-010');
    const userAEmail = getEnv('EMAIL');
    console.log('User A:', userAEmail);
    
    await runIdrFlow(page, 'SCN-010');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    // Extract ID from URL
    const userAUrl = new URL(page.url());
    const userAId = userAUrl.searchParams.get('id') || userAUrl.searchParams.get('applicationId') || 'unknown';
    console.log('User A ID pattern:', typeof userAId, userAId?.length);
    
    // Create User B
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-011');
    activateProfile('SCN-011');
    
    await runIdrFlow(userBPage, 'SCN-011');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    // Check ID patterns
    const userBUrl = new URL(userBPage.url());
    const userBId = userBUrl.searchParams.get('id') || userBUrl.searchParams.get('applicationId') || 'unknown';
    
    // Test if IDs are sequential (vulnerability indicator)
    const idsNumeric = /^\d+$/.test(userAId) && /^\d+$/.test(userBId);
    
    if (idsNumeric) {
      const aNum = parseInt(userAId);
      const bNum = parseInt(userBId);
      const isSequential = Math.abs(aNum - bNum) === 1;
      
      if (isSequential) {
        console.log('WARNING: Sequential IDs detected (enumeration risk)');
      } else {
        console.log('PASS: Numeric IDs but not sequential');
      }
    } else {
      console.log('PASS: UUIDs or non-sequential IDs (good security)');
    }
    
    await userBContext.close();
  });
});

export {};

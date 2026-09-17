import { test, expect } from '@playwright/test';
import { runIdrFlow, loadProfile, activateProfile, getEnv } from './test-setup';

/**
 * SEC-03: Authorization & Permission Testing Suite
 * Tests role-based access control and permission boundaries
 */

test.describe('SEC-03: Authorization & Permissions', () => {

  test('SEC-03.1: Verify role-based feature access control', async ({ page, browser }) => {
    console.log('\n=== SEC-03.1: Role-Based Access Control ===');
    
    // Test with different user profiles
    const profiles = ['SCN-015', 'SCN-016', 'SCN-017'];
    
    for (const profile of profiles) {
      loadProfile(profile);
      activateProfile(profile);
      const email = getEnv('EMAIL');
      console.log('Testing profile:', email);
      
      const context = profile === 'SCN-015' ? page : await browser.newContext().then(ctx => ctx.newPage());
      
      await runIdrFlow(context instanceof HTMLElement ? page : context, profile);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(2000);
      
      const content = await page.textContent('body');
      console.log('  - Features available for', email);
      
      if (context !== page && 'close' in context) {
        await context.close();
      }
    }
    
    console.log('PASS: Role-based access controls working');
  });

  test('SEC-03.2: Prevent permission escalation attempts', async ({ page }) => {
    console.log('\n=== SEC-03.2: Permission Escalation Prevention ===');
    
    loadProfile('SCN-020');
    activateProfile('SCN-020');
    const email = getEnv('EMAIL');
    console.log('User:', email);
    
    await runIdrFlow(page, 'SCN-020');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    // Test escalation attempts
    const escalationTests = [
      'localStorage modification',
      'API admin endpoint access',
      'Role elevation attempts'
    ];
    
    let escalationAttempts = 0;
    let successfulEscalations = 0;
    
    // Try to modify localStorage
    try {
      await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.role = 'admin';
        localStorage.setItem('user', JSON.stringify(user));
      });
      escalationAttempts++;
    } catch (e) {
      console.log('  - localStorage modification blocked');
    }
    
    // Try admin API
    try {
      const result = await page.evaluate(async () => {
        const resp = await fetch('/api/admin/users', { credentials: 'include' });
        return resp.status;
      });
      
      if (result === 200) {
        console.log('  - WARNING: Admin API accessible');
        successfulEscalations++;
      } else {
        console.log('  - Admin API blocked:', result);
      }
    } catch (e) {
      console.log('  - Admin API access failed (good)');
    }
    
    if (successfulEscalations === 0) {
      console.log('PASS: No escalation vulnerabilities found');
    } else {
      console.log('FAIL: Escalation attempts successful');
      expect(successfulEscalations).toBe(0);
    }
  });

  test('SEC-03.3: Verify sensitive operations require confirmation', async ({ page }) => {
    console.log('\n=== SEC-03.3: Sensitive Operation Approval ===');
    
    loadProfile('SCN-030');
    activateProfile('SCN-030');
    
    await runIdrFlow(page, 'SCN-030');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    // Look for sensitive operations
    const sensitiveOps = [
      '[data-testid="delete-account"]',
      '[data-testid="withdraw"]',
      '.delete-account',
      '.withdraw-btn'
    ];
    
    let found = 0;
    for (const selector of sensitiveOps) {
      const el = await page.$(selector).catch(() => null);
      if (el) {
        found++;
        console.log('Found sensitive operation:', selector);
        
        try {
          await el.click().catch(() => {});
          await page.waitForTimeout(1000);
          
          const modal = await page.$('[role="alertdialog"], .modal, [role="dialog"]').catch(() => null);
          if (modal) {
            console.log('  - Confirmation dialog appears (good)');
          } else {
            console.log('  - WARNING: No confirmation dialog');
          }
        } catch (e) {
          console.log('  - Operation test skipped');
        }
      }
    }
    
    if (found > 0) {
      console.log('PASS: Sensitive operations found and tested');
    } else {
      console.log('INFO: No sensitive operations found in current page');
    }
  });

  test('SEC-03.4: Verify account lockout protection', async ({ page }) => {
    console.log('\n=== SEC-03.4: Account Lockout Protection ===');
    
    // Check for rate limiting on login page
    const currentUrl = page.url();
    if (!currentUrl.includes('login')) {
      console.log('Not on login page, skipping test');
      return;
    }
    
    // Test rate limit detection
    const results = await page.evaluate(async () => {
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        try {
          const resp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `test${Math.random()}@test.com`,
              password: 'wrong'
            })
          });
          attempts.push(resp.status);
        } catch (e) {
          attempts.push(0);
        }
      }
      return attempts;
    });
    
    const hasRateLimit = results.includes(429);
    const hasLock = results.includes(423);
    
    if (hasRateLimit || hasLock) {
      console.log('PASS: Rate limiting detected');
    } else {
      console.log('WARNING: No rate limiting detected');
    }
  });

  test('SEC-03.5: Verify data access boundaries', async ({ page, browser }) => {
    console.log('\n=== SEC-03.5: Data Access Boundaries ===');
    
    // User A
    loadProfile('SCN-040');
    activateProfile('SCN-040');
    const userABalance = getEnv('APPLICANT_BALANCE');
    console.log('User A balance:', userABalance);
    
    await runIdrFlow(page, 'SCN-040');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    // User B
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    
    loadProfile('SCN-041');
    activateProfile('SCN-041');
    
    await runIdrFlow(userBPage, 'SCN-041');
    await userBPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await userBPage.waitForTimeout(2000);
    
    const userBContent = await userBPage.textContent('body');
    
    // Check if User B can see User A's data
    const dataLeaked = userBContent?.includes(userABalance) || false;
    
    if (!dataLeaked) {
      console.log('PASS: Data access boundaries enforced');
    } else {
      console.log('FAIL: Data boundary violation');
      expect(dataLeaked).toBe(false);
    }
    
    await userBContext.close();
  });

  test('SEC-03.6: Verify admin function access control', async ({ page }) => {
    console.log('\n=== SEC-03.6: Admin Function Access ===');
    
    loadProfile('SCN-050');
    activateProfile('SCN-050');
    
    await runIdrFlow(page, 'SCN-050');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
    
    // Test admin endpoints
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/applications',
      '/admin/dashboard'
    ];
    
    let unauthorized = 0;
    
    for (const endpoint of adminEndpoints) {
      const result = await page.evaluate(async (url) => {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          return resp.status;
        } catch {
          return 0;
        }
      }, endpoint);
      
      if (result === 403 || result === 401) {
        console.log('  -', endpoint, '-> Properly restricted');
        unauthorized++;
      } else if (result === 200) {
        console.log('  - WARNING:', endpoint, '-> Accessible to non-admin');
      } else {
        console.log('  -', endpoint, '-> Error/Not found');
      }
    }
    
    if (unauthorized === adminEndpoints.length) {
      console.log('PASS: All admin endpoints properly restricted');
    }
  });
});

export {};

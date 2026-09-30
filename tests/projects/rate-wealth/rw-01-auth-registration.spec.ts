import { test, expect } from '@playwright/test';
import { ACCOUNTS, BASE_URL, getPassword, login, removeCookieBanner, trackHttpErrors } from './rw-helpers';

test.describe('RW-AUTH: Okta SSO gateway and session @smoke @auth', () => {
  test.setTimeout(90_000);

  test('RW-AUTH-001 unauthenticated visit redirects to the Okta login with the expected controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/login\.dev\.rate\.com\/oauth2\/.+\/authorize/);
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="credentials.passcode"]')).toBeVisible();
    await expect(page.locator('input[type="submit"]')).toBeVisible();
    await expect(page.locator('input[name="rememberMe"]')).toBeAttached();
    await expect(page.locator('a:has-text("Forgot password?")')).toBeVisible();
    await expect(page.locator('a:has-text("Unlock account?")')).toBeVisible();
    await expect(page.locator('a:has-text("Register")')).toBeVisible();
  });

  for (const route of ['/home', '/financial-plans', '/plan-select', '/wealth', '/budget', '/settings']) {
    test(`RW-AUTH-002 deep link ${route} without a session redirects to login`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/login\.dev\.rate\.com/, { timeout: 30_000 });
    });
  }

  test('RW-AUTH-003 wrong password shows a generic credential error and keeps the user on login', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="identifier"]').waitFor({ state: 'visible' });
    await removeCookieBanner(page);
    await page.locator('input[name="identifier"]').fill(ACCOUNTS.complete);
    await page.locator('input[name="credentials.passcode"]').fill(`${getPassword()}-wrong`);
    await page.locator('input[type="submit"]').click();
    await expect(page.getByText(/email or password is incorrect/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/login\.dev\.rate\.com/);
  });

  test('RW-AUTH-004 unknown user gets the same message as a wrong password (no account enumeration)', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="identifier"]').waitFor({ state: 'visible' });
    await removeCookieBanner(page);
    await page.locator('input[name="identifier"]').fill('no-such-user-rwqa@yopmail.com');
    await page.locator('input[name="credentials.passcode"]').fill(getPassword());
    await page.locator('input[type="submit"]').click();
    await expect(page.getByText(/email or password is incorrect/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('RW-AUTH-005 valid login lands on the app and stores the JWT pair with a short access-token lifetime', async ({ page }) => {
    await login(page, ACCOUNTS.complete);
    await expect(page).toHaveURL(/\/home/);
    const tokens = await page.evaluate(() => ({
      access: localStorage.getItem('fitBUX-jwt'),
      refresh: localStorage.getItem('fitBUX-refresh-jwt'),
    }));
    expect(tokens.access, 'access token present').toBeTruthy();
    expect(tokens.refresh, 'refresh token present').toBeTruthy();
    const payload = (t: string) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
    const access = payload(tokens.access as string);
    const refresh = payload(tokens.refresh as string);
    expect(access.exp - access.iat, 'access token lifetime (s)').toBeLessThanOrEqual(1800);
    expect(refresh.exp).toBeGreaterThan(access.exp);
  });

  test('RW-AUTH-006 a hard reload keeps the session (no SSO loop) on protected routes', async ({ page }) => {
    await login(page, ACCOUNTS.complete);
    const hops: string[] = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame() && /login\.dev\.rate\.com/.test(f.url())) hops.push(f.url()); });
    for (const route of ['/financial-plans', '/wealth', '/budget', '/accounts']) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(new RegExp(route));
    }
    expect(hops.length, 'Okta round trips during 4 protected navigations').toBe(0);
  });

  test('RW-AUTH-007 expired access token is silently refreshed without an SSO loop (RW-BUG-05 not reproduced 2026-09-30)', async ({ page }) => {
    await login(page, ACCOUNTS.complete);
    const hops: string[] = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame() && /login\.dev\.rate\.com/.test(f.url())) hops.push(f.url()); });
    await page.evaluate(() => {
      const t = localStorage.getItem('fitBUX-jwt') as string;
      const [h, p, s] = t.split('.');
      const body = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      body.exp = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem('fitBUX-jwt', `${h}.${btoa(JSON.stringify(body)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.${s}`);
    });
    await page.goto(`${BASE_URL}/plan-select`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    expect(hops.length, 'Okta hops after token expiry').toBeLessThanOrEqual(1);
    await expect(page).not.toHaveURL(/login\.dev\.rate\.com/);
  });

  test('RW-AUTH-008 login page load triggers no 5xx from the app tracking endpoint (RW-BUG-07)', async ({ page }) => {
    test.fail(true, 'RW-BUG-07: GET /api/tracking/purchase/subscribe.php returns 500 after SSO callback');
    const seen: string[] = [];
    page.on('response', (r) => { if (r.status() >= 500 && r.url().includes('wealth.dev.fitbux.com')) seen.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await login(page, ACCOUNTS.complete);
    await page.waitForTimeout(3000);
    expect(seen).toEqual([]);
  });

  test('RW-AUTH-009 http errors are not raised on the home dashboard itself', async ({ page }) => {
    const errors = trackHttpErrors(page);
    await login(page, ACCOUNTS.complete);
    await page.waitForTimeout(3000);
    expect(errors().filter((e) => /\/home/.test(e))).toEqual([]);
  });
});

test.describe('RW-REG: public registration (myAccount) @smoke @registration', () => {
  test.setTimeout(60_000);
  const REG = 'https://my.dev.rate.com/registration';

  test('RW-REG-001 registration page renders the email-first step', async ({ page }) => {
    await page.goto(REG, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Welcome to myAccount/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(page.getByText(/Already have an account\?/i)).toBeVisible();
  });

  test('RW-REG-002 Continue stays disabled until an email is entered (no blank-submit validation message)', async ({ page }) => {
    await page.goto(REG, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  test('RW-REG-003 malformed email keeps Continue disabled', async ({ page }) => {
    await page.goto(REG, { waitUntil: 'domcontentloaded' });
    for (const bad of ['not-an-email', 'a@b', 'a b@c.com', '@yopmail.com']) {
      await page.locator('#email').fill(bad);
      await page.locator('#email').blur();
      await expect(page.getByRole('button', { name: 'Continue' }), `email ${bad}`).toBeDisabled();
    }
  });

  test('RW-REG-004 valid email advances to the name capture step with a magic-link action', async ({ page }) => {
    await page.goto(REG, { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(`rwqa.registration.${Date.now()}@yopmail.com`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#firstname')).toBeVisible();
    await expect(page.locator('#lastname')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Link/i })).toBeVisible();
  });

  test('RW-REG-005 existing user email is handled without leaking account existence on the first step', async ({ page }) => {
    await page.goto(REG, { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(ACCOUNTS.complete);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body, 'exposes whether the email is registered').not.toMatch(/already (registered|exists)|account exists/);
  });

  test('RW-REG-006 registration page copy has no spelling errors (translation notice)', async ({ page }) => {
    test.fail(true, 'RW-BUG-08: "discrepency" misspelled in the Spanish translation notice on my.dev.rate.com');
    await page.goto(REG, { waitUntil: 'domcontentloaded' });
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('discrepency');
  });
});

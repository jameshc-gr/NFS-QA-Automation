import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ACCOUNTS, gotoRoute, login, trackHttpErrors } from './rw-helpers';

const PLAID_IFRAME = 'iframe[name*="plaid" i], iframe[title*="plaid" i], iframe[src*="plaid" i]';
const PLAID_USER = 'user_good';
const PLAID_PASSWORD = 'pass_good';

test.describe('RW-ACCT: Plaid account linking @regression @accounts', () => {
  test.setTimeout(180_000);
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page, ACCOUNTS.planner);
  });

  test.afterAll(async () => { await context?.close(); });

  test('RW-ACCT-005 links the Platypus sandbox account through Plaid', async () => {
    test.fail(true, 'RW-BUG-13: Plaid Link is initialized with an empty link token on DEV');
    const httpErrors = trackHttpErrors(page);
    const accountRequests: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (/plaid|institution|connect|link/i.test(path)) accountRequests.push(`REQ ${request.method()} ${path}`);
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (/plaid|institution|connect|link/i.test(path) || response.status() >= 400) {
        accountRequests.push(`RES ${response.status()} ${path}`);
      }
    });
    await gotoRoute(page, '/accounts');
    const alreadyLinked = page.getByText(/Platypus/i).first();
    if (await alreadyLinked.isVisible().catch(() => false)) return;

    await page.getByRole('button', { name: /Connect Account/i }).click();
    await page.getByRole('button', { name: /Add Financial Institution/i }).click();
    const mine = page.getByRole('dialog').getByRole('button', { name: /Add New Link \(Mine\)/i });
    if (await mine.isVisible().catch(() => false)) await mine.click();
    const personPicker = page.getByRole('heading', { name: /Who do you want to link this account for\?/i }).first();
    if (await personPicker.isVisible().catch(() => false)) {
      await page.getByRole('dialog').getByRole('button').filter({ hasNotText: /Cancel/i }).first().click();
    }

    const plaidFrame = page.locator(PLAID_IFRAME).first();
    if (!(await plaidFrame.isVisible().catch(() => false))) {
      console.log('Plaid iframe source:', await plaidFrame.getAttribute('src'));
      console.log('HTTP errors during Plaid launch:', httpErrors());
      console.log('Account-link network paths:', accountRequests);
    }
    await expect(plaidFrame).toHaveAttribute('src', /[?&]token=[^&]+/);
    await expect(plaidFrame).toBeVisible({ timeout: 30_000 });
    const plaid = page.frameLocator(PLAID_IFRAME).first();

    const continueWithoutPhone = plaid.getByRole('button', { name: /Continue without phone number/i }).first();
    if (await continueWithoutPhone.isVisible().catch(() => false)) await continueWithoutPhone.click();

    const search = plaid.locator('input[placeholder*="Search" i], input[type="search"], input[name*="search" i]').first();
    await search.waitFor({ state: 'visible', timeout: 30_000 });
    await search.fill('Platypus');
    await plaid.getByRole('button', { name: /Platypus/i }).first().click();

    const username = plaid.locator('input[name*="user" i], input[name*="login" i], input[autocomplete*="username" i], input[type="text"]').first();
    const password = plaid.locator('input[type="password"]').first();
    await username.waitFor({ state: 'visible', timeout: 20_000 });
    await password.waitFor({ state: 'visible', timeout: 20_000 });
    await username.fill(PLAID_USER);
    await password.fill(PLAID_PASSWORD);
    await plaid.getByRole('button', { name: /Sign in|Continue|Submit|Connect/i }).first().click();

    for (let step = 0; step < 5; step++) {
      if (!(await plaidFrame.isVisible().catch(() => false))) break;
      const continueButton = plaid.getByRole('button', { name: /Continue|Connect|Done|Authorize|Finish|Submit/i }).first();
      if (await continueButton.isVisible().catch(() => false) && await continueButton.isEnabled().catch(() => false)) {
        await continueButton.click();
      } else {
        break;
      }
    }

    await expect(plaidFrame).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText(/Platypus/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
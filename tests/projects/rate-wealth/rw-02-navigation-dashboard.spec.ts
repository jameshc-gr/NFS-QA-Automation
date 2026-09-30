import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ACCOUNTS, BASE_URL, NAV_ROUTES, clickNav, expandNavGroup, gotoRoute, login, parseMoney, readWealthScore, removeCookieBanner, trackHttpErrors, visibleText } from './rw-helpers';

test.describe.configure({ mode: 'default' });

// Snapshot renders the four $k values after their labels: future earnings, assets, debts, net wealth.
function snapshotValues(text: string): { future: number; assets: number; debts: number; net: number } {
  const m = text.match(/Net Wealth\s+(-?\$[\d,]+)k\s+(-?\$[\d,]+)k\s+(-?\$[\d,]+)k\s+(-?\$[\d,]+)k/);
  const v = (i: number) => parseMoney(m?.[i] ?? 'NaN');
  return { future: v(1), assets: v(2), debts: v(3), net: v(4) };
}

test.describe('RW-NAV / RW-HOME / RW-SNAP / RW-PLANSUM: navigation and read-only dashboards @regression', () => {
  test.setTimeout(90_000);
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page, ACCOUNTS.complete);
  });
  test.afterAll(async () => { await context?.close(); });

  test('RW-NAV-001 sidebar exposes the top-level items and two collapsible groups', async () => {
    await gotoRoute(page, '/home');
    for (const label of ['Home', 'Plan Summary', 'Financial Plans', 'Transactions', 'Accounts']) {
      await expect(page.locator('button:visible').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).first(), label).toBeVisible();
    }
    await expect(page.locator('.euiAccordion__triggerWrapper', { hasText: 'My Money Details' })).toBeVisible();
    await expect(page.locator('.euiAccordion__triggerWrapper', { hasText: 'Tools & Products' })).toBeVisible();
  });

  test('RW-NAV-002 accordion groups toggle aria-expanded', async () => {
    await gotoRoute(page, '/home');
    const trigger = page.locator('.euiAccordion__triggerWrapper', { hasText: 'My Money Details' }).locator('button').first();
    await expandNavGroup(page, 'My Money Details');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  for (const [label, meta] of Object.entries(NAV_ROUTES)) {
    test(`RW-NAV-003 "${label}" navigates to ${meta.route}`, async () => {
      await gotoRoute(page, '/home');
      await clickNav(page, label as keyof typeof NAV_ROUTES);
      await expect(page).toHaveURL(new RegExp(`${meta.route}$`), { timeout: 15_000 });
    });
  }

  for (const legacy of ['/day-to-day-money', '/student-loans', '/my-money-details', '/risk-management', '/tools-products']) {
    test(`RW-NAV-004 unknown route ${legacy} silently redirects to /home (no 404 page)`, async () => {
      await page.goto(`${BASE_URL}${legacy}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/home$/);
    });
  }

  test('RW-NAV-005 header shows a numeric Wealth Score and the mail icon opens /coach', async () => {
    await gotoRoute(page, '/home');
    expect(await readWealthScore(page)).toMatch(/^\d+$/);
    await page.mouse.click(1343, 37);
    await expect(page).toHaveURL(/\/coach$/);
    await expect(page.getByRole('heading', { name: /Talk With a Financial Expert/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Schedule a Call/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Message an Expert/i })).toBeVisible();
  });

  test('RW-NAV-006 header icon buttons have accessible names (ACCESS-001)', async () => {
    test.fail(true, 'ACCESS-001: phone and mail header buttons expose no aria-label');
    await gotoRoute(page, '/home');
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('header button, [class*=euiHeader] button')]
        .filter((b) => (b as HTMLElement).offsetParent !== null)
        .filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    );
    expect(unnamed, 'unnamed visible header buttons').toBe(0);
  });

  test('RW-HOME-001 dashboard cards for a completed profile', async () => {
    await gotoRoute(page, '/home');
    for (const s of ['Plan Progress (Last 30 Days)', 'Action Items', 'Progress Towards Your Top Goal', 'Financial Snapshot']) await expect(page.locator('body'), s).toContainText(s, { timeout: 15_000 });
  });

  test('RW-HOME-002 Home "Financial Net Worth" equals assets minus debts', async () => {
    await gotoRoute(page, '/home');
    await expect(page.locator('body')).toContainText('Financial Net Worth', { timeout: 20_000 });
    const text = await visibleText(page);
    const assets = parseMoney(text.match(/Total Assets\s*(-?\$[\d,]+)/)?.[1] ?? '');
    const debts = parseMoney(text.match(/Total Debts\s*(-?\$[\d,]+)/)?.[1] ?? '');
    const net = parseMoney(text.match(/Financial Net Worth\s*(-?\$[\d,]+)/)?.[1] ?? '');
    expect(assets).toBeGreaterThan(0);
    expect(net).toBe(assets - Math.abs(debts));
  });

  test('RW-HOME-003 Home and Snapshot label the same concept consistently (CALC-001)', async () => {
    test.fail(true, 'CALC-001: Home shows "Financial Net Worth" ($36k = assets - debts) while Snapshot headline "Net Wealth" ($597k) includes future earnings; same word, different figure, no explanation on Home');
    await gotoRoute(page, '/home');
    await expect(page.locator('body')).toContainText('Financial Net Worth', { timeout: 20_000 });
    const home = parseMoney((await visibleText(page)).match(/Financial Net Worth\s*(-?\$[\d,]+)/)?.[1] ?? '');
    await gotoRoute(page, '/wealth');
    await expect(page.locator('body')).toContainText('Projected Total Net Wealth', { timeout: 20_000 });
    const snap = snapshotValues(await visibleText(page)).net * 1000;
    expect(snap).toBeLessThan(home * 2);
  });

  test('RW-SNAP-001 Financial Snapshot tabs render their content', async () => {
    await gotoRoute(page, '/wealth');
    const tabs = ['Summary', 'Assets', 'Debts', 'Work & Background'];
    for (const t of tabs) {
      await page.getByRole('tab', { name: t }).click();
      await expect(page.getByRole('tab', { name: t })).toHaveAttribute('aria-selected', 'true');
      await page.waitForTimeout(700);
    }
  });

  test('RW-SNAP-002 Total Net Wealth breakdown adds up (future earnings + assets + debts)', async () => {
    await gotoRoute(page, '/wealth');
    await expect(page.locator('body')).toContainText('Projected Total Net Wealth', { timeout: 20_000 });
    const { future, assets, debts, net } = snapshotValues(await visibleText(page));
    expect(Math.abs(future + assets - Math.abs(debts) - net), 'rounded $k components vs Net Wealth').toBeLessThanOrEqual(1);
  });

  test('RW-SNAP-003 Projected Total Net Wealth axis has unique tick labels (UX-004)', async () => {
    test.fail(true, 'UX-004: y-axis shows "$1M, $1M, $1M, $800k" - duplicate labels from coarse rounding');
    await gotoRoute(page, '/wealth');
    await page.waitForTimeout(2500);
    const ticks = (await page.locator('svg text').allInnerTexts()).map((t) => t.trim()).filter((t) => /^\$[\d.]+[kKM]?$/.test(t));
    expect(new Set(ticks).size, `ticks: ${ticks.join(',')}`).toBe(ticks.length);
  });

  test('RW-PLANSUM-001 Plan Summary offers the three periods and a progress table', async () => {
    await gotoRoute(page, '/plan-summary');
    await expect(page.getByRole('heading', { name: /Tracking your progress/i })).toBeVisible();
    for (const p of ['Last 30 Days', 'Last Month', 'Last 12 Months']) await expect(page.getByText(p, { exact: true }).first(), p).toBeVisible();
    await expect(page.getByText('Money for Future You')).toBeVisible();
  });

  test('RW-PLANSUM-002 percent-of-income never renders "Infinity%" when income is zero (CALC-002)', async () => {
    await gotoRoute(page, '/plan-summary');
    expect(await visibleText(page)).not.toMatch(/Infinity%|NaN%/);
  });

  test('RW-HOME-004 core dashboard routes load without 4xx/5xx API errors', async () => {
    const errors = trackHttpErrors(page);
    for (const r of ['/home', '/wealth', '/budget', '/risk', '/plan-summary', '/financial-plans', '/accounts', '/settings', '/coach']) await gotoRoute(page, r);
    expect(errors()).toEqual([]);
  });

  test('RW-HOME-005 session survives cookie banner removal and direct navigation (smoke)', async () => {
    await gotoRoute(page, '/home');
    await removeCookieBanner(page);
    await expect(page).toHaveURL(/\/home$/);
  });
});

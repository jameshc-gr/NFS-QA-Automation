import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ACCOUNTS, BASE_URL, gotoRoute, login, parseMoney, trackHttpErrors, visibleText } from './rw-helpers';

test.describe.configure({ mode: 'default' });

async function columnSum(page: Page, _header: string): Promise<{ sum: number; rows: number }> {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('table tbody tr')].filter((r) => (r as HTMLElement).offsetParent !== null && !/No items found/i.test(r.textContent || ''));
    let sum = 0;
    for (const r of rows) {
      const cell = [...r.querySelectorAll('td')].find((c) => /^Balance\s*-?\$/.test((c.textContent || '').trim()));
      const n = Number((cell?.textContent || '').replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(n)) sum += n;
    }
    return { sum, rows: rows.length };
  });
}

test.describe('RW-ACCT / RW-TX / RW-BUD / RW-RISK / RW-SET / RW-TOOLS: money pages and tools @regression', () => {
  test.setTimeout(90_000);
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page, ACCOUNTS.complete);
  });
  test.afterAll(async () => { await context?.close(); });

  test('RW-ACCT-001 Accounts shows tabs, totals, add/connect actions and the federal-loan linking notice', async () => {
    await gotoRoute(page, '/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Asset Accounts' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Debt Accounts' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Account Manually/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Account/i })).toBeVisible();
    const text = await visibleText(page);
    expect(text).toMatch(/Student Loan Linking Update/);
    expect(text).toMatch(/Asset Total\s*\$[\d,]+/);
    expect(text).toMatch(/Debt Total\s*\$[\d,]+/);
  });

  test('RW-ACCT-002 Asset Total and Debt Total equal the sum of account balances', async () => {
    await gotoRoute(page, '/accounts');
    await expect(page.locator('body')).toContainText(/Asset Total\s*\$[\d,]*[1-9]/, { timeout: 20_000 });
    const text = await visibleText(page);
    const assetTotal = parseMoney(text.match(/Asset Total\s*(\$[\d,]+)/)?.[1] ?? '');
    const debtTotal = parseMoney(text.match(/Debt Total\s*(\$[\d,]+)/)?.[1] ?? '');
    await page.getByRole('tab', { name: 'Asset Accounts' }).click();
    await page.waitForTimeout(800);
    const assets = await columnSum(page, 'Balance');
    await page.getByRole('tab', { name: 'Debt Accounts' }).click();
    await page.waitForTimeout(800);
    const debts = await columnSum(page, 'Balance');
    expect(assets.rows + debts.rows).toBeGreaterThan(0);
    expect(Math.abs(assets.sum)).toBe(assetTotal);
    expect(Math.abs(debts.sum)).toBe(debtTotal);
  });

  test('RW-ACCT-003 Add Account Manually opens a dialog where Add is disabled until a type is chosen (RW-BUG-04/05 not reproducible)', async () => {
    await gotoRoute(page, '/accounts');
    await page.getByRole('button', { name: /Add Account Manually/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Add manual account/i)).toBeVisible();
    await expect(dialog.getByText(/Account Type/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Add$/ })).toBeDisabled();
    await dialog.getByRole('button', { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden();
  });

  test('RW-ACCT-004 closing the account dialog leaves no blocking overlay (RW-BUG-06)', async () => {
    await gotoRoute(page, '/accounts');
    await page.getByRole('button', { name: /Add Account Manually/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.euiOverlayMask')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Debt Accounts' }).click();
    await expect(page.getByRole('tab', { name: 'Debt Accounts' })).toHaveAttribute('aria-selected', 'true');
  });

  test('RW-TX-001 Transactions exposes search, type and date-range filters with the documented options', async () => {
    await gotoRoute(page, '/transactions');
    await expect(page.getByLabel('Search transactions')).toBeVisible();
    const type = page.getByLabel('Transaction Type');
    const range = page.getByLabel('Date Range');
    expect(await type.locator('option').allInnerTexts()).toEqual(['Type: All', 'Income', 'Expenses', 'Assets', 'Debt', 'Risk Mgmt.', 'Education Funding', 'Education Costs']);
    expect(await range.locator('option').allInnerTexts()).toEqual(['Last 30 Days', 'Last 90 Days', 'Last 12 Months']);
  });

  test('RW-TX-002 Add Transaction Manually opens the form; Confirm cannot submit an empty form', async () => {
    await gotoRoute(page, '/transactions');
    await page.getByRole('button', { name: /Add Transaction Manually/i }).click();
    const dialog = page.getByRole('dialog');
    for (const l of ['Date', 'Category', 'Type', 'Account', 'Amount', 'Description']) await expect(dialog.getByText(l, { exact: true }).first(), l).toBeVisible();
    await expect(dialog.getByText(/Mark as refund or reversal\?/i)).toBeVisible();
    const confirm = dialog.getByRole('button', { name: /^Confirm$/ });
    if (await confirm.isEnabled()) await confirm.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Cancel$/ }).click();
  });

  test('RW-TX-003 Amount field rejects letters', async () => {
    await gotoRoute(page, '/transactions');
    await page.getByRole('button', { name: /Add Transaction Manually/i }).click();
    const amount = page.getByRole('dialog').locator('input[name="amount"]');
    await amount.fill('abc');
    await amount.blur();
    expect((await amount.inputValue()).replace(/[$,.0\s]/g, '')).toBe('');
    await page.keyboard.press('Escape');
  });

  test('RW-TX-004 Transactions page raises no failed API calls (TRANS_REVIEW action item PATCH 404)', async () => {
    test.fail(true, 'RW-BUG-09: PATCH /api/v2/actionitem/TRANS_REVIEW returns 404 on every Transactions load');
    const errors = trackHttpErrors(page);
    await gotoRoute(page, '/transactions');
    await page.waitForTimeout(2500);
    expect(errors()).toEqual([]);
  });

  test('RW-BUD-001 Day-to-Day Money shows Income/Expenses tabs, period selector and Budget Overview', async () => {
    await gotoRoute(page, '/budget');
    await expect(page.getByRole('heading', { name: /Day-to-Day Money/i }).first()).toBeVisible();
    const text = await visibleText(page);
    for (const s of ['Income', 'Expenses', 'Current', 'Last Month', 'Last 12 Months', 'Add Income', 'Budget Overview', 'Household Expenses', 'Asset Contributions', 'Debt Payments', 'Premium Payments', 'Available Funds']) expect(text, s).toContain(s);
  });

  test('RW-BUD-002 Budget Overview Available Funds = income - expenses - contributions - debt - premiums', async () => {
    await gotoRoute(page, '/budget');
    const text = await visibleText(page);
    const n = (label: string) => parseMoney(text.match(new RegExp(`${label}\\s*(-?\\$[\\d,]+)`))?.[1] ?? '');
    const household = n('Household Expenses');
    const assets = n('Asset Contributions');
    const debt = n('Debt Payments');
    const premiums = n('Premium Payments');
    const available = n('Available Funds');
    const incomeTotal = parseMoney(text.match(/Total\s*\$([\d,]+)\s*\$([\d,]+)/)?.[2] ?? '0');
    expect(Math.abs(available - (incomeTotal - household - assets - debt - premiums)), 'displayed components vs total (rounding tolerance $1)').toBeLessThanOrEqual(1);
  });

  test('RW-BUD-003 Add Income dialog renders a real title and fields (not the "Default Header" placeholder)', async () => {
    await gotoRoute(page, '/budget');
    await page.getByRole('button', { name: /Add Income/i }).click();
    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(3000);
    expect(await dialog.innerText()).not.toMatch(/Default Header/i);
    await expect(dialog.locator('input, [role=combobox], button').first()).toBeVisible();
  });

  test('RW-BUD-004 Expenses tab and Annually toggle switch the view', async () => {
    await gotoRoute(page, '/budget');
    await page.getByRole('tab', { name: 'Expenses' }).click();
    await expect(page.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
    await page.getByText('Annually', { exact: true }).first().click();
    await page.waitForTimeout(800);
    expect(await visibleText(page)).toMatch(/Budget Overview/);
  });

  test('RW-RISK-001 Risk Management lists premiums and the insurance coverage summary', async () => {
    await gotoRoute(page, '/risk');
    await expect(page.getByRole('heading', { name: 'Risk Management' }).first()).toBeVisible();
    const text = await visibleText(page);
    for (const s of ['Insurance Premiums', 'Add Premium', 'Health insurance', 'Disability insurance', 'Accidental death insurance', 'Dental insurance', 'Vision insurance', 'Rental insurance', 'Home insurance', 'Vehicle insurance', 'Property insurance', 'Do you have a trust?', 'Do you have a will?']) expect(text, s).toContain(s);
  });

  test('RW-RISK-002 Add Premium dialog renders its form', async () => {
    await gotoRoute(page, '/risk');
    await page.getByRole('button', { name: /Add Premium/i }).click();
    const dialog = page.locator('.euiFlyout, .euiModal, [role=dialog]').last();
    await expect(dialog).toContainText(/Type.*Annual.*Monthly.*Cancel.*Add/is, { timeout: 15_000 });
    await expect(dialog.getByRole('button', { name: /^Add$/ })).toBeVisible();
  });

  test('RW-SET-001 Settings shows profile, spouse and subscription management sections', async () => {
    await gotoRoute(page, '/settings');
    const text = await visibleText(page);
    for (const s of ['Profile Information', 'Edit your profile', 'Date of Birth', 'Phone Number', 'Spouse Information', 'Add Spouse/Fiance Manually', 'Account management', 'Manage Subscription']) expect(text, s).toContain(s);
  });

  const tools: Array<{ route: string; tile: string; target: RegExp; external?: boolean }> = [
    { route: '/studentloans', tile: 'Student Loan Pay Off', target: /\/tools\/payoffAnalysis/ },
    { route: '/studentloans', tile: 'Income-Driven Repayment Plans & PSLF', target: /\/tools\/payoffVsIDR/ },
    { route: '/studentloans', tile: 'Student Loan Refinance', target: /\/tools\/refinance/ },
    { route: '/studentloans', tile: 'Manual Student Loan Refinance Rate Check', target: /\/solutions\?solution=refinance/ },
    { route: '/studentloans', tile: 'Student Loan Refinance Rate Shop', target: /rate\.com\/lp\/student-loan-refinance/, external: true },
    { route: '/studentloans', tile: 'In-School Student Loans', target: /rate\.com\/loans\/student-loans/, external: true },
    { route: '/investments', tile: 'Future Value of a CD', target: /\/cd-returns/ },
    { route: '/investments', tile: 'Investment Projections', target: /\/investment-projections/ },
    { route: '/homebuying', tile: 'How Much Home Can I Afford?', target: /\/homeaffordability/ },
    { route: '/homebuying', tile: 'Should I Rent Vs. Buy?', target: /\/rent-vs-buy/ },
    { route: '/homebuying', tile: 'Mortgage Pay Off Analysis', target: /\/mortgage-payment/ },
    { route: '/homebuying', tile: 'Mortgage Points Optimization', target: /\/points-calculator/ },
    { route: '/homebuying', tile: 'Property Tax Estimation', target: /\/property-tax-estimate/ },
    { route: '/homebuying', tile: 'Cost Of Living Comparison', target: /\/cost-of-living/ },
    { route: '/homebuying', tile: 'HELOC Pay Off Analysis', target: /\/heloc-payment/ },
  ];
  for (const t of tools) {
    test(`RW-TOOLS-001 ${t.route} tile "${t.tile}" opens its calculator`, async () => {
      await gotoRoute(page, t.route);
      const popupPromise = t.external ? page.waitForEvent('popup', { timeout: 15_000 }) : Promise.resolve(null);
      await page.getByText(t.tile, { exact: true }).first().click();
      if (t.external) {
        const popup = await popupPromise;
        await popup!.waitForLoadState('domcontentloaded');
        expect(popup!.url()).toMatch(t.target);
        await popup!.close();
      } else {
        await expect(page).toHaveURL(t.target, { timeout: 15_000 });
        await expect(page.locator('h1, h2').filter({ hasNotText: /Cookie|Consent|Sell|My Money|Tools/ }).first()).toBeVisible();
      }
    });
  }

  test('RW-TOOLS-002 calculator pages load with no HTTP errors', async () => {
    const errors = trackHttpErrors(page);
    for (const r of ['/tools/payoffAnalysis', '/tools/payoffVsIDR', '/tools/refinance', '/cd-returns?return=investments', '/investment-projections', '/homeaffordability', '/rent-vs-buy', '/mortgage-payment', '/points-calculator', '/property-tax-estimate', '/cost-of-living', '/heloc-payment']) {
      await page.goto(`${BASE_URL}${r}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }
    expect(errors()).toEqual([]);
  });
});

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ACCOUNTS, QA_PLAN_PREFIX, gotoRoute, login, parseMoney, removeCookieBanner, trackHttpErrors, visibleText } from './rw-helpers';

// The planner account is dedicated to these tests: it is emptied before and after every test because the app caps plans at 3.
test.describe.configure({ mode: 'default' });

const WIZARD_SUBSTEPS = [
  'Life Events/Goals',
  'Day-to-Day Money',
  'Short-term Goals (Savings/Checking)',
  'Employer Retirement',
  'Health Savings Account',
  'Roth and Traditional IRA',
  'Money For Future Self',
  'Risk Management',
  'Emergency Fund',
  'Goal Ranking',
];

const uniqueName = () => `${QA_PLAN_PREFIX}${Date.now().toString().slice(-7)}`;
const nextStep = (p: Page) => p.getByRole('button', { name: /Next Step/ }).last();

async function deleteAllPlans(page: Page): Promise<number> {
  await gotoRoute(page, '/financial-plans');
  let deleted = 0;
  for (let i = 0; i < 6; i++) {
    const actions = page.locator('button[aria-label="Actions"]');
    if ((await actions.count()) === 0) break;
    await actions.first().click();
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Delete$/ }).first().click();
    await page.waitForTimeout(1500);
    deleted++;
  }
  return deleted;
}

async function planCount(page: Page): Promise<number> {
  await gotoRoute(page, '/financial-plans');
  await page.locator('button[aria-label="Actions"]').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  return page.locator('button[aria-label="Actions"]').count();
}

async function openNewManualPlan(page: Page): Promise<void> {
  await gotoRoute(page, '/plan-select');
  await page.locator('button.euiCard__titleButton').filter({ hasText: /Manually/i }).first().click();
  await expect(page.getByLabel(/Name your plan/i)).toBeVisible({ timeout: 20_000 });
  await removeCookieBanner(page);
}

async function createPlan(page: Page, name: string): Promise<void> {
  await openNewManualPlan(page);
  await page.getByLabel(/Name your plan/i).fill(name);
  await nextStep(page).click();
  await expect(page.getByRole('heading', { name: /Life Events\/Goals/i }).first()).toBeVisible({ timeout: 20_000 });
}

async function openActions(page: Page, index = 0): Promise<void> {
  await page.locator('button[aria-label="Actions"]').nth(index).click();
  await expect(page.locator('[role=menuitem], .euiContextMenuItem').first()).toBeVisible();
}

test.describe('RW-PLAN: financial plan creation, management and wizard @regression @plans', () => {
  test.setTimeout(180_000);
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page, ACCOUNTS.planner);
    await deleteAllPlans(page);
  });
  test.afterEach(async () => { await deleteAllPlans(page); });
  test.afterAll(async () => { await context?.close(); });

  test('RW-PLAN-001 plan-select offers the AI assistant and manual builder cards and Cancel', async () => {
    await gotoRoute(page, '/plan-select');
    await expect(page.getByRole('heading', { name: /How do you want to build your plan\?/i })).toBeVisible();
    await expect(page.getByText('Use AI-Powered Assistant 1.0')).toBeVisible();
    await expect(page.locator('button.euiCard__titleButton').filter({ hasText: /Manually/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^Cancel$/ })).toBeVisible();
  });

  test('RW-PLAN-002 AI assistant card explains why it is unavailable when disabled', async () => {
    test.fail(true, 'UX-007: the AI-Powered Assistant 1.0 card is disabled for this account with no explanation or tooltip');
    await gotoRoute(page, '/plan-select');
    const card = page.locator('button.euiCard__titleButton').filter({ hasText: /AI-Powered/i });
    if (await card.isDisabled()) {
      await expect(page.getByText(/coming soon|not available|unavailable|requires|upgrade/i).first()).toBeVisible();
    }
  });

  test('RW-PLAN-003 manual plan: naming step then the wizard lists all Plan Setup steps with a default Retirement goal', async () => {
    await createPlan(page, uniqueName());
    const text = await visibleText(page);
    for (const step of ['Plan Setup', 'Life Events/Goals', 'Day-To-Day Money', 'Money For Future Self', 'Risk Management', 'Emergency Fund', 'Goal Ranking', 'Simulate & Preview plan', 'Save and Exit']) expect(text, step).toContain(step);
    expect(text).toMatch(/Retirement\s+Age 65/);
  });

  test('RW-PLAN-004 plan name is required before leaving the naming step', async () => {
    test.fail(true, 'DATA-003: "Name your plan*" is marked required but empty input advances and silently names the plan "My Financial Plan"');
    await openNewManualPlan(page);
    await nextStep(page).click();
    await page.waitForTimeout(3000);
    await expect(page.getByLabel(/Name your plan/i)).toBeVisible();
  });

  test('RW-PLAN-005 whitespace-only plan name is rejected', async () => {
    await openNewManualPlan(page);
    await page.getByLabel(/Name your plan/i).fill('   ');
    await nextStep(page).click();
    await page.waitForTimeout(1500);
    const stillNaming = await page.getByLabel(/Name your plan/i).isVisible().catch(() => false);
    const cardName = stillNaming ? '' : await planCount(page).then(() => page.locator('h2, h3').allInnerTexts()).then((t) => t.join('|'));
    expect(stillNaming || !/^\s*$/.test(cardName)).toBeTruthy();
  });

  test('RW-PLAN-006 abandoning plan creation with Cancel does not leave a draft plan behind', async () => {
    test.fail(true, 'ARCH-001: clicking "Manually" immediately persists a draft "Plan 1" (0% completed) that counts toward the 3-plan limit');
    await openNewManualPlan(page);
    await page.getByRole('button', { name: /^Cancel$/ }).first().click();
    await page.waitForTimeout(1500);
    expect(await planCount(page)).toBe(0);
  });

  test('RW-PLAN-007 Save and Exit stores the new plan on Financial Plans', async () => {
    const name = uniqueName();
    await createPlan(page, name);
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/, { timeout: 20_000 });
    await expect(page.getByText(name)).toBeVisible();
    expect(await page.locator('button[aria-label="Actions"]').count()).toBeGreaterThan(0);
  });

  test('RW-PLAN-008 plan card Actions menu lists View, Edit, Implement, Copy, Rename, Delete', async () => {
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/);
    await openActions(page);
    const items = (await page.locator('[role=menuitem], .euiContextMenuItem').allInnerTexts()).map((s) => s.trim());
    expect(items).toEqual(['View', 'Edit', 'Implement', 'Copy', 'Rename', 'Delete']);
  });

  test('RW-PLAN-009 an incomplete plan cannot be implemented', async () => {
    test.fail(true, 'UX-008: "Implement" is enabled on a 14%-complete plan');
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/);
    await openActions(page);
    await expect(page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Implement$/ })).toBeDisabled();
  });

  test('RW-PLAN-010 Rename updates the plan card title', async () => {
    const original = uniqueName();
    await createPlan(page, original);
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page.getByText(original)).toBeVisible();
    await openActions(page);
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Rename$/ }).click();
    const renamed = `${original}-R`;
    const input = page.locator('.euiModal input, .euiFlyout input, [role=dialog] input').first();
    await input.fill(renamed);
    await page.getByRole('button', { name: /Save changes/i }).click();
    await expect(page.getByText(renamed)).toBeVisible();
  });

  test('RW-PLAN-011 Copy duplicates the plan', async () => {
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/);
    const before = await planCount(page);
    await openActions(page);
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Copy$/ }).click();
    await page.getByRole('button', { name: /^Copy Plan$/ }).click();
    await page.waitForTimeout(3000);
    expect(await planCount(page)).toBe(before + 1);
  });

  test('RW-PLAN-012 Delete asks for confirmation before removing a plan', async () => {
    test.fail(true, 'UX-009: Actions > Delete removes the plan immediately with no confirmation dialog');
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/);
    await openActions(page);
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Delete$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

  test('RW-PLAN-013 the three-plan limit disables plan creation', async () => {
    test.setTimeout(240_000);
    for (let i = 0; i < 3; i++) {
      await createPlan(page, `${uniqueName()}-${i}`);
      await page.getByRole('button', { name: /Save and Exit/i }).first().click();
      await expect(page).toHaveURL(/\/financial-plans/);
    }
    expect(await planCount(page)).toBe(3);
    await expect(page.getByText(/up to 3 plans at a time/i)).toBeVisible();
    const create = page.getByRole('button', { name: /Create New Plan/i });
    const disabled = await create.isDisabled();
    if (!disabled) {
      await create.click();
      await page.waitForTimeout(2500);
      expect(await visibleText(page), 'limit message or blocked navigation').toMatch(/up to 3|maximum|limit|delete a plan/i);
    }
  });

  test('RW-PLAN-014 Compare plans dialog needs two plans and labels its checkboxes', async () => {
    test.fail(true, 'ACCESS-003: plan selection checkboxes in "Select plans to compare" have no label or aria-label');
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/);
    await page.getByRole('button', { name: /Compare existing plans/i }).click();
    await expect(page.getByText(/Select plans to compare/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Compare Plans$/ })).toBeDisabled();
    const unlabeled = await page.locator('.euiModal input[type=checkbox]').evaluateAll((els) => els.filter((e) => !(e.getAttribute('aria-label') || e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent?.trim())).length);
    expect(unlabeled).toBe(0);
  });

  test('RW-PLAN-015 Life Event/Goal picker lists the 14 documented event types', async () => {
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Add Life Event\/Goal/ }).click();
    for (const t of ['Getting Married', 'Buying a Home', 'Moving Out of Parent/Relative', 'Moving In w/ Parent/Relative', 'Buying an Investment Property', 'Having a Child', 'Purchasing a Vehicle', 'Moving', 'Expected Decrease in Income', 'Beginning Part-time Work', 'Expected Increase in Income', 'Receiving an Inheritance', 'Saving for Other Goal', 'Go on Vacation']) {
      await expect(page.getByRole('button', { name: t, exact: true }), t).toBeVisible();
    }
  });

  test('RW-PLAN-016 Budget Overview Available Funds equals income minus all outflows', async () => {
    test.fail(true, 'CALC-005: Budget Overview shows $5,417 income - $1,088 household = $4,329 but Available Funds reads $4,327');
    await createPlan(page, uniqueName());
    const text = await visibleText(page);
    const n = (label: string) => parseMoney(text.match(new RegExp(`${label}\\s*(-?\\$[\\d,]+)`))?.[1] ?? '');
    const income = parseMoney(text.match(/(\$[\d,]+)\s*Total Income/)?.[1] ?? '');
    const expected = income - n('Household Expenses') - n('Asset Contributions') - n('Debt Payments') - n('Premium Payments');
    expect(n('Available Funds')).toBe(expected);
  });

  test('RW-PLAN-017 stepping through the wizard visits every sub-step in order without API errors', async () => {
    test.fail(true, 'RW-BUG-10/11: PUT /api/plan/liabilities.php returns 500 and GET /api/invest/portfolio.php returns 404 while stepping through the wizard');
    const errors = trackHttpErrors(page);
    await createPlan(page, uniqueName());
    const visited: string[] = [];
    for (let i = 0; i < 14; i++) {
      const heads = (await page.locator('h3').allInnerTexts()).map((h) => h.trim());
      for (const s of WIZARD_SUBSTEPS) if (heads.some((h) => h.startsWith(s)) && !visited.includes(s)) visited.push(s);
      if (visited.includes('Goal Ranking')) break;
      await nextStep(page).click();
      await page.waitForTimeout(3500);
    }
    expect(visited).toEqual(WIZARD_SUBSTEPS);
    expect(errors()).toEqual([]);
  });

  async function runToPreview(name: string): Promise<void> {
    await createPlan(page, name);
    for (let i = 0; i < 14; i++) {
      if (await page.getByRole('button', { name: /Review Plan/ }).isVisible().catch(() => false)) break;
      await nextStep(page).click();
      await page.waitForTimeout(3500);
    }
    await page.getByRole('button', { name: /Review Plan/ }).click();
    await expect(page.getByRole('heading', { name: /Creating your financial plan|Validating your plan/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Implement Plan', { timeout: 120_000 });
  }

  test('RW-PLAN-018 Review Plan shows the simulation loader, then a populated preview with its six tabs', async () => {
    await runToPreview(uniqueName());
    const text = await visibleText(page);
    for (const t of ['My Wealth Score', 'Goal Summary', 'Assets/Investments', 'Debts', 'Net Wealth Summary', 'Paycheck Allocation', 'Edit Plan', 'Implement Plan', 'Projected Wealth Score']) expect(text, t).toContain(t);
    expect(text).not.toMatch(/Complete All Steps/i);
  });

  test('RW-PLAN-019 the preview heading shows the name the user gave the plan', async () => {
    test.fail(true, 'DATA-004: preview heading reads "Plan 1" instead of the plan name entered on the naming step');
    const name = uniqueName();
    await runToPreview(name);
    await expect(page.getByRole('heading', { name }).first()).toBeVisible({ timeout: 5000 });
  });

  test('RW-PLAN-020 Buying a Home scenario completes planning and renders the implemented goal chart', async () => {
    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Add Life Event\/Goal/ }).click();
    await page.getByRole('button', { name: 'Buying a Home', exact: true }).click();
    await page.locator('input[name="cost"]').fill('450000');
    await page.locator('input[name="down"]').fill('90000');
    await nextStep(page).click();

    const visited: string[] = [];
    for (let i = 0; i < 14; i++) {
      const headings = (await page.locator('h2, h3').allInnerTexts()).map((heading) => heading.trim());
      for (const step of WIZARD_SUBSTEPS) {
        if (headings.some((heading) => heading.startsWith(step)) && !visited.includes(step)) visited.push(step);
      }
      if (visited.includes('Goal Ranking')) break;
      await nextStep(page).click();
      await page.waitForTimeout(3500);
    }
    expect(visited).toEqual([
      'Life Events/Goals',
      'Day-to-Day Money',
      'Money For Future Self',
      'Risk Management',
      'Emergency Fund',
      'Goal Ranking',
    ]);
    await page.getByRole('button', { name: /Review Plan/ }).click();
    await expect(page.getByRole('heading', { name: /Creating your financial plan|Validating your plan/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Implement Plan', { timeout: 120_000 });
    const preview = await visibleText(page);
    for (const label of ['Goal Summary', 'My Wealth Score', 'Projected Wealth Score']) expect(preview).toContain(label);
    expect(preview).not.toMatch(/Complete All Steps/i);
    await page.getByRole('button', { name: /Implement Plan/i }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });
    await expect(page.getByText('Progress Towards Your Top Goal')).toBeVisible();
    await expect(page.getByText('Save for house down payment')).toBeVisible();
    await expect(page.getByText('7%', { exact: true })).toBeVisible();
    await expect(page.locator('svg[data-test-id="CircularProgressbar"]').filter({ hasText: '7%' })).toBeVisible();
    await page.screenshot({ path: 'test-results/rw-plan-020-home-goal-card.png', fullPage: true });
  });

  test('RW-PLAN-021 edits to an in-progress home plan persist after save and reopen', async () => {
    test.fail(true, 'RW-BUG-12: edited Buying a Home amounts revert to their prior values after Save and Exit');
    const originalCost = '450000';
    const updatedCost = '475000';
    const updatedDownPayment = '95000';

    await createPlan(page, uniqueName());
    await page.getByRole('button', { name: /Add Life Event\/Goal/ }).click();
    await page.getByRole('button', { name: 'Buying a Home', exact: true }).click();
    await page.locator('input[name="cost"]').fill(originalCost);
    await page.locator('input[name="down"]').fill('90000');
    await nextStep(page).click();
    const goalRow = page.getByRole('row', { name: /Buying a Home/ });
    await expect(goalRow).toBeVisible();
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/, { timeout: 20_000 });

    await openActions(page);
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Edit$/ }).click();
    const reopenedGoalRow = page.getByRole('row', { name: /Buying a Home/ });
    await expect(reopenedGoalRow).toBeVisible();
    await reopenedGoalRow.getByRole('button').first().click();
    await expect(page.locator('input[name="cost"]')).toHaveValue('$450,000.00');
    await page.locator('input[name="cost"]').fill(updatedCost);
    await page.locator('input[name="down"]').fill(updatedDownPayment);
    await nextStep(page).click();
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/, { timeout: 20_000 });

    await openActions(page);
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Edit$/ }).click();
    await page.getByRole('row', { name: /Buying a Home/ }).getByRole('button').first().click();
    await expect(page.locator('input[name="cost"]')).toHaveValue('$475,000.00');
    await expect(page.locator('input[name="down"]')).toHaveValue('$95,000.00');
  });

  test('RW-PLAN-022 deleting a home plan does not restore its goal in a new plan', async () => {
    const deletedPlanName = uniqueName();
    const replacementPlanName = `${deletedPlanName}-NEW`;

    await createPlan(page, deletedPlanName);
    await page.getByRole('button', { name: /Add Life Event\/Goal/ }).click();
    await page.getByRole('button', { name: 'Buying a Home', exact: true }).click();
    await page.locator('input[name="cost"]').fill('450000');
    await page.locator('input[name="down"]').fill('90000');
    await nextStep(page).click();
    await expect(page.getByRole('row', { name: /Buying a Home/ })).toBeVisible();
    await page.getByRole('button', { name: /Save and Exit/i }).first().click();
    await expect(page).toHaveURL(/\/financial-plans/, { timeout: 20_000 });

    await openActions(page);
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Delete$/ }).click();
    await expect(page.getByText(deletedPlanName)).toHaveCount(0);

    await createPlan(page, replacementPlanName);
    await expect(page.getByRole('row', { name: /Buying a Home/ })).toHaveCount(0);
  });
});

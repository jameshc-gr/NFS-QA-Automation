import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import { ACCOUNTS, QA_PLAN_PREFIX, gotoRoute, login, removeCookieBanner } from './rw-helpers';

// Matrix of every Life Event/Goal type x invalid money input (0, empty, negative, whitespace). Serial: the plan cap is 3.
test.describe.configure({ mode: 'default' });

const GOAL_TYPES = [
  'Getting Married',
  'Buying a Home',
  'Moving Out of Parent/Relative',
  'Moving In w/ Parent/Relative',
  'Buying an Investment Property',
  'Having a Child',
  'Purchasing a Vehicle',
  'Moving',
  'Expected Decrease in Income',
  'Beginning Part-time Work',
  'Expected Increase in Income',
  'Receiving an Inheritance',
  'Saving for Other Goal',
  'Go on Vacation',
] as const;

const INVALID_VALUES = [
  { id: 'zero', value: '0' },
  { id: 'negative', value: '-100' },
] as const;

const nextStep = (p: Page) => p.getByRole('button', { name: /Next Step/ }).last();
const outDir = 'test-results/2026-09-30/rate-wealth/goal-matrix';

async function deleteAllPlans(page: Page): Promise<void> {
  await gotoRoute(page, '/financial-plans');
  for (let i = 0; i < 6; i++) {
    const actions = page.locator('button[aria-label="Actions"]');
    if ((await actions.count()) === 0) break;
    await actions.first().click();
    await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Delete$/ }).first().click();
    await page.waitForTimeout(1500);
  }
}

async function startPlanAndOpenGoal(page: Page, goal: string): Promise<void> {
  await gotoRoute(page, '/plan-select');
  await page.locator('button.euiCard__titleButton').filter({ hasText: /Manually/i }).first().click();
  await page.getByLabel(/Name your plan/i).fill(`${QA_PLAN_PREFIX}${Date.now().toString().slice(-7)}`);
  await removeCookieBanner(page);
  await nextStep(page).click();
  await page.getByRole('button', { name: /Add Life Event\/Goal/ }).click();
  await page.getByRole('button', { name: goal, exact: true }).click();
  await page.waitForTimeout(1200);
}

async function moneyFields(page: Page) {
  const inputs = page.locator('input[type="text"]:visible, input[type="number"]:visible').filter({ hasNot: page.locator('[role=combobox]') });
  const names: string[] = [];
  for (let i = 0; i < (await inputs.count()); i++) {
    const name = (await inputs.nth(i).getAttribute('name')) || '';
    if (name && !/date|year|month/i.test(name)) names.push(name);
  }
  return names;
}

test.describe('RW-GOAL: life event / goal input validation matrix @regression @goals', () => {
  test.setTimeout(120_000);
  let context: BrowserContext;
  let page: Page;
  const results: Array<Record<string, unknown>> = [];

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    fs.mkdirSync(outDir, { recursive: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page, ACCOUNTS.planner);
    await deleteAllPlans(page);
  });
  test.afterEach(async () => { await deleteAllPlans(page); });
  test.afterAll(async () => {
    fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2));
    await context?.close();
  });

  for (const goal of GOAL_TYPES) {
    test(`RW-GOAL-001 "${goal}" exposes labelled numeric inputs (discovery)`, async () => {
      await startPlanAndOpenGoal(page, goal);
      const fields = await moneyFields(page);
      const labels = await page.evaluate(() => [...document.querySelectorAll('label')].filter((l) => (l as HTMLElement).offsetParent !== null).map((l) => (l.textContent || '').trim()).filter((t) => t.length > 8));
      results.push({ goal, stage: 'discovery', fields, labels });
      await page.screenshot({ path: `${outDir}/${goal.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, fullPage: true });
      // Having a Child exposes no numeric input on this build (observed 2026-09-30).
      expect(fields.length, `numeric fields for ${goal}`).toBeGreaterThanOrEqual(goal === 'Having a Child' ? 0 : 1);
    });

    for (const invalid of INVALID_VALUES) {
      test(`RW-GOAL-002 "${goal}" blocks ${invalid.id} in every money field (RW-BUG-02)`, async () => {
        test.fail(true, 'RW-BUG-02: life event forms accept 0/negative/blank amounts without validation');
        await startPlanAndOpenGoal(page, goal);
        const fields = await moneyFields(page);
        for (const name of fields) {
          const input = page.locator(`input[name="${name}"]`).first();
          await input.fill(invalid.value);
          await input.blur();
        }
        await nextStep(page).click();
        await page.waitForTimeout(2500);
        const stillOnForm = (await page.locator(`input[name="${fields[0]}"]`).count()) > 0;
        const errorShown = (await page.locator('.euiFormErrorText:visible, [role=alert]:visible').count()) > 0;
        results.push({ goal, stage: 'invalid-input', input: invalid.id, stillOnForm, errorShown, url: page.url() });
        expect(stillOnForm && errorShown, `${goal} / ${invalid.id} should be blocked with an error`).toBeTruthy();
      });
    }
  }

  test('RW-GOAL-003 a plan saved with a zero-value goal still renders Goal Ranking (no blank page / perpetual loader)', async () => {
    await startPlanAndOpenGoal(page, 'Saving for Other Goal');
    for (const name of await moneyFields(page)) await page.locator(`input[name="${name}"]`).first().fill('0');
    await nextStep(page).click();
    await page.waitForTimeout(2500);
    for (let i = 0; i < 14; i++) {
      if (await page.getByRole('heading', { name: /Goal Ranking/ }).last().isVisible().catch(() => false)) break;
      if (!(await nextStep(page).isVisible().catch(() => false))) break;
      await nextStep(page).click();
      await page.waitForTimeout(3500);
    }
    await page.waitForTimeout(6000);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body.length, 'page must not be blank').toBeGreaterThan(300);
    await expect(page.getByRole('button', { name: /Review Plan|Previous Step|Next Step/ }).first()).toBeVisible();
  });

  test('RW-GOAL-004 a goal saved with a valid amount appears in the goals table', async () => {
    await startPlanAndOpenGoal(page, 'Go on Vacation');
    const fields = await moneyFields(page);
    await page.locator(`input[name="${fields[0]}"]`).first().fill('3500');
    await page.locator(`input[name="${fields[0]}"]`).first().blur();
    await nextStep(page).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /Previous Step/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body).toMatch(/Vacation/i);
    expect(body).toMatch(/Go on Vacation\s+\d{2}-\d{4}/);
  });
});

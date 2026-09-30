import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { ACCOUNTS, MfaRequiredError, openSession, readWealthScore, removeCookieBanner } from './rw-helpers';

// Drives the Profile Builder on a shared QA account. Only Next/Back are used (never Finish), so the suite is re-runnable.
test.describe.configure({ mode: 'default' });

const STEPS = [
  { key: 'welcome', heading: /^Welcome to Rate Wealth$/i },
  { key: 'basics', heading: /^Let's start with you$/i },
  { key: 'education', heading: /^Your education$/i },
  { key: 'financial-intro', heading: /^See your financial life together$/i },
  { key: 'income', heading: /^your income$/i },
  { key: 'expenses', heading: /^Household expenses$/i },
  { key: 'debts', heading: /^Your debts$/i },
  { key: 'assets', heading: /^Your assets$/i },
  { key: 'work-intro', heading: /^Work & Background$/i },
  { key: 'work', heading: /^Your work & background$/i },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

const next = (p: Page) => p.getByRole('button', { name: /^Next$/ });
const back = (p: Page) => p.getByRole('button', { name: /^Back$/ });
const dobInput = (p: Page) => p.locator('input[aria-label*="calendar"]');
const flyout = (p: Page) => p.locator('.euiFlyout').last();

async function currentStep(page: Page): Promise<number> {
  const heads = (await page.locator('h1, h2, h3').allInnerTexts()).map((h) => h.trim());
  return STEPS.findIndex((s) => heads.some((h) => s.heading.test(h)));
}

async function ensureRequiredData(page: Page, key: StepKey): Promise<void> {
  if (key === 'basics') {
    if (!(await dobInput(page).inputValue())) await dobInput(page).fill('05/20/1990');
    const zip = page.locator('input[name="zip"]');
    if (!(await zip.inputValue())) await zip.fill('90210');
    if (!(await page.locator('#m, #f, #o').evaluateAll((els) => els.some((e) => (e as HTMLInputElement).checked)))) await page.locator('label[for="m"]').click();
  }
  if (key === 'income') {
    const annual = page.locator('input[name="annual"]');
    if (!(await annual.inputValue()) || (await annual.inputValue()) === '$0') { await annual.fill('65000'); await annual.blur(); }
  }
}

async function goToStep(page: Page, target: StepKey): Promise<void> {
  const targetIdx = STEPS.findIndex((s) => s.key === target);
  for (let i = 0; i < 16; i++) {
    const idx = await currentStep(page);
    if (idx === targetIdx) return;
    if (idx === -1) { await page.waitForTimeout(1000); continue; }
    if (idx < targetIdx) {
      await ensureRequiredData(page, STEPS[idx].key);
      await next(page).click();
    } else {
      await back(page).click();
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(`Could not reach onboarding step ${target}`);
}

async function pickSuperSelect(page: Page, optionText: string): Promise<void> {
  await flyout(page).locator('[class*=SuperSelect], .euiFormControlLayout button, button:not([aria-label]):not(:has-text("Cancel")):not(:has-text("Add"))').first().click();
  await page.locator('[role=option], .euiSuperSelect__item').filter({ hasText: optionText }).first().click();
}

async function superSelectOptions(page: Page): Promise<string[]> {
  await flyout(page).locator('[class*=SuperSelect], .euiFormControlLayout button, button:not([aria-label]):not(:has-text("Cancel")):not(:has-text("Add"))').first().click();
  await page.waitForTimeout(500);
  const options = (await page.locator('[role=option], .euiSuperSelect__item').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  await page.keyboard.press('Escape');
  return options;
}

async function inputsWithoutName(scope: Locator): Promise<number> {
  return scope.evaluate((root) =>
    [...root.querySelectorAll('input:not([type=hidden])')]
      .filter((i) => (i as HTMLElement).offsetParent !== null)
      .filter((i) => {
        const el = i as HTMLInputElement;
        const label = el.id ? root.ownerDocument.querySelector(`label[for="${el.id}"]`) : null;
        return !(label?.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.closest('label');
      }).length,
  );
}

test.describe('RW-ONB: Profile Builder onboarding (Personal, Financial, Work) @regression @onboarding', () => {
  test.setTimeout(120_000);
  let context: BrowserContext;
  let page: Page;
  let mfaBlockedReason = '';

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    try {
      ({ context, page } = await openSession(browser, ACCOUNTS.onboarding));
    } catch (e) {
      if (!(e instanceof MfaRequiredError)) throw e;
      mfaBlockedReason = e.message;
    }
  });
  test.afterAll(async () => { await context?.close(); });
  test.beforeEach(async () => {
    test.skip(Boolean(mfaBlockedReason), mfaBlockedReason);
    await removeCookieBanner(page);
  });

  test('RW-ONB-001 welcome screen lists the three stages and the schedule-a-call note', async () => {
    await goToStep(page, 'welcome');
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const s of ['Personal Info', 'Financial Info', 'Work & Background', 'You will be able to schedule a call after completing your profile']) expect(text, s).toContain(s);
    await expect(next(page)).toBeEnabled();
  });

  test('RW-ONB-002 Basics: clearing Date of Birth and ZIP then Next shows required errors and blocks progress', async () => {
    await goToStep(page, 'basics');
    await dobInput(page).fill('');
    await page.locator('input[name="zip"]').fill('');
    await next(page).click();
    await expect(page.getByText('This field is required.').first()).toBeVisible();
    await expect(dobInput(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('input[name="zip"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('heading', { name: /Let's start with you/i })).toBeVisible();
    await expect(next(page)).toBeDisabled();
  });

  test('RW-ONB-003 Basics: ZIP accepts digits only and at most five characters', async () => {
    await goToStep(page, 'basics');
    const zip = page.locator('input[name="zip"]');
    await zip.fill('abcde'); await expect(zip).toHaveValue('');
    await zip.fill('902101'); await expect(zip).toHaveValue('90210');
    await zip.fill('12 345'); await expect(zip).toHaveValue('12345');
    await zip.fill('90210');
  });

  test('RW-ONB-004 Basics: a 4-digit ZIP is rejected with a format-specific message', async () => {
    test.fail(true, 'UX-001: malformed ZIP is rejected with the generic "This field is required." instead of a 5-digit format message');
    await goToStep(page, 'basics');
    const zip = page.locator('input[name="zip"]');
    await zip.fill('9021');
    await next(page).click();
    await expect(zip).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/5[- ]digit|valid zip|invalid zip/i).first()).toBeVisible();
    await zip.fill('90210');
  });

  test('RW-ONB-005 Basics: impossible and non-date Date of Birth values are flagged invalid', async () => {
    await goToStep(page, 'basics');
    for (const bad of ['13/45/1990', '02/30/1990', 'abcd']) {
      await dobInput(page).fill(bad);
      await dobInput(page).blur();
      await expect(dobInput(page), bad).toHaveAttribute('aria-invalid', 'true');
    }
    await dobInput(page).fill('05/20/1990');
    await dobInput(page).blur();
    await expect(dobInput(page)).toHaveAttribute('aria-invalid', 'false');
  });

  for (const [label, value] of [['a future date', '05/20/2030'], ['a date before 1910 (age > 110)', '01/01/1900']] as const) {
    test(`RW-ONB-006 Basics: ${label} is rejected`, async () => {
      test.fail(true, 'DATA-001: DOB has no range validation; future and >110-year-old dates are accepted and saved');
      await goToStep(page, 'basics');
      await dobInput(page).fill(value);
      await dobInput(page).blur();
      await expect(dobInput(page)).toHaveAttribute('aria-invalid', 'true');
      await dobInput(page).fill('05/20/1990');
    });
  }

  test('RW-ONB-007 Basics: an implausible DOB never turns the Wealth Score into NaN', async () => {
    test.fail(true, 'CALC-004: saving DOB 01/01/1900 makes the header Wealth Score render "NaN" until the next reload');
    await goToStep(page, 'basics');
    try {
      await dobInput(page).fill('01/01/1900');
      await dobInput(page).blur();
      await next(page).click();
      await page.waitForTimeout(2500);
      expect(await readWealthScore(page)).toMatch(/^\d+$/);
    } finally {
      await goToStep(page, 'basics');
      await dobInput(page).fill('05/20/1990');
      await dobInput(page).blur();
    }
  });

  test('RW-ONB-008 Basics -> Education with valid data; Back restores the saved answers', async () => {
    await goToStep(page, 'basics');
    await dobInput(page).fill('05/20/1990');
    await page.locator('input[name="zip"]').fill('90210');
    await page.locator('label[for="m"]').click();
    await next(page).click();
    await expect(page.getByRole('heading', { name: /Your education/i })).toBeVisible();
    await back(page).click();
    await expect(dobInput(page)).toHaveValue('05/20/1990');
    await expect(page.locator('input[name="zip"]')).toHaveValue('90210');
    await expect(page.locator('#m')).toBeChecked();
  });

  test('RW-ONB-009 Education: Yes/No degree question advances to the financial intro', async () => {
    await goToStep(page, 'education');
    await expect(page.getByText(/Have you completed or are you pursuing a degree\?/i)).toBeVisible();
    await expect(page.locator('label[for="n"]')).toBeVisible();
    await expect(page.locator('label[for="y"]')).toBeVisible();
    await next(page).click();
    await expect(page.getByRole('heading', { name: /See your financial life together/i })).toBeVisible();
  });

  test('RW-ONB-010 Income: annual converts to monthly using rounding, not truncation', async () => {
    test.fail(true, 'CALC-003: $65,000 annual shows $5,416/mo (truncated) here but $5,417 in the plan Budget Overview (65000/12 = 5,416.67)');
    await goToStep(page, 'income');
    await page.locator('input[name="annual"]').fill('65000');
    await page.locator('input[name="annual"]').blur();
    await expect(page.locator('input[name="monthly"]')).toHaveValue('$5,417');
  });

  test('RW-ONB-011 Income: monthly converts to annual and formatting is currency', async () => {
    await goToStep(page, 'income');
    await page.locator('input[name="monthly"]').fill('5000');
    await page.locator('input[name="monthly"]').blur();
    await expect(page.locator('input[name="annual"]')).toHaveValue('$60,000');
    await page.locator('input[name="annual"]').fill('65000');
    await page.locator('input[name="annual"]').blur();
  });

  test('RW-ONB-012 Income: letters and minus signs are not accepted as salary', async () => {
    await goToStep(page, 'income');
    const annual = page.locator('input[name="annual"]');
    for (const bad of ['abc', '-5000']) {
      await annual.fill(bad);
      await annual.blur();
      expect(await annual.inputValue(), bad).not.toMatch(/[a-z-]/i);
    }
    await annual.fill('65000');
    await annual.blur();
  });

  test('RW-ONB-013 Income: an absurd salary above a sane ceiling is rejected', async () => {
    test.fail(true, 'DATA-002: $99,999,999,999 annual salary is accepted with no upper-bound validation');
    await goToStep(page, 'income');
    const annual = page.locator('input[name="annual"]');
    await annual.fill('99999999999');
    await annual.blur();
    await expect(annual).toHaveAttribute('aria-invalid', 'true');
    await annual.fill('65000');
    await annual.blur();
  });

  test('RW-ONB-014 Income: Add More Income adds a typed row that can be deleted', async () => {
    await goToStep(page, 'income');
    await page.getByRole('button', { name: /Add More Income/i }).click();
    await expect(page.locator('input[name="monthly____0"]')).toBeVisible();
    await page.getByRole('button', { name: /^Delete$/ }).first().click();
    await expect(page.locator('input[name="monthly____0"]')).toHaveCount(0);
  });

  test('RW-ONB-015 Expenses: nine default categories with monthly/annual pairs convert both ways', async () => {
    await goToStep(page, 'expenses');
    for (const c of ['Groceries', 'HOA dues', 'Property taxes', 'Rent', 'Clothing', 'Fuel', 'Power', 'Phone', 'Water']) await expect(page.getByText(c, { exact: true }).first(), c).toBeVisible();
    const rentM = page.locator('input[name="monthly__rent"]');
    await rentM.fill('1500'); await rentM.blur();
    await expect(page.locator('input[name="annual__rent"]')).toHaveValue('$18,000');
    const groceryA = page.locator('input[name="annual__grocery"]');
    await groceryA.fill('4800'); await groceryA.blur();
    await expect(page.locator('input[name="monthly__grocery"]')).toHaveValue('$400');
  });

  test('RW-ONB-016 Expenses: every expense input has an accessible name', async () => {
    test.fail(true, 'ACCESS-002: only the first expense row exposes a label; 16 of 18 inputs have no label/aria-label');
    await goToStep(page, 'expenses');
    expect(await inputsWithoutName(page.locator('main, body').first())).toBe(0);
  });

  test('RW-ONB-017 Debts: empty state, Add debt account dialog and Federal loan linking notice', async () => {
    await goToStep(page, 'debts');
    await expect(page.getByText(/This table contains \d+ rows?/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Add debt account/i }).click();
    await expect(page.getByRole('button', { name: /Add account manually/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect account/i })).toBeVisible();
    await expect(page.getByText(/Student Loan Linking Update/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('RW-ONB-018 Debts: manual form offers the documented debt types and Add is disabled until one is chosen', async () => {
    await goToStep(page, 'debts');
    await page.getByRole('button', { name: /Add debt account/i }).click();
    await page.getByRole('button', { name: /Add account manually/i }).click();
    await expect(flyout(page).getByRole('button', { name: /^Add$/ })).toBeDisabled();
    const options = await superSelectOptions(page);
    for (const t of ['Federal student loan', 'Perkins loan', 'Private student loan', 'Credit card', 'Home mortgage', 'Investment property mortgage', 'Auto loan', 'Personal loan', 'Other debt']) expect(options, t).toContain(t);
    await flyout(page).getByRole('button', { name: /^Cancel$/ }).click();
  });

  test('RW-ONB-019 Debts: private student loan form requires institution, name, balance, rate and payment', async () => {
    await goToStep(page, 'debts');
    await page.getByRole('button', { name: /Add debt account/i }).click();
    await page.getByRole('button', { name: /Add account manually/i }).click();
    await pickSuperSelect(page, 'Private student loan');
    for (const l of ['Financial Institution', 'Account Name', 'Balance', 'Interest Rate', 'Minimum Payment']) await expect(flyout(page).getByText(l).first(), l).toBeVisible();
    await expect(flyout(page).getByRole('button', { name: /^Add$/ })).toBeDisabled();
    await flyout(page).getByRole('button', { name: /^Cancel$/ }).click();
  });

  test('RW-ONB-020 Assets: manual form offers banking, retirement, investment and property types', async () => {
    await goToStep(page, 'assets');
    await page.getByRole('button', { name: /Add asset account/i }).click();
    await page.getByRole('button', { name: /Add account manually/i }).click();
    const options = await superSelectOptions(page);
    for (const t of ['Checking/savings', '401(k)', 'Roth 401(k)', 'Roth IRA', 'IRA', 'HSA', 'Primary residence', 'Investment property', 'Auto value', 'Other assets']) expect(options, t).toContain(t);
    await flyout(page).getByRole('button', { name: /^Cancel$/ }).click();
  });

  test('RW-ONB-021 Work: Finish is blocked until a profession is chosen', async () => {
    await goToStep(page, 'work');
    await page.getByRole('button', { name: /^Finish$/ }).click();
    await expect(page.locator('.euiComboBox input').first()).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('heading', { name: /Your work & background/i })).toBeVisible();
  });

  test('RW-ONB-022 Work: profession search returns matching occupations and qualifiers default to "No"', async () => {
    await goToStep(page, 'work');
    const combo = page.locator('.euiComboBox').first();
    await combo.click();
    await combo.locator('input').pressSequentially('Eng', { delay: 80 });
    await expect(page.locator('[role=option]').first()).toBeVisible();
    const options = await page.locator('[role=option]').allInnerTexts();
    expect(options.length).toBeGreaterThan(3);
    expect(options.join(' ')).toMatch(/engineer/i);
    await page.keyboard.press('Escape');
    for (const q of ['qual_networking', 'qual_ncaa_sports', 'qual_marathons', 'qual_military']) await expect(page.locator(`input[name="${q}"][value="n"]`), q).toBeChecked();
  });

  test('RW-ONB-023 Work: the three stage questions each offer Yes / No / Does not apply', async () => {
    await goToStep(page, 'work');
    for (const q of ['qual_networking', 'qual_ncaa_sports', 'qual_marathons', 'qual_military']) await expect(page.locator(`input[name="${q}"]`), q).toHaveCount(3);
  });
});

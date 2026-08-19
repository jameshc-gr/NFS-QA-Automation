import { Page, expect, test, type TestInfo, type Locator } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROFILE_KEYS = [
  'SCENARIO_ID', 'PERSONA', 'FIRST_NAME', 'LAST_NAME', 'EMAIL', 'PASSWORD', 'TERMS_AGREEMENT',
  'MARITAL_STATUS', 'FILING_STATUS', 'APPLICANT_AGI', 'APPLICANT_DEPENDENTS',
  'APPLICANT_DEPENDENT_CHILD_AGES', 'APPLICANT_SAVINGS', 'STATE_OF_RESIDENCE',
  'SPOUSE_FIRST_NAME', 'SPOUSE_LAST_NAME', 'SPOUSE_AGI', 'SPOUSE_SAVINGS', 'JOINT_SAVINGS',
  'APPLICANT_LOAN_ENTRY_MODE', 'APPLICANT_BALANCE', 'APPLICANT_RATE', 'APPLICANT_PRINCIPAL',
  'APPLICANT_ACCRUED_INTEREST', 'APPLICANT_PLAN', 'APPLICANT_START', 'APPLICANT_FORBEARANCE',
  'APPLICANT_PSLF', 'SPOUSE_HAS_LOANS', 'SPOUSE_BALANCE', 'SPOUSE_RATE', 'SPOUSE_PLAN',
  'ASSET_ACCOUNT_NAME', 'ASSET_ACCOUNT_TYPE', 'ASSET_FINANCIAL_INSTITUTION',
  'ASSET_CURRENT_BALANCE', 'ASSET_OWNER', 'INCLUDE_IN_TAX_BOMB_CALC',
  'APPLICANT_LOANS',
  'PLAID_BANK', 'PLAID_USER', 'PLAID_PASSWORD', 'EXPECTED_USE'
];

function parseYamlScalar(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadProfileYaml(filePath: string) {
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);
    if (key) process.env[key] = parseYamlScalar(rawValue);
  }
}

const profileYamlPath = path.resolve(process.cwd(), 'test-data/student-IDR/student-IDR.yaml');
const profileYmlPath = path.resolve(process.cwd(), 'test-data/student-IDR/student-IDR.yml');
loadProfileYaml(existsSync(profileYamlPath) ? profileYamlPath : profileYmlPath);

const BASE_ENV = Object.fromEntries(
  PROFILE_KEYS.map((key) => [key, process.env[key]])
) as Record<string, string | undefined>;

// Profile values are cached per profile so parallel workers do not overwrite
// each other's process.env state. The active profile is activated at test runtime.
const PROFILE_CACHE: Record<string, Record<string, string | undefined>> = {};
let activeProfileValues: Record<string, string | undefined> = { ...BASE_ENV };

function resolveProfileValue(key: string, profile: string): string | undefined {
  const profileValue = process.env[`${key}_${profile}`];
  if (profileValue !== undefined && profileValue !== null && profileValue !== '') {
    return profileValue;
  }
  return BASE_ENV[key];
}

export function loadProfile(profile: string) {
  if (!profile) return;
  const values: Record<string, string | undefined> = {};
  for (const key of PROFILE_KEYS) {
    values[key] = resolveProfileValue(key, profile);
  }
  PROFILE_CACHE[profile] = values;
  activeProfileValues = values;
}

export function activateProfile(profile: string) {
  if (!profile) return;
  if (!PROFILE_CACHE[profile]) {
    loadProfile(profile);
  }
  activeProfileValues = PROFILE_CACHE[profile];
}

export function resetProfile() {
  activeProfileValues = { ...BASE_ENV };
}

export function getEnv(key: string) {
  const value = activeProfileValues[key];
  if (value === undefined || value === null) return '';
  return value.trim();
}

export function setEnvValue(key: string, value: string) {
  activeProfileValues[key] = value;
}

function resolveTestUrl(profile?: string) {
  const environmentName = process.env.TEST_ENV?.trim().toUpperCase();
  if (environmentName) {
    const envUrl = process.env[`TEST_URL_${environmentName}`]?.trim();
    if (envUrl) return envUrl;
  }
  const sharedUrl = process.env.TEST_URL?.trim();
  if (sharedUrl) return sharedUrl;
  return process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome';
}

async function getFirstVisibleLocator(candidates: Locator[], timeoutMs = 5000) {
  for (const candidate of candidates) {
    const visible = await candidate.first().isVisible().catch(() => false);
    if (visible) return candidate.first();
    await candidate.first().waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null);
    if (await candidate.first().isVisible().catch(() => false)) return candidate.first();
  }
  return candidates[0].first();
}

export async function clickWhenEnabled(locator: Locator, timeoutMs = 10000) {
  // Wait for visibility first, then poll until the element is enabled.
  await locator.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null);
  const start = Date.now();
  const pollInterval = 100;
  while (Date.now() - start < timeoutMs) {
    const enabled = await locator.evaluate((el) => {
      const btn = el as HTMLButtonElement;
      return !btn.disabled;
    }).catch(() => false);
    if (enabled) {
      // Click with remaining timeout budget.
      const remaining = Math.max(1000, timeoutMs - (Date.now() - start));
      await locator.click({ timeout: remaining }).catch((err) => { throw err; });
      return;
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // On timeout, attempt to save a small screenshot for debugging then throw.
  try {
    const outDir = path.resolve(process.cwd(), 'test-results');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const filename = `click-when-enabled-failure-${randomBytes(4).toString('hex')}.png`;
    const outPath = path.join(outDir, filename);
    await locator.screenshot({ path: outPath }).catch(() => null);
  } catch (e) {
    // ignore screenshot errors
  }

  throw new Error('Timeout waiting for locator to become enabled before click');
}

export async function recoverAssetsPageIfRefreshFails(page: Page) {
  const assetsUrl = resolveTestUrl().replace(/\/forgiveness\/welcome.*$/i, '/forgiveness/assets');

  const isAssetsReady = async () => {
    const enterManually = page.getByRole('button', { name: /Enter manually/i }).first();
    const linkAccount = page.getByRole('button', { name: /Link Account/i }).first();
    const assetsHeading = page.getByRole('heading', { name: /Assets/i }).first();
    const manualFormInput = page.locator('input[name^="accountName-"]').first();
    const enterVisible = await enterManually.isVisible().catch(() => false);
    const linkVisible = await linkAccount.isVisible().catch(() => false);
    const headingVisible = await assetsHeading.isVisible().catch(() => false);
    const manualInputVisible = await manualFormInput.isVisible().catch(() => false);
    return enterVisible || linkVisible || headingVisible || manualInputVisible;
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForURL(/\/forgiveness\/(assets|repayment|federal|partner-student-loans)/, { timeout: 20000 }).catch(() => null);

    if (!page.url().includes('/forgiveness/assets')) {
      const continueButton = page.getByRole('button', { name: 'Continue' }).first();
      if (await continueButton.isVisible().catch(() => false)) {
        await clickWhenEnabled(continueButton).catch(() => null);
        await page.waitForURL(/\/forgiveness\/(assets|partner-student-loans)/, { timeout: 12000 }).catch(() => null);
      }
    }

    if (!page.url().includes('/forgiveness/assets')) {
      await page.goto(assetsUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForURL(/\/forgiveness\/assets/, { timeout: 20000 }).catch(() => null);
    }

    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForURL(/\/forgiveness\/assets/, { timeout: 20000 }).catch(() => null);
    if (await isAssetsReady()) return true;

    await page.waitForTimeout(1200);
  }

  return false;
}

export async function continueFlowBeforeDashboard(page: Page) {
  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  if (await continueButton.isVisible().catch(() => false)) {
    await clickWhenEnabled(continueButton).catch(() => null);
    await page.waitForTimeout(2500);
  }

  const url = page.url().toLowerCase();
  const hasUnderConstruction = await page.getByText(/under construction/i).first().isVisible().catch(() => false);
  if (url.includes('dashboard') || hasUnderConstruction) {
    await page.goBack({ timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }
}

export async function resilientFill(page: Page, selector: string, value: string) {
  if (value === undefined || value === null || value === '') return;
  if (page.isClosed()) return;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
  if (page.isClosed()) return;
  const strValue = String(value);

  // If the field already contains the expected value (ignoring currency
  // formatting), leave it alone to avoid masked inputs duplicating text.
  const beforeValue = await locator.inputValue().catch(() => '');
  const beforeDigits = beforeValue.replace(/[^0-9]/g, '');
  const expectedDigits = strValue.replace(/[^0-9]/g, '');
  if (beforeDigits === expectedDigits && beforeDigits !== '') return;

  // Standard fill; fall back to native value setter for stubborn masked inputs.
  await locator.fill('').catch(() => null);
  await locator.fill(strValue).catch(() => null);

  if (page.isClosed()) return;
  const inputValue = await locator.inputValue().catch(() => '');
  if (inputValue.replace(/[^0-9]/g, '') !== expectedDigits) {
    await locator.evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.value = '';
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(input, v);
      else input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, strValue).catch(() => null);
  }
}

export async function selectButtonToggle(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;

  // Try a visible, clickable element with the exact text (common for custom
  // radio buttons where the native input is hidden).
  const byText = page.getByText(value, { exact: true }).first();
  if (await byText.isVisible().catch(() => false)) {
    const tagName = await byText.evaluate((el) => (el as HTMLElement).tagName.toLowerCase()).catch(() => '');
    if (tagName !== 'input') {
      await byText.click();
      return;
    }
  }

  // Try a hidden radio input by value, aria-label, or id.
  const lowerValue = value.toLowerCase();
  const radios = await page.locator('input[type="radio"]').all();
  for (const radio of radios) {
    const radioValue = String((await radio.getAttribute('value').catch(() => '')) ?? '');
    const ariaLabel = String((await radio.getAttribute('aria-label').catch(() => '')) ?? '');
    const id = String((await radio.getAttribute('id').catch(() => '')) ?? '');
    if (
      radioValue.toLowerCase() === lowerValue ||
      ariaLabel.toLowerCase() === lowerValue ||
      id.toLowerCase().includes(lowerValue)
    ) {
      await radio.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return;
    }
  }

  // Fallback to the original group-based search.
  const group = page.locator('div, fieldset, form').filter({ hasText: labelRegex }).first();
  const button = group.locator('button, [role="radio"]').filter({ hasText: new RegExp(`^${value}$`, 'i') }).first();
  const pageButton = page.locator('button, [role="radio"]').filter({ hasText: new RegExp(`^${value}$`, 'i') }).first();
  const target = await button.isVisible().catch(() => false) ? button : pageButton;
  if (await target.isVisible().catch(() => false)) {
    await target.click();
  }
}

export async function selectDropdown(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;

  // Find the dropdown trigger: either a combobox with the label as its
  // accessible name, or a combobox associated with a matching label via
  // aria-labelledby, or a native select.
  let trigger: Locator | null = page.getByRole('combobox', { name: labelRegex }).first();
  if (!(await trigger.isVisible().catch(() => false))) {
    const label = page.locator('label').filter({ hasText: labelRegex }).first();
    const labelId = await label.getAttribute('id').catch(() => null);
    if (labelId) {
      trigger = page.locator(`[aria-labelledby="${labelId}"]`).first();
    }
    if (!trigger || !(await trigger.isVisible().catch(() => false))) {
      trigger = label.locator('..').locator('[role="combobox"]').first();
    }
  }
  if (!trigger || !(await trigger.isVisible().catch(() => false))) {
    trigger = page.locator('select').filter({ hasText: labelRegex }).first();
  }
  if (!trigger || !(await trigger.isVisible().catch(() => false))) return;

  // Ensure we are interacting with the combobox trigger, not a sibling listbox.
  const comboboxTrigger = trigger.locator('[role="combobox"]').or(trigger.filter({ has: page.locator(':scope[role="combobox"]') })).first();
  const actualTrigger = (await comboboxTrigger.isVisible().catch(() => false)) ? comboboxTrigger : trigger;

  await actualTrigger.click().catch(() => null);
  await page.waitForTimeout(500);

  // If options did not appear, try keyboard to open the dropdown.
  let optionsVisible = await page.locator('[role="listbox"] [role="option"]').first().isVisible().catch(() => false);
  if (!optionsVisible) {
    await actualTrigger.press('Enter');
    await page.waitForTimeout(500);
    optionsVisible = await page.locator('[role="listbox"] [role="option"]').first().isVisible().catch(() => false);
  }
  if (!optionsVisible) {
    await actualTrigger.press('Space');
    await page.waitForTimeout(500);
  }

  // Wait for a listbox/dropdown to appear and be populated with options.
  const listbox = page.locator('[role="listbox"]').first();
  await listbox.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
  await page.waitForFunction(
    () => document.querySelectorAll('[role="listbox"] [role="option"]').length > 0,
    { timeout: 3000 }
  ).catch(() => null);

  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const optionSelectors = [
    page.getByRole('option', { name: value, exact: true }).first(),
    page.getByRole('option', { name: new RegExp(escapedValue, 'i') }).first(),
    page.locator('[role="listbox"] >> text=' + JSON.stringify(value)).first(),
    page.locator('li, [role="option"]').filter({ hasText: new RegExp(escapedValue, 'i') }).first(),
    page.locator('select').filter({ hasText: new RegExp(value, 'i') }).locator('option').filter({ hasText: new RegExp(value, 'i') }).first()
  ];

  for (const option of optionSelectors) {
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      await page.keyboard.press('Escape');
      await actualTrigger.blur().catch(() => null);
      return;
    }
  }
}

async function selectDate(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;
  // Prefer native date input, then labeled input, placeholder input, then textbox.
  const inputDate = page.locator('input[type="date"]').first();
  const byLabel = page.getByLabel(labelRegex).first();
  const byPlaceholder = page.locator('input[placeholder*="date" i]').first();
  const textInput = page.getByRole('textbox').filter({ hasText: labelRegex }).first();

  let target: Locator | null = null;
  if (await inputDate.isVisible().catch(() => false)) target = inputDate;
  else if (await byLabel.isVisible().catch(() => false)) target = byLabel;
  else if (await byPlaceholder.isVisible().catch(() => false)) target = byPlaceholder;
  else if (await textInput.isVisible().catch(() => false)) target = textInput;
  if (!target) return;

  const normalizeToIso = (raw: string) => {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Accept M/D/YY, M/D/YYYY, MM/DD/YY, MM/DD/YYYY with separators / - .
    const us = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (us) {
      let mo = us[1].padStart(2, '0');
      let day = us[2].padStart(2, '0');
      let yr = us[3];
      if (yr.length === 2) {
        const n = Number(yr);
        yr = String(n <= 49 ? 2000 + n : 1900 + n);
      }
      return `${yr}-${mo}-${day}`;
    }
    // Detect DD/MM/YYYY where day>12
    const eu = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (eu) {
      const d = Number(eu[1]);
      const m = Number(eu[2]);
      if (d > 12 && m <= 12) {
        return `${eu[3]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    // Fallback to Date parsing
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      const mo = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${day}`;
    }
    return s;
  };

  const iso = normalizeToIso(value);

  // If native date input, set via native setter to avoid masking issues
  const tag = await target.evaluate((el) => (el as HTMLElement).tagName.toLowerCase()).catch(() => 'input');
  if (tag === 'input') {
    const type = await target.getAttribute('type').catch(() => 'text');
    if (type === 'date') {
      await target.evaluate((el, v) => {
        const input = el as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(input, v);
        else input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, iso).catch(() => null);
      return;
    }
  }

  // For text inputs that may have masking, use resilientFill which handles native setter fallback.
  // Try to derive a selector for resilientFill: prefer name attribute, then id, otherwise fallback to direct fill.
  const selector = await target.evaluate((el) => (el as HTMLInputElement).getAttribute('name') || (el as HTMLElement).id || '').catch(() => '');
  if (selector) {
    // If selector looks like an id, prefix with '#'
    const resolved = selector.startsWith('#') || selector.startsWith('.') || selector.startsWith('input') ? selector : `input[name="${selector}"]`;
    await resilientFill(page, resolved, iso).catch(async () => {
      await target.fill(iso).catch(() => null);
    });
  } else {
    await target.fill(iso).catch(() => null);
  }
}

export async function setCheckbox(page: Page, selector: string, checked: boolean) {
  const locator = page.locator(selector).first();
  if (!(await locator.isVisible().catch(() => false))) return;
  const isChecked = await locator.isChecked().catch(() => false);
  if (isChecked !== checked) await locator.click();
}

export async function fillWelcome(page: Page) {
  await page.goto(resolveTestUrl());
  await page.locator('body').click();

  const firstName = getEnv('FIRST_NAME');
  const lastName = getEnv('LAST_NAME');
  const email = getEnv('EMAIL');
  const password = getEnv('PASSWORD');

  await page.waitForSelector('input[name="firstName"]', { state: 'visible', timeout: 15000 });
  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  if (getEnv('TERMS_AGREEMENT') === 'true') {
    await page.check('#termsCheckbox');
  }

  const continueButton = page.locator('button[data-testid="button"]').first();
  await continueButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);

  // Wait for the Continue button to become enabled after the form is filled.
  try {
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button[data-testid="button"]') as HTMLButtonElement | null;
        return !!btn && !btn.disabled;
      },
      { timeout: 10000 }
    );
  } catch {
    // Continue anyway; the click will fail cleanly if still disabled.
  }

  if (await continueButton.isEnabled().catch(() => false)) {
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }).catch(() => null),
      continueButton.click()
    ]);
    await page.waitForTimeout(3000);

    // If the environment redirects to a login screen, the account already
    // exists for this email. Sign in with the credentials we just used so the
    // flow can continue.
    await handleLoginRedirect(page, email, password);

    // If we are still on the welcome page, the signup did not advance.
    // Give the app one more chance to settle before the next step fails.
    if (page.url().includes('/forgiveness/welcome')) {
      await page.waitForTimeout(5000);
      if (page.url().includes('/forgiveness/welcome') && await continueButton.isVisible().catch(() => false)) {
        await Promise.all([
          page.waitForNavigation({ timeout: 30000 }).catch(() => null),
          continueButton.click()
        ]);
        await page.waitForTimeout(3000);
        await handleLoginRedirect(page, email, password);
      }
    }
  }
}

async function ensureOnIncomePage(page: Page) {
  if (page.url().includes('/forgiveness/income')) return;

  // The app sometimes lands on the bare /forgiveness route as a transient
  // shell while it decides where to route the user. Wait for it to settle.
  const url = page.url();
  if (url.replace(/\/$/, '').endsWith('/forgiveness')) {
    await page.waitForTimeout(5000);
    if (page.url().includes('/forgiveness/income')) return;
  }

  // If we are still on welcome, the signup did not advance; try navigating to income directly.
  if (page.url().includes('/forgiveness/welcome')) {
    await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/income').catch(() => null);
    await page.waitForTimeout(3000);
    if (page.url().includes('/forgiveness/income')) return;
  }

  // If we landed on the Okta/login page, authentication is required.
  if (isLoginUrl(page.url())) {
    const email = getEnv('EMAIL');
    const password = getEnv('PASSWORD');
    if (email && password) {
      await handleLoginRedirect(page, email, password);
      if (page.url().includes('/forgiveness/income')) return;
    }
  }

  // If we were redirected to my.gr-dev.com/dashboard or the bare /forgiveness
  // landing shell after login, navigate back to the forgiveness flow manually.
  if (page.url().includes('my.gr-dev.com') || page.url().includes('dashboard') || page.url().replace(/\/$/, '').endsWith('/forgiveness')) {
    await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/income').catch(() => null);
    await page.waitForTimeout(3000);
    if (page.url().includes('/forgiveness/income')) return;
  }

  // If we still cannot reach the income page, the session is not authenticated.
  if (!page.url().includes('/forgiveness/income')) {
    throw new Error(
      'Authentication required: unable to reach /forgiveness/income. ' +
      'Current URL: ' + page.url() + '. ' +
      'To run full IDR flow tests, supply a pre-authenticated storageState or existing-user credentials.'
    );
  }
}

export async function fillIncome(page: Page) {
  await ensureOnIncomePage(page);
  await page.waitForSelector('input[name="agiOrIncome"], [data-testid="textInput"]', { timeout: 15000 }).catch(() => null);

  const agi = getEnv('APPLICANT_AGI');
  if (agi) {
    await resilientFill(page, 'input[name="agiOrIncome"]', agi);
  }

  const maritalStatus = getEnv('MARITAL_STATUS');
  if (maritalStatus) {
    await selectButtonToggle(page, /marital status/i, maritalStatus);
  }

  if (maritalStatus === 'Married') {
    await resilientFill(page, 'input[name="spouseFirstName"]', getEnv('SPOUSE_FIRST_NAME'));
    await resilientFill(page, 'input[name="spouseLastName"]', getEnv('SPOUSE_LAST_NAME'));
    await resilientFill(page, 'input[name="spouseAgiOrIncome"]', getEnv('SPOUSE_AGI'));
    const filingStatus = getEnv('FILING_STATUS');
    if (filingStatus) {
      await selectButtonToggle(page, /How do you file your taxes/i, filingStatus);
    }
  }

  const dependents = getEnv('APPLICANT_DEPENDENTS');
  if (dependents && Number(dependents) > 0) {
    const ages = getEnv('APPLICANT_DEPENDENT_CHILD_AGES').split(',').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < ages.length; i++) {
      let ageInput = page.getByLabel(/Child's age/i).nth(i);
      if (!(await ageInput.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /Add child/i }).first().click().catch(() => null);
        await page.waitForTimeout(300);
        ageInput = page.getByLabel(/Child's age/i).nth(i);
      }
      if (await ageInput.isVisible().catch(() => false)) {
        await ageInput.fill(ages[i]);
      }
    }
  }

  const state = getEnv('STATE_OF_RESIDENCE');
  if (state) {
    // Give the Google Places autocomplete script time to attach to the state input.
    await page.waitForTimeout(1500);
    const stateSelectors = [
      'input[name="state"]',
      'input#state',
      'input[name="a"]',
      'input#gma',
      'input[placeholder*="state" i]',
      'input[aria-label*="state" i]'
    ];
    let stateInput: Locator | null = null;
    for (const selector of stateSelectors) {
      const candidate = page.locator(selector).first();
      if (await candidate.isVisible().catch(() => false)) {
        stateInput = candidate;
        break;
      }
    }
    if (stateInput) {
      const currentState = await stateInput.inputValue().catch(() => '');
      // If the state is already populated (common when the app pre-fills it),
      // leave it alone to avoid overwriting a valid Google Places selection.
      if (currentState.trim()) {
        await stateInput.blur();
      } else {
        await stateInput.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type(state);

        // Wait for Google Places suggestions to render.
        const firstSuggestion = page.locator('.pac-item').first();
        await page.waitForFunction(
          () => document.querySelectorAll('.pac-item').length > 0,
          { timeout: 5000 }
        ).catch(() => null);
        const hasSuggestion = await firstSuggestion.isVisible().catch(() => false);
        if (hasSuggestion) {
          await firstSuggestion.click({ force: true }).catch(async () => {
            await stateInput.press('ArrowDown');
            await page.waitForTimeout(200);
            await stateInput.press('Enter');
          });
        } else {
          await stateInput.press('ArrowDown');
          await page.waitForTimeout(200);
          await stateInput.press('Enter');
        }
        await page.waitForTimeout(300);
        await stateInput.blur();
      }
    }
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[data-testid="button"]') as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    },
    { timeout: 10000 }
  ).catch(() => null);
  await page.waitForTimeout(500);

  // Click Continue and wait for navigation. If we remain on the income page
  // (e.g. due to slow autocomplete validation), click once more.
  const incomeUrl = /\/forgiveness\/income/;
  await continueButton.click();
  await page.waitForURL(/\/forgiveness\/(federal|repayment|assets|partner-student-loans)/, { timeout: 45000 }).catch(() => null);
  if (incomeUrl.test(page.url())) {
    await page.waitForTimeout(1000);
    await continueButton.click();
    await page.waitForURL(/\/forgiveness\/(federal|repayment|assets|partner-student-loans)/, { timeout: 45000 }).catch(() => null);
  }
}

export async function fillFederal(page: Page) {
  await page.waitForURL(/\/forgiveness\/federal/, { timeout: 15000 }).catch(() => null);

  const fillFederalTotals = async (balance: string, rate: string) => {
    const balanceValue = balance || '0';
    const rateValue = rate || '0';

    const balanceTargets: Array<string | Locator> = [
      page.getByRole('textbox', { name: /Total estimated balance/i }).first(),
      'input[name="estimatedTotalBalance"]',
      'input[placeholder*="total estimated balance" i]',
      'input[placeholder*="total balance" i]',
      'input[aria-label*="Total estimated balance" i]',
      'input[aria-label*="Total balance" i]'
    ];
    const rateTargets: Array<string | Locator> = [
      page.getByRole('textbox', { name: /Estimated average interest rate/i }).first(),
      'input[name="estimatedAverageInterestRate"]',
      'input[placeholder*="estimated average interest rate" i]',
      'input[placeholder*="interest rate" i]',
      'input[aria-label*="average interest rate" i]',
      'input[aria-label*="interest rate" i]'
    ];

    for (const target of balanceTargets) {
      const input = typeof target === 'string' ? page.locator(target).first() : target;
      await input.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
      if (await input.isVisible().catch(() => false)) {
        await input.fill(balanceValue);
        await input.blur().catch(() => null);
        break;
      }
    }

    for (const target of rateTargets) {
      const input = typeof target === 'string' ? page.locator(target).first() : target;
      await input.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
      if (await input.isVisible().catch(() => false)) {
        await input.fill(rateValue);
        await input.blur().catch(() => null);
        break;
      }
    }
  };

  const parseLoanRows = () => {
    const raw = getEnv('APPLICANT_LOANS');
    if (!raw) return [] as Array<{ balance: string; apr: string; principal: string; accrued: string }>;

    const normalize = (value: string) => value.replace(/[$,\s]/g, '').trim();
    return raw
      .split(';')
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const [balance = '', apr = '', principal = '', accrued = ''] = row.split('|').map((part) => normalize(part));
        return { balance, apr, principal, accrued };
      })
      .filter((row) => row.balance);
  };

  const entryMode = getEnv('APPLICANT_LOAN_ENTRY_MODE');
  if (entryMode === 'Enter total') {
    await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
    await fillFederalTotals(getEnv('APPLICANT_BALANCE'), getEnv('APPLICANT_RATE'));
  } else {
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    const hasIndividualRows =
      (await page.locator('input[name^="loan-balance-"]').first().isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /New loan/i }).first().isVisible().catch(() => false));

    // Some app variants keep only the total-entry fields active even when the
    // individual tab is selected. Fall back so Continue can become enabled.
    if (!hasIndividualRows) {
      await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
      await page.waitForTimeout(300);
      await fillFederalTotals(getEnv('APPLICANT_BALANCE'), getEnv('APPLICANT_RATE'));
    }

    const loanRows = parseLoanRows();

    if (hasIndividualRows && loanRows.length > 0) {
      // Ensure enough rows exist before filling all configured loans.
      let rowCount = await page.locator('input[name^="loan-balance-"]').count();
      if (rowCount === 0) {
        await page.getByRole('button', { name: /New loan/i }).first().click().catch(() => null);
        await page.waitForTimeout(500);
        rowCount = await page.locator('input[name^="loan-balance-"]').count();
      }

      while (rowCount < loanRows.length) {
        await page.getByRole('button', { name: /New loan/i }).first().click().catch(() => null);
        await page.waitForTimeout(400);
        rowCount = await page.locator('input[name^="loan-balance-"]').count();
      }

      for (let i = 0; i < loanRows.length; i++) {
        const loan = loanRows[i];
        await resilientFill(page, `input[name="loan-balance-${i}"]`, loan.balance);
        await resilientFill(page, `input[name="loan-apr-${i}"]`, loan.apr);
        await resilientFill(page, `input[name="loan-principal-${i}"]`, loan.principal || loan.balance);
        await resilientFill(page, `input[name="loan-accruedInterest-${i}"]`, loan.accrued || '0');
      }

      // Remove empty leftover rows that can block validation.
      const rows = await page.locator('input[name^="loan-balance-"]').all();
      for (let i = loanRows.length; i < rows.length; i++) {
        const rowBalance = await rows[i].inputValue().catch(() => '');
        if (!rowBalance.trim()) {
          const deleteButton = page.getByRole('button', { name: new RegExp(`Delete loan row ${i + 1}`, 'i') }).first();
          if (await deleteButton.isVisible().catch(() => false)) {
            await deleteButton.click();
            await page.waitForTimeout(300);
          }
        }
      }
    } else if (hasIndividualRows) {
      const balance = getEnv('APPLICANT_BALANCE');
      if (balance && Number(balance) > 0) {
        // Only add a new row if the table is currently empty. The app sometimes
        // pre-renders an empty row; clicking "+ New loan" again creates an extra
        // empty row that disables Continue.
        const existingRows = page.locator('input[name^="loan-balance-"]').count();
        if ((await existingRows) === 0) {
          await page.getByRole('button', { name: /New loan/i }).first().click().catch(() => null);
          await page.waitForTimeout(500);
        }
        await resilientFill(page, 'input[name="loan-balance-0"]', balance);
        await resilientFill(page, 'input[name="loan-apr-0"]', getEnv('APPLICANT_RATE'));
        await resilientFill(page, 'input[name="loan-principal-0"]', getEnv('APPLICANT_PRINCIPAL') || balance);
        await resilientFill(page, 'input[name="loan-accruedInterest-0"]', getEnv('APPLICANT_ACCRUED_INTEREST') || '0');

        // Remove any leftover empty rows so the form validates.
        const rows = await page.locator('input[name^="loan-balance-"]').all();
        for (let i = 1; i < rows.length; i++) {
          const rowBalance = await rows[i].inputValue().catch(() => '');
          if (!rowBalance.trim()) {
            const deleteButton = page.getByRole('button', { name: new RegExp(`Delete loan row ${i + 1}`, 'i') }).first();
            if (await deleteButton.isVisible().catch(() => false)) {
              await deleteButton.click();
              await page.waitForTimeout(300);
            }
          }
        }
      } else {
        // No-loan scenario: an empty individual table leaves Continue disabled.
        // The "Enter total" tab allows $0 and lets the form continue.
        await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
        await page.waitForTimeout(300);
        await fillFederalTotals('0', '0');
      }
    } else {
      await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
      await page.waitForTimeout(300);
      await fillFederalTotals(getEnv('APPLICANT_BALANCE') || '0', getEnv('APPLICANT_RATE') || '0');
    }
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton).catch(() => null);
  await page.waitForURL(/\/forgiveness\/(repayment|assets|partner-student-loans)/, { timeout: 20000 }).catch(() => null);

  // If the first click did not advance, try once more after a short settle.
  if (page.url().includes('/forgiveness/federal')) {
    await page.waitForTimeout(1200);
    await clickWhenEnabled(continueButton).catch(() => null);
    await page.waitForURL(/\/forgiveness\/(repayment|assets|partner-student-loans)/, { timeout: 20000 }).catch(() => null);
  }
}

export async function fillRepayment(page: Page) {
  await page.waitForURL(/\/forgiveness\/repayment/, { timeout: 15000 }).catch(() => null);
  if (!page.url().includes('/forgiveness/repayment')) return;

  const plan = getEnv('APPLICANT_PLAN');
  if (plan) {
    await selectDropdown(page, /Repayment Plan/i, plan);
  }

  const pslf = getEnv('APPLICANT_PSLF') === 'true';
  await setCheckbox(page, 'input[name="pursuingPslf"]', pslf);

  await selectDate(page, /estimated repayment start date/i, getEnv('APPLICANT_START'));
  const forbearance = getEnv('APPLICANT_FORBEARANCE');
  if (forbearance !== undefined && forbearance !== null && forbearance !== '') {
    await resilientFill(page, 'input[name="forbearanceMonths"]', forbearance);
  }
  await resilientFill(page, 'input[name="currentMonthlyPayment"]', '0');

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
}

async function fillPartnerStudentLoans(page: Page) {
  if (!page.url().includes('/forgiveness/partner-student-loans')) return;

  const spouseHasLoans = getEnv('SPOUSE_HAS_LOANS');
  if (spouseHasLoans) {
    await selectButtonToggle(page, /Does .* have student loans/i, spouseHasLoans);
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);

  // Married users with spouseHasLoans=Yes route through partner-federal and
  // partner-repayment before assets. If "No" was selected, the flow advances
  // directly to assets, so these helpers are no-ops when the URL does not match.
  await fillSpouseFederal(page);
  await fillSpouseRepayment(page);
}

export async function linkPlaidAccount(page: Page, bankName: string, userId: string, password: string, institutionName?: string) {
  const effectiveBankName = institutionName || bankName;
  const bankPrimaryToken = (effectiveBankName || '').trim().split(/\s+/)[0] || effectiveBankName;

  // Click Link account in the app before entering Plaid.
  const linkButton = page.getByRole('button', { name: /Link account/i }).first();
  await linkButton.waitFor({ state: 'visible', timeout: 15000 });
  await linkButton.click();

  // Wait for either person selector modal or Plaid iframe to appear.
  const plaidIframeSelector = 'iframe[name*="plaid" i], iframe[title*="plaid" i], iframe[src*="plaid" i]';
  const personPickerHeading = page.getByRole('heading', { name: /Who do you want to link this account for\?/i }).first();
  for (let i = 0; i < 20; i++) {
    const hasPersonPicker = await personPickerHeading.isVisible().catch(() => false);
    const hasIframe = (await page.locator(plaidIframeSelector).count()) > 0;
    if (hasPersonPicker || hasIframe) break;
    await page.waitForTimeout(500);
  }

  // If person selector appears, choose profile owner first.
  if (await personPickerHeading.isVisible().catch(() => false)) {
    const firstName = getEnv('FIRST_NAME');
    const personButton = firstName
      ? page.getByRole('button', { name: new RegExp(`^${firstName}$`, 'i') }).first()
      : page.getByRole('dialog').first().locator('button').filter({ hasText: /^(?!Cancel$).+/i }).first();

    await personButton.waitFor({ state: 'visible', timeout: 10000 });
    await personButton.click();
  }

  // After person selection, wait for Plaid container (iframe or inline surface).
  let usingIframe = false;
  for (let i = 0; i < 30; i++) {
    if ((await page.locator(plaidIframeSelector).count()) > 0) {
      usingIframe = true;
      break;
    }
    const inlinePlaidVisible = await page.getByText(/Sandbox mode|Plaid/i).first().isVisible().catch(() => false);
    if (inlinePlaidVisible) break;
    await page.waitForTimeout(500);
  }

  const plaidRoot = usingIframe ? page.frameLocator(plaidIframeSelector).first() : page;

  const continueWithoutPhone = plaidRoot.getByRole('button', { name: /Continue without phone number/i }).first();
  const phoneInput = plaidRoot.getByRole('textbox', { name: /Phone/i }).first();
  const continueWithPhone = plaidRoot.getByRole('button', { name: /^Continue$/i }).first();
  const searchBox = plaidRoot.locator('input[placeholder*="Search" i], input[type="search"], input[name*="search" i]').first();
  const bankOption = plaidRoot.getByRole('button', { name: new RegExp(effectiveBankName, 'i') }).first();
  const bankOptionFallback = plaidRoot.getByRole('button', { name: new RegExp(bankPrimaryToken, 'i') }).first();
  const userIdInput = plaidRoot.locator('input[name*="user" i], input[name*="login" i], input[autocomplete*="username" i]').first();
  const userIdInputFallback = plaidRoot.locator('input[type="text"], input[inputmode="email"]').first();
  const passwordInput = plaidRoot.locator('input[type="password"]').first();

  // Wait until one of the next actionable states is visible.
  let stateResolved = false;
  for (let i = 0; i < 30; i++) {
    const continueWithoutPhoneVisible = await continueWithoutPhone.isVisible().catch(() => false);
    if (continueWithoutPhoneVisible) {
      await continueWithoutPhone.click({ force: true }).catch(() => null);
      await page.waitForTimeout(800);
      continue;
    }

    const phoneInputVisible = await phoneInput.isVisible().catch(() => false);
    if (phoneInputVisible) {
      await phoneInput.fill('4155550011').catch(() => null);
      if (await continueWithPhone.isVisible().catch(() => false)) {
        await continueWithPhone.click().catch(() => null);
        await page.waitForTimeout(800);
      }
    }

    const searchVisible = await searchBox.isVisible().catch(() => false);
    const bankVisible = await bankOption.isVisible().catch(() => false);
    const bankFallbackVisible = await bankOptionFallback.isVisible().catch(() => false);
    const credsVisible = await userIdInput.isVisible().catch(() => false);
    const credsFallbackVisible = await userIdInputFallback.isVisible().catch(() => false);

    if (searchVisible) {
      await searchBox.fill(effectiveBankName);
      if (await bankOption.isVisible().catch(() => false)) {
        await bankOption.click();
      } else {
        await bankOptionFallback.waitFor({ state: 'visible', timeout: 10000 });
        await bankOptionFallback.click();
      }
      stateResolved = true;
      break;
    }
    if (bankVisible) {
      await bankOption.click();
      stateResolved = true;
      break;
    }
    if (bankFallbackVisible) {
      await bankOptionFallback.click();
      stateResolved = true;
      break;
    }
    if (credsVisible) {
      stateResolved = true;
      break;
    }
    if (credsFallbackVisible && (await passwordInput.isVisible().catch(() => false))) {
      stateResolved = true;
      break;
    }
    await page.waitForTimeout(1000);
  }

  if (!stateResolved) {
    throw new Error('Plaid did not reach searchable institutions or credential entry.');
  }

  const primaryUserVisible = await userIdInput.isVisible().catch(() => false);
  const activeUserInput = primaryUserVisible ? userIdInput : userIdInputFallback;
  await activeUserInput.waitFor({ state: 'visible', timeout: 20000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 20000 });
  await activeUserInput.fill(userId);
  await passwordInput.fill(password);

  const signInButton = plaidRoot.getByRole('button', { name: /Sign in|Continue|Submit|Connect/i }).first();
  await signInButton.waitFor({ state: 'visible', timeout: 15000 });
  await signInButton.click();

  // Complete post-login account/consent screens by pressing primary continue actions
  // until Plaid naturally returns to assets.
  const plaidFrameOnPage = page.locator(plaidIframeSelector).first();
  let completed = false;
  let clickedPostLoginContinue = false;
  for (let i = 0; i < 45; i++) {
    const frameVisible = await plaidFrameOnPage.isVisible().catch(() => false);
    if (!frameVisible) {
      completed = true;
      break;
    }

    const finalContinueButton = plaidRoot.getByRole('button', { name: /Continue|Connect|Done|Authorize|Finish|Submit/i }).first();
    if (await finalContinueButton.isVisible().catch(() => false)) {
      const enabled = await finalContinueButton.isEnabled().catch(() => false);
      if (enabled) {
        await finalContinueButton.click().catch(() => null);
        clickedPostLoginContinue = true;
      }
    }

    await page.waitForTimeout(1000);
  }

  if (!completed) {
    throw new Error('Plaid did not complete and return to assets page.');
  }

  if (!clickedPostLoginContinue) {
    throw new Error('Plaid completed without confirming account/consent continue step.');
  }

  await page.waitForURL(/\/forgiveness\/assets/, { timeout: 15000 }).catch(() => null);
}

export async function waitForPlaidLinkedAccounts(
  page: Page,
  accountPattern: RegExp = /Platypus|Bank Account|Linked/i,
  refreshAttempts = 3
) {
  const refreshIntervalMs = 3 * 60 * 1000;
  const linkedAccount = page.getByText(accountPattern).first();

  for (let attempt = 1; attempt <= refreshAttempts; attempt += 1) {
    await page.waitForTimeout(refreshIntervalMs);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/forgiveness\/assets/, { timeout: 30000 }).catch(() => null);

    if (await linkedAccount.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

export async function addManualAsset(page: Page, accountName: string, accountType: string, institution: string, balance: string, owner: string, includeTaxBomb: boolean) {
  const addButton = page.getByRole('button', { name: /Enter manually|Add asset manually|Add manual account/i }).first();
  const accountNameInput = page.locator('input[name^="accountName-"]').first();
  let formVisible = await accountNameInput.isVisible().catch(() => false);

  if (!formVisible) {
    await addButton.waitFor({ state: 'visible', timeout: 30000 }).catch(() => null);
    if (!(await addButton.isVisible().catch(() => false))) {
      throw new Error('Assets remained loading for 30 seconds; neither Enter manually nor the manual account form rendered.');
    }

    await clickWhenEnabled(addButton);
    await accountNameInput.waitFor({ state: 'visible', timeout: 30000 }).catch(() => null);
    formVisible = await accountNameInput.isVisible().catch(() => false);
  }

  if (!formVisible) {
    throw new Error('Assets Enter manually remained loading for 30 seconds; no manual account form rendered.');
  }

  // Use the most recently created row. The app often pre-renders row 0,
  // so using count-1 avoids writing into a non-existent index.
  const existingAccounts = await page.locator('input[name^="accountName-"]').count();
  let index = Math.max(existingAccounts - 1, 0);
  const targetExists = await page.locator(`input[name="accountName-${index}"]`).first().isVisible().catch(() => false);
  if (!targetExists) {
    index = 0;
  }

  // Fill account details
  await resilientFill(page, `input[name="accountName-${index}"]`, accountName);
  await selectDropdown(page, /Account type/i, accountType);
  await resilientFill(page, `input[name="financialInstitution-${index}"]`, institution);
  await resilientFill(page, `input[name="currentBalance-${index}"]`, balance);
  const ownerOption = owner === 'Applicant'
    ? getEnv('FIRST_NAME')
    : owner === 'Spouse'
      ? getEnv('SPOUSE_FIRST_NAME')
      : owner;
  await selectDropdown(page, /Owner/i, ownerOption);
  await setCheckbox(page, `input[name="includeInPlan-${index}"]`, includeTaxBomb);

  // Save account
  const saveButton = page.getByRole('button', { name: /Save account|Save asset/i }).first();
  if (!(await saveButton.isVisible().catch(() => false))) {
    throw new Error('Manual account form rendered without a Save account action.');
  }
  await expect(saveButton).toBeEnabled({ timeout: 10000 }).catch(() => null);
  if (!(await saveButton.isEnabled().catch(() => false))) {
    throw new Error(`Manual account Save is disabled after entering all fields. Owner option selected: ${ownerOption || 'none'}.`);
  }
  await clickWhenEnabled(saveButton);
  await page.waitForTimeout(1000);
}

export async function editAsset(page: Page, accountName: string, newBalance: string) {
  // Find and click the Edit button for the specific account
  const accountCard = page.locator(`text=${accountName}`).first().locator('..').locator('..').locator('..').first();
  const editButton = accountCard.locator('button:has-text("Edit")').first();

  if (await editButton.isVisible().catch(() => false)) {
    await editButton.click();
    await page.waitForTimeout(1000);

    // Update the balance
    const balanceInput = page.locator('input[name*="currentBalance"]').first();
    if (await balanceInput.isVisible().catch(() => false)) {
      await balanceInput.fill(newBalance);

      // Save changes
      const saveButton = page.getByRole('button', { name: /Save|Update/i }).first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }
  }
}

export async function deleteAsset(page: Page, accountName: string) {
  // Find and click the Delete button for the specific account
  const accountCard = page.locator(`text=${accountName}`).first().locator('..').locator('..').locator('..').first();
  const deleteButton = accountCard.locator('button:has-text("Delete")').first();

  if (await deleteButton.isVisible().catch(() => false)) {
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').nth(1);
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    }
  }
}

async function fillAssets(page: Page) {
  await page.waitForURL(/\/forgiveness\/assets/, { timeout: 15000 }).catch(() => null);
  if (!page.url().includes('/forgiveness/assets')) return;

  const accountName = getEnv('ASSET_ACCOUNT_NAME');
  if (accountName) {
    const continueButton = page.getByRole('button', { name: 'Continue' }).first();
    if (!(await continueButton.isVisible().catch(() => false))) {
      await addManualAsset(
        page,
        accountName,
        getEnv('ASSET_ACCOUNT_TYPE'),
        getEnv('ASSET_FINANCIAL_INSTITUTION'),
        getEnv('ASSET_CURRENT_BALANCE'),
        getEnv('ASSET_OWNER') || 'Applicant',
        getEnv('INCLUDE_IN_TAX_BOMB_CALC') !== 'false'
      );
    }
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  if (!(await continueButton.isVisible().catch(() => false))) {
    throw new Error('Assets save did not expose Continue. Verify the manual account form was accepted.');
  }
  await clickWhenEnabled(continueButton, 15000);
}

const EMAIL_REGISTRY_DIR = path.resolve(process.cwd(), 'test-data', 'student-idr');
const EMAIL_REGISTRY_FILE = path.join(EMAIL_REGISTRY_DIR, 'student-IDR-emails.json');

interface EmailRegistryEntry {
  email: string;
  password: string;
  runId: string;
  workerIndex: number;
  testTitle: string;
  testFile: string;
  createdAt: string;
}

// Unique identifier for this test run. Generated once per worker process; the
// timestamp + random suffix makes collisions across separate runs extremely unlikely.
const RUN_ID = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

// In-memory per-worker counters avoid racing the registry file on every call.
const workerCounters = new Map<number, number>();

function ensureEmailRegistryDir() {
  if (!existsSync(EMAIL_REGISTRY_DIR)) {
    mkdirSync(EMAIL_REGISTRY_DIR, { recursive: true });
  }
}

function loadEmailRegistry(): EmailRegistryEntry[] {
  ensureEmailRegistryDir();
  if (!existsSync(EMAIL_REGISTRY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(EMAIL_REGISTRY_FILE, 'utf8')) as EmailRegistryEntry[];
  } catch {
    return [];
  }
}

function saveEmailRegistry(entries: EmailRegistryEntry[]) {
  ensureEmailRegistryDir();
  writeFileSync(EMAIL_REGISTRY_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function isEmailUsed(email: string): boolean {
  return loadEmailRegistry().some((entry) => entry.email === email);
}

function nextWorkerCounter(workerIndex: number): number {
  const next = (workerCounters.get(workerIndex) || 0) + 1;
  workerCounters.set(workerIndex, next);
  return next;
}

function makeEmailUnique(email: string | undefined, workerIndex: number, counter: number) {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  return `${localPart}.${RUN_ID}.w${workerIndex}.${counter}@${domain}`;
}

function makePasswordUnique(password: string | undefined, seq: number) {
  if (!password) return '';
  // Keep password complexity while varying it per run.
  return `${password.slice(0, -1)}${seq}!`;
}

function registerCredentials(baseEmail: string | undefined, basePassword: string | undefined, testInfo: TestInfo): { email: string; password: string } {
  const counter = nextWorkerCounter(testInfo.workerIndex);
  const email = makeEmailUnique(baseEmail, testInfo.workerIndex, counter);
  const password = makePasswordUnique(basePassword, counter);

  const entry: EmailRegistryEntry = {
    email,
    password,
    runId: RUN_ID,
    workerIndex: testInfo.workerIndex,
    testTitle: testInfo.title,
    testFile: testInfo.file,
    createdAt: new Date().toISOString(),
  };

  if (!isEmailUsed(email)) {
    const registry = loadEmailRegistry();
    registry.push(entry);
    saveEmailRegistry(registry);
  }

  return { email, password };
}

function isLoginUrl(url: string): boolean {
  return /okta|login|signin|auth|my\.gr-dev\.com/.test(url);
}

async function handleLoginRedirect(page: Page, email: string, password: string) {
  // Allow navigation/network requests to settle.
  await page.waitForTimeout(3000);

  // Already past the login gate; nothing to do.
  if (!isLoginUrl(page.url())) return;

  // Look for common email/username inputs.
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[name="identifier"]',
    'input[id="okta-signin-username"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
  ];
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[id="okta-signin-password"]',
    'input[autocomplete="current-password"]',
  ];
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign In")',
    'button:has-text("Log In")',
    'button:has-text("Continue")',
    'input[value="Sign In"]',
    'input[value="Log In"]',
  ];

  const emailInput = page.locator(emailSelectors.join(', ')).first();
  const passwordInput = page.locator(passwordSelectors.join(', ')).first();
  const submitButton = page.locator(submitSelectors.join(', ')).first();

  if (!(await emailInput.isVisible().catch(() => false))) {
    return;
  }

  await emailInput.fill(email);
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(password);
  }
  await submitButton.click().catch(() => null);

  // Wait for the post-login destination to settle.
  await page.waitForURL(/\/forgiveness\/income|\/forgiveness\/welcome|dashboard|my\.gr-dev\.com/, { timeout: 30000 }).catch(() => null);
}

export async function runIdrFlow(page: Page, profile: string, options?: { testUrl?: string }) {
  const testInfo = test.info();

  if (options?.testUrl) {
    process.env.TEST_URL = options.testUrl;
  }

  // Ensure a unique email and password per test run to avoid duplicate-account
  // conflicts in QA. Credentials are persisted in a registry so they can be
  // reused if a login screen is encountered mid-run.
  const { email, password } = registerCredentials(getEnv('EMAIL'), getEnv('PASSWORD'), testInfo);
  setEnvValue('EMAIL', email);
  setEnvValue('PASSWORD', password);
  process.env.EMAIL = email;
  process.env.PASSWORD = password;

  await fillWelcome(page);
  await fillIncome(page);
  await fillFederal(page);
  await fillRepayment(page);
  await fillPartnerStudentLoans(page);
  await fillAssets(page);

  await writeRunArtifacts(page, testInfo);
}

async function fillSpouseFederal(page: Page) {
  await page.waitForURL(/\/forgiveness\/partner-federal/, { timeout: 15000 }).catch(() => null);
  if (!page.url().includes('/forgiveness/partner-federal')) return;

  const balance = getEnv('SPOUSE_BALANCE');
  const rate = getEnv('SPOUSE_RATE');
  if (balance && Number(balance) > 0 && rate) {
    await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
    await page.waitForTimeout(300);
    await resilientFill(page, 'input[name="estimatedTotalBalance"]', balance);
    await resilientFill(page, 'input[name="estimatedAverageInterestRate"]', rate);
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
}

async function fillSpouseRepayment(page: Page) {
  await page.waitForURL(/\/forgiveness\/partner-repayment/, { timeout: 15000 }).catch(() => null);
  if (!page.url().includes('/forgiveness/partner-repayment')) return;

  const plan = getEnv('SPOUSE_PLAN');
  if (plan) {
    await selectDropdown(page, /Repayment Plan/i, plan);
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
}

async function writeRunArtifacts(page: Page, testInfo: TestInfo) {
  const statusLabel = testInfo.status === testInfo.expectedStatus ? 'passed' : 'failed';
  const screenshotPath = testInfo.outputPath(`${statusLabel}.png`);
  const reportPath = testInfo.outputPath(`${statusLabel}-report.md`);
  const currentUrl = page.isClosed() ? 'page closed' : page.url();
  const currentTitle = page.isClosed() ? 'page closed' : await page.title().catch(() => '');
  const errorBlocks = testInfo.errors.length
    ? testInfo.errors
        .map((error, index) => {
          const message = error.message || String(error);
          const stack = error.stack || '';
          return [
            `### Error ${index + 1}`,
            '',
            '```text',
            message,
            '```',
            stack ? '' : null,
            stack ? '```text' : null,
            stack || null,
            stack ? '```' : null,
          ]
            .filter((line) => line !== null)
            .join('\n');
        })
        .join('\n\n')
    : 'No error objects were captured.';

  const report = [
    `# Test ${statusLabel}`,
    '',
    `- Test file: ${testInfo.file}`,
    `- Test name: ${testInfo.title}`,
    `- Project: ${testInfo.project.name}`,
    `- Retry: ${testInfo.retry}`,
    `- Status: ${testInfo.status}`,
    `- Expected: ${testInfo.expectedStatus}`,
    `- URL: ${currentUrl}`,
    currentTitle ? `- Page title: ${currentTitle}` : '',
    `- Duration: ${testInfo.duration ?? 0}ms`,
    '',
    '## Error details',
    '',
    errorBlocks,
  ]
    .filter((line) => line !== '')
    .join('\n');

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report, 'utf8');

  if (!page.isClosed()) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  }

  await testInfo.attach(`${statusLabel} report`, { path: reportPath, contentType: 'text/markdown' }).catch(() => null);
  await testInfo.attach(`${statusLabel} screenshot`, { path: screenshotPath, contentType: 'image/png' }).catch(() => null);
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(180000);
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
});

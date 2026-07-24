import { Page, expect, test, type TestInfo, type Locator } from '@playwright/test';
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
  'ASSET_CURRENT_BALANCE', 'ASSET_OWNER', 'INCLUDE_IN_TAX_BOMB_CALC', 'EXPECTED_USE'
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

export function loadProfile(profile: string) {
  if (!profile) return;
  for (const key of PROFILE_KEYS) {
    const source = `${key}_${profile}`;
    if (process.env[source]) {
      process.env[key] = process.env[source];
    }
  }
}

export function resetProfile() {
  for (const key of PROFILE_KEYS) {
    process.env[key] = BASE_ENV[key];
  }
}

export function getEnv(key: string) {
  return (process.env[key] || '').trim();
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

async function clickWhenEnabled(locator: Locator, timeoutMs = 10000) {
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  await locator.evaluate((el) => {
    const button = el as HTMLButtonElement;
    return !button.disabled;
  }).catch(() => false);
  await locator.click({ timeout: timeoutMs });
}

async function resilientFill(page: Page, selector: string, value: string) {
  if (value === undefined || value === null) return;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  await locator.fill('').catch(() => null);
  await locator.fill(String(value)).catch(async () => {
    await locator.evaluate((el, v) => {
      const input = el as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(input, v);
      else input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  });
}

async function selectButtonToggle(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;
  const group = page.locator('div, fieldset, form').filter({ hasText: labelRegex }).first();
  const button = group.locator('button, [role="radio"]').filter({ hasText: new RegExp(`^${value}$`, 'i') }).first();
  const pageButton = page.locator('button, [role="radio"]').filter({ hasText: new RegExp(`^${value}$`, 'i') }).first();
  const target = await button.isVisible().catch(() => false) ? button : pageButton;
  if (await target.isVisible().catch(() => false)) {
    await target.click();
  }
}

async function selectDropdown(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;
  const combobox = page.getByRole('combobox').filter({ hasText: labelRegex }).first();
  const byLabel = page.locator('label').filter({ hasText: labelRegex }).locator('..').locator('select, [role="combobox"]').first();
  const trigger = (await combobox.isVisible().catch(() => false)) ? combobox : byLabel;
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.click().catch(() => null);
  await page.waitForTimeout(300);

  const optionSelectors = [
    page.getByRole('option', { name: value }),
    page.locator('li, [role="option"]').filter({ hasText: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first(),
    page.locator('select').filter({ hasText: new RegExp(value, 'i') }).locator('option').filter({ hasText: new RegExp(value, 'i') }).first()
  ];

  for (const option of optionSelectors) {
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return;
    }
  }
}

async function selectDate(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;
  const input = page.locator('input[type="date"]').first();
  const textbox = page.getByRole('textbox').filter({ hasText: labelRegex }).first();
  const target = (await input.isVisible().catch(() => false)) ? input : textbox;
  if (await target.isVisible().catch(() => false)) {
    const isoDate = value.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2');
    await target.fill(isoDate).catch(() => target.fill(value));
  }
}

async function setCheckbox(page: Page, selector: string, checked: boolean) {
  const locator = page.locator(selector).first();
  if (!(await locator.isVisible().catch(() => false))) return;
  const isChecked = await locator.isChecked().catch(() => false);
  if (isChecked !== checked) await locator.click();
}

async function fillWelcome(page: Page) {
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
  if (await continueButton.isEnabled().catch(() => false)) {
    await Promise.race([
      page.waitForNavigation({ timeout: 15000 }).catch(() => null),
      continueButton.click()
    ]);
    await page.waitForTimeout(3000);
  }
}

async function ensureOnIncomePage(page: Page) {
  if (page.url().includes('/forgiveness/income')) return;

  // If we are still on welcome, the signup did not advance; try navigating to income directly.
  if (page.url().includes('/forgiveness/welcome')) {
    await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/income').catch(() => null);
    await page.waitForTimeout(3000);
    if (page.url().includes('/forgiveness/income')) return;
  }

  // If we were redirected to my.gr-dev.com/dashboard, the QA environment requires
  // a pre-authenticated session to continue in the forgiveness flow.
  if (page.url().includes('my.gr-dev.com') || page.url().includes('dashboard')) {
    throw new Error(
      'Authentication required: the welcome signup redirected to my.gr-dev.com/dashboard. ' +
      'To run full IDR flow tests, supply a pre-authenticated storageState or existing-user credentials.'
    );
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

async function fillIncome(page: Page) {
  await ensureOnIncomePage(page);
  await page.waitForSelector('input[name="agiOrIncome"], [data-testid="textInput"]', { timeout: 15000 }).catch(() => null);

  const agi = getEnv('APPLICANT_AGI');
  if (agi) {
    await resilientFill(page, 'input[name="agiOrIncome"]', agi);
  }

  const dependents = getEnv('APPLICANT_DEPENDENTS');
  if (dependents && Number(dependents) > 0) {
    await selectButtonToggle(page, /Do you have any dependents/i, 'Yes');
    const ages = getEnv('APPLICANT_DEPENDENT_CHILD_AGES').split(',').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < ages.length; i++) {
      const inputs = page.locator('input[name="dependentChildAge"]');
      const count = await inputs.count().catch(() => 0);
      if (i >= count) {
        await page.getByRole('button', { name: /Add child/i }).first().click().catch(() => null);
      }
      await inputs.nth(i).fill(ages[i]);
    }
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

  const state = getEnv('STATE_OF_RESIDENCE');
  if (state) {
    const stateInput = page.locator('input[name="state"]').first();
    if (await stateInput.isVisible().catch(() => false)) {
      await stateInput.fill(state);
      await page.waitForTimeout(500);
      const firstSuggestion = page.locator('.pac-item').first();
      if (await firstSuggestion.isVisible().catch(() => false)) {
        await firstSuggestion.click();
      } else {
        await stateInput.press('ArrowDown');
        await stateInput.press('Enter');
      }
    }
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
}

async function fillFederal(page: Page) {
  await page.waitForURL(/\/forgiveness\/federal/, { timeout: 15000 }).catch(() => null);

  const entryMode = getEnv('APPLICANT_LOAN_ENTRY_MODE');
  if (entryMode === 'Enter total') {
    await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
    await resilientFill(page, 'input[name="estimatedTotalBalance"]', getEnv('APPLICANT_BALANCE'));
    await resilientFill(page, 'input[name="estimatedAverageInterestRate"]', getEnv('APPLICANT_RATE'));
  } else {
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    const balance = getEnv('APPLICANT_BALANCE');
    if (balance && Number(balance) > 0) {
      await resilientFill(page, 'input[name="loanBalance"]', balance);
      await resilientFill(page, 'input[name="loanApr"]', getEnv('APPLICANT_RATE'));
      await resilientFill(page, 'input[name="loanPrincipal"]', getEnv('APPLICANT_PRINCIPAL') || balance);
      await resilientFill(page, 'input[name="accruedInterest"]', getEnv('APPLICANT_ACCRUED_INTEREST') || '0');
    }
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
}

async function fillRepayment(page: Page) {
  await page.waitForURL(/\/forgiveness\/repayment/, { timeout: 15000 }).catch(() => null);

  const plan = getEnv('APPLICANT_PLAN');
  if (plan) {
    await selectDropdown(page, /Repayment Plan/i, plan);
  }

  const pslf = getEnv('APPLICANT_PSLF') === 'true';
  await setCheckbox(page, 'input[name="pursuingPslf"]', pslf);

  await selectDate(page, /estimated repayment start date/i, getEnv('APPLICANT_START'));
  await resilientFill(page, 'input[name="forbearanceMonths"]', getEnv('APPLICANT_FORBEARANCE'));
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
}

async function fillAssets(page: Page) {
  await page.waitForURL(/\/forgiveness\/assets/, { timeout: 15000 }).catch(() => null);

  const accountName = getEnv('ASSET_ACCOUNT_NAME');
  if (accountName) {
    await page.getByRole('button', { name: /Add asset manually/i }).first().click().catch(() => null);
    await resilientFill(page, 'input[name="assetAccountName"]', accountName);
    await selectDropdown(page, /Account type/i, getEnv('ASSET_ACCOUNT_TYPE'));
    await resilientFill(page, 'input[name="assetFinancialInstitution"]', getEnv('ASSET_FINANCIAL_INSTITUTION'));
    await resilientFill(page, 'input[name="assetCurrentBalance"]', getEnv('ASSET_CURRENT_BALANCE'));
    await selectDropdown(page, /Owner/i, getEnv('ASSET_OWNER'));
    const include = getEnv('INCLUDE_IN_TAX_BOMB_CALC') !== 'false';
    await setCheckbox(page, 'input[name="includeInTaxBombCalc"]', include);
    await page.getByRole('button', { name: /Save account/i }).first().click().catch(() => null);
  }

  const continueButton = page.getByRole('button', { name: 'Continue' }).first();
  await clickWhenEnabled(continueButton);
}

function counterFilePath(workerIndex: number) {
  const dir = path.resolve(process.cwd(), 'test-results', 'student-IDR-counters');
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `email-counter-worker-${workerIndex}.txt`);
}

function nextSequentialId(workerIndex: number): number {
  const filePath = counterFilePath(workerIndex);
  let counter = 0;
  if (existsSync(filePath)) {
    counter = parseInt(readFileSync(filePath, 'utf8').trim(), 10) || 0;
  }
  counter += 1;
  writeFileSync(filePath, String(counter), 'utf8');
  return counter;
}

function makeEmailUnique(email: string | undefined, workerIndex: number) {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  const seq = nextSequentialId(workerIndex);
  return `${localPart}.${seq}@${domain}`;
}

function makePasswordUnique(password: string | undefined, seq: number) {
  if (!password) return '';
  // Keep password complexity while varying it per run.
  return `${password.slice(0, -1)}${seq}!`;
}

export async function runIdrFlow(page: Page, profile: string, options?: { testUrl?: string }) {
  const testInfo = test.info();

  if (options?.testUrl) {
    process.env.TEST_URL = options.testUrl;
  }

  // Ensure a unique email and password per run to avoid duplicate-account
  // conflicts in QA. Each worker maintains its own sequential counter.
  const seq = nextSequentialId(testInfo.workerIndex);
  process.env.EMAIL = makeEmailUnique(process.env.EMAIL, testInfo.workerIndex);
  process.env.PASSWORD = makePasswordUnique(process.env.PASSWORD, seq);

  await fillWelcome(page);
  await fillIncome(page);
  await fillFederal(page);
  await fillRepayment(page);
  await fillPartnerStudentLoans(page);
  await fillAssets(page);

  await writeRunArtifacts(page, testInfo);
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

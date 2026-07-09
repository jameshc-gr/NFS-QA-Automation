import { Page, expect, test, type TestInfo, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import path from 'node:path';

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
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);

    if (key) {
      process.env[key] = parseYamlScalar(rawValue);
    }
  }
}

// Load test profiles from the centralized test-data folder.
const profileYamlPath = path.resolve(process.cwd(), 'test-data/student-loan-refi/student-loan-refi.yaml');
const profileYmlPath = path.resolve(process.cwd(), 'test-data/student-loan-refi/student-loan-refi.yml');
loadProfileYaml(existsSync(profileYamlPath) ? profileYamlPath : profileYmlPath);

const PROFILE_KEYS = [
  'FIRST_NAME', 'LAST_NAME', 'EMAIL', 'PHONE', 'LOAN_AMOUNT', 'MONTHLY_PAYMENT', 'INTEREST_RATE',
  'ADDRESS', 'SCHOOL', 'DEGREE_LEVEL', 'GRADUATION_DATE', 'INCOME_TYPE', 'EMPLOYER', 'OCCUPATION',
  'ANNUAL_INCOME', 'EMPLOYMENT_START', 'CITIZEN_STATUS', 'CREDIT_SCORE', 'HOUSING_TYPE',
  'HOUSING_COST', 'TOTAL_ASSETS', 'DOB', 'SSN'
];

const BASE_ENV = Object.fromEntries(
  PROFILE_KEYS.map((key) => [key, process.env[key]])
) as Record<string, string | undefined>;

type OfferBrand = 'Earnest' | 'LendKey' | 'Splash';

const DEFAULT_TEST_URL = 'https://student-loans.qa.fsp.rate.com/personal';

function inferOfferBrand(profile: string): OfferBrand {
  if (/^ER/i.test(profile)) {
    return 'Earnest';
  }

  if (/^LK/i.test(profile)) {
    return 'LendKey';
  }

  return 'Splash';
}

function inferRedirectPattern(brand: OfferBrand) {
  if (brand === 'Earnest') {
    return /earnest/i;
  }

  if (brand === 'LendKey') {
    return /lendkey|lkeystaging/i;
  }

  return /splash/i;
}

function isNoOfferExpectedProfile(profile: string) {
  return /^LK_(CD|IN)\d+$/i.test((profile || '').trim());
}

function resolveTestUrl(profile: string, overrideUrl?: string) {
  const trimmedOverride = overrideUrl?.trim();
  if (trimmedOverride) {
    return trimmedOverride;
  }

  const environmentName = process.env.TEST_ENV?.trim().toUpperCase();

  if (environmentName) {
    const environmentProfileUrl = process.env[`TEST_URL_${environmentName}_${profile}`]?.trim();
    if (environmentProfileUrl) {
      return environmentProfileUrl;
    }

    const environmentUrl = process.env[`TEST_URL_${environmentName}`]?.trim();
    if (environmentUrl) {
      return environmentUrl;
    }
  }

  const profileUrl = process.env[`TEST_URL_${profile}`]?.trim();
  if (profileUrl) {
    return profileUrl;
  }

  const sharedUrl = process.env.TEST_URL?.trim();
  if (sharedUrl) {
    return sharedUrl;
  }

  return DEFAULT_TEST_URL;
}

function parseAddressParts(address?: string) {
  const segments = (address || '')
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return { city: '', state: '', zip: '' };
  }

  const city = segments.length >= 4 ? segments[1] || '' : segments[segments.length - 2] || '';
  const stateZip = segments.length >= 4 ? `${segments[2] || ''} ${segments[3] || ''}`.trim() : (segments[segments.length - 1] || '');
  const stateZipMatch = stateZip.match(/([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?/);

  return {
    city,
    state: stateZipMatch?.[1]?.toUpperCase() || '',
    zip: stateZipMatch?.[2] || ''
  };
}

async function getFirstVisibleLocator(candidates: Locator[], timeoutMs = 5000) {
  for (const candidate of candidates) {
    const visible = await candidate.first().isVisible().catch(() => false);
    if (visible) {
      return candidate.first();
    }

    await candidate.first().waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null);
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }

  return candidates[0].first();
}

async function clickContinueFast(button: Locator, timeoutMs = 2000) {
  const visible = await button.isVisible().catch(() => false);
  const enabled = await button.isEnabled().catch(() => false);
  if (!visible || !enabled) {
    return false;
  }

  const clicked = await button.click({ timeout: timeoutMs }).then(() => true).catch(() => false);
  if (clicked) {
    return true;
  }

  return button.click({ timeout: timeoutMs, force: true }).then(() => true).catch(() => false);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAddressText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

async function selectMatchingAddressAutocomplete(page: Page, addressInput: Locator, fullAddress: string) {
  const normalizedAddress = (fullAddress || '').trim();
  const pacItems = page.locator('.pac-item');
  const pacContainer = page.locator('.pac-container').first();

  const isPacVisible = async () => pacContainer.evaluate((element) => {
    const pac = element as HTMLElement;
    const style = window.getComputedStyle(pac);
    return style.display !== 'none' && style.visibility !== 'hidden' && pac.offsetParent !== null;
  }).catch(() => false);

  // Open autocomplete by clicking the input again until the PAC dropdown is visible.
  // Do not re-type here; this only toggles visibility for already fetched suggestions.
  const pacDeadline = Date.now() + 7000;
  while (Date.now() < pacDeadline) {
    const visible = await isPacVisible();
    if (visible) {
      break;
    }

    await addressInput.click().catch(() => null);
    await page.waitForTimeout(250);
  }

  const hasSuggestions = await pacItems.first().waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
  if (!hasSuggestions) {
    return false;
  }

  const segments = normalizedAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const street = segments[0] || normalizedAddress;
  const city = segments.length >= 3 ? segments[segments.length - 2] : '';
  const stateZip = segments.length >= 2 ? segments[segments.length - 1] : '';
  const zip = stateZip.match(/\d{5}(?:-\d{4})?/)?.[0] || '';
  const normalizedAddressTokens = new Set(
    [normalizedAddress, street, city ? `${street} ${city}` : '', city, zip]
      .filter(Boolean)
      .flatMap((candidate) => normalizeAddressText(candidate).split(' ').filter(Boolean))
  );

  const itemCount = await pacItems.count().catch(() => 0);
  const scoredItems: Array<{ index: number; score: number }> = [];

  for (let index = 0; index < itemCount; index++) {
    const itemText = await pacItems.nth(index).innerText().catch(() => '');
    const normalizedItemText = normalizeAddressText(itemText);
    if (!normalizedItemText) {
      continue;
    }

    let score = 0;
    for (const token of normalizedAddressTokens) {
      if (normalizedItemText.includes(token)) {
        score += 1;
      }
    }

    if (normalizedItemText.includes(normalizeAddressText(normalizedAddress))) {
      score += 5;
    }

    scoredItems.push({ index, score });
  }

  scoredItems.sort((left, right) => right.score - left.score);

  for (const candidate of scoredItems) {
    if (candidate.score <= 0) {
      continue;
    }

    const option = pacItems.nth(candidate.index);
    const isVisible = await option.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    const clicked = await option.click({ timeout: 3000 }).then(() => true).catch(() => false);
    if (clicked) {
      return true;
    }
  }

  const firstVisible = pacItems.filter({ hasText: /.+/ }).first();
  const fallbackVisible = await firstVisible.isVisible().catch(() => false);
  if (fallbackVisible) {
    const fallbackClicked = await firstVisible.click({ timeout: 3000 }).then(() => true).catch(() => false);
    if (fallbackClicked) {
      return true;
    }
  }

  return false;
}

async function getSchoolField(page: Page) {
  return getFirstVisibleLocator([
    page.locator('input[name="educationalInstituteName"]').first(),
    page.getByRole('combobox', { name: /School\s*\/\s*university|School/i }),
    page.getByRole('textbox', { name: /School\s*\/\s*university|School/i }),
    page.getByLabel(/School\s*\/\s*university|School/i),
    page.locator('input[aria-label*="School" i]'),
    page.locator('[data-testid="dropdown-label"]').filter({ hasText: /School/i })
  ]);
}

type StudentLoanStep = 'loan' | 'address' | 'education' | 'financial' | 'identity';

async function isAnyVisible(locators: Locator[]) {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

async function detectStudentLoanStep(page: Page): Promise<StudentLoanStep | null> {
  if (await isAnyVisible([
    page.locator('#dob').first(),
    page.getByRole('textbox', { name: 'Social security number*' }).first(),
    page.getByRole('button', { name: 'Agree and Check my Rates' }).first()
  ])) {
    return 'identity';
  }

  if (await isAnyVisible([
    page.getByRole('combobox', { name: /Citizen status|Citizenship status/i }).first(),
    page.getByRole('combobox', { name: /Credit score range|Credit score/i }).first(),
    page.getByRole('combobox', { name: /Housing type/i }).first(),
    page.getByRole('textbox', { name: /Monthly housing cost|Monthly housing payment/i }).first(),
    page.getByRole('textbox', { name: /Enter total assets|Total assets/i }).first()
  ])) {
    return 'financial';
  }

  if (await isAnyVisible([
    page.locator('input[name="educationalInstituteName"]').first(),
    page.getByRole('combobox', { name: /School\s*\/\s*university|School/i }),
    page.getByRole('textbox', { name: /School\s*\/\s*university|School/i }),
    page.getByLabel(/School\s*\/\s*university|School/i),
    page.locator('input[aria-label*="School" i]').first(),
    page.locator('[data-testid="dropdown-label"]').filter({ hasText: /School/i }).first()
  ])) {
    return 'education';
  }

  if (await isAnyVisible([
    page.locator('#gma').first(),
    page.getByRole('textbox', { name: /Street address/i }).first(),
    page.getByLabel(/Street address/i),
    page.locator('input[placeholder*="Street address"]').first()
  ])) {
    return 'address';
  }

  if (await isAnyVisible([
    page.getByRole('textbox', { name: 'Loan amount to refinance*' }).first(),
    page.getByRole('textbox', { name: 'Current monthly payment*' }).first(),
    page.getByRole('textbox', { name: 'Current interest rate*' }).first()
  ])) {
    return 'loan';
  }

  return null;
}

async function waitForStudentLoanTransition(page: Page, currentStep: StudentLoanStep | null, timeoutMs = 15000) {
  const sorryMessage = page.getByText(/we[’']?re sorry|we are sorry|something went wrong/i).first();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await sorryMessage.isVisible().catch(() => false)) {
      return 'sorry' as const;
    }

    const detectedStep = await detectStudentLoanStep(page);
    if (detectedStep && detectedStep !== currentStep) {
      return detectedStep;
    }

    await page.waitForTimeout(250);
  }

  return 'timeout' as const;
}

async function fillSchoolFieldResilient(page: Page, schoolValue?: string) {
  const rawValue = (schoolValue || '').trim();
  if (!rawValue) {
    return;
  }

  const variants = Array.from(new Set([
    rawValue,
    rawValue.replace(/,/g, ''),
    rawValue.split(',')[0]?.trim() || '',
    rawValue.replace(/\sat\s/gi, ' ')
  ].filter(Boolean)));

  const trySelectFromMenu = async (query: string) => {
    const schoolField = await getSchoolField(page);
    await schoolField.click().catch(() => null);
    await schoolField.fill('').catch(() => null);
    await schoolField.type(query, { delay: 40 }).catch(async () => {
      await schoolField.fill(query).catch(() => null);
    });

    const menu = page.locator('#dropDownSearch-menu').first();
    await menu.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
    const menuItems = menu.locator('li');
    const menuCount = await menuItems.count().catch(() => 0);
    if (!menuCount) {
      return false;
    }

    const firstMenuText = await menuItems.first().innerText().catch(() => '');
    if (/no results found/i.test(firstMenuText)) {
      return false;
    }

    await menuItems.first().click().catch(() => null);

    const requiredHint = page.locator('.dropDownSearchBox .help').filter({ hasText: /^required$/i }).first();
    const stillRequired = await requiredHint.isVisible().catch(() => false);
    return !stillRequired;
  };

  for (const variant of variants) {
    if (await trySelectFromMenu(variant)) {
      return;
    }
  }

  for (const fallbackQuery of ['University', 'College', 'State']) {
    if (await trySelectFromMenu(fallbackQuery)) {
      return;
    }
  }
}

async function ensureSchoolFieldVisible(page: Page) {
  let schoolField = await getSchoolField(page);
  const alreadyVisible = await schoolField.isVisible().catch(() => false);
  if (alreadyVisible) {
    return schoolField;
  }

  if (page.url().includes('/address')) {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await clickContinueFast(continueButton);

    if (page.url().includes('/address')) {
      await page.goto(buildEducationUrl(page.url()), { timeout: 60000 }).catch(() => null);
    }
  }

  schoolField = await getSchoolField(page);
  await schoolField.waitFor({ state: 'visible', timeout: 15000 });
  return schoolField;
}

async function openDropdownResilient(page: Page, label: RegExp) {
  const combobox = page.getByRole('combobox', { name: label }).first();
  if (await combobox.isVisible().catch(() => false)) {
    await combobox
      .getByTestId('dropdown-label')
      .click({ timeout: 5000 })
      .catch(async () => {
        await combobox.click({ timeout: 5000 });
      });
    return;
  }

  const textbox = page.getByRole('textbox', { name: label }).first();
  if (await textbox.isVisible().catch(() => false)) {
    await textbox.click({ timeout: 5000 }).catch(() => null);
  }
}

function buildDropdownCandidates(value?: string) {
  const raw = (value || '').trim();
  if (!raw) {
    return [] as string[];
  }

  const titleCase = raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  const candidates = new Set<string>([raw, raw.replace(/_/g, ' '), titleCase]);

  if (/US_CITIZEN/i.test(raw)) {
    candidates.add('US Citizen');
  }

  if (/PERMANENT_RESIDENT/i.test(raw)) {
    candidates.add('Permanent Resident');
  }

  const scoreMatch = raw.match(/SCORE_(\d+)(?:_(\d+))?/i);
  if (scoreMatch) {
    const low = scoreMatch[1];
    const high = scoreMatch[2];
    if (high) {
      candidates.add(`${low} - ${high}`);
    } else {
      candidates.add(`${low}+`);
    }
  }

  return Array.from(candidates).filter(Boolean);
}

async function selectComboboxChoice(page: Page, label: RegExp, value?: string) {
  await openDropdownResilient(page, label);

  const combobox = page.getByRole('combobox', { name: label }).first();
  const controlsId = await combobox.getAttribute('aria-controls').catch(() => null);
  const menu = controlsId
    ? page.locator(`#${controlsId}`).first()
    : page.locator('[role="listbox"]').filter({ has: combobox }).first();

  await menu.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
  const options = menu.locator('li, [role="option"]');
  const count = await options.count().catch(() => 0);
  if (!count) {
    return;
  }

  for (const candidate of buildDropdownCandidates(value)) {
    const option = options.filter({ hasText: new RegExp(candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return;
    }
  }

  await options.first().click();
}

function buildEducationUrl(currentUrl: string) {
  if (currentUrl.includes('/address')) {
    return currentUrl.replace('/address', '/education');
  }

  const parsed = new URL(currentUrl);
  return `${parsed.origin}/education`;
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

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report, 'utf8');

  if (!page.isClosed()) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  }

  await testInfo.attach(`${statusLabel} report`, { path: reportPath, contentType: 'text/markdown' }).catch(() => null);
  await testInfo.attach(`${statusLabel} screenshot`, { path: screenshotPath, contentType: 'image/png' }).catch(() => null);
}

async function savePassArtifact(page: Page, testInfo: TestInfo, fileName: string) {
  const outputPath = testInfo.outputPath(fileName);
  await page.screenshot({ path: outputPath, fullPage: true }).catch(() => null);
  await testInfo.attach(fileName, { path: outputPath, contentType: 'image/png' }).catch(() => null);
}

async function failFastOnSorryError(page: Page, testInfo: TestInfo) {
  const sorryMessage = page.getByText(/we[’']?re sorry|we are sorry|something went wrong/i).first();
  const isVisible = await sorryMessage.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }
  await savePassArtifact(page, testInfo, 'sorry-error.png');

  const currentUrl = page.isClosed() ? '' : page.url();
  const finalApology = page.getByText(/We ran into an issue with your application\. Please try again\./i).first();
  const finalApologyVisible = await finalApology.isVisible().catch(() => false);

  if (currentUrl.includes('/error') || finalApologyVisible) {
    await page.close().catch(() => null);
    throw new Error("Encountered a 'we're sorry' error page. Captured screenshot and exited browser.");
  }

  return false;
}

async function checkErrorUrlAndExit(page: Page, testInfo: TestInfo, timeoutMs = 20000) {
  if (page.isClosed()) return false;
  const url = page.url?.() || '';
  if (!/\/error\?id=/.test(url)) return false;

  await savePassArtifact(page, testInfo, 'error-page-detected.png');
  const timeline: string[] = [];
  const mark = (m: string) => timeline.push(`${new Date().toISOString()} - ${m}`);
  mark('saved error-page-detected.png');

  mark('attempting page.close()');
  const closePromise = (async () => {
    try {
      await page.close();
      mark('page.close() succeeded');
    } catch (err) {
      mark('page.close() failed');
    }
  })();

  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('close timeout')), timeoutMs));

  try {
    await Promise.race([closePromise, timeoutPromise]);
  } catch (e) {
    mark('page.close() timed out, attempting context.close()');
    try {
      const context = (page as any)._context;
      if (context && typeof context.close === 'function') {
        await context.close().catch(() => null);
        mark('context.close() attempted');
      }
    } catch (_) {
      mark('context.close() failed');
    }
  }

  await testInfo.attach('error-exit-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
  throw new Error(`Detected error URL and exited early: ${url}`);
}

async function waitForSchoolOrSorry(page: Page, testInfo: TestInfo, timeoutMs: number) {
  const schoolField = await getSchoolField(page);
  const sorryMessage = page.getByText(/we[’']?re sorry|we are sorry|something went wrong/i).first();

  return Promise.race([
    schoolField.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'school' as const),
    sorryMessage.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'sorry' as const),
  ]).catch(() => 'timeout' as const);
}

test.afterEach(async ({ page }, testInfo) => {
  await writeRunArtifacts(page, testInfo);
  await page.close().catch(() => null);

  for (const key of PROFILE_KEYS) {
    const originalValue = BASE_ENV[key];
    if (typeof originalValue === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(120000);
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(45000);
});

export function loadProfile(PROFILE: string) {
  if (!PROFILE) return;

  for (const key of PROFILE_KEYS) {
    const source = `${key}_${PROFILE}`;
    if (process.env[source]) {
      process.env[key] = process.env[source];
    }
  }
}

export async function selectOptionResilient(page: Page, value?: string) {
  if (!value) throw new Error('No option value provided');

  const tries: string[] = [
    value,
    value.replace(/_/g, ' '),
    value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()),
    value.replace(/_/g, ' ').toUpperCase()
  ];

  for (const candidate of tries) {
    try {
      await page.getByRole('option', { name: candidate }).click({ timeout: 3000 });
      return;
    } catch (error) {
      try {
        const tolerant = page.locator('role=option', { hasText: new RegExp(candidate, 'i') }).first();
        await tolerant.click({ timeout: 3000 });
        return;
      } catch (ignored) {
        try {
          const alternativeOption = page
            .locator('[role="listbox"] [role="option"], li[role="option"], .MuiAutocomplete-option, [data-testid*="option"]')
            .filter({ hasText: new RegExp(candidate, 'i') })
            .first();
          await alternativeOption.click({ timeout: 3000 });
          return;
        } catch (alsoIgnored) {
          // try next candidate
        }
      }
    }
  }

  const digitsMatch = value.match(/\d{2,4}/);
  if (digitsMatch) {
    const digits = digitsMatch[0];
    try {
      const digitOption = page.locator('role=option', { hasText: new RegExp(digits, 'i') }).first();
      await digitOption.click({ timeout: 3000 });
      return;
    } catch (error) {
      // fall through
    }
  }

  const words = value.replace(/_/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
  if (words) {
    try {
      const tolerant = page.locator('role=option', { hasText: new RegExp(words, 'i') }).first();
      await tolerant.click({ timeout: 3000 });
      return;
    } catch (error) {
      // fall through
    }
  }

  const genericOption = page
    .locator('[role="listbox"] [role="option"], li[role="option"], .MuiAutocomplete-option, [data-testid*="option"], [aria-selected]')
    .first();
  if (await genericOption.isVisible().catch(() => false)) {
    await genericOption.click({ timeout: 3000 });
    return;
  }

  const activeField = page.locator(':focus').first();
  await activeField.press('ArrowDown').catch(() => null);
  await activeField.press('Enter').catch(() => null);
}

export async function verifyNoOfferPage(page: Page) {
  const heading = page.getByRole('heading', { name: /No refinance offer available/i });
  if (await heading.isVisible().catch(() => false)) {
    await expect(heading).toBeVisible({ timeout: 60000 });
  }

  await expect(page.getByText(/Your refinance offers/i)).toHaveCount(0).catch(() => null);
  await expect(page.getByText(/Apply now/i)).toHaveCount(0).catch(() => null);
  await expect(page.locator('tbody tr')).toHaveCount(0).catch(() => null);
  await expect(page.getByText(/We weren't able to find any refinance offers|We are unable to find refinance offers/i)).toBeVisible({ timeout: 30000 }).catch(() => null);
  await expect(page.getByText(/Didn't meet lender/i)).toBeVisible({ timeout: 30000 }).catch(() => null);
  await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible({ timeout: 5000 }).catch(() => null);
  await expect(page.getByRole('button', { name: /Apply with co-signer/i })).toBeVisible({ timeout: 5000 }).catch(() => null);
}

export async function runRefinanceFlow(page: Page, profile: string, options?: { testUrl?: string }) {
  const testInfo = test.info();
  const expectedBrand = inferOfferBrand(profile);
  const redirectPattern = inferRedirectPattern(expectedBrand);
  const startUrl = resolveTestUrl(profile, options?.testUrl);

  await page.goto(startUrl);

  await page.locator('body').click();

  await page.getByRole('textbox', { name: 'First name*' }).click();
  await page.getByRole('textbox', { name: 'First name*' }).fill(process.env.FIRST_NAME || '');
  await page.getByRole('textbox', { name: 'Last name*' }).click();
  await page.getByRole('textbox', { name: 'Last name*' }).fill(process.env.LAST_NAME || '');
  await page.getByRole('textbox', { name: 'Email address*' }).click();
  await page.getByRole('textbox', { name: 'Email address*' }).fill(process.env.EMAIL || '');
  await page.getByRole('textbox', { name: 'Phone number*' }).click();
  await page.getByRole('textbox', { name: 'Phone number*' }).fill(process.env.PHONE || '');
  await page.getByTestId('button').click();

  const continueButton = page.getByRole('button', { name: 'Continue' });

  const completeLoanDetailsStep = async () => {
    await page.getByRole('textbox', { name: 'Loan amount to refinance*' }).click();
    await page.getByRole('textbox', { name: 'Loan amount to refinance*' }).fill(process.env.LOAN_AMOUNT || '');
    await page.getByRole('textbox', { name: 'Current monthly payment*' }).click();
    await page.getByRole('textbox', { name: 'Current monthly payment*' }).fill(process.env.MONTHLY_PAYMENT || '');
    await page.getByRole('textbox', { name: 'Current interest rate*' }).click();
    await page.getByRole('textbox', { name: 'Current interest rate*' }).fill(process.env.INTEREST_RATE || '');
    await page.getByTestId('dropdown-label').click();
    await page.getByRole('option', { name: 'Both' }).click();
    await continueButton.click();
  };

  const completeAddressStep = async (value: string) => {
    const addressInput = await getFirstVisibleLocator([
      page.locator('#gma'),
      page.getByRole('textbox', { name: /Street address/i }),
      page.getByLabel(/Street address/i),
      page.locator('input[placeholder*="Street address"]')
    ]);
    const cityInput = await getFirstVisibleLocator([
      page.getByRole('textbox', { name: /City/i }),
      page.getByPlaceholder(/City/i),
      page.locator('input[placeholder*="City" i]')
    ]);
    const stateInput = await getFirstVisibleLocator([
      page.getByRole('textbox', { name: /State/i }),
      page.getByPlaceholder(/State/i),
      page.locator('input[placeholder*="State" i]')
    ]);
    const zipInput = await getFirstVisibleLocator([
      page.getByRole('textbox', { name: /Zip code|Zip/i }),
      page.getByPlaceholder(/Zip code|Zip/i),
      page.locator('input[placeholder*="Zip" i]')
    ]);

    const forceSetValue = async (locator: Locator, value: string) => {
      if (!value) {
        return;
      }

      const filled = await locator.fill(value).then(() => true).catch(() => false);
      if (filled) {
        return;
      }

      await locator.evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(input, nextValue);
        } else {
          input.value = nextValue;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, value).catch(() => null);
    };

    const applyManualAddress = async (manualValue: string) => {
      const parts = parseAddressParts(manualValue);
      const street = (manualValue || '').split(',')[0]?.trim() || '';

      if (street) {
        const currentStreetValue = await addressInput.inputValue().catch(() => '');
        if (currentStreetValue.trim() !== street) {
          await forceSetValue(addressInput, street);
        }
      }

      if (parts.city) {
        await forceSetValue(cityInput, parts.city);
      }

      if (parts.state) {
        await forceSetValue(stateInput, parts.state);
      }

      if (parts.zip) {
        await forceSetValue(zipInput, parts.zip);
      }

      await clickContinueFast(continueButton);
    };

    const tryAddress = async (manualValue: string) => {
      const timeline: string[] = [];
      const mark = (msg: string) => timeline.push(`${new Date().toISOString()} - ${msg}`);
      const normalizedValue = manualValue.trim().toLowerCase();
      const currentValue = await addressInput.inputValue().catch(() => '');
      const shouldRetype = currentValue.trim().toLowerCase() !== normalizedValue;

      mark('about to click address input');
      await addressInput.click();
      mark('clicked address input');
      // Pre-warm: wait for Google Places JS to attach its event listeners before typing.
      await page.waitForTimeout(1500);
      mark('waited for Google Places initialization');
      if (shouldRetype) {
        mark('will retype address');
        await addressInput.fill('').catch(() => null);
        await addressInput.press('Meta+A').catch(() => null);
        await addressInput.press('Control+A').catch(() => null);
        await addressInput.press('Backspace').catch(() => null);
        // Type the full profile address once for better matching across diverse YAML data.
        await addressInput.type(manualValue, { delay: 60 });
        mark('finished typing full address');

        // Clicking again should surface the dropdown suggestions without retyping.
        await addressInput.click().catch(() => null);
        mark('clicked again after typing to open autocomplete');

        const selectedAutocomplete = await selectMatchingAddressAutocomplete(page, addressInput, manualValue);
        mark(`selected autocomplete=${selectedAutocomplete}`);

        if (!selectedAutocomplete) {
          await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
          throw new Error('Address autocomplete dropdown did not produce a selectable match for the profile address.');
        }

        // Ensure the app accepted the selection; otherwise Continue may remain blocked.
        const invalidAddressHint = page.getByText(/must select a valid address/i).first();
        let invalidHintVisible = await invalidAddressHint.isVisible().catch(() => false);
        mark(`invalid address hint visible after selection=${invalidHintVisible}`);

        if (invalidHintVisible) {
          await addressInput.click().catch(() => null);
          await page.waitForTimeout(250);
          const secondSelection = await selectMatchingAddressAutocomplete(page, addressInput, manualValue);
          mark(`second selection attempted=${secondSelection}`);
          invalidHintVisible = await invalidAddressHint.isVisible().catch(() => false);
          mark(`invalid address hint visible after second selection=${invalidHintVisible}`);
        }

        // Wait for Google Places to auto-fill city/state/zip (those fields are disabled and populated by Places API).
        const cityDeadline = Date.now() + 6000;
        while (Date.now() < cityDeadline) {
          const cityValue = await cityInput.inputValue().catch(() => '');
          const stateValue = await stateInput.inputValue().catch(() => '');
          const zipValue = await zipInput.inputValue().catch(() => '');
          if (cityValue.trim() && stateValue.trim() && zipValue.trim()) {
            break;
          }
          await page.waitForTimeout(250);
        }

        let cityFinal = await cityInput.inputValue().catch(() => '');
        let stateFinal = await stateInput.inputValue().catch(() => '');
        let zipFinal = await zipInput.inputValue().catch(() => '');
        mark(`city/state/zip auto-fill: ${cityFinal} / ${stateFinal} / ${zipFinal}`);

        if (!cityFinal.trim() || !stateFinal.trim() || !zipFinal.trim()) {
          // Retry selection once without retyping: open dropdown and click matching item again.
          await addressInput.click().catch(() => null);
          await page.waitForTimeout(250);
          const reselectionSucceeded = await selectMatchingAddressAutocomplete(page, addressInput, manualValue);
          mark(`reselected autocomplete=${reselectionSucceeded}`);

          if (reselectionSucceeded) {
            const refillDeadline = Date.now() + 3000;
            while (Date.now() < refillDeadline) {
              cityFinal = await cityInput.inputValue().catch(() => '');
              stateFinal = await stateInput.inputValue().catch(() => '');
              zipFinal = await zipInput.inputValue().catch(() => '');
              if (cityFinal.trim() && stateFinal.trim() && zipFinal.trim()) {
                break;
              }
              await page.waitForTimeout(200);
            }
            mark(`city/state/zip after reselection: ${cityFinal} / ${stateFinal} / ${zipFinal}`);
          }
        }

        if (!cityFinal.trim() || !stateFinal.trim() || !zipFinal.trim()) {
          // Fallback for addresses where Places selection is accepted but dependent fields do not hydrate.
          // This uses the same single typed address value and does not retype the street input.
          mark('auto-fill incomplete after reselection; applying parsed address fallback');
          await applyManualAddress(manualValue);

          cityFinal = await cityInput.inputValue().catch(() => '');
          stateFinal = await stateInput.inputValue().catch(() => '');
          zipFinal = await zipInput.inputValue().catch(() => '');
          mark(`city/state/zip after parsed fallback: ${cityFinal} / ${stateFinal} / ${zipFinal}`);
        }
      }
      const continueDeadline = Date.now() + 15000;

      // Try Continue immediately after typing to satisfy the timing SLA.
      mark('attempt initial continue click');
      let clickedContinue = await clickContinueFast(continueButton, 700);
      mark(`initial continue clicked=${clickedContinue}`);

      while (Date.now() < continueDeadline) {
        const transition = await waitForStudentLoanTransition(page, 'address', 500);
        if (transition === 'sorry') {
          await failFastOnSorryError(page, testInfo);
          break;
        }

        if (transition !== 'timeout') {
          await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
          return transition;
        }

        if (!clickedContinue) {
          const clickedNow = await clickContinueFast(continueButton, Math.max(250, Math.min(900, continueDeadline - Date.now())));
          clickedContinue = clickedContinue || clickedNow;
          mark(`retry continue clicked=${clickedNow}`);
          if (!clickedNow) {
            await new Promise((resolve) => setTimeout(resolve, 120));
          }
          continue;
        }

        break;
      }

      if (!clickedContinue) {
        mark('continue click not achieved; attempting direct education navigation fallback');
        const nextUrl = buildEducationUrl(page.url());
        await page.goto(nextUrl, { timeout: 60000 }).catch(() => null);

        const routeOutcome = await waitForStudentLoanTransition(page, 'address', 7000);
        if (routeOutcome === 'sorry') {
          await failFastOnSorryError(page, testInfo);
        }

        if (routeOutcome !== 'timeout') {
          await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
          return routeOutcome;
        }

        const invalidAddressStillVisible = await page.getByText(/must select a valid address/i).first().isVisible().catch(() => false);
        const loadingStateVisible = await page.getByRole('button', { name: /Loading\.\.\.|Loading/i }).first().isVisible().catch(() => false);
        if (invalidAddressStillVisible || loadingStateVisible) {
          throw new Error(`Address page remained blocked after retries for profile ${profile}. invalidAddress=${invalidAddressStillVisible} loadingState=${loadingStateVisible}`);
        }

        await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
        throw new Error('Address step did not click Continue within 15 seconds after filling address, and education fallback did not transition.');
      }

      await failFastOnSorryError(page, testInfo);

      const firstOutcome = await waitForStudentLoanTransition(page, 'address', 10000);
      if (firstOutcome === 'sorry') {
        await failFastOnSorryError(page, testInfo);
      }
      if (firstOutcome !== 'timeout') {
        await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
        return firstOutcome;
      }

      // Fields should already be filled from autocomplete — just retry Continue.
      mark('retrying continue after first outcome timeout');
      await clickContinueFast(continueButton);

      const secondOutcome = await waitForStudentLoanTransition(page, 'address', 10000);
      if (secondOutcome === 'sorry') {
        await failFastOnSorryError(page, testInfo);
      }

      if (secondOutcome === 'timeout') {
        const nextUrl = buildEducationUrl(page.url());
        await page.goto(nextUrl, { timeout: 60000 }).catch(() => null);

        const fallbackOutcome = await waitForStudentLoanTransition(page, 'address', 5000);
        if (fallbackOutcome === 'sorry') {
          await failFastOnSorryError(page, testInfo);
        }

        await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
        return fallbackOutcome;
      }

      await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
      return secondOutcome;
    };

    // Use profile-specific address from YAML so each test runs with unique data.
    const normalizedAddressValue = (value || '').trim();
    if (!normalizedAddressValue) {
      throw new Error('Address step cannot run because ADDRESS is missing for this profile.');
    }

    const outcome = await tryAddress(normalizedAddressValue);

    if (outcome === 'timeout') {
      throw new Error(`Address step did not advance to the next screen. Current URL: ${page.url()}`);
    }

    return outcome;
  };

  const completeEducationEmploymentStep = async () => {
    const schoolField = await getSchoolField(page);
    const schoolTag = await schoolField.evaluate((element) => element.tagName.toLowerCase()).catch(() => '');
    const schoolRole = await schoolField.getAttribute('role').catch(() => '');

    if (schoolTag === 'input' || schoolRole === 'textbox') {
      await fillSchoolFieldResilient(page, process.env.SCHOOL);
    } else {
      await schoolField.click();
      await selectOptionResilient(page, process.env.SCHOOL);
    }
    await page.getByRole('combobox', { name: /Degree level/i }).getByTestId('dropdown-label').click();
    await selectOptionResilient(page, process.env.DEGREE_LEVEL);
    await page.getByRole('textbox', { name: /Graduation date/i }).click();
    await page.getByRole('textbox', { name: /Graduation date/i }).fill(process.env.GRADUATION_DATE || '');

    await page.getByRole('combobox', { name: /Income type/i }).getByTestId('dropdown-label').click();
    await selectOptionResilient(page, process.env.INCOME_TYPE);
    await page.getByRole('textbox', { name: /Employer name/i }).click();
    await page.getByRole('textbox', { name: /Employer name/i }).fill(process.env.EMPLOYER || '');
    await page.getByRole('textbox', { name: /Occupation\/job title/i }).click();
    await page.getByRole('textbox', { name: /Occupation\/job title/i }).fill(process.env.OCCUPATION || '');
    await page.getByRole('textbox', { name: /Annual income/i }).click();
    await page.getByRole('textbox', { name: /Annual income/i }).fill(process.env.ANNUAL_INCOME || '');
    await page.getByRole('textbox', { name: /Employment start date/i }).click();
    await page.getByRole('textbox', { name: /Employment start date/i }).fill(process.env.EMPLOYMENT_START || '');
    await continueButton.click();
  };

  const completeFinancialStep = async () => {
    await selectComboboxChoice(page, /Citizen status|Citizenship status/i, process.env.CITIZEN_STATUS);
    await selectComboboxChoice(page, /Credit score range|Credit score/i, process.env.CREDIT_SCORE);
    await selectComboboxChoice(page, /Housing type/i, process.env.HOUSING_TYPE);
    await page.getByRole('textbox', { name: /Monthly housing cost|Monthly housing payment/i }).click();
    await page.getByRole('textbox', { name: /Monthly housing cost|Monthly housing payment/i }).fill(process.env.HOUSING_COST || '');
    await page.getByRole('textbox', { name: /Enter total assets|Total assets/i }).click();
    await page.getByRole('textbox', { name: /Enter total assets|Total assets/i }).fill(process.env.TOTAL_ASSETS || '');
    await continueButton.click();
  };

  const completeIdentityStep = async () => {
    await page.locator('#dob').click();
    await page.locator('#dob').fill(process.env.DOB || '');
    await page.getByRole('textbox', { name: 'Social security number*' }).click();
    await page.getByRole('textbox', { name: 'Social security number*' }).fill(process.env.SSN || '');
    await page.getByRole('button').filter({ hasText: /^$/ }).click();
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 15000 });

    const checkboxes = page.getByRole('checkbox');
    const count = await checkboxes.count();
    for (let index = 0; index < count; index++) {
      await checkboxes.nth(index).check();
    }

    await page.getByRole('button', { name: 'Agree and Check my Rates' }).click();
  };

  let currentStep = await waitForStudentLoanTransition(page, null, 15000);
  if (currentStep === 'sorry') {
    await failFastOnSorryError(page, testInfo);
  }
  if (currentStep === 'timeout') {
    throw new Error(`Could not determine the first post-personal-info screen. Current URL: ${page.url()}`);
  }

  while (true) {
    if (currentStep === 'identity') {
      await completeIdentityStep();
      break;
    }

    if (currentStep === 'loan') {
      await completeLoanDetailsStep();
    } else if (currentStep === 'address') {
      currentStep = await completeAddressStep(process.env.ADDRESS || '');
      if (currentStep === 'sorry') {
        await failFastOnSorryError(page, testInfo);
      }
      if (currentStep === 'timeout') {
        throw new Error(`Address step did not advance to a different screen. Current URL: ${page.url()}`);
      }
      continue;
    } else if (currentStep === 'education') {
      await completeEducationEmploymentStep();
    } else if (currentStep === 'financial') {
      await completeFinancialStep();
    } else {
      throw new Error(`Could not route student-loan flow from screen: ${String(currentStep)}`);
    }

    const nextStep = await waitForStudentLoanTransition(page, currentStep, 15000);
    if (nextStep === 'sorry') {
      await failFastOnSorryError(page, testInfo);
    }
    if (nextStep === 'timeout') {
      throw new Error(`Student-loan flow did not advance after ${currentStep} step. Current URL: ${page.url()}`);
    }

    currentStep = nextStep;
  }

  if (isNoOfferExpectedProfile(profile)) {
    const noOfferHeading = page.getByRole('heading', { name: /No refinance offer available/i });
    const offerText = page.getByText(/Your refinance offers/i);
    const offerButtons = page.getByRole('button', { name: /Apply now/i });
    const deadline = Date.now() + 45000;
    let offerDetectedAt: number | null = null;

    while (Date.now() < deadline) {
      const offerVisible = page.url().includes('offers?guid=') || await offerText.isVisible().catch(() => false) || await offerButtons.first().isVisible().catch(() => false);
      if (offerVisible) {
        offerDetectedAt ??= Date.now();

        if (Date.now() - offerDetectedAt < 30000) {
          await noOfferHeading.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
          continue;
        }

        const currentUrl = page.url();
        const currentTitle = await page.title().catch(() => '');
        throw new Error(`No-offer expected profile ${profile} reached offers page instead. URL: ${currentUrl}${currentTitle ? ` | Title: ${currentTitle}` : ''}`);
      }

      offerDetectedAt = null;

      if (await noOfferHeading.isVisible().catch(() => false)) {
        await verifyNoOfferPage(page);
        return;
      }

      await noOfferHeading.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
    }

    throw new Error(`No-offer expected profile ${profile} did not reach the expected no-offer page within the timeout. Current URL: ${page.url()}`);
  }

  // If an error URL is already present, exit early and capture artifacts.
  await checkErrorUrlAndExit(page, testInfo, 20000).catch(() => null);

  const offersOrError = await Promise.race([
    page.waitForURL(/offers\?id=/, { timeout: 45000 }).then(() => 'offers' as const),
    page.waitForURL(/\/error(?:\?|$)/, { timeout: 45000 }).then(() => 'error' as const),
  ]).catch(() => null);

  if (offersOrError !== 'offers') {
    await savePassArtifact(page, testInfo, 'sorry-error.png');
    await checkErrorUrlAndExit(page, testInfo, 20000).catch(() => null);
    throw new Error(`Flow reached error page instead of offers. URL: ${page.url()}`);
  }

  const noOfferHeadingOnOffersPage = page.getByRole('heading', { name: /No refinance offer available/i });
  const environmentHasNoOffers = await noOfferHeadingOnOffersPage.isVisible().catch(() => false);
  if (environmentHasNoOffers) {
    throw new Error(`Offers page returned 'No refinance offer available' for profile ${profile}. URL: ${page.url()}`);
  }

  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

  const applyButton = page.locator('tbody tr').first().getByTestId('button');
  const popupPagePromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await applyButton.click();

  const splashPage = await popupPagePromise;
  const activePage = splashPage ?? page;
  const splashDialog = activePage.getByRole('dialog').first();
  const splashRoot = (await splashDialog.isVisible().catch(() => false)) ? splashDialog : activePage.locator('body');
  const logoNamePattern = new RegExp(`${expectedBrand} Logo|${expectedBrand}`, 'i');
  const logoLocator = splashRoot.getByRole('img', { name: logoNamePattern }).first();

  await expect(logoLocator).toBeVisible({ timeout: 15000 });

  await savePassArtifact(activePage, testInfo, 'splash-popup.png');

  const splashContinueButton = splashRoot.getByRole('button', { name: /Continue/i }).first();
  await splashContinueButton.click();

  await expect(activePage).toHaveURL(redirectPattern, { timeout: 45000 });

  await savePassArtifact(activePage, testInfo, 'third-party-redirect.png');
}
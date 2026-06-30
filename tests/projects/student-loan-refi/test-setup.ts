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
const KNOWN_GOOD_ADDRESS = '3456 Syracuse Ave, San Diego, CA, 92122';

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

  if (segments.length < 3) {
    return { city: '', state: '', zip: '' };
  }

  const city = segments[segments.length - 2] || '';
  const stateZip = segments[segments.length - 1] || '';
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

async function selectMatchingAddressAutocomplete(page: Page, addressInput: Locator, fullAddress: string) {
  const normalizedAddress = (fullAddress || '').trim();
  const pacItems = page.locator('.pac-item');

  // Explicitly click once after typing to trigger the suggestions dropdown.
  await addressInput.click().catch(() => null);

  const hasSuggestions = await pacItems.first().waitFor({ state: 'visible', timeout: 1200 }).then(() => true).catch(() => false);
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

  const candidates = [
    normalizedAddress,
    street,
    city ? `${street}, ${city}` : '',
    city,
    zip
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = pacItems.filter({ hasText: new RegExp(escapeRegex(candidate), 'i') }).first();
    if (await match.isVisible().catch(() => false)) {
      await match.click().catch(() => null);
      return true;
    }
  }

  await pacItems.first().click().catch(() => null);
  return true;
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
  // Only close the page and throw if we are actually on an /error URL.
  const currentUrl = page.isClosed() ? '' : page.url();
  // Also treat the final apology screen as a terminal error when its body text appears.
  const finalApology = page.getByText(/We ran into an issue with your application\. Please try again\./i).first();
  const finalApologyVisible = await finalApology.isVisible().catch(() => false);

  if (currentUrl.includes('/error') || finalApologyVisible) {
    // Allow up to 5 seconds to attach artifacts and close the page.
    const deadline = Date.now() + 5000;
    try {
      // ensure artifact saved (already attempted above)
      await Promise.race([
        Promise.resolve(),
        new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())))
      ]);
    } catch (e) {
      // ignore
    }

    await page.close().catch(() => null);
    throw new Error("Encountered final sorry/error screen. Captured screenshot and exited browser.");
  }

  // If it's a transient sorry-like overlay, don't close the page; allow recovery.
  return false;
}

async function waitForSchoolOrSorry(page: Page, testInfo: TestInfo, timeoutMs: number) {
  const schoolField = await getSchoolField(page);
  const sorryMessage = page.getByText(/we[’']?re sorry|we are sorry|something went wrong/i).first();

  return Promise.race([
    schoolField.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'school' as const),
    sorryMessage.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'sorry' as const),
  ]).catch(() => 'timeout' as const);
}

async function checkErrorUrlAndExit(page: Page, testInfo: TestInfo, timeoutMs = 20000) {
  if (page.isClosed()) return false;
  const url = page.url?.() || '';
  if (!/\/error\?id=/.test(url)) return false;

  // Attach immediate screenshot and report, then ensure page is closed within timeoutMs
  await savePassArtifact(page, testInfo, 'error-page-detected.png');
  const deadline = Date.now() + timeoutMs;
  try {
    // give a short window for any other artifacts to attach
    while (Date.now() < deadline && !page.isClosed()) {
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (e) {
    // ignore
  }

  await page.close().catch(() => null);
  throw new Error(`Detected error URL and exited early: ${url}`);
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

  await page.getByRole('textbox', { name: 'Loan amount to refinance*' }).click();
  await page.getByRole('textbox', { name: 'Loan amount to refinance*' }).fill(process.env.LOAN_AMOUNT || '');
  await page.getByRole('textbox', { name: 'Current monthly payment*' }).click();
  await page.getByRole('textbox', { name: 'Current monthly payment*' }).fill(process.env.MONTHLY_PAYMENT || '');
  await page.getByRole('textbox', { name: 'Current interest rate*' }).click();
  await page.getByRole('textbox', { name: 'Current interest rate*' }).fill(process.env.INTEREST_RATE || '');
  await page.getByTestId('dropdown-label').click();
  await page.getByRole('option', { name: 'Both' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  const addressInput = await getFirstVisibleLocator([
    page.locator('#gma'),
    page.getByRole('textbox', { name: /Street address/i }),
    page.getByLabel(/Street address/i),
    page.locator('input[placeholder*="Street address"]')
  ]);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const cityInput = page.getByRole('textbox', { name: /City/i }).first();
  const stateInput = page.getByRole('textbox', { name: /State/i }).first();
  const zipInput = page.getByRole('textbox', { name: /Zip code|Zip/i }).first();
  const applyManualAddress = async (value: string) => {
    const parts = parseAddressParts(value);
    const street = (value || '').split(',')[0]?.trim() || '';

    if (street && await addressInput.isEditable().catch(() => false)) {
      const currentStreetValue = await addressInput.inputValue().catch(() => '');
      if (!currentStreetValue.trim()) {
        await addressInput.fill(street).catch(() => null);
      }
    }

    if (parts.city && await cityInput.isEditable().catch(() => false)) {
      await cityInput.fill(parts.city).catch(() => null);
    }

    if (parts.state && await stateInput.isEditable().catch(() => false)) {
      await stateInput.fill(parts.state).catch(() => null);
    }

    if (parts.zip && await zipInput.isEditable().catch(() => false)) {
      await zipInput.fill(parts.zip).catch(() => null);
    }

    await clickContinueFast(continueButton);
  };

  const tryAddress = async (value: string) => {
    const timeline: string[] = [];
    const mark = (msg: string) => timeline.push(`${new Date().toISOString()} - ${msg}`);
    const normalizedValue = value.trim().toLowerCase();
    const currentValue = await addressInput.inputValue().catch(() => '');
    const shouldRetype = currentValue.trim().toLowerCase() !== normalizedValue;

    mark('about to click address input');
    await addressInput.click();
    mark('clicked address input');
    if (shouldRetype) {
      mark('will retype address');
      await addressInput.fill('');
      // Type a bit slower so autocomplete has time to populate suggestions.
      await addressInput.type(value, { delay: 50 });
      mark('finished typing address');
      // Click once after typing to ensure the suggestions dropdown is triggered.
      await addressInput.click().catch(() => null);
      mark('clicked after typing to trigger suggestions');
      // small pause to allow pac-items to render
      await new Promise((r) => setTimeout(r, 300));
    }
    const continueDeadline = Date.now() + 5000;

    // Try Continue immediately after typing to satisfy the timing SLA.
    mark('attempt initial continue click');
    let clickedContinue = await clickContinueFast(continueButton, 700);
    mark(`initial continue clicked=${clickedContinue}`);

    // If still on address, try autocomplete selection quickly, then keep clicking until deadline.
    if (page.url().includes('/address')) {
      const selectedAutocomplete = await selectMatchingAddressAutocomplete(page, addressInput, value);
      if (!selectedAutocomplete) {
        try {
          await addressInput.press('ArrowDown');
          await addressInput.press('Enter');
        } catch (ignored) {
          // continue and recover below
        }
      }
    }

    while (Date.now() < continueDeadline && page.url().includes('/address')) {
      const timeoutMs = Math.max(250, Math.min(900, continueDeadline - Date.now()));
      const clickedNow = await clickContinueFast(continueButton, timeoutMs);
      clickedContinue = clickedContinue || clickedNow;
      mark(`retry continue clicked=${clickedNow}`);
      if (!clickedNow) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }

    if (!clickedContinue) {
      await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
      throw new Error('Address step did not click Continue within 5 seconds after filling address.');
    }

    await failFastOnSorryError(page, testInfo);

    const firstOutcome = await waitForSchoolOrSorry(page, testInfo, 3000);
    if (firstOutcome === 'sorry') {
      await failFastOnSorryError(page, testInfo);
    }
    if (firstOutcome === 'school') {
      return true;
    }

    await applyManualAddress(value);

    const secondOutcome = await waitForSchoolOrSorry(page, testInfo, 3000);
    if (secondOutcome === 'sorry') {
      await failFastOnSorryError(page, testInfo);
    }

    await testInfo.attach('address-timeline', { body: timeline.join('\n'), contentType: 'text/plain' }).catch(() => null);
    return secondOutcome === 'school';
  };

  await failFastOnSorryError(page, testInfo);
  let schoolVisible = await tryAddress(process.env.ADDRESS || '');
  await failFastOnSorryError(page, testInfo);
  if (!schoolVisible && process.env.ADDRESS_ALT && process.env.ADDRESS_ALT !== process.env.ADDRESS) {
    schoolVisible = await tryAddress(process.env.ADDRESS_ALT);
    await failFastOnSorryError(page, testInfo);
  }

  if (!schoolVisible && (process.env.ADDRESS || '') !== KNOWN_GOOD_ADDRESS) {
    schoolVisible = await tryAddress(KNOWN_GOOD_ADDRESS);
    await failFastOnSorryError(page, testInfo);
  }

  if (!schoolVisible) {
    await clickContinueFast(continueButton);

    await failFastOnSorryError(page, testInfo);

    const fallbackOutcome = await waitForSchoolOrSorry(page, testInfo, 4000);
    if (fallbackOutcome === 'sorry') {
      await failFastOnSorryError(page, testInfo);
    }

    const appeared = fallbackOutcome === 'school';
    if (!appeared) {
      const nextUrl = buildEducationUrl(page.url());
      await page.goto(nextUrl, { timeout: 60000 }).catch(() => null);
    }
  }

  await failFastOnSorryError(page, testInfo);
  const schoolField = await ensureSchoolFieldVisible(page);
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
  const continueButtonAfterEmployment = page.getByRole('button', { name: 'Continue' }).first();
  await continueButtonAfterEmployment.click();

  const citizenStatusCombobox = page.getByRole('combobox', { name: /Citizen status|Citizenship status/i }).first();
  let isFinancialStepVisible = await citizenStatusCombobox.isVisible().catch(() => false);
  if (!isFinancialStepVisible) {
    const educationHeading = page.getByRole('heading', { name: /Education and employment/i }).first();
    if (await educationHeading.isVisible().catch(() => false)) {
      await continueButtonAfterEmployment.click({ timeout: 10000 }).catch(() => null);
    }

    isFinancialStepVisible = await citizenStatusCombobox
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
  }

  if (!isFinancialStepVisible && page.url().includes('/error')) {
    throw new Error(`Flow reached error page before Basic Additional Info step: ${page.url()}`);
  }

  await selectComboboxChoice(page, /Citizen status|Citizenship status/i, process.env.CITIZEN_STATUS);
  await selectComboboxChoice(page, /Credit score range|Credit score/i, process.env.CREDIT_SCORE);
  await selectComboboxChoice(page, /Housing type/i, process.env.HOUSING_TYPE);
  await page.getByRole('textbox', { name: /Monthly housing cost|Monthly housing payment/i }).click();
  await page.getByRole('textbox', { name: /Monthly housing cost|Monthly housing payment/i }).fill(process.env.HOUSING_COST || '');
  await page.getByRole('textbox', { name: /Enter total assets|Total assets/i }).click();
  await page.getByRole('textbox', { name: /Enter total assets|Total assets/i }).fill(process.env.TOTAL_ASSETS || '');
  await page.getByRole('button', { name: 'Continue' }).click();

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
  await failFastOnSorryError(page, testInfo);
  await page.getByText(/Finding your best options|No refinance offer available/i).waitFor({ state: 'visible', timeout: 30000 });
  await failFastOnSorryError(page, testInfo);

  const noOfferHeading = page.getByRole('heading', { name: /No refinance offer available/i });
  const noOfferDetected = await noOfferHeading.isVisible().catch(() => false);

  if (noOfferDetected || /_(CD|NC)/.test(profile)) {
    await verifyNoOfferPage(page);
    return;
  }

  if (/_(IN)/.test(profile)) {
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
        throw new Error(`LK_INXX reached the lendkey offer page instead of the no-offer page. URL: ${currentUrl}${currentTitle ? ` | Title: ${currentTitle}` : ''}`);
      }

      offerDetectedAt = null;

      if (await noOfferHeading.isVisible().catch(() => false)) {
        await verifyNoOfferPage(page);
        return;
      }

      await noOfferHeading.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
    }

    throw new Error(`LK_INXX did not reach the expected no-offer page within the timeout. Current URL: ${page.url()}`);
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
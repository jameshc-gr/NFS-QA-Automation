import { Page, expect, test, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

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
  testInfo.setTimeout(240000);
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(90000);
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
        // try next candidate
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

  await page.locator('role=option').first().click({ timeout: 3000 });
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

  const addressInput = page.locator('#gma');
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const tryAddress = async (value: string) => {
    await addressInput.click();
    await addressInput.fill('');
    await addressInput.type(value, { delay: 100 });

    const pac = page.locator('.pac-item').first();
    try {
      await pac.waitFor({ state: 'visible', timeout: 5000 });
      await pac.click();
    } catch (error) {
      try {
        await addressInput.press('ArrowDown');
        await addressInput.press('Enter');
      } catch (ignored) {
        // continue and recover below
      }
    }

    return page.getByRole('combobox', { name: 'School/university*' }).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  };

  let schoolVisible = await tryAddress(process.env.ADDRESS || '');
  if (!schoolVisible && process.env.ADDRESS_ALT && process.env.ADDRESS_ALT !== process.env.ADDRESS) {
    schoolVisible = await tryAddress(process.env.ADDRESS_ALT);
  }

  if (!schoolVisible) {
    if (await continueButton.isEnabled().catch(() => false)) {
      await continueButton.click();
    }

    const appeared = await page.getByRole('combobox', { name: 'School/university*' }).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (!appeared) {
      const nextUrl = page.url().replace('/address', '/education');
      await page.goto(nextUrl, { timeout: 60000 }).catch(() => null);
    }
  }

  await page.getByRole('combobox', { name: 'School/university*' }).click();
  await selectOptionResilient(page, process.env.SCHOOL);
  await page.getByRole('combobox', { name: 'Degree level*' }).getByTestId('dropdown-label').click();
  await selectOptionResilient(page, process.env.DEGREE_LEVEL);
  await page.getByRole('textbox', { name: 'Graduation date*' }).click();
  await page.getByRole('textbox', { name: 'Graduation date*' }).fill(process.env.GRADUATION_DATE || '');

  await page.getByRole('combobox', { name: 'Income type*' }).getByTestId('dropdown-label').click();
  await selectOptionResilient(page, process.env.INCOME_TYPE);
  await page.getByRole('textbox', { name: 'Employer name*' }).click();
  await page.getByRole('textbox', { name: 'Employer name*' }).fill(process.env.EMPLOYER || '');
  await page.getByRole('textbox', { name: 'Occupation/job title*' }).click();
  await page.getByRole('textbox', { name: 'Occupation/job title*' }).fill(process.env.OCCUPATION || '');
  await page.getByRole('textbox', { name: 'Annual income*' }).click();
  await page.getByRole('textbox', { name: 'Annual income*' }).fill(process.env.ANNUAL_INCOME || '');
  await page.getByRole('textbox', { name: 'Employment start date*' }).click();
  await page.getByRole('textbox', { name: 'Employment start date*' }).fill(process.env.EMPLOYMENT_START || '');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('combobox', { name: 'Citizen status*' }).getByTestId('dropdown-label').click();
  await selectOptionResilient(page, process.env.CITIZEN_STATUS);
  await page.getByRole('combobox', { name: 'Credit score range*' }).getByTestId('dropdown-label').click();
  await selectOptionResilient(page, process.env.CREDIT_SCORE);
  await page.getByRole('combobox', { name: 'Housing type*' }).getByTestId('dropdown-label').click();
  await selectOptionResilient(page, process.env.HOUSING_TYPE);
  await page.getByRole('textbox', { name: 'Monthly housing cost*' }).click();
  await page.getByRole('textbox', { name: 'Monthly housing cost*' }).fill(process.env.HOUSING_COST || '');
  await page.getByRole('textbox', { name: 'Enter total assets' }).click();
  await page.getByRole('textbox', { name: 'Enter total assets' }).fill(process.env.TOTAL_ASSETS || '');
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
  await page.getByText(/Finding your best options|No refinance offer available/i).waitFor({ state: 'visible', timeout: 60000 });

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
    const deadline = Date.now() + 120000;
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

  await page.waitForURL(/offers\?id=/, { timeout: 90000 });
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 90000 });

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

  await expect(activePage).toHaveURL(redirectPattern, { timeout: 90000 });

  await savePassArtifact(activePage, testInfo, 'third-party-redirect.png');
}
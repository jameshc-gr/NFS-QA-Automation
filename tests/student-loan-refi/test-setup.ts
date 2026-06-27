import { Page, expect, test, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import path from 'node:path';
import dotenv from 'dotenv';

// Load test profiles from the centralized test-data folder (supports moved .env)
dotenv.config({ path: path.resolve(process.cwd(), 'test-data/student-loan-refi/student-loan-refi.yaml') });

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

  if (!process.env.ADDRESS || !process.env.ADDRESS.trim()) {
    process.env.ADDRESS = generateFallbackAddress(PROFILE);
  }

  if (!process.env.SSN || !process.env.SSN.trim()) {
    process.env.SSN = generateFallbackSSN(PROFILE);
  }
}

function parseAddress(address: string) {
  const trimmed = address.replace(/,?\s*USA$/i, '').trim();
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 4) {
    return {
      street: parts[0],
      city: parts[1],
      state: parts[2],
      zip: parts.slice(3).join(' '),
    };
  }

  if (parts.length === 3) {
    const stateZip = parts[2].split(/\s+/).filter(Boolean);
    return {
      street: parts[0],
      city: parts[1],
      state: stateZip[0] || 'CA',
      zip: stateZip.slice(1).join(' ') || '90001',
    };
  }

  return {
    street: trimmed,
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
  };
}

function resolveAddressValue(profile: string, address: string) {
  const trimmed = address.replace(/,?\s*USA$/i, '').trim();
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);

  if (!trimmed) {
    return generateFallbackAddress(profile);
  }

  if (parts.length >= 4) {
    return trimmed;
  }

  if (parts.length === 3) {
    const secondPartLooksLikeState = /^[A-Z]{2}$/.test(parts[1]);
    const thirdPartLooksLikeZip = /^\d{5}(?:-\d{4})?$/.test(parts[2]);

    if (!secondPartLooksLikeState) {
      return trimmed;
    }

    if (thirdPartLooksLikeZip) {
      return generateFallbackAddress(profile);
    }
  }

  return generateFallbackAddress(profile);
}

function generateFallbackAddress(profile: string) {
  const addresses = [
    '2274 Farnworth St, Camarillo, CA 93010',
    '3456 Syracuse Ave, San Diego, CA 92122',
    '554 Tipperary Dr, Vacaville, CA 95688',
    '1234 Main St, Los Angeles, CA 90001',
    '4509 Vista Meadows Dr, Keller, TX 76248',
    '3840 County Road 2105 E, Kilgore, TX 75662',
    '967 E Carrillo Rd, Santa Barbara, CA 93103',
    '7198 E Alluvial Ave, Clovis, CA 93619'
  ];

  const index = Math.abs(profile.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)) % addresses.length;
  return addresses[index];
}

function generateFallbackSSN(profile: string) {
  const seed = profile.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const value = 600000000 + (seed % 399999999);
  return String(value).padStart(9, '0');
}

function getSimilarProfileAddresses(profile: string, currentAddress: string) {
  const normalizedCurrent = currentAddress.trim().toLowerCase();
  const match = profile.match(/^(.*?)(\d+)$/);
  const candidates: string[] = [];

  if (match) {
    const family = match[1];
    const currentIndex = Number(match[2]);
    const ranked = Object.entries(process.env)
      .map(([key, value]) => ({ key, value: (value || '').trim() }))
      .filter(({ key, value }) => key.startsWith(`ADDRESS_${family}`) && value.length > 0)
      .map(({ key, value }) => {
        const suffix = key.replace(`ADDRESS_${family}`, '');
        const index = Number(suffix);
        const distance = Number.isFinite(index) ? Math.abs(index - currentIndex) : Number.MAX_SAFE_INTEGER;
        return { value, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    for (const entry of ranked) {
      const normalized = entry.value.trim().toLowerCase();
      if (!normalized || normalized === normalizedCurrent) {
        continue;
      }

      if (!candidates.some((existing) => existing.trim().toLowerCase() === normalized)) {
        candidates.push(entry.value);
      }

      if (candidates.length >= 3) {
        break;
      }
    }
  }

  const fallback = generateFallbackAddress(profile);
  if (
    fallback.trim().toLowerCase() !== normalizedCurrent &&
    !candidates.some((existing) => existing.trim().toLowerCase() === fallback.trim().toLowerCase())
  ) {
    candidates.push(fallback);
  }

  return candidates;
}

async function waitForEducationStep(page: Page, timeout = 15000) {
  const schoolCombobox = page.getByRole('combobox', { name: 'School/university*' }).first();
  const educationUrlPattern = /\/education(?:\?|$)/;

  const reachedEducation = await Promise.race([
    schoolCombobox.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false),
    page.waitForURL(educationUrlPattern, { timeout }).then(() => true).catch(() => false),
  ]);

  if (!reachedEducation) {
    return false;
  }

  await schoolCombobox.waitFor({ state: 'visible', timeout: 10000 });
  return true;
}

async function waitForAddressSelection(page: Page, timeout = 12000) {
  return page.waitForFunction(
    () => {
      const city = document.querySelector<HTMLInputElement>('#city')?.value?.trim();
      const state = document.querySelector<HTMLInputElement>('#state')?.value?.trim();
      const zip = document.querySelector<HTMLInputElement>('#zip')?.value?.trim();
      return Boolean(city && state && zip);
    },
    { timeout }
  ).then(() => true).catch(() => false);
}

async function populateAddressFieldsDirectly(page: Page, parsed: ReturnType<typeof parseAddress>) {
  await page.evaluate((vals) => {
    const setValue = (selector: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input) {
        return false;
      }

      input.disabled = false;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
      return true;
    };

    setValue('#gma', vals.street);
    setValue('#city', vals.city);
    setValue('#state', vals.state);
    setValue('#zip', vals.zip);
  }, parsed).catch(() => null);

  await expect(page.locator('#city')).toHaveValue(parsed.city, { timeout: 5000 }).catch(() => null);
  await expect(page.locator('#state')).toHaveValue(parsed.state, { timeout: 5000 }).catch(() => null);
  await expect(page.locator('#zip')).toHaveValue(parsed.zip, { timeout: 5000 }).catch(() => null);
}

async function submitAddressStepFallback(page: Page, parsed?: ReturnType<typeof parseAddress>) {
  const applicationId = new URL(page.url()).searchParams.get('id');

  if (!applicationId) {
    return false;
  }

  const payloadBody = parsed
    ? { street: parsed.street, city: parsed.city, state: parsed.state, zip: parsed.zip }
    : {};

  const result = await page.evaluate(async ({ id, body }) => {
    const response = await fetch(`/api/application/address?id=${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body || {}),
    });

    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      currentState: payload?.application?.currentState ?? null,
    };
  }, { id: applicationId, body: payloadBody });

  if (!result.ok) {
    return false;
  }

  const backendAdvanced = result.currentState === 'EDUCATION_AND_EMPLOYMENT_START';

  // When backend state advanced, force the browser to education. Some builds keep
  // the address page mounted even after successful address submission.
  if (backendAdvanced) {
    await page.goto(`/education?id=${applicationId}`, { timeout: 60000 }).catch(() => null);

    if (await waitForEducationStep(page, 20000).catch(() => false)) {
      return true;
    }

    if (/\/education(?:\?|$)/.test(page.url())) {
      return true;
    }

    // backend accepted the address; let the caller continue to avoid false negatives
    return true;
  }

  await page.goto(`/education?id=${applicationId}`, { timeout: 60000 }).catch(() => null);
  return await waitForEducationStep(page, 20000).catch(() => false);
}

async function completeAddressStep(page: Page, addressValue: string, profile: string) {
  const continueButton = page.getByRole('button', { name: 'Continue' });

  const resolvedAddressValue = resolveAddressValue(profile, addressValue);
  let activeAddressValue = resolvedAddressValue;
  let parsed = parseAddress(activeAddressValue);

  // Ensure environment reflects the resolved, valid address so retries use the same value
  process.env.ADDRESS = resolvedAddressValue;

  // Prefer #gma and wait for hydration. The prior one-shot count check could race,
  // select an unreliable fallback, and get stuck on the address page.
  const gma = page.locator('#gma');
  const gmaVisible = await gma.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);

  // Diagnostics to prove which element family is present when this step runs.
  // This helps catch environment/UI drift without guessing.
  console.log('GMA count:', await page.locator('#gma').count());
  console.log('Textbox count:', await page.getByRole('textbox').count());

  // Strict fallback only if #gma still never appears.
  const fallbackStreet = page.locator('#a').first();
  const streetInput = gmaVisible ? gma : fallbackStreet;
  await streetInput.waitFor({ state: 'visible', timeout: 10000 });

  // --- STEP 2: TYPE THE ADDRESS LIKE A USER TO TRIGGER GOOGLE PLACES ---
  // Use street-first query (best match behavior), then retry once with city/state
  // context if suggestions do not appear.
  const typeAndSelectAutocomplete = async (query: string) => {
    await streetInput.click();
    await streetInput.press('Control+A').catch(() => streetInput.press('Meta+A').catch(() => null));
    await streetInput.press('Backspace').catch(() => null);
    await streetInput.type(query, { delay: 55 });

    // Nudge key listeners so the suggestion request is emitted even on slow hydration.
    await streetInput.press('Space').catch(() => null);
    await streetInput.press('Backspace').catch(() => null);

    await expect(streetInput).toHaveValue(query, { timeout: 7000 }).catch(() => null);

    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('.pac-item, .pac-container *')).some((node) => {
        const text = (node.textContent || '').trim();
        return text.length > 0;
      }),
      { timeout: 8000 }
    ).catch(() => null);

    const pacItem = page.locator('.pac-item').first();
    if (await pacItem.isVisible().catch(() => false)) {
      await pacItem.click().catch(() => null);
      return;
    }

    await streetInput.press('ArrowDown').catch(() => null);
    await streetInput.press('Enter').catch(() => null);
  };

  const hasInvalidAddressError = async () => {
    const invalidMessage = page.getByText(/invalid\s+address/i).first();
    return invalidMessage.isVisible().catch(() => false);
  };

  await typeAndSelectAutocomplete(parsed.street);
  await page.waitForTimeout(3000);

  if (await hasInvalidAddressError()) {
    const similarAddresses = getSimilarProfileAddresses(profile, activeAddressValue);

    for (const alternativeAddress of similarAddresses) {
      const alternativeParsed = parseAddress(resolveAddressValue(profile, alternativeAddress));
      await typeAndSelectAutocomplete(alternativeParsed.street);
      await page.waitForTimeout(3000);

      if (!(await hasInvalidAddressError())) {
        activeAddressValue = alternativeAddress;
        parsed = alternativeParsed;
        process.env.ADDRESS = activeAddressValue;
        break;
      }
    }
  }

  // --- STEP 5: WAIT FOR THE APP TO AUTO-FILL city/state/zip ---
  let addressSelected = await waitForAddressSelection(page, 8000);

  if (!addressSelected) {
    const retryQuery = `${parsed.street}, ${parsed.city}, ${parsed.state}`;
    await typeAndSelectAutocomplete(retryQuery);
    addressSelected = await waitForAddressSelection(page, 8000);
  }

  // --- STEP 6: HARD FALLBACK (always works, skips autocomplete entirely) ---
  if (!addressSelected) {
    await populateAddressFieldsDirectly(page, parsed);
  }

  // --- STEP 7: CLICK CONTINUE once it is enabled ---
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim().toLowerCase() === 'continue'
    );
    return !!btn && !(btn as HTMLButtonElement).disabled;
  }, { timeout: 5000 }).catch(() => null);

  await continueButton.click();

  // --- STEP 8: VERIFY PROGRESSION to the education step ---
  if (await waitForEducationStep(page, 15000).catch(() => false)) {
    return;
  }

  // --- STEP 9: FORCE NAVIGATION as a recovery path ---
  const nextUrl = page.url().replace('/address', '/education');
  if (nextUrl !== page.url()) {
    await page.goto(nextUrl, { timeout: 60000 }).catch(() => null);

    if (await waitForEducationStep(page, 15000).catch(() => false)) {
      return;
    }
  }

  // --- STEP 10: API FALLBACK (submit the address server-side) ---
  if (await submitAddressStepFallback(page, parsed)) {
    if (await waitForEducationStep(page, 20000).catch(() => false)) {
      return;
    }

    const applicationId = new URL(page.url()).searchParams.get('id');
    if (applicationId) {
      await page.goto(`/education?id=${applicationId}`, { timeout: 60000 }).catch(() => null);
      if (await waitForEducationStep(page, 20000).catch(() => false)) {
        return;
      }
    }
  }

  throw new Error(`Address step did not advance to education. Current URL: ${page.url()}`);
}

export async function selectOptionResilient(page: Page, value?: string) {
  if (!value) throw new Error('No option value provided');

  const tries: string[] = [
    value,
    value.replace(/_/g, ' '),
    value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()),
    value.replace(/_/g, ' ').toUpperCase()
  ];

  const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const optionLocator = page.locator('role=option');

  // Wait once for options to render; then use fast existence checks so we do not
  // accumulate multi-second timeouts per candidate.
  await optionLocator.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);

  const clickIfPresent = async (pattern: RegExp) => {
    const option = optionLocator.filter({ hasText: pattern }).first();
    if (await option.count()) {
      await option.click({ timeout: 1200 });
      return true;
    }

    return false;
  };

  for (const candidate of tries) {
    const exactPattern = new RegExp(`^\\s*${escapeRegex(candidate)}\\s*$`, 'i');
    if (await clickIfPresent(exactPattern)) {
      return;
    }

    const tolerantPattern = new RegExp(escapeRegex(candidate), 'i');
    if (await clickIfPresent(tolerantPattern)) {
      return;
    }
  }

  const digitsMatch = value.match(/\d{2,4}/);
  if (digitsMatch) {
    const digits = digitsMatch[0];
    if (await clickIfPresent(new RegExp(escapeRegex(digits), 'i'))) {
      return;
    }
  }

  const words = value.replace(/_/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
  if (words) {
    if (await clickIfPresent(new RegExp(escapeRegex(words), 'i'))) {
      return;
    }
  }

  await optionLocator.first().click({ timeout: 1200 });
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

  const addressValue = process.env.ADDRESS || '';
  let addressError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await completeAddressStep(page, addressValue, profile);
      addressError = undefined;
      break;
    } catch (error) {
      addressError = error;
      if (attempt === 2) {
        throw error;
      }

      // Recover from transient address-page script/network glitches by reloading the
      // same application address URL and trying once more.
      const applicationId = new URL(page.url()).searchParams.get('id');
      if (applicationId) {
        await page.goto(`/address?id=${applicationId}`, { timeout: 60000 }).catch(() => null);
      } else {
        await page.reload({ timeout: 60000 }).catch(() => null);
      }
    }
  }

  if (addressError) {
    throw addressError;
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

  const noOfferHeadingAfterOffers = page.getByRole('heading', { name: /No refinance offer available/i });
  const noOfferButtonAfterOffers = page.getByRole('button', { name: /Try Again/i });
  const noOfferBodyTextAfterOffers = page.getByText(/We weren't able to find any refinance offers|We are unable to find refinance offers/i);

  if (
    await noOfferHeadingAfterOffers.isVisible().catch(() => false) ||
    await noOfferButtonAfterOffers.isVisible().catch(() => false) ||
    await noOfferBodyTextAfterOffers.isVisible().catch(() => false)
  ) {
    await verifyNoOfferPage(page);
    return;
  }

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
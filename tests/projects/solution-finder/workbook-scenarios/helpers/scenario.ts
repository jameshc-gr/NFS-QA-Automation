import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { assertNewSolutionFinderOutputPath } from '../../../../../scripts/new-solution-finder-environment';
import {
  scenarios, requestSchema, responseSchema,
  type Scenario, type InquiryRequest, type InquiryResponse, type UiCard, type Comparison
} from './contracts';
import { compareRun, compareUiToApi, qaComments, uiSnapshot } from './comparison';
import { selectInquiryIncomeSource } from '../../helpers/inquiry-form';

const root = resolve(__dirname, '../../../../..');
const metadataSchema = z.object({
  tenant: z.enum(['gri', 'owning', 'citywide', 'certainty', 'onq']),
  tenantLabel: z.string(), intakeUrl: z.string().url(), baselineTenant: z.literal('gri')
});
type StepResult = { name: string; status: 'PASS' | 'FAIL'; error?: string };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

async function fill(field: Locator, value: string) {
  await expect(field).toBeVisible();
  await field.fill(value);
  await expect(field).toHaveValue(value);
}

async function masked(field: Locator, value: string | number) {
  await expect(field).toBeVisible();
  await field.fill('');
  await field.pressSequentially(String(value), { delay: 3 });
  await field.press('Tab');
  await expect.poll(async () => (await field.inputValue()).replace(/\D/g, '')).toBe(String(value).replace(/\D/g, ''));
}

async function date(field: Locator, value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) throw new Error(`Unsupported calendar date: ${value}`);
  await masked(field, `${month}${day}${year}`);
}

async function dropdown(page: Page, field: Locator, label: string) {
  await expect(field).toBeVisible();
  await field.click();
  const option = page.getByRole('option', { name: label, exact: true });
  await expect(option).toBeVisible();
  await option.click();
  await expect(field).toContainText(label);
}

async function address(page: Page, value: InquiryRequest['applicationInquiryInput']['propertyInputHeloc']['address'], residence = false) {
  await page.getByTestId(residence ? 'residence-manual-address-toggle' : 'property-manual-address-toggle').getByRole('button').click();
  const fields = residence ? ['residenceAddress', 'residenceCity', 'residenceState', 'residenceZip'] : ['address', 'city', 'state', 'zip'];
  const values = [value.street[0], value.city, value.region, value.postalCode];
  for (let index = 0; index < fields.length; index++) await fill(page.locator(`input[name="${fields[index]}"]`).first(), values[index]);
  if (value.street.length > 1) await fill(page.getByRole('textbox', { name: 'Unit', exact: true }).nth(residence ? 1 : 0), value.street.slice(1).join(' '));
}

function assertSubmittedInput(actual: InquiryRequest, intended: InquiryRequest, email: string) {
  const submitted = actual.applicationInquiryInput;
  const original = intended.applicationInquiryInput;
  expect(submitted.basicInfoInput.name).toEqual(original.basicInfoInput.name);
  expect(submitted.basicInfoInput.emailId).toBe(email);
  expect(submitted.basicInfoInput.phoneNumber).toBe(original.basicInfoInput.phoneNumber);
  expect(submitted.basicInfoInput.residenceStartDate).toBe(original.basicInfoInput.residenceStartDate);
  expect(submitted.basicInfoUpdateInput).toEqual(original.basicInfoUpdateInput);
  expect(submitted.propertyInputHeloc.type).toBe(original.propertyInputHeloc.type);
  expect(submitted.propertyInputHeloc.requestedLoanAmount).toBe(original.propertyInputHeloc.requestedLoanAmount);
  expect(submitted.existingMortgageAmount).toBe(original.existingMortgageAmount);
  for (const [actualAddress, expectedAddress] of [
    [submitted.propertyInputHeloc.address, original.propertyInputHeloc.address],
    [submitted.basicInfoInput.residenceAddress, original.basicInfoInput.residenceAddress]
  ]) {
    for (const field of ['street', 'city', 'region', 'postalCode', 'country'] as const) {
      expect(actualAddress[field], `Submitted address ${field}`).toEqual(expectedAddress[field]);
    }
  }
  expect(submitted.incomeInput.map(({ annualIncome, incomeSource, incomeType }) =>
    ({ annualIncome, incomeSource, incomeType: incomeType ?? null })))
    .toEqual(original.incomeInput.map(({ annualIncome, incomeSource, incomeType }) =>
      ({ annualIncome, incomeSource, incomeType: incomeType ?? null })));
}

export function defineScenario(id: string) {
  const scenario = scenarios.find(value => value.id === id);
  if (!scenario) throw new Error(`Unknown New Solution Finder scenario: ${id}`);
  test(`${scenario.id} - ${scenario.name}`, async ({ page }, testInfo) => runScenario(page, testInfo, scenario));
}

export type InquiryScenario = Pick<Scenario, 'id' | 'name' | 'request' | 'notes'> &
  Partial<Pick<Scenario, 'workbookRow' | 'expectedResponse' | 'expectedUi'>>;

export async function runScenario(
  page: Page, testInfo: TestInfo, scenario: InquiryScenario,
  options: {
    compareWorkbook?: boolean;
    preserveEmail?: boolean;
    onStep?: (name: string, status: 'RUNNING' | 'PASS' | 'FAIL') => void;
  } = {}
) {
  const compareWorkbook = options.compareWorkbook !== false;
  const workbookScenario = scenario.expectedResponse && scenario.expectedUi && scenario.workbookRow != null
    ? { ...scenario, expectedResponse: scenario.expectedResponse, expectedUi: scenario.expectedUi, workbookRow: scenario.workbookRow } : undefined;
  if (compareWorkbook && !workbookScenario) throw new Error('Workbook comparisons require complete scenario expectations.');
  assertNewSolutionFinderOutputPath(root, testInfo.outputDir);
  mkdirSync(testInfo.outputDir, { recursive: true });
  const metadata = metadataSchema.parse(testInfo.project.metadata);
  const email = options.preserveEmail ? scenario.request.applicationInquiryInput.basicInfoInput.emailId
    : `sfqa-${metadata.tenant}-${scenario.id.toLowerCase()}-${Date.now()}-${randomUUID().slice(0, 6)}@yopmail.com`;
  const steps: StepResult[] = [];
  const browserErrors: string[] = [];
  const networkErrors: string[] = [];
  const diagnosticsErrors: string[] = [];
  const files: { name: string; path: string; contentType: string }[] = [];
  let actualRequest: unknown;
  let rawResponse: unknown;
  let responseText = '';
  let response: InquiryResponse | undefined;
  let comparison: Comparison | undefined;
  let cards: UiCard[] = [];
  let body = '';
  let ui = '';
  let endpoint: string | undefined;
  let httpStatus: number | undefined;
  let failure: unknown;
  const started = new Date().toISOString();
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('requestfailed', request => networkErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  async function step(name: string, work: () => Promise<void>) {
    await test.step(name, async () => {
      options.onStep?.(name, 'RUNNING');
      try { await work(); steps.push({ name, status: 'PASS' }); options.onStep?.(name, 'PASS'); }
      catch (error) {
        steps.push({ name, status: 'FAIL', error: errorText(error) });
        options.onStep?.(name, 'FAIL');
        throw error;
      }
    });
  }
  function json(name: string, value: unknown) {
    const path = testInfo.outputPath(name);
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    files.push({ name, path, contentType: 'application/json' });
  }
  function plain(name: string, value: string, contentType = 'text/plain') {
    const path = testInfo.outputPath(name);
    writeFileSync(path, value);
    files.push({ name, path, contentType });
  }
  try {
    const input = scenario.request.applicationInquiryInput;
    await step('Load selected tenant intake', async () => {
      await page.goto(metadata.intakeUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('new-inquiry-page')).toBeVisible({ timeout: 60000 });
      expect(new URL(page.url()).origin).toBe(new URL(metadata.intakeUrl).origin);
    });
    await step('Enter and verify property, occupancy and loan amounts', async () => {
      await address(page, input.propertyInputHeloc.address);
      await dropdown(page, page.getByRole('combobox', { name: 'Occupancy Type*', exact: true }), {
        PRIMARY: 'Primary residence', SECONDARY: 'Secondary residence', INVESTMENT: 'Investment'
      }[input.propertyInputHeloc.type]);
      await masked(page.locator('input[name="existingMortgageAmount"]'), input.existingMortgageAmount);
      await masked(page.locator('input[name="loanAmount"]'), input.propertyInputHeloc.requestedLoanAmount);
    });
    await step('Enter and verify single-borrower identity', async () => {
      const name = input.basicInfoInput.name;
      for (const [field, value] of Object.entries({
        firstName: name.first, middleName: name.middle, lastName: name.last, suffix: name.suffix, email
      })) await fill(page.locator(`input[name="${field}"]`), value);
      await masked(page.locator('input[name="phoneNumber"]'), input.basicInfoInput.phoneNumber);
      await date(page.locator('input#date'), input.basicInfoUpdateInput.dateOfBirth);
      await masked(page.locator('input[name="lastFourSSN"]'), input.basicInfoUpdateInput.lastFourSSN);
    });
    await step('Enter and verify primary residence', async () => {
      if (input.propertyInputHeloc.type !== 'PRIMARY') await address(page, input.basicInfoInput.residenceAddress, true);
      await date(page.locator('#residence-start-date'), input.basicInfoInput.residenceStartDate);
    });
    await step('Enter and verify all income sources', async () => {
      await selectInquiryIncomeSource(page, page.getByTestId('inquiry-primary-income-source'), input.incomeInput[0].incomeSource);
      await masked(page.locator('input[name="income"]'), input.incomeInput[0].annualIncome);
      for (let index = 1; index < input.incomeInput.length; index++) {
        await page.getByRole('button', { name: 'additional income sources', exact: true }).click();
        const field = page.locator(`input[name="income-${index - 1}"]`);
        await expect(field).toBeVisible();
        const row = page.locator('div.grid').filter({ has: field }).first();
        await selectInquiryIncomeSource(page, row, input.incomeInput[index].incomeSource);
        await masked(field, input.incomeInput[index].annualIncome);
      }
    });
    await step('Consent, submit through UI and capture real inquiry response', async () => {
      await page.locator('#inquiry-consent-checkbox').check();
      await expect(page.locator('#inquiry-consent-checkbox')).toBeChecked();
      const button = page.getByRole('button', { name: 'Submit', exact: true });
      await expect(button).toBeEnabled();
      const [networkResponse] = await Promise.all([
        page.waitForResponse(value => new URL(value.url()).pathname === '/api/application/inquiry' && value.request().method() === 'POST', { timeout: 240000 }),
        button.click()
      ]);
      actualRequest = networkResponse.request().postDataJSON();
      endpoint = networkResponse.url();
      httpStatus = networkResponse.status();
      responseText = await networkResponse.text();
      rawResponse = networkResponse.headers()['content-type']?.includes('json') ? JSON.parse(responseText) : { nonJsonBody: responseText };
      expect(httpStatus, 'Actual inquiry HTTP status').toBe(200);
      response = responseSchema.parse(rawResponse);
      if (scenario.expectedResponse) expect(response.inquiryId).not.toBe(scenario.expectedResponse.inquiryId);
      await page.waitForURL(/\/inquiry\/prequalify/, { timeout: 240000 });
      await expect(page.getByTestId('inquiry-offers-page')).toBeVisible({ timeout: 240000 });
      expect(new URL(page.url()).searchParams.get('id')).toBe(response.inquiryId);
    });
    await step('Verify the UI submitted the intended inquiry data', async () => {
      assertSubmittedInput(requestSchema.parse(actualRequest), scenario.request, email);
    });
    await step('Capture actual UI offers before comparing expectations', async () => {
      await expect(page.locator('[data-testid^="inquiry-offer-card-"]').first()).toBeVisible();
      cards = await page.locator('[data-testid^="inquiry-offer-card-"]').evaluateAll(elements => elements.map(element => ({
        title: (element as HTMLElement).innerText.split('\n')[0],
        text: (element as HTMLElement).innerText,
        testId: element.getAttribute('data-testid') || ''
      })));
      body = await page.locator('body').innerText();
      ui = uiSnapshot(body, cards);
    });
    await step(compareWorkbook ? 'Match actual API and UI against workbook expectations' : 'Match rendered offers to the actual API response', async () => {
      if (!response) throw new Error('No validated inquiry response available.');
      comparison = compareWorkbook && workbookScenario ? compareRun(response, cards, ui, workbookScenario)
        : { apiBaseline: [], uiApi: compareUiToApi(cards, response), uiBaseline: [] };
      expect([...comparison.apiBaseline, ...comparison.uiApi, ...comparison.uiBaseline],
        'Actual output differs from expected; see comparison.json and QA comment (baselines are never auto-updated)').toEqual([]);
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (!page.isClosed()) {
        if (!body) body = await page.locator('body').innerText({ timeout: 5000 });
        plain('page-source.html', await page.content(), 'text/html');
        const path = testInfo.outputPath('offers.png');
        await page.screenshot({ path, fullPage: true, timeout: 15000 });
        files.push({ name: 'offers-screenshot', path, contentType: 'image/png' });
      } else diagnosticsErrors.push('Page was closed before diagnostics could be captured.');
    } catch (error) {
      diagnosticsErrors.push(`Diagnostic capture failed: ${errorText(error)}`);
      console.error(diagnosticsErrors[diagnosticsErrors.length - 1]);
      if (!failure) failure = error;
    }
    const comments = compareWorkbook && workbookScenario
      ? qaComments(workbookScenario, metadata.tenant, response, comparison, failure ? errorText(failure) : undefined)
      : [
        `Solution Finder Lab: ${scenario.name}; tenant ${metadata.tenant}.`,
        'Live UI submission; no placeholder workbook expectations asserted. UI/API agreement does not independently certify pricing or eligibility.',
        `UI/API differences: ${comparison?.uiApi.length ?? 'not compared'}.`,
        `Eligible offers: ${response?.offers.filter(offer => offer.loanAmount != null && !offer.ineligibleReasons?.length).length ?? 'unavailable'}.`,
        'Inquiry and returned internal application IDs do not establish a completed or funded loan.',
        ...(failure ? [`FAILED CHECKPOINT: ${errorText(failure)}`] : [])
      ];
    comments.push(...diagnosticsErrors);
    if (browserErrors.length) comments.push(`Browser page errors: ${browserErrors.join('; ')}`);
    if (networkErrors.length) comments.push(`Failed network requests (review relevance): ${networkErrors.join('; ')}`);
    if (compareWorkbook) json('expected-inquiry-response.json', scenario.expectedResponse);
    json('actual-inquiry-request.json', actualRequest ?? { unavailable: true, failedStep: steps.find(step => step.status === 'FAIL')?.name });
    json('actual-inquiry-response.json', rawResponse ?? { unavailable: true, httpStatus });
    json('actual-ui-offers.json', { cards, ui, body });
    json('comparison.json', comparison ?? { notCompared: true, reason: 'Execution stopped before both API and UI were available.' });
    plain('actual-response-body.txt', responseText);
    if (compareWorkbook && scenario.expectedUi) plain('expected-ui-offers.txt', scenario.expectedUi);
    plain('actual-ui-offers.txt', ui || body);
    plain('qa-comment.txt', comments.join('\n\n'));
    json('run-result.json', {
      scenarioId: scenario.id, scenarioName: scenario.name, workbookRow: scenario.workbookRow,
      ...metadata, baselineApprovedForTenant: compareWorkbook && metadata.tenant === 'gri',
      comparisonMode: compareWorkbook ? 'workbook' : 'actual-ui-api',
      started, finished: new Date().toISOString(), status: failure ? 'FAIL' : 'PASS',
      email, endpoint, httpStatus, inquiryId: response?.inquiryId, navigatorUrl: page.url(), steps, comparison,
      qaComments: comments, browserErrors, networkErrors, diagnosticsErrors,
      error: failure ? errorText(failure) : undefined
    });
    for (const file of files) await testInfo.attach(file.name === 'qa-comment.txt' ? 'qa-comment' : file.name, { path: file.path, contentType: file.contentType });
    testInfo.annotations.push({ type: 'qa-comment', description: comments.join('\n') });
  }
  if (failure) throw failure;
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const name = z.object({ first: z.string(), middle: z.string(), last: z.string(), suffix: z.string() }).passthrough();
const address = z.object({
  street: z.array(z.string()).min(1), city: z.string(), region: z.string(),
  postalCode: z.string(), country: z.string().optional()
}).passthrough();
const number = z.number().nullable().optional();
const income = z.object({
  annualIncome: z.number(),
  incomeSource: z.enum(['EMPLOYED_FULL_TIME', 'EMPLOYED_PART_TIME', 'SELF_EMPLOYED', 'RETIRED_SSI']),
  incomeType: z.string().nullable().optional()
}).passthrough();
export const requestSchema = z.object({
  applicationInquiryInput: z.object({
    propertyInputHeloc: z.object({
      address, type: z.enum(['PRIMARY', 'SECONDARY', 'INVESTMENT']), requestedLoanAmount: z.number()
    }).passthrough(),
    basicInfoInput: z.object({
      name, emailId: z.string().email(), phoneNumber: z.string(),
      residenceAddress: address, residenceStartDate: z.string()
    }).passthrough(),
    basicInfoUpdateInput: z.object({ dateOfBirth: z.string(), lastFourSSN: z.string().regex(/^\d{4}$/) }).passthrough(),
    incomeInput: z.array(income).min(1), existingMortgageAmount: z.number()
  }).passthrough()
}).passthrough();
export const offerSchema = z.object({
  productType: z.enum(['HELOAN', 'FIXED_RATE_HELOC', 'VARIABLE_RATE_HELOC', 'CES']),
  applicationType: z.string(), offerId: z.string().optional(),
  loanAmount: number, term: number, rate: number, apr: number, monthlyPayment: number,
  badge: z.string().optional(), ineligibleReasons: z.array(z.string()).optional(),
  offerDetails: z.object({
    closingCostsMin: number, closingCostsMax: number,
    processingTimeMinDays: number, processingTimeMaxDays: number,
    minCreditScore: number, maxLtv: number,
    earlyPayoffPenalty: z.string().optional(), rateType: z.string().optional()
  }).passthrough().optional()
}).passthrough();
export const responseSchema = z.object({
  inquiryId: z.string().uuid(),
  offers: z.array(offerSchema),
  summary: z.object({
    name, address, requestedAmount: z.number(),
    fico: z.record(z.number().nullable()),
    estimatedPropertyValues: z.record(z.number().nullable()),
    lowestDti: number, highestDti: number, lowestCltv: number, highestCltv: number
  }).passthrough()
}).passthrough();
const scenarioBase = z.object({
  id: z.string().regex(/^NSF-\d{3}$/), name: z.string().min(1), workbookRow: z.number().int(),
  request: requestSchema,
  notes: z.array(z.string())
});
const workbookProvenance = z.object({ kind: z.literal('unchanged-workbook') }).strict();
const irProvenance = z.object({
  kind: z.literal('tri-bureau-ir'), profileId: z.string().regex(/^TB-\d{3}$/),
  profileWorkbookRow: z.number().int(), baselineStatus: z.literal('pending-approved-variant-baseline'),
  dob: z.object({
    value: z.string(), source: z.literal('preserved-synthetic-scenario-intent'), certifiedByIrWorkbook: z.literal(false)
  }).strict(),
  subjectPropertyChanged: z.boolean(), preservedFields: z.array(z.string()),
  contactSource: z.literal('normalized-profile-QA-contact-not-IR-workbook'),
  identitySource: z.literal('IR-workbook-name-residence-last-four'),
  priorCreditAndFinancialExpectationsInvalidated: z.literal(true)
}).strict();
export const workbookScenarioSchema = scenarioBase.extend({
  comparisonMode: z.literal('workbook').default('workbook'),
  provenance: workbookProvenance.default({ kind: 'unchanged-workbook' }),
  expectedResponse: responseSchema, expectedUi: z.string().min(1)
}).strict();
export const actualUiApiScenarioSchema = scenarioBase.extend({
  comparisonMode: z.literal('actual-ui-api'), provenance: irProvenance
}).strict().superRefine((scenario, context) => {
  const slot = Number(scenario.id.slice(4));
  const profile = slot >= 63 ? slot - 62 : slot - 50;
  if (slot < 51 || slot > 102 ||
      scenario.provenance.profileId !== `TB-${String(profile).padStart(3, '0')}` ||
      scenario.provenance.profileWorkbookRow !== profile + 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['provenance'], message: 'IR profile must match the approved scenario-slot/source-row mapping.' });
  }
  if (scenario.provenance.dob.value !== scenario.request.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['provenance', 'dob'], message: 'DOB provenance must match the intended inquiry DOB.' });
  }
  const input = scenario.request.applicationInquiryInput;
  const primary = input.propertyInputHeloc.type === 'PRIMARY';
  if (scenario.provenance.subjectPropertyChanged !== primary) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['provenance', 'subjectPropertyChanged'], message: 'Subject-property provenance must reflect the PRIMARY mapping.' });
  }
  if (primary) {
    const subject = input.propertyInputHeloc.address;
    const residence = input.basicInfoInput.residenceAddress;
    if (['city', 'region', 'postalCode', 'country'].some(key => subject[key] !== residence[key]) ||
        JSON.stringify(subject.street) !== JSON.stringify(residence.street)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['request', 'applicationInquiryInput', 'propertyInputHeloc', 'address'], message: 'PRIMARY IR subject must match the borrower residence.' });
    }
  }
});
export const scenarioSchema = z.union([workbookScenarioSchema, actualUiApiScenarioSchema]);
const dataset = process.env.SF_LAB_PORTABLE === '1' ? null : z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]), sourceWorkbook: z.string(), sourceSha256: z.string(),
  baselineTenant: z.literal('gri'), migration: z.record(z.unknown()).optional(), scenarios: z.array(scenarioSchema).length(102)
}).parse(JSON.parse(readFileSync(resolve(__dirname, '../../../../../test-data/solution-finder/workbook-scenarios/scenarios.json'), 'utf8')));
if (dataset && new Set(dataset.scenarios.map(s => s.id)).size !== 102) throw new Error('Duplicate New Solution Finder scenario IDs.');
if (dataset && dataset.scenarios.some((scenario, index) =>
  scenario.id !== `NSF-${String(index + 1).padStart(3, '0')}` ||
  scenario.comparisonMode !== (index < 50 ? 'workbook' : 'actual-ui-api'))) {
  throw new Error('Solution Finder catalog must contain ordered NSF-001..102: 50 workbook baselines and 52 IR UI/API scenarios.');
}
export const scenarios = dataset?.scenarios ?? [];
export type Scenario = z.infer<typeof scenarioSchema>;
export type WorkbookScenario = z.infer<typeof workbookScenarioSchema>;
export const workbookScenarios = scenarios.filter((scenario): scenario is WorkbookScenario => scenario.comparisonMode === 'workbook');
export type InquiryRequest = z.infer<typeof requestSchema>;
export type InquiryResponse = z.infer<typeof responseSchema>;
export type Offer = z.infer<typeof offerSchema>;
export interface UiCard { title: string; text: string; testId: string; }
export interface Difference { path: string; expected: unknown; actual: unknown; }
export interface Comparison {
  apiBaseline: Difference[];
  uiApi: Difference[];
  uiBaseline: Difference[];
}

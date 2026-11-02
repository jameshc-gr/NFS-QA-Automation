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
const scenarioSchema = z.object({
  id: z.string().regex(/^NSF-\d{3}$/), name: z.string().min(1), workbookRow: z.number().int(),
  request: requestSchema, expectedResponse: responseSchema, expectedUi: z.string().min(1),
  notes: z.array(z.string())
});
const dataset = process.env.SF_LAB_PORTABLE === '1' ? null : z.object({
  schemaVersion: z.literal(1), sourceWorkbook: z.string(), sourceSha256: z.string(),
  baselineTenant: z.literal('gri'), scenarios: z.array(scenarioSchema).length(102)
}).parse(JSON.parse(readFileSync(resolve(__dirname, '../../../../../test-data/solution-finder/workbook-scenarios/scenarios.json'), 'utf8')));
if (dataset && new Set(dataset.scenarios.map(s => s.id)).size !== 102) throw new Error('Duplicate New Solution Finder scenario IDs.');
export const scenarios = dataset?.scenarios ?? [];
export type Scenario = z.infer<typeof scenarioSchema>;
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

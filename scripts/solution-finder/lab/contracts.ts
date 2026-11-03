import { resolve, relative, sep } from 'node:path';
import { z } from 'zod';
import { requestSchema, type InquiryRequest, type InquiryResponse } from '../../../tests/projects/solution-finder/workbook-scenarios/helpers/contracts';
import { resolveNewSolutionFinderEnvironment } from '../../new-solution-finder-environment';
import environments from '../../../test-data/solution-finder/workbook-scenarios/environments.json';

export const root = resolve(__dirname, '../../..');
export const tenants = Object.keys(environments).map(key => resolveNewSolutionFinderEnvironment(key));
const input = requestSchema.shape.applicationInquiryInput;
const basic = input.shape.basicInfoInput;
const property = input.shape.propertyInputHeloc;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Invalid calendar date')
  .refine(value => value <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future');
const dollars = z.number().int().nonnegative().max(1_000_000_000);
export function borrowerAge(dateOfBirth: string, today = new Date()): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const birthdayPending = today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  return today.getFullYear() - year - (birthdayPending ? 1 : 0);
}
const address = basic.shape.residenceAddress.extend({
  street: z.array(z.string().trim().min(1)).min(1).max(2),
  city: z.string().trim().min(1), region: z.string().regex(/^[A-Z]{2}$/),
  postalCode: z.string().regex(/^\d{5}(?:-\d{4})?$/), country: z.literal('US').optional()
}).strict();
export const labRequestSchema = requestSchema.extend({
  type: z.literal('SALES_INQUIRY').optional(),
  applicationInquiryInput: input.extend({
    propertyInputHeloc: property.extend({ address, requestedLoanAmount: dollars.positive() }).strict(),
    basicInfoInput: basic.extend({
      name: basic.shape.name.extend({ first: z.string().trim().min(1), last: z.string().trim().min(1) }).strict(),
      phoneNumber: z.string().regex(/^\d{10}$/, 'Use 10 digits'),
      residenceAddress: address, residenceStartDate: date, isAgreed: z.literal(true).optional()
    }).strict(),
    basicInfoUpdateInput: input.shape.basicInfoUpdateInput.extend({ dateOfBirth: date }).strict(),
    incomeInput: z.array(input.shape.incomeInput.element.extend({
      annualIncome: dollars, incomeType: z.literal('SOCIAL_SECURITY').nullable().optional()
    }).strict()).min(1).max(10),
    existingMortgageAmount: dollars,
    loCostCenter: z.string().optional(), isConsent: z.literal(true).optional(),
    channel: z.literal('CONSUMERDIRECT').optional()
  }).strict()
}).strict().superRefine((request, context) => {
  const fields = request.applicationInquiryInput;
  fields.incomeInput.forEach((income, index) => {
    if (income.incomeSource === 'RETIRED_SSI') {
      if (income.incomeType !== 'SOCIAL_SECURITY') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['applicationInquiryInput', 'incomeInput', index, 'incomeType'],
          message: 'Retired SSI requires SOCIAL_SECURITY income type, as submitted by Navigator.' });
      }
      if (borrowerAge(fields.basicInfoUpdateInput.dateOfBirth) < 62) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['applicationInquiryInput', 'basicInfoUpdateInput', 'dateOfBirth'],
          message: 'Navigator exposes Retired SSI only from the borrower\'s 62nd birthday. Supply an age-eligible DOB or a different income source.' });
      }
    } else if (income.incomeType != null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['applicationInquiryInput', 'incomeInput', index, 'incomeType'],
        message: 'Employment/self-employment income type must be null or omitted.' });
    }
  });
});

export function parseLabRequest(value: unknown): InquiryRequest {
  const parsed = labRequestSchema.parse(value);
  for (const address of [parsed.applicationInquiryInput.propertyInputHeloc.address, parsed.applicationInquiryInput.basicInfoInput.residenceAddress]) {
    address.country ??= 'US';
  }
  if (parsed.applicationInquiryInput.propertyInputHeloc.type === 'PRIMARY') {
    parsed.applicationInquiryInput.basicInfoInput.residenceAddress =
      structuredClone(parsed.applicationInquiryInput.propertyInputHeloc.address);
  }
  return parsed;
}

export function parsedInput(request: InquiryRequest) {
  const input = request.applicationInquiryInput;
  return {
    borrower: ['first', 'middle', 'last', 'suffix'].map(key => input.basicInfoInput.name[key]).filter(Boolean).join(' '),
    lastFourSSN: input.basicInfoUpdateInput.lastFourSSN,
    subjectProperty: input.propertyInputHeloc.address,
    primaryResidence: input.basicInfoInput.residenceAddress,
    occupancy: input.propertyInputHeloc.type,
    requestedAmount: input.propertyInputHeloc.requestedLoanAmount,
    existingMortgage: input.existingMortgageAmount,
    annualIncome: input.incomeInput.reduce((sum, item) => sum + item.annualIncome, 0)
  };
}

export function parsedResponse(response: InquiryResponse) {
  return {
    inquiryId: response.inquiryId, summary: response.summary,
    eligibleOfferCount: response.offers.filter(offer => offer.loanAmount != null && !offer.ineligibleReasons?.length).length,
    offers: response.offers.map(offer => ({
      product: offer.productType,
      eligible: offer.loanAmount != null && !offer.ineligibleReasons?.length,
      loanAmount: offer.loanAmount, rate: offer.rate, apr: offer.apr,
      monthlyPayment: offer.monthlyPayment, term: offer.term,
      reasons: offer.ineligibleReasons ?? [], internalAppId: offer.internalAppId ?? null,
      extAppUuid: offer.extAppUuid ?? null, offerId: offer.offerId ?? null,
      offerDetails: offer.offerDetails
    }))
  };
}

export const runIdPattern = /^sf-lab-\d{8}T\d{9}Z-[a-f0-9]{8}$/;
export function labDirectory(id: string, date: string) {
  if (!runIdPattern.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid lab run identifier/date.');
  return resolve(root, 'test-results', date, 'solution-finder', 'lab', id);
}
export function validateLabDirectory(directory: string) {
  const path = relative(resolve(root, 'test-results'), resolve(directory)).split(sep);
  if (path.length !== 4 || path[1] !== 'solution-finder' || path[2] !== 'lab' ||
      labDirectory(path[3], path[0]) !== resolve(directory)) throw new Error('Lab directory must be a dated Solution Finder lab run under test-results.');
  return resolve(directory);
}

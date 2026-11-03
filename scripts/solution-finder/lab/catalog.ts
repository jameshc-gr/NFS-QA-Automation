import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarios } from '../../../tests/projects/solution-finder/workbook-scenarios/helpers/contracts';
import { parseLabRequest } from './contracts';
import portableData from '../../../test-data/solution-finder/portable-scenarios.json';

const starters = z.object({
  schemaVersion: z.literal(1), baseRequest: z.unknown(),
  scenarios: z.array(z.object({
    id: z.string().regex(/^SF-DEMO-\d{2}$/), name: z.string().min(1),
    occupancy: z.enum(['PRIMARY', 'SECONDARY', 'INVESTMENT']),
    requestedLoanAmount: z.number().int().positive(), existingMortgageAmount: z.number().int().nonnegative(),
    annualIncome: z.number().int().positive(),
    incomeSource: z.enum(['EMPLOYED_FULL_TIME', 'EMPLOYED_PART_TIME', 'SELF_EMPLOYED', 'RETIRED_SSI']),
    incomeType: z.literal('SOCIAL_SECURITY').nullable(), dateOfBirth: z.string().optional(),
    ageYears: z.literal(17).optional()
  }).strict()).length(5)
}).strict().parse(portableData);
if (new Set(starters.scenarios.map(scenario => scenario.id)).size !== starters.scenarios.length) {
  throw new Error('Duplicate portable starter scenario IDs.');
}

function starterCases(today: Date) {
  return starters.scenarios.map(scenario => {
    const request = parseLabRequest(starters.baseRequest);
    const input = request.applicationInquiryInput;
    input.propertyInputHeloc.type = scenario.occupancy;
    input.propertyInputHeloc.requestedLoanAmount = scenario.requestedLoanAmount;
    input.existingMortgageAmount = scenario.existingMortgageAmount;
    input.incomeInput = [{
      annualIncome: scenario.annualIncome, incomeSource: scenario.incomeSource, incomeType: scenario.incomeType
    }];
    input.basicInfoUpdateInput.dateOfBirth = scenario.ageYears
      ? `${today.getFullYear() - scenario.ageYears}-01-01`
      : scenario.dateOfBirth ?? input.basicInfoUpdateInput.dateOfBirth;
    if (input.basicInfoInput.residenceStartDate < input.basicInfoUpdateInput.dateOfBirth) {
      input.basicInfoInput.residenceStartDate = input.basicInfoUpdateInput.dateOfBirth;
    }
    if (scenario.occupancy === 'PRIMARY') {
      input.basicInfoInput.residenceAddress = structuredClone(input.propertyInputHeloc.address);
    }
    return {
      id: scenario.id, name: scenario.name, group: 'Synthetic starter scenarios',
      request: parseLabRequest(request), sourceRequest: null,
      notes: ['Synthetic demo only: names, addresses, contact data and SSN suffix are placeholders. Replace with company-approved QA inputs before live submission. Not an original workbook case or an expected offer/eligibility baseline.']
    };
  });
}

const originals = process.env.SF_LAB_PORTABLE === '1' ? null : z.object({
  schemaVersion: z.literal(1), sourceWorkbook: z.string(), sourceSha256: z.string(),
  scenarios: z.array(z.object({
    id: z.string(), name: z.string(), workbookRow: z.number(),
    sourceRequest: z.record(z.unknown()).nullable(),
    request: z.record(z.unknown()).nullable(), notes: z.array(z.string())
  })).length(23)
}).parse(JSON.parse(readFileSync(resolve(__dirname, '../../../test-data/solution-finder/workbook-scenarios/original-scenarios.json'), 'utf8')));

const irProfiles = !originals || process.env.SF_LAB_CATALOG === 'original125' ? null : z.object({
  schemaVersion: z.literal(1),
  profiles: z.array(z.object({
    id: z.string().regex(/^TB-\d{3}$/), name: z.string().min(1),
    request: z.record(z.unknown()), notes: z.array(z.string()),
    bureau: z.object({ TU: z.number().nullable(), XPN: z.number().nullable(), EFX: z.number().nullable() }).strict()
  })).length(40)
}).parse(JSON.parse(readFileSync(resolve(__dirname,
  '../../../test-data/solution-finder/workbook-scenarios/tri-bureau-40/profiles.json'), 'utf8')));

const productSchema = z.enum(['HELOAN', 'FIXED_RATE_HELOC', 'VARIABLE_RATE_HELOC']);
const ficoSchema = z.object({
  TU: z.number().int().min(0).max(999).nullable(),
  XPN: z.number().int().min(0).max(999).nullable(),
  EFX: z.number().int().min(0).max(999).nullable()
}).strict();
export const profileReferenceSchema = z.object({
  profileId: z.string().regex(/^TB-(?:00[1-9]|0[1-3]\d|040)$/),
  lastFourSSN: z.string().regex(/^\d{4}$/),
  expectedFico: ficoSchema, returnedFico: ficoSchema, creditReturned: z.boolean(),
  eligibleProducts: z.array(productSchema).max(3),
  offers: z.array(z.object({
    product: productSchema, status: z.enum(['Eligible', 'Declined', 'Pending', 'Unclassified']),
    applicationType: z.enum(['HELOAN', 'FIGURE_HELOC']).nullable(),
    loanAmount: z.number().nonnegative().nullable(), rate: z.number().nonnegative().nullable(),
    apr: z.number().nonnegative().nullable(), term: z.number().nonnegative().nullable(),
    monthlyPayment: z.number().nonnegative().nullable(),
    reasons: z.array(z.enum([
      'Representative Credit Score < 660', 'NEAR_PRIME_OCCUPANCY_STATUS',
      'Your credit score is below our minimum requirement',
      'No credit profile match found; cannot generate offers without manual intervention/resubmission.',
      'Income Verification Type is not Investor - DSCR, And DTI Ratio = 0',
      'WAITING_FOR_INITIAL_OFFERS', 'TU Soft pull was not successful',
      'Credit utilization is above the threshold for which we extend credit'
    ]))
  }).strict()).length(3)
}).strict().superRefine((reference, ctx) => {
  const usable = Object.values(reference.returnedFico).some(v => v !== null && v >= 300 && v <= 850);
  const eligible = reference.offers.filter(o => o.status === 'Eligible').map(o => o.product).sort();
  if (usable !== reference.creditReturned ||
    new Set(reference.offers.map(o => o.product)).size !== 3 ||
    new Set(reference.eligibleProducts).size !== reference.eligibleProducts.length ||
    JSON.stringify([...reference.eligibleProducts].sort()) !== JSON.stringify(eligible)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Reference credit/products conflict (values suppressed).' });
  }
});
export const profileReferenceDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  sourceWorkbook: z.literal('test-data/solution-finder/IR_profile-offer-table.xlsx'),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  observedOn: z.literal('2026-11-02'),
  context: z.literal('Prior GRI QA screening; secondary occupancy, 50k request/70k mortgage/250k income, DOB1980 assumed; editing inputs/tenant may change outcomes. Reference only, not current results/eligibility approval.'),
  profiles: z.array(profileReferenceSchema).length(40)
}).strict().superRefine((data, ctx) => {
  if (new Set(data.profiles.map(p => p.profileId)).size !== 40) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Reference IDs must be unique.' });
  }
});
export type ProfileReference = z.infer<typeof profileReferenceSchema> & {
  observedOn: string; context: string; sourceWorkbook: string; sourceSha256: string;
};
export const profileReferenceDataset = !irProfiles ? null : (() => {
  try {
    const data = profileReferenceDatasetSchema.parse(JSON.parse(readFileSync(resolve(__dirname,
      '../../../test-data/solution-finder/workbook-scenarios/tri-bureau-40/profile-reference.json'), 'utf8')));
    for (const profile of irProfiles.profiles) {
      const reference = data.profiles.find(p => p.profileId === profile.id);
      const input = parseLabRequest(profile.request).applicationInquiryInput;
      if (!reference || reference.lastFourSSN !== input.basicInfoUpdateInput.lastFourSSN ||
        ['TU', 'XPN', 'EFX'].some(key => reference.expectedFico[key as keyof typeof reference.expectedFico] !==
          profile.bureau[key as keyof typeof profile.bureau])) {
        throw new Error('Reference/source profile alignment failed.');
      }
    }
    return data;
  } catch {
    throw new Error('Invalid IR profile reference schema/count/source ID/last-four/expected-score alignment (values suppressed).');
  }
})();

export function getLabCases(today = new Date()) {
  if (!originals) return starterCases(today);
  const retirementRequest = parseLabRequest(originals.scenarios[11].request);
  retirementRequest.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = '1950-01-01';
  const underageRequest = parseLabRequest(originals.scenarios[0].request);
  const underageDob = `${today.getFullYear() - 17}-01-01`;
  underageRequest.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = underageDob;
  if (underageRequest.applicationInquiryInput.basicInfoInput.residenceStartDate < underageDob) {
    underageRequest.applicationInquiryInput.basicInfoInput.residenceStartDate = underageDob;
  }

  return [
    ...originals.scenarios.map((scenario, index) => {
      if (scenario.id !== `SF-${index + 1}-Original`) throw new Error('Original scenario numbering must remain 1 through 23.');
      const generated = scenario.id === 'SF-22-Original' && scenario.request === null;
      const request = generated ? underageRequest : scenario.id === 'SF-12-Original' ? retirementRequest : scenario.request;
      const notes = generated ? [
        'The original workbook has no Inquiry Request (N/A). User authorized a generated under-18 test input.',
        `Generated from SF-1-Original with DOB ${underageDob} (age 17 when loaded or queued). Residence start is no earlier than DOB. Original workbook/source JSON is unchanged; this is not captured customer data or an approved response baseline.`
      ] : scenario.id === 'SF-12-Original' ? [...scenario.notes,
        'User-authorized DOB correction: use 1950-01-01 to match the scenario title and retirement-age UI. Original workbook/source DOB remains 1962-01-02. RETIRED_SSI / SOCIAL_SECURITY income is preserved.'
      ] : scenario.notes;
      const checked = request ? (() => {
        try { parseLabRequest(request); return []; }
        catch (error) {
          if (!(error instanceof z.ZodError)) throw error;
          return error.issues.map(issue => `Input requires review: ${issue.path.join('.')}: ${issue.message}`);
        }
      })() : [];
      return { ...scenario, request, group: 'Original 23 scenarios', notes: [...notes, ...checked] };
    }),
    ...scenarios.map(scenario => ({
      id: scenario.id, name: scenario.name, request: scenario.request,
      group: 'Additional 102 scenarios', sourceRequest: null,
      notes: scenario.comparisonMode === 'actual-ui-api' ? [
        `IR profile ${scenario.provenance.profileId}; DOB assumption is preserved synthetic scenario intent, not IR-certified; pending approved variant baseline.`,
        ...scenario.notes
      ] : [] as string[]
    })),
    ...(irProfiles?.profiles.map((profile, index) => {
      if (profile.id !== `TB-${String(index + 1).padStart(3, '0')}`) throw new Error('IR profile numbering must remain 1 through 40.');
      const request = parseLabRequest(profile.request);
      const fullName = ['first', 'middle', 'last', 'suffix']
        .map(key => request.applicationInquiryInput.basicInfoInput.name[key]).filter(Boolean).join(' ');
      const reference = profileReferenceDataset!.profiles.find(p => p.profileId === profile.id)!;
      return {
        id: profile.id, name: fullName, group: 'Tri-Bureau IR 40 profiles',
        request, sourceRequest: null,
        profileReference: {
          ...structuredClone(reference),
          observedOn: profileReferenceDataset!.observedOn,
          context: profileReferenceDataset!.context,
          sourceWorkbook: profileReferenceDataset!.sourceWorkbook,
          sourceSha256: profileReferenceDataset!.sourceSha256
        } satisfies ProfileReference,
        notes: [
          `IR profile ${profile.id}; all normalized profiles included irrespective of screening outcome.`,
          'DOB remains assumed, not IR-certified. Financial setup is the normalized source request. No approved response/UI baseline.',
          ...profile.notes
        ]
      };
    }) ?? [])
  ];
}

export const labCases = getLabCases();

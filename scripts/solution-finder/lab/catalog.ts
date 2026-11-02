import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarios } from '../../../tests/projects/solution-finder/workbook-scenarios/helpers/contracts';
import { parseLabRequest } from './contracts';

const originals = process.env.SF_LAB_PORTABLE === '1' ? null : z.object({
  schemaVersion: z.literal(1), sourceWorkbook: z.string(), sourceSha256: z.string(),
  scenarios: z.array(z.object({
    id: z.string(), name: z.string(), workbookRow: z.number(),
    sourceRequest: z.record(z.unknown()).nullable(),
    request: z.record(z.unknown()).nullable(), notes: z.array(z.string())
  })).length(23)
}).parse(JSON.parse(readFileSync(resolve(__dirname, '../../../test-data/solution-finder/workbook-scenarios/original-scenarios.json'), 'utf8')));

export function getLabCases(today = new Date()) {
  if (!originals) return [];
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
      group: 'Additional 102 scenarios', sourceRequest: null, notes: [] as string[]
    }))
  ];
}

export const labCases = getLabCases();

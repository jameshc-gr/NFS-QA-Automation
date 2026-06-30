import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { ApplicationClient } from '../clients/ApplicationClient';

const applicationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  currentState: z.string().min(1)
});

test.describe('Application API contract', () => {
  test.skip(!process.env.API_BASE_URL, 'Set API_BASE_URL to run API contract tests');

  test('GET /api/application returns a valid schema', async () => {
    const applicationId = process.env.API_APPLICATION_ID || '';
    test.skip(!applicationId, 'Set API_APPLICATION_ID for contract tests');

    const client = new ApplicationClient({
      baseUrl: process.env.API_BASE_URL || '',
      bearerToken: process.env.API_BEARER_TOKEN,
      apiKey: process.env.API_KEY
    });

    const payload = await client.getApplication(applicationId);
    const candidate = payload?.application ?? payload;
    const parsed = applicationSchema.safeParse(candidate);

    expect(parsed.success, JSON.stringify(parsed, null, 2)).toBeTruthy();
  });
});

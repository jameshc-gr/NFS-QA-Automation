import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { ApplicationClient } from '../clients/ApplicationClient';

const addressSchema = z.object({
  street: z.string().min(3),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().regex(/^[0-9]{5}(?:-[0-9]{4})?$/)
});

test.describe('Address API contract', () => {
  test.skip(!process.env.API_BASE_URL, 'Set API_BASE_URL to run API contract tests');

  test('GET /api/application/address returns a valid schema', async () => {
    const applicationId = process.env.API_APPLICATION_ID || '';
    test.skip(!applicationId, 'Set API_APPLICATION_ID for contract tests');

    const client = new ApplicationClient({
      baseUrl: process.env.API_BASE_URL || '',
      bearerToken: process.env.API_BEARER_TOKEN,
      apiKey: process.env.API_KEY
    });

    const payload = await client.getAddress(applicationId);
    const candidate = payload?.address ?? payload;
    const parsed = addressSchema.safeParse(candidate);

    expect(parsed.success, JSON.stringify(parsed, null, 2)).toBeTruthy();
  });
});

import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './test-setup';

dotenv.config();
test.setTimeout(240000);

// Legacy Ernest happy path alias for the offer-success profile below.
const PROFILE = 'ER_OFFER_SUCCESS';
loadProfile(PROFILE);

// Maps to the Ernest success profile data in .env.
test('Student Loan Refinance - ER_OFFER_SUCCESS', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});
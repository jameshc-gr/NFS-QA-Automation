import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './test-setup';

dotenv.config();
test.setTimeout(240000);

// Maps to the Ernest happy path offer profile in .env.
const PROFILE = 'ER_OFFER_SUCCESS';
loadProfile(PROFILE);

// Runs the Ernest success offer scenario.
test('Student Loan Refinance - ER_OFFER_SUCCESS', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});
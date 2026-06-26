import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './test-setup';

dotenv.config();
test.setTimeout(240000);

// Maps to the Ernest low-FICO decline profile in .env.
const PROFILE = 'ER_CD_LOW_FICO';
loadProfile(PROFILE);

// Runs the Ernest low-FICO decline scenario.
test('Student Loan Refinance - ER_CD_LOW_FICO', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});
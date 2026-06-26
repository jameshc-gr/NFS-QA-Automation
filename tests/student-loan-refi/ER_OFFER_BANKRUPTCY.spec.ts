import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './test-setup';

dotenv.config();
test.setTimeout(240000);

// Maps to the Ernest bankruptcy decline profile in .env.
const PROFILE = 'ER_CD_BANKRUPTCY';
loadProfile(PROFILE);

// Runs the Ernest bankruptcy decline scenario.
test('Student Loan Refinance - ER_CD_BANKRUPTCY', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});
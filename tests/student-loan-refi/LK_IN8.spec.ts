import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './test-setup';

dotenv.config();
test.setTimeout(240000);

const PROFILE = 'LK_IN8';
loadProfile(PROFILE);

test('Student Loan Refinance - LK_IN8', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

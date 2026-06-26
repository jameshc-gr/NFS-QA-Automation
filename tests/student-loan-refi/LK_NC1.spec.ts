import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './test-setup';

dotenv.config();
test.setTimeout(240000);

const PROFILE = 'LK_NC1';
loadProfile(PROFILE);

test('Student Loan Refinance - LK_NC1', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

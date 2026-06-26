import { test } from '@playwright/test';
import { loadProfile, runRefinanceFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'LK10';
loadProfile(PROFILE);

test('Student Loan Refinance - LK10', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

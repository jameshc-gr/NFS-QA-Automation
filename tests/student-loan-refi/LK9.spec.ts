import { test } from '@playwright/test';
import { loadProfile, runRefinanceFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'LK9';
loadProfile(PROFILE);

test('Student Loan Refinance - LK9', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

import { test } from '@playwright/test';
import { loadProfile, runRefinanceFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'LK7';
loadProfile(PROFILE);

test('Student Loan Refinance - LK7', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

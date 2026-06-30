import { test } from '@playwright/test';
import { loadProfile, runRefinanceFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'LK13';
loadProfile(PROFILE);

test('Student Loan Refinance - LK13', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

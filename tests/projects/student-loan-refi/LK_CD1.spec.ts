import { test } from '@playwright/test';
import { loadProfile, runRefinanceFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'LK_CD1';
loadProfile(PROFILE);

test('Student Loan Refinance - LK_CD1', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});

import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-019';
loadProfile(PROFILE);

test('Student IDR - SCN-019 - Asset Plaid linked both spouses', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

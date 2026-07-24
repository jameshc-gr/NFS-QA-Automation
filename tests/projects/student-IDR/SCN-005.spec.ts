import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-005';
loadProfile(PROFILE);

test('Student IDR - SCN-005 - Jordan no loans', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

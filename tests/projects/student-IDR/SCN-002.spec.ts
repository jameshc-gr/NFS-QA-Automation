import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-002';
loadProfile(PROFILE);

test('Student IDR - SCN-002 - Marcus older IBR high income', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

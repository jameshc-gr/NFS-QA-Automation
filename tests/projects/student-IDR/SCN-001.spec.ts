import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-001';
loadProfile(PROFILE);

test('Student IDR - SCN-001 - Alex single moderate income', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

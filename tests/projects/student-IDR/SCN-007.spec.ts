import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-007';
loadProfile(PROFILE);

test('Student IDR - SCN-007 - Casey very high debt', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

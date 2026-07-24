import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-015';
loadProfile(PROFILE);

test('Student IDR - SCN-015 - Grace zero savings', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

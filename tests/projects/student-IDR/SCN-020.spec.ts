import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-020';
loadProfile(PROFILE);

test('Student IDR - SCN-020 - Asset excluded from tax bomb calc', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-003';
loadProfile(PROFILE);

test('Student IDR - SCN-003 - Elena low income RAP', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-011';
loadProfile(PROFILE);

test('Student IDR - SCN-011 - Chris married joint spouse no savings', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

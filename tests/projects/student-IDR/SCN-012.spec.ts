import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-012';
loadProfile(PROFILE);

test('Student IDR - SCN-012 - Dana paid off early', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

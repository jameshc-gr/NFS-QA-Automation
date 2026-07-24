import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-004';
loadProfile(PROFILE);

test('Student IDR - SCN-004 - Priya PAYE mapping', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-009';
loadProfile(PROFILE);

test('Student IDR - SCN-009 - Avery married joint both borrowers', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

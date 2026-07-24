import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-013';
loadProfile(PROFILE);

test('Student IDR - SCN-013 - Elliot PSLF attested', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

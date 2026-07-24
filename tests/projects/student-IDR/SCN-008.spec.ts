import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-008';
loadProfile(PROFILE);

test('Student IDR - SCN-008 - Taylor long forbearance', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-014';
loadProfile(PROFILE);

test('Student IDR - SCN-014 - Frank high return sensitivity', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

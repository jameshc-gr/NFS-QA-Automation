import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-010';
loadProfile(PROFILE);

test('Student IDR - SCN-010 - Blake married separate applicant debt', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

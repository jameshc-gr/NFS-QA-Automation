import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-022';
loadProfile(PROFILE);

test('Student IDR - SCN-022 - Dependent Impact: $80k AGI, 3 Dependents (HH size 4)', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

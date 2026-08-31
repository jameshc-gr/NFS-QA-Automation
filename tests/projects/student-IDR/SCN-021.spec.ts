import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-021';
loadProfile(PROFILE);

test('Student IDR - SCN-021 - Dependent Impact: $80k AGI, 1 Dependent (HH size 2)', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

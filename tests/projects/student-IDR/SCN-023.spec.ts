import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-023';
loadProfile(PROFILE);

test('Student IDR - SCN-023 - Dependent Impact: $80k AGI, 5 Dependents (HH size 6)', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

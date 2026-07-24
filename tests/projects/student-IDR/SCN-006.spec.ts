import { test } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-006';
loadProfile(PROFILE);

test('Student IDR - SCN-006 - Sam very low income', async ({ page }) => {
  await runIdrFlow(page, PROFILE);
});

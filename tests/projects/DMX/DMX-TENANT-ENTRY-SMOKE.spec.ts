import { test, expect } from '@playwright/test';
import { DMX_ENTRY_TARGETS } from './dmx-environments';
import { runTenantEntrySmoke } from './dmx-flows';

const selectedTargetId = process.env.DMX_ENTRY_TARGET_ID;
const selectedTargets = DMX_ENTRY_TARGETS.filter(entry => entry.available && (!selectedTargetId || entry.id === selectedTargetId));
if (selectedTargetId && selectedTargets.length === 0) throw new Error(`DMX_ENTRY_TARGET_ID is not an available target: ${selectedTargetId}`);

for (const target of selectedTargets) {
  test(`DMX_ENTRY_SMOKE:${target.id} ${target.label} entry page`, async ({ page }, testInfo) => {
    const result = { id: target.id, ...await runTenantEntrySmoke(target.id, page, testInfo), status: 'entry-ready' };
    testInfo.annotations.push({ type: 'dmx-entry-result', description: JSON.stringify(result) });
    console.log(`DMX_ENTRY_SMOKE_RESULT:${JSON.stringify(result)}`);
    const screenshotPath = testInfo.outputPath(`${target.id}-entry-page.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testInfo.annotations.push({ type: 'dmx-entry-screenshot', description: screenshotPath });
    await testInfo.attach(`${target.id}-entry-page`, { path: screenshotPath, contentType: 'image/png' });
  });
}

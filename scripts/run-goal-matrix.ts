import { chromium } from 'playwright';
import * as fs from 'fs';

const nonCustomGoalTypes = [
  'Getting Married',
  'Buying a Home',
  'Moving Out of Parent/Relative',
  'Moving In w/ Parent/Relative',
  'Buying an Investment Property',
  'Having a Child',
  'Purchasing a Vehicle',
  'Moving',
  'Expected Decrease in Income',
  'Beginning Part-time Work',
  'Expected Increase in Income',
  'Receiving an Inheritance',
  'Go on Vacation',
];

async function runMatrix() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: 'test-results/rate-wealth-auth.json' });
  const page = await context.newPage();
  const outDir = 'test-results/goal-type-zero';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('https://wealth.dev.fitbux.com/home', { waitUntil: 'networkidle' });

  const scenarioResults: Array<Record<string, unknown>> = [];

  for (let i = 0; i < nonCustomGoalTypes.length; i++) {
    const goalLabel = nonCustomGoalTypes[i];
    console.log(`[${i + 1}/${nonCustomGoalTypes.length}] Testing: ${goalLabel}`);

    await page.goto('https://wealth.dev.fitbux.com/plan-select', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const manualPlan = page.locator('button.euiCard__titleButton').filter({ hasText: /Manually/i }).first();
    await manualPlan.waitFor({ state: 'visible', timeout: 15000 });
    await manualPlan.click();

    const planName = page.locator('input:visible').first();
    await planName.waitFor({ state: 'visible', timeout: 15000 });
    await planName.fill('ZeroPlan-' + Date.now() + '-' + i);
    await page.getByRole('button', { name: /Next|Continue|Save and Continue|Start/i }).first().click();

    const addGoal = page.locator('text=Add Life Event/Goal').first();
    await addGoal.waitFor({ state: 'visible', timeout: 15000 });
    await addGoal.click();

    const option = page.getByText(goalLabel, { exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 15000 });
    await option.click();

    const fields = page.locator('input[type="text"]:visible, input[type="number"]:visible');
    const fieldMetadata = await fields.evaluateAll((elements) =>
      elements.map((element) => ({
        name: element.getAttribute('name'),
        placeholder: element.getAttribute('placeholder'),
        ariaLabel: element.getAttribute('aria-label'),
        type: element.getAttribute('type'),
        valueBefore: (element as HTMLInputElement).value,
      }))
    );

    const count = await fields.count();
    for (let f = 0; f < count; f++) {
      const field = fields.nth(f);
      const name = (await field.getAttribute('name')) || '';
      if (!name.includes('date') && !name.includes('year') && !name.includes('month')) {
        await field.fill('0');
      }
    }

    const screenshotPath = `${outDir}/${String(i + 1).padStart(2, '0')}-${goalLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const saveBtn = page.getByRole('button', { name: /Save|Add|Submit/i }).first();
    const canSave = await saveBtn.isVisible();
    let postSaveUrl = '';
    let validationErrors: string[] = [];

    if (canSave) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      postSaveUrl = page.url();
      validationErrors = await page.locator('.euiFormErrorText:visible, [role="alert"]:visible').allInnerTexts();
    }

    scenarioResults.push({
      goalLabel,
      fieldMetadata,
      canSave,
      postSaveUrl,
      validationErrors,
      screenshotPath,
    });
  }

  fs.writeFileSync(`${outDir}/results.json`, JSON.stringify({ scenarioResults, testedValue: '0' }, null, 2));
  console.log(`Matrix run complete! Saved to ${outDir}/results.json`);
  await browser.close();
}

runMatrix().catch((err) => {
  console.error(err);
  process.exit(1);
});

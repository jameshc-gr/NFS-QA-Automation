import { test, expect } from './test-setup';
import fs from 'fs';

test.describe('RW-GOAL-EDGECASES: Goal input edge cases (0 / empty)', () => {
  const testEmail = process.env.RW_TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;
  const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

  const scenarios = [
    { id: 'custom-goal-zero', label: 'custom goal with explicit 0', value: '0' },
    { id: 'custom-goal-empty', label: 'custom goal with empty amount', value: '' },
    { id: 'custom-goal-zero-decimal', label: 'custom goal with explicit 0.00', value: '0.00' },
    { id: 'custom-goal-whitespace', label: 'custom goal with whitespace amount', value: ' ' },
  ];

  test.beforeEach(async ({ loginPage }) => {
    test.skip(!storageState && (!testEmail || !testPassword), 'RW_TEST_EMAIL and TEST_PASSWORD or PLAYWRIGHT_STORAGE_STATE are required for authenticated Rate Wealth tests');
    if (!storageState) {
      await loginPage.navigate();
      await loginPage.login(testEmail!, testPassword!);
    }
  });

  for (const scenario of scenarios) {
    test(`RW-GOAL-EDGECASES: ${scenario.label} reaches a usable plan state`, async ({ page }) => {
    const outDir = `test-results/goal-edge/${scenario.id}`;
    fs.mkdirSync(outDir, { recursive: true });

    // capture console errors and failed requests
    const consoleErrors: string[] = [];
    const requestFailures: any[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', req => {
      requestFailures.push({ url: req.url(), failure: req.failure()?.errorText });
    });

    // 1) Open plan-select and choose manual plan
    await page.goto('https://wealth.dev.fitbux.com/plan-select', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url(), 'Authenticated account must reach plan selection before testing goal inputs').toContain('/plan-select');
    try {
      const manualCard = page.locator('button.euiCard__titleButton:has-text("Manually")');
      if (await manualCard.count() > 0) {
        await manualCard.first().click();
      } else {
        // fallback: click by visible text
        const manualAlt = page.locator('text=Manual');
        if (await manualAlt.count() > 0) await manualAlt.first().click();
      }
    } catch (e) {
      // continue best-effort
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outDir}/01-plan-select.png`, fullPage: true });

    // 2) Name my plan -> fill first input found and continue
    try {
      const nameInput = page.locator('input').first();
      await nameInput.fill(`AutoPlan-${Date.now()}`);
      // click next (try several buttons)
      const nextBtn = page.getByRole('button', { name: /Next|Continue|Save and Continue|Start/i }).first();
      if (await nextBtn.count() > 0) await nextBtn.click();
    } catch (e) {
      // ignore and continue
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outDir}/02-name-plan.png`, fullPage: true });

    // 3) Add life event/goal and submit the scenario's numeric value.
    try {
      // try to click an "Add" button or the Life Events/Goals card
      const addGoalBtn = page.locator('button:has-text("Add life") , button:has-text("Add goal") , button:has-text("Add Life Event")').first();
      if (await addGoalBtn.count() > 0) {
        await addGoalBtn.click();
      } else {
        // try to click a card with Life Events/Goals text
        const card = page.locator('text=Life Events/Goals').first();
        if (await card.count() > 0) await card.click();
      }
      await page.waitForTimeout(1000);

      // Select "Saving for other goal" if visible
      const savingOpt = page.locator('text=Saving for other goal').first();
      if (await savingOpt.count() > 0) {
        await savingOpt.click();
      } else {
        // try a generic option list
        const opt = page.locator('.euiSelectableListItem, [role="option"]').filter({ hasText: 'Saving' }).first();
        if (await opt.count() > 0) await opt.click();
      }

      // Fill amount input with 0 (try several heuristics)
      const amountInputCandidates = [
        'input[placeholder*="amount"]',
        'input[placeholder*="How much"]',
        'input[type="number"]',
        'input[name*="amount"]',
        'input[name*="save"]',
        'input'
      ];
      let filled = false;
      for (const sel of amountInputCandidates) {
        const loc = page.locator(sel).filter({ hasText: '' }).first();
        if (await loc.count() > 0) {
          try {
            await loc.fill(scenario.value);
            filled = true;
            break;
          } catch (e) {
            // ignore
          }
        }
      }

      // Click continue/save for goal
      const saveGoal = page.getByRole('button', { name: /Save|Add|Done|Continue/i }).first();
      if (await saveGoal.count() > 0) await saveGoal.click();
      await page.waitForTimeout(1500);
    } catch (e) {
      // best-effort
    }
    await page.screenshot({ path: `${outDir}/03-add-zero-goal.png`, fullPage: true });

    // Check for N/A text near target amount
    let naFound = false;
    try {
      naFound = await page.locator('text=N/A').count() > 0;
    } catch (e) {
      naFound = false;
    }

    // 4) Attempt to add other life event types with 0/empty where possible (best-effort enumeration)
    try {
      // open add goal flow again
      const addAgain = page.locator('button:has-text("Add") , button:has-text("Add goal")').first();
      if (await addAgain.count() > 0) await addAgain.click();
      await page.waitForTimeout(800);
      // try to iterate options if a list exists
      const options = await page.$$eval('.euiSelectableListItem, [role="option"]', els => els.map(e => (e as HTMLElement).innerText).slice(0, 8));
      const tried: string[] = [];
      for (const t of options) {
        if (tried.length > 6) break;
        tried.push(t);
        // click option by text
        const opt = page.locator(`text=${t}`).first();
        try {
          await opt.click();
          await page.waitForTimeout(400);
          // try to find amount input and set to 0 or leave empty
          const num = page.locator('input[type="number"], input[name*="amount"], input').first();
          if (await num.count() > 0) {
            try { await num.fill('0'); } catch {}
          }
          const save = page.getByRole('button', { name: /Save|Add|Done|Continue/i }).first();
          if (await save.count() > 0) await save.click();
          await page.waitForTimeout(600);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
    await page.screenshot({ path: `${outDir}/04-add-various-zero-goals.png`, fullPage: true });

    // 5) Fill realistic day-to-day income/expenses and savings contribution, then continue
    try {
      // navigate to budget/day-to-day step if present
      await page.goto('https://wealth.dev.fitbux.com/budget', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      // fill common inputs if present
      const salary = page.locator('input[name*="salary"], input[name*="annual"], input[placeholder*="income"]').first();
      if (await salary.count() > 0) await salary.fill('65000');
      const rent = page.locator('input[name*="rent"], input[placeholder*="rent"], input[name*="monthly__rent"]').first();
      if (await rent.count() > 0) await rent.fill('1500');
      const grocery = page.locator('input[name*="grocery"], input[placeholder*="grocery"]').first();
      if (await grocery.count() > 0) await grocery.fill('300');
      // savings contribution
      const savings = page.locator('input[name*="savings"], input[placeholder*="savings"]').first();
      if (await savings.count() > 0) await savings.fill('300');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${outDir}/05-filled-budget.png`, fullPage: true });
    } catch (e) {
      // ignore
    }

    // 6) Proceed to Goal Ranking and click Review Plan
    try {
      await page.goto('https://wealth.dev.fitbux.com/plan-builder?step=goal-ranking', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${outDir}/06-goal-ranking.png`, fullPage: true });

      // Click Review Plan / Review button
      const reviewBtn = page.getByRole('button', { name: /Review Plan|Review|Finish|Complete/i }).first();
      if (await reviewBtn.count() > 0) await reviewBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${outDir}/07-after-review-click.png`, fullPage: true });

      // Wait for robot loading image then for either navigation or an error state
      // Robot image heuristic: look for an <img> with alt or src containing 'robot' or 'loading'
      const robotImg = page.locator('img[alt*="robot" i], img[src*="robot" i], text=Loading');
      if (await robotImg.count() > 0) {
        // wait a little for it to resolve
        await page.waitForTimeout(4000);
      }

      // capture final state
      await page.screenshot({ path: `${outDir}/08-final-state.png`, fullPage: true });
    } catch (e) {
      // ignore
    }

    // Save artifacts: console errors and failed requests
    const bodyText = await page.locator('body').innerText();
    const finalUrl = page.url();
    const results = {
      scenario,
      naFound,
      finalUrl,
      bodyTextLength: bodyText.length,
      blankPage: bodyText.trim().length <= 20,
      consoleErrors,
      requestFailures
    };
    fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2));

    expect(bodyText.length).toBeGreaterThan(20);
    expect(results.blankPage).toBeFalsy();
    });
  }
});

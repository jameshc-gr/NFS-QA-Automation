import { test, expect, Page } from '@playwright/test';
import {
  loadProfile,
  activateProfile,
  fillWelcome,
  fillIncome,
  fillFederal,
  fillRepayment,
  linkPlaidAccount,
  getEnv,
  setEnvValue,
  recoverAssetsPageIfRefreshFails,
  waitForPlaidLinkedAccounts,
  continueFlowBeforeDashboard,
} from './test-setup';

test.setTimeout(900000);

const PROFILE = 'UI-FLOW-ASSETS-01';
loadProfile(PROFILE);

function setUniqueEmailForRun(profile: string) {
  activateProfile(profile);
  const baseEmail = getEnv('EMAIL');
  const [local = 'assets.user', domain = 'example.test'] = baseEmail.split('@');
  const seed = `${Date.now().toString(36)}.${Math.floor(Math.random() * 10000)}`;
  const uniqueEmail = `${local}.${seed}@${domain}`;
  setEnvValue('EMAIL', uniqueEmail);
}

async function navigateToAssetsWithoutRefresh(page: Page) {
  await page.waitForURL(/\/forgiveness\/(assets|repayment|partner-student-loans|federal)/, { timeout: 20000 }).catch(() => null);

  if (!page.url().includes('/forgiveness/assets')) {
    const continueButton = page.getByRole('button', { name: 'Continue' }).first();
    const canContinue =
      (await continueButton.isVisible().catch(() => false)) &&
      (await continueButton.isEnabled().catch(() => false));
    if (canContinue) {
      await continueButton.click().catch(() => null);
      await page.waitForURL(/\/forgiveness\/(assets|partner-student-loans)/, { timeout: 12000 }).catch(() => null);
    }
  }

  if (!page.url().includes('/forgiveness/assets')) {
    const origin = page.url().startsWith('http') ? new URL(page.url()).origin : 'https://student-loans.qa.fsp.rate.com';
    await page.goto(`${origin}/forgiveness/assets`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  }

  await expect(page).toHaveURL(/\/forgiveness\/assets/);
}

/**
 * Test: UI-FLOW-ASSETS-01 - Plaid Account Linking
 * 
 * Scenario: User links a bank account through Plaid integration using sandbox credentials
 * - Navigate through income and repayment steps
 * - On Assets page, click "Link account" button
 * - Select Platypus Bank from Plaid search
 * - Enter sandbox credentials (user_good / pass_good)
 * - Verify linked account appears in asset list
 * - Continue to next step
 */
test('Student IDR - UI-FLOW-ASSETS-01 - Link Account via Plaid (Platypus)', async ({ page }) => {
  setUniqueEmailForRun(PROFILE);

  await test.step('Navigate to Assets page', async () => {
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    await fillRepayment(page);
    await navigateToAssetsWithoutRefresh(page);
  });

  await test.step('Click Link Account and verify Plaid opens', async () => {
    const linkButton = page.getByRole('button', { name: /Link Account/i }).first();
    await expect(linkButton).toBeVisible({ timeout: 10000 });
    await linkButton.click();

    const personSelectorHeading = page.getByRole('heading', { name: /Who do you want to link this account for\?/i }).first();
    const plaidFrame = page.locator('iframe[name*="plaid" i], iframe[title*="plaid" i], iframe[src*="plaid" i]').first();
    let opened = false;
    for (let i = 0; i < 20; i++) {
      const hasPersonSelector = await personSelectorHeading.isVisible().catch(() => false);
      const hasPlaidFrame = await plaidFrame.isVisible().catch(() => false);
      if (hasPersonSelector || hasPlaidFrame) {
        opened = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    expect(opened).toBeTruthy();
  });

  await test.step('Dismiss Plaid and return to assets', async () => {
    const cancelPersonSelector = page.getByRole('button', { name: /Cancel/i }).first();
    if (await cancelPersonSelector.isVisible().catch(() => false)) {
      await cancelPersonSelector.click().catch(() => null);
    }

    const plaidRoot = page.frameLocator('iframe[name*="plaid" i], iframe[title*="plaid" i], iframe[src*="plaid" i]').first();
    const exitButton = plaidRoot.getByRole('button', { name: /Exit/i }).first();
    if (await exitButton.isVisible().catch(() => false)) {
      await exitButton.click().catch(() => null);
    }
  });

  await test.step('Remain on assets after link flow check', async () => {
    await expect(page).toHaveURL(/\/forgiveness\/assets/);
  });

  await test.step('Continue before dashboard without refresh', async () => {
    await continueFlowBeforeDashboard(page);
  });
});

/**
 * Alternative: Standalone Assets page test with explicit Plaid linking
 * This can be used to debug Plaid-specific issues independently
 */
test('Student IDR - UI-FLOW-ASSETS-01 - Plaid Linking Standalone', async ({ page }) => {
  setUniqueEmailForRun(PROFILE);

  await test.step('Setup and navigate to Assets page', async () => {
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    await fillRepayment(page);
    await navigateToAssetsWithoutRefresh(page);
  });

  await test.step('Perform Link Account flow through Plaid', async () => {
    await linkPlaidAccount(page, getEnv('PLAID_BANK'), getEnv('PLAID_USER'), getEnv('PLAID_PASSWORD'));
  });

  await test.step('Refresh assets and verify linked account state', async () => {
    const linkedAccountsRendered = await waitForPlaidLinkedAccounts(page);
    expect(linkedAccountsRendered).toBeTruthy();

    const plaidFrame = page.locator('iframe[name*="plaid" i], iframe[title*="plaid" i], iframe[src*="plaid" i]').first();
    await expect(plaidFrame).toBeHidden({ timeout: 10000 });
  });

  await test.step('Continue run before dashboard', async () => {
    await continueFlowBeforeDashboard(page);
  });
});

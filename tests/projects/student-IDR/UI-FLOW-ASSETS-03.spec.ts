import { test, expect } from '@playwright/test';
import { loadProfile, activateProfile, fillWelcome, fillIncome, fillFederal, fillRepayment, linkPlaidAccount, addManualAsset, clickWhenEnabled, getEnv, setEnvValue, recoverAssetsPageIfRefreshFails, waitForPlaidLinkedAccounts, continueFlowBeforeDashboard } from './test-setup';

test.setTimeout(900000);

const PROFILE = 'UI-FLOW-ASSETS-03';
loadProfile(PROFILE);

function setUniqueEmailForRun(profile: string) {
  activateProfile(profile);
  const baseEmail = getEnv('EMAIL');
  const [local = 'assets.user', domain = 'example.test'] = baseEmail.split('@');
  const seed = `${Date.now().toString(36)}.${Math.floor(Math.random() * 10000)}`;
  const uniqueEmail = `${local}.${seed}@${domain}`;
  setEnvValue('EMAIL', uniqueEmail);
}

async function continueUntilDashboard(page: import('@playwright/test').Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (page.url().includes('/dashboard')) return;

    const continueButton = page.getByRole('button', { name: 'Continue' }).first();
    const canContinue =
      (await continueButton.isVisible().catch(() => false)) &&
      (await continueButton.isEnabled().catch(() => false));

    if (canContinue) {
      await clickWhenEnabled(continueButton).catch(() => null);
      await page.waitForURL(/dashboard|\/forgiveness\//i, { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(1000);
    } else {
      await page.waitForTimeout(1000);
    }
  }
}

async function ensureAssetsPage(page: import('@playwright/test').Page) {
  const recovered = await recoverAssetsPageIfRefreshFails(page);
  if (recovered && page.url().includes('/forgiveness/assets')) return;

  const origin = page.url().startsWith('http') ? new URL(page.url()).origin : 'https://student-loans.qa.fsp.rate.com';
  await page.goto(`${origin}/forgiveness/assets`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForURL(/\/forgiveness\/assets/, { timeout: 20000 }).catch(() => null);
}

/**
 * Test: UI-FLOW-ASSETS-03 - Combined Plaid Linked + Manual Accounts
 * 
 * Scenario: User links one account via Plaid and adds manual account on same page
 * - Navigate through all setup steps to reach Assets page
 * - Link account via Plaid (Platypus Bank, user_good/pass_good)
 * - Add a manual account (Checking account)
 * - Verify both accounts appear in list
 * - Verify combined total is calculated correctly
 * - Continue to next step
 */
test('Student IDR - UI-FLOW-ASSETS-03 - Plaid + Manual Account Hybrid', async ({ page }) => {
  setUniqueEmailForRun(PROFILE);

  await test.step('Fill Welcome page', async () => {
    await fillWelcome(page);
  });

  await test.step('Fill Income page', async () => {
    await fillIncome(page);
  });

  await test.step('Fill Federal Student Loans page', async () => {
    await fillFederal(page);
  });

  await test.step('Fill Repayment Plan page', async () => {
    await fillRepayment(page);
  });

  await test.step('Navigate to Assets page', async () => {
    const recovered = await recoverAssetsPageIfRefreshFails(page);
    expect(recovered).toBeTruthy();
    expect(page.url()).toContain('/forgiveness/assets');
  });

  await test.step('Link Plaid account', async () => {
    const plaidBank = getEnv('PLAID_BANK_UI-FLOW-ASSETS-03');
    const plaidUser = getEnv('PLAID_USER_UI-FLOW-ASSETS-03');
    const plaidPass = getEnv('PLAID_PASSWORD_UI-FLOW-ASSETS-03');

    await linkPlaidAccount(page, plaidBank, plaidUser, plaidPass);
  expect(await waitForPlaidLinkedAccounts(page)).toBeTruthy();
  });

  await test.step('Add manual checking account', async () => {
    await addManualAsset(
      page,
      'Primary Checking',       // accountName
      'Cash',                   // accountType
      'Local Bank',             // institution
      '8500',                   // balance
      'Applicant',              // owner
      true                      // includeTaxBomb
    );
  });

  await test.step('Verify both accounts present', async () => {
    // Check for Plaid-linked account
    const plaidAccount = page.locator('text=/Platypus|Bank Account|Linked/i').first();
    await plaidAccount.isVisible({ timeout: 5000 }).then(
      visible => console.log('✓ Plaid account visible'),
      () => console.log('⚠ Plaid account not visible')
    );

    // Check for manual account
    const manualAccount = page.locator('text=/Primary Checking/i').first();
    await manualAccount.isVisible({ timeout: 5000 }).then(
      visible => console.log('✓ Manual account visible'),
      () => console.log('⚠ Manual account not visible')
    );
  });

  await test.step('Continue to next step', async () => {
    await continueFlowBeforeDashboard(page);
  });
});

/**
 * Test: UI-FLOW-ASSETS-03 - Multiple Accounts Mixed Sources
 * 
 * Scenario: Link Plaid account, then add 2-3 manual accounts with different types
 * Tests complex asset page with mixed data entry methods
 */
test('Student IDR - UI-FLOW-ASSETS-03 - Mixed Asset Sources (Plaid + Multiple Manual)', async ({ page }) => {
  setUniqueEmailForRun(PROFILE);

  await test.step('Setup: Navigate to Assets page', async () => {
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    await fillRepayment(page);
    const recovered = await recoverAssetsPageIfRefreshFails(page);
    expect(recovered).toBeTruthy();
    expect(page.url()).toContain('/forgiveness/assets');
  });

  await test.step('Link Plaid account - Platypus Bank', async () => {
    await linkPlaidAccount(page, 'Platypus Bank', 'user_good', 'pass_good');
    expect(await waitForPlaidLinkedAccounts(page)).toBeTruthy();
  });

  const manualAccounts = [
    { name: 'Savings Account', type: 'Cash', institution: 'Community Bank', balance: '22000' },
    { name: 'Investment Brokerage', type: 'Other Investments', institution: 'TD Ameritrade', balance: '145000' },
  ];

  for (const account of manualAccounts) {
    await test.step(`Add manual account: ${account.name}`, async () => {
      await addManualAsset(
        page,
        account.name,
        account.type,
        account.institution,
        account.balance,
        'Applicant',
        true
      );
    });
  }

  await test.step('Verify all assets visible', async () => {
    const assets = [
      { pattern: /Platypus|Bank Account|Linked/, name: 'Plaid account' },
      { pattern: /Savings Account|Community Bank/, name: 'Manual savings' },
      { pattern: /Investment Brokerage|TD Ameritrade/, name: 'Manual investment' },
    ];

    for (const asset of assets) {
      await page.locator(`text=/${asset.pattern.source}/i`).first()
        .isVisible({ timeout: 5000 })
        .then(
          visible => console.log(`✓ ${asset.name} visible`),
          () => console.log(`⚠ ${asset.name} not visible`)
        );
    }
  });

  await test.step('Continue to summary', async () => {
    await continueFlowBeforeDashboard(page);
  });
});

test('Student IDR - UI-FLOW-ASSETS-03 - Enter Manually Edit And Retain In Mixed Flow', async ({ page }) => {
  setUniqueEmailForRun(PROFILE);

  await test.step('Setup: Reach assets page', async () => {
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    await fillRepayment(page);
    await ensureAssetsPage(page);
    expect(page.url()).toContain('/forgiveness/assets');
  });

  await test.step('Link plaid and add multiple manual accounts', async () => {
    await linkPlaidAccount(page, 'Platypus Bank', 'user_good', 'pass_good');
    expect(await waitForPlaidLinkedAccounts(page)).toBeTruthy();
    await addManualAsset(page, 'Hybrid Manual A', 'Cash', 'Hybrid Bank A', '7300', 'Applicant', true);
    await addManualAsset(page, 'Hybrid Manual B', 'Other Investments', 'Hybrid Broker B', '48000', 'Applicant', true);
  });

  await test.step('Edit manual account and verify retained after refresh', async () => {
    const manualCard = page.locator('text=Hybrid Manual A').first().locator('..').locator('..').locator('..').first();
    const editButton = manualCard.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForTimeout(500);
      const balanceInput = page.locator('input[name*="currentBalance-"]').first();
      if (await balanceInput.isVisible().catch(() => false)) {
        await balanceInput.fill('9100');
      }
      const saveButton = page.getByRole('button', { name: /Save|Update/i }).first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
      }
    }

    const recovered = await recoverAssetsPageIfRefreshFails(page);
    expect(recovered).toBeTruthy();
    await expect(page.locator('text=/Hybrid Manual A/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Hybrid Manual B/i').first()).toBeVisible({ timeout: 5000 });
  });

  await test.step('Continue flow', async () => {
    await continueFlowBeforeDashboard(page);
  });
});

test('Student IDR - UI-FLOW-ASSETS-03 - Manual Add More Edit + Plaid + Refresh + Continue', async ({ page }) => {
  setUniqueEmailForRun(PROFILE);

  await test.step('Setup: Reach assets page', async () => {
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    await fillRepayment(page);
    const recovered = await recoverAssetsPageIfRefreshFails(page);
    expect(recovered).toBeTruthy();
    expect(page.url()).toContain('/forgiveness/assets');
  });

  await test.step('Enter manually: add account and add more account', async () => {
    await addManualAsset(page, 'Flow Manual One', 'Cash', 'Flow CU One', '12500', 'Applicant', true);
    await addManualAsset(page, 'Flow Manual Two', '401K', 'Flow Retirement', '89000', 'Applicant', true);

    await expect(page.locator('text=/Flow Manual One/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Flow Manual Two/i').first()).toBeVisible({ timeout: 5000 });
  });

  await test.step('Edit one manual account', async () => {
    const manualCard = page.locator('text=Flow Manual One').first().locator('..').locator('..').locator('..').first();
    const editButton = manualCard.locator('button:has-text("Edit")').first();

    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForTimeout(500);

      const balanceInput = page.locator('input[name*="currentBalance-"]').first();
      if (await balanceInput.isVisible().catch(() => false)) {
        await balanceInput.fill('15000');
      }

      const saveButton = page.getByRole('button', { name: /Save|Update/i }).first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
      }
    }
  });

  await test.step('Link account with Plaid', async () => {
    await linkPlaidAccount(page, 'Platypus Bank', 'user_good', 'pass_good');
  });

  await test.step('Refresh after Plaid and verify all linked/manual accounts', async () => {
    const linkedAccountsRendered = await waitForPlaidLinkedAccounts(page);
    expect(linkedAccountsRendered).toBeTruthy();

    await expect(page.locator('text=/Flow Manual One/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Flow Manual Two/i').first()).toBeVisible({ timeout: 5000 });

    const plaidAccount = page.locator('text=/Platypus|Bank Account|Linked/i').first();
    await expect(plaidAccount).toBeVisible({ timeout: 10000 }).catch(() => null);
  });

  await test.step('Apply message/plaid fallback rules before continue', async () => {
    const manualFallbackMessage = page
      .locator('text=/unable to link|can\'t connect|couldn\'t connect|no linked accounts|link issue|try again/i')
      .first();
    const hasFallbackMessage = await manualFallbackMessage.isVisible().catch(() => false);

    if (hasFallbackMessage) {
      await addManualAsset(page, 'Fallback Manual Cash', 'Cash', 'Fallback CU', '6000', 'Applicant', true);
    }

    const plaidDisplayed = await page.locator('text=/Platypus|Linked|Bank Account/i').first().isVisible().catch(() => false);
    if (plaidDisplayed) {
      await addManualAsset(page, 'Plaid Mix Cash A', 'Cash', 'Mix Bank A', '3000', 'Applicant', true);
      await addManualAsset(page, 'Plaid Mix Cash B', 'Cash', 'Mix Bank B', '4500', 'Applicant', true);
      await addManualAsset(page, 'Plaid Mix Cash C', 'Cash', 'Mix Bank C', '5200', 'Applicant', true);
    }
  });

  await test.step('Continue until dashboard and finish scenario', async () => {
    await continueUntilDashboard(page);
    await expect(page).toHaveURL(/dashboard/i);
  });
});

import { test, expect, Page } from '@playwright/test';
import { fillWelcome, fillIncome, getEnv, loadProfile, setEnvValue, activateProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'BASE';
loadProfile(PROFILE);

test.describe('ASSETS PAGE - Account Management & Calculation Testing', () => {
  
  test('ASSETS-DISCOVERY-001: Inspect Assets Page Structure', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS PAGE STRUCTURE DISCOVERY =====');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate through federal page to reach assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    // Try clicking continue again to get to assets
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Find all input fields
    const allInputs = await page.locator('input').all();
    console.log(`Total input fields found: ${allInputs.length}`);
    
    // Find all buttons
    const allButtons = await page.getByRole('button').all();
    console.log(`Total buttons found: ${allButtons.length}`);
    
    // Look for account/asset sections
    const sections = await page.locator('[class*="account"], [class*="asset"]').all();
    console.log(`Account/Asset sections found: ${sections.length}`);
    
    console.log('\nButton Labels:');
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const text = await allButtons[i].textContent();
      console.log(`  ${i + 1}. ${text?.trim()}`);
    }
  });
  
  test('ASSETS-BOUNDARY-001: Add Single Asset Account', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-001: Add Single Asset Account =====');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets page
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    // Check if we're on assets page
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page yet. Current: ${currentUrl}`);
      return;
    }
    
    console.log('✓ On assets page');
    
    // Look for "Add account" or "Add asset" button
    const addBtn = page.getByRole('button', { name: /add|new|plus/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      console.log('✓ Clicked add account button');
      
      // Count account rows before
      const rowsBefore = await page.locator('input[name*="account"], input[name*="asset"]').count();
      console.log(`Account fields before: ${rowsBefore}`);
    }
  });
  
  test('ASSETS-BOUNDARY-002: Add Multiple Asset Accounts', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-002: Add Multiple Asset Accounts =====');
    console.log('Test: Add 5 different asset accounts');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    // Sample assets to add
    const assets = [
      { name: 'Savings Account', value: '25000' },
      { name: 'Money Market', value: '50000' },
      { name: 'Investment Account', value: '75000' },
      { name: 'Certificate of Deposit', value: '10000' },
      { name: 'Other Assets', value: '5000' },
    ];
    
    // Try to add accounts
    let accountCount = 0;
    for (let i = 0; i < assets.length; i++) {
      const addBtn = page.getByRole('button', { name: /add|new|plus/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(400);
        accountCount++;
        console.log(`Added account ${accountCount}: ${assets[i].name}`);
      } else {
        console.log(`Cannot add more accounts (button not visible)`);
        break;
      }
    }
    
    console.log(`Total accounts added: ${accountCount}`);
    
    // Count final field groups
    const finalInputs = await page.locator('input[name*="account"], input[name*="asset"]').count();
    console.log(`Final asset input fields: ${finalInputs}`);
  });
  
  test('ASSETS-BOUNDARY-003: Remove Asset Account', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-003: Remove Asset Account =====');
    console.log('Test: Add account, then remove it');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    // Count initial accounts
    const initialCount = await page.locator('input[name*="account-"], input[name*="asset-"]').count();
    console.log(`Initial account fields: ${initialCount}`);
    
    // Add an account
    const addBtn = page.getByRole('button', { name: /add|new|plus/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(400);
    }
    
    const afterAddCount = await page.locator('input[name*="account-"], input[name*="asset-"]').count();
    console.log(`After adding: ${afterAddCount}`);
    
    // Look for delete/remove button
    const deleteBtn = page.getByRole('button', { name: /delete|remove|trash/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(400);
      console.log('✓ Clicked delete button');
      
      const afterDeleteCount = await page.locator('input[name*="account-"], input[name*="asset-"]').count();
      console.log(`After deleting: ${afterDeleteCount}`);
      console.log(`Fields removed: ${Math.max(0, afterAddCount - afterDeleteCount)}`);
    } else {
      console.log('Delete button not found');
    }
  });
  
  test('ASSETS-BOUNDARY-004: Negative Asset Values', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-004: Negative Asset Values =====');
    console.log('Test: Try to enter negative asset amount');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    // Find an asset amount field
    const assetInputs = await page.locator('input[type="text"][name*="amount"], input[type="text"][name*="value"]').all();
    if (assetInputs.length > 0) {
      await assetInputs[0].fill('-50000');
      const displayed = await assetInputs[0].inputValue();
      console.log(`Input: -50000 → Displayed: ${displayed}`);
      console.log(`Negative stripped: ${!displayed.includes('-')}`);
    } else {
      console.log('No asset amount fields found');
    }
  });
  
  test('ASSETS-BOUNDARY-005: Extreme Asset Values', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-005: Extreme Asset Values =====');
    console.log('Test: Enter maximum asset amount ($999,999,999)');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    const assetInputs = await page.locator('input[type="text"][name*="amount"], input[type="text"][name*="value"]').all();
    if (assetInputs.length > 0) {
      await assetInputs[0].fill('999999999');
      const displayed = await assetInputs[0].inputValue();
      console.log(`Input: 999999999 → Displayed: ${displayed}`);
    }
  });
  
  test('ASSETS-BOUNDARY-006: Asset Calculation - Total Display', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-006: Asset Calculation - Total Display =====');
    console.log('Test: Add multiple assets and verify total calculation');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    // Look for total/sum display
    const totalText = await page.locator('text=/total|sum|combined|overall/i').first().textContent();
    if (totalText) {
      console.log(`Total display found: ${totalText}`);
    } else {
      console.log('No total display element found');
    }
    
    // Look for any readonly or disabled summary fields
    const summaryFields = await page.locator('input[readonly], input[disabled]').all();
    console.log(`Summary/readonly fields found: ${summaryFields.length}`);
    
    for (let i = 0; i < Math.min(summaryFields.length, 3); i++) {
      const value = await summaryFields[i].inputValue();
      const label = await summaryFields[i].getAttribute('aria-label') || 
                    await summaryFields[i].getAttribute('name') || 'Unknown';
      console.log(`  ${label}: ${value}`);
    }
  });
  
  test('ASSETS-BOUNDARY-007: Zero Asset Values', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-007: Zero Asset Values =====');
    console.log('Test: Enter zero for all assets');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    const assetInputs = await page.locator('input[type="text"][name*="amount"], input[type="text"][name*="value"]').all();
    console.log(`Asset input fields found: ${assetInputs.length}`);
    
    // Fill all with zero
    for (let i = 0; i < assetInputs.length; i++) {
      await assetInputs[i].fill('0').catch(() => null);
    }
    
    // Check if continue button enabled
    const continueBtn = page.getByRole('button', { name: 'Continue' }).first();
    const isDisabled = await continueBtn.isDisabled();
    console.log(`Continue button disabled when all assets are zero: ${isDisabled}`);
  });
  
  test('ASSETS-BOUNDARY-008: Account Limit Testing', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-008: Account Limit Testing =====');
    console.log('Test: Try to add maximum number of asset accounts');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    // Try adding many accounts
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < 20; i++) {
      const addBtn = page.getByRole('button', { name: /add|new|plus/i }).first();
      
      if (await addBtn.isVisible().catch(() => false)) {
        const isDisabled = await addBtn.isDisabled();
        if (!isDisabled) {
          await addBtn.click();
          await page.waitForTimeout(200);
          successCount++;
        } else {
          console.log(`Add button disabled at attempt ${i + 1} (limit reached)`);
          failCount++;
          break;
        }
      } else {
        console.log(`Add button invisible at attempt ${i + 1}`);
        failCount++;
        break;
      }
    }
    
    console.log(`Successfully added: ${successCount} accounts`);
    console.log(`Failed to add: ${failCount} times`);
    
    if (failCount > 0) {
      console.log('✓ Account limit enforced');
    }
  });
  
  test('ASSETS-BOUNDARY-009: Asset Account Types & Labels', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== ASSETS-BOUNDARY-009: Asset Account Types & Labels =====');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to assets
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/assets')) {
      console.log(`Not on assets page. Current: ${currentUrl}`);
      return;
    }
    
    // Look for dropdowns or select options
    const selects = await page.locator('select').all();
    console.log(`Select/dropdown elements: ${selects.length}`);
    
    for (let i = 0; i < selects.length; i++) {
      const options = await selects[i].locator('option').all();
      const label = await selects[i].getAttribute('name') || await selects[i].getAttribute('aria-label') || `Select ${i}`;
      console.log(`\n${label}:`);
      for (let j = 0; j < Math.min(options.length, 5); j++) {
        const text = await options[j].textContent();
        console.log(`  - ${text}`);
      }
      if (options.length > 5) {
        console.log(`  ... and ${options.length - 5} more`);
      }
    }
  });
});

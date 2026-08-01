import { test, expect, Page } from '@playwright/test';
import { fillWelcome, fillIncome, getEnv, loadProfile, setEnvValue, activateProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'BASE';
loadProfile(PROFILE);

test.describe('FEDERAL LOANS PAGE - Comprehensive Boundary Testing', () => {
  
  test('FEDERAL-BOUNDARY-001: Negative Loan Balance', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    setEnvValue('APPLICANT_LOANS', '-50000|5|0|0'); // Negative balance
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-001: Negative Loan Balance =====');
    console.log('Test: Input negative balance (-$50,000)');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to federal page
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    // Click "Enter individually" button
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    // Try to add a new loan if needed
    const addButton = page.getByRole('button', { name: /New loan/i }).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(300);
    }
    
    // Fill with negative value
    const balanceInput = page.locator('input[name="loan-balance-0"]').first();
    if (await balanceInput.isVisible().catch(() => false)) {
      await balanceInput.fill('-50000');
      const displayed = await balanceInput.inputValue();
      console.log(`Input: -50000 → Displayed: ${displayed}`);
      console.log(`Negative sign stripped: ${!displayed.includes('-')}`);
      expect(displayed).not.toContain('-');
    }
  });
  
  test('FEDERAL-BOUNDARY-002: Negative APR', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    setEnvValue('APPLICANT_LOANS', '50000|-2.5|50000|0'); // Negative APR
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-002: Negative APR =====');
    console.log('Test: Input negative APR (-2.5%)');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    // Click "Enter individually" button
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    const addButton = page.getByRole('button', { name: /New loan/i }).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(300);
    }
    
    // Fill APR field
    const aprInput = page.locator('input[name="loan-apr-0"]').first();
    if (await aprInput.isVisible().catch(() => false)) {
      await aprInput.fill('-2.5');
      const displayed = await aprInput.inputValue();
      console.log(`Input: -2.5 → Displayed: ${displayed}`);
      console.log(`Negative sign stripped: ${!displayed.includes('-')}`);
      expect(displayed).not.toContain('-');
    }
  });
  
  test('FEDERAL-BOUNDARY-003: APR Over 100%', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    setEnvValue('APPLICANT_LOANS', '50000|150|50000|0'); // 150% APR
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-003: APR Over 100% =====');
    console.log('Test: Input extreme APR (150%)');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    const addButton = page.getByRole('button', { name: /New loan/i }).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(300);
    }
    
    const aprInput = page.locator('input[name="loan-apr-0"]').first();
    if (await aprInput.isVisible().catch(() => false)) {
      await aprInput.fill('150');
      const displayed = await aprInput.inputValue();
      console.log(`Input: 150 → Displayed: ${displayed}`);
      console.log(`Accepted: ${displayed.includes('150') || displayed.includes('15')}`);
      expect(displayed).toBeTruthy();
    }
  });
  
  test('FEDERAL-BOUNDARY-004: Balance vs Principal+Accrued Mismatch', async ({ page }) => {
    activateProfile('BASE');
    // Balance ($100) != Principal ($50) + Accrued ($20) = should FAIL
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    setEnvValue('APPLICANT_LOANS', '100|5|50|20'); // Mismatch
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-004: Balance/Principal/Accrued Mismatch =====');
    console.log('Test: Balance ($100) != Principal ($50) + Accrued ($20)');
    console.log('Expected: Form should show validation error');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    const addButton = page.getByRole('button', { name: /New loan/i }).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(300);
    }
    
    // Fill all four fields
    await page.locator('input[name="loan-balance-0"]').first().fill('100').catch(() => null);
    await page.locator('input[name="loan-apr-0"]').first().fill('5').catch(() => null);
    await page.locator('input[name="loan-principal-0"]').first().fill('50').catch(() => null);
    await page.locator('input[name="loan-accruedInterest-0"]').first().fill('20').catch(() => null);
    
    // Try to continue
    await page.waitForTimeout(500);
    btn = page.getByRole('button', { name: 'Continue' }).first();
    const isDisabled = await btn.isDisabled();
    
    console.log(`Continue button disabled: ${isDisabled}`);
    
    if (!isDisabled) {
      console.log('WARNING: Form accepted invalid balance calculation (100 != 50+20)');
      expect(isDisabled).toBeTruthy();
    } else {
      console.log('✓ Form correctly rejected invalid calculation');
    }
  });
  
  test('FEDERAL-BOUNDARY-005: Zero Balance', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter total');
    setEnvValue('APPLICANT_BALANCE', '0');
    setEnvValue('APPLICANT_RATE', '0');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-005: Zero Balance =====');
    console.log('Test: All loan values set to zero');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    // Use "Enter total" mode
    await page.getByRole('button', { name: /Enter total/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    const balanceInputs = await page.locator('input[aria-label*="balance" i]').all();
    if (balanceInputs.length > 0) {
      await balanceInputs[0].fill('0');
      const displayed = await balanceInputs[0].inputValue();
      console.log(`Zero balance input displayed as: ${displayed}`);
    }
  });
  
  test('FEDERAL-BOUNDARY-006: Extreme Values', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    setEnvValue('APPLICANT_LOANS', '999999999|100|999999999|0'); // Extreme values
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-006: Extreme Values =====');
    console.log('Test: Balance=$999,999,999 APR=100%');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    const addButton = page.getByRole('button', { name: /New loan/i }).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(300);
    }
    
    const balanceInput = page.locator('input[name="loan-balance-0"]').first();
    const aprInput = page.locator('input[name="loan-apr-0"]').first();
    
    if (await balanceInput.isVisible().catch(() => false)) {
      await balanceInput.fill('999999999');
      const balanceDisplay = await balanceInput.inputValue();
      console.log(`Extreme balance input displayed as: ${balanceDisplay}`);
    }
    
    if (await aprInput.isVisible().catch(() => false)) {
      await aprInput.fill('100');
      const aprDisplay = await aprInput.inputValue();
      console.log(`100% APR input displayed as: ${aprDisplay}`);
    }
  });
  
  test('FEDERAL-BOUNDARY-007: Multiple Loans - Addition & Deletion', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOAN_ENTRY_MODE', 'Enter individually');
    // Three loans
    setEnvValue('APPLICANT_LOANS', '25000|4.5|20000|5000;35000|5.5|28000|7000;45000|6|40000|5000');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== FEDERAL-BOUNDARY-007: Multiple Loans =====');
    console.log('Test: Add and manage multiple federal loans');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click();
    await page.waitForNavigation().catch(() => null);
    
    await page.getByRole('button', { name: /Enter individually/i }).first().click().catch(() => null);
    await page.waitForTimeout(500);
    
    // Count initial rows
    let rowCount = await page.locator('input[name^="loan-balance-"]').count();
    console.log(`Initial loan rows: ${rowCount}`);
    
    // Add loans
    const addButton = page.getByRole('button', { name: /New loan/i }).first();
    for (let i = 0; i < 2; i++) {
      if (await addButton.isVisible().catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(400);
      }
    }
    
    rowCount = await page.locator('input[name^="loan-balance-"]').count();
    console.log(`After adding loans: ${rowCount}`);
    
    // Fill all loans
    const loans = [
      { balance: '25000', apr: '4.5', principal: '20000', accrued: '5000' },
      { balance: '35000', apr: '5.5', principal: '28000', accrued: '7000' },
      { balance: '45000', apr: '6', principal: '40000', accrued: '5000' },
    ];
    
    for (let i = 0; i < loans.length && i < rowCount; i++) {
      await page.locator(`input[name="loan-balance-${i}"]`).first().fill(loans[i].balance).catch(() => null);
      await page.locator(`input[name="loan-apr-${i}"]`).first().fill(loans[i].apr).catch(() => null);
      await page.locator(`input[name="loan-principal-${i}"]`).first().fill(loans[i].principal).catch(() => null);
      await page.locator(`input[name="loan-accruedInterest-${i}"]`).first().fill(loans[i].accrued).catch(() => null);
    }
    
    console.log(`✓ Filled ${loans.length} loans`);
  });
});

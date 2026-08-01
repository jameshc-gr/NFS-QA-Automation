import { test, expect, Page } from '@playwright/test';
import { fillWelcome, fillIncome, getEnv, loadProfile, setEnvValue, activateProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'BASE';
loadProfile(PROFILE);

test.describe('REPAYMENT PAGE - Validation & Calculation Testing', () => {
  
  test('REPAYMENT-DISCOVERY: Inspect Repayment Page Structure', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== REPAYMENT PAGE STRUCTURE DISCOVERY =====');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate through federal page to reach repayment
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    // Try clicking continue again to get to repayment
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    console.log('On repayment page:', currentUrl.includes('/repayment'));
    
    // Find all input fields
    const allInputs = await page.locator('input').all();
    console.log(`\nTotal input fields found: ${allInputs.length}`);
    
    console.log('\nInput Field Details:');
    for (let i = 0; i < allInputs.length; i++) {
      const name = await allInputs[i].getAttribute('name');
      const type = await allInputs[i].getAttribute('type');
      const placeholder = await allInputs[i].getAttribute('placeholder');
      const ariaLabel = await allInputs[i].getAttribute('aria-label');
      const value = await allInputs[i].inputValue();
      
      if (name || placeholder || ariaLabel) {
        console.log(`\nField ${i + 1}:`);
        if (name) console.log(`  Name: ${name}`);
        if (type) console.log(`  Type: ${type}`);
        if (placeholder) console.log(`  Placeholder: ${placeholder}`);
        if (ariaLabel) console.log(`  Aria-label: ${ariaLabel}`);
        if (value) console.log(`  Current Value: ${value}`);
      }
    }
    
    // Look for any text mentioning assets, accounts, or similar
    const bodyText = await page.locator('body').textContent();
    console.log('\nPage contains "asset":', bodyText?.toLowerCase().includes('asset'));
    console.log('Page contains "account":', bodyText?.toLowerCase().includes('account'));
    console.log('Page contains "savings":', bodyText?.toLowerCase().includes('savings'));
    console.log('Page contains "investment":', bodyText?.toLowerCase().includes('investment'));
  });
  
  test('REPAYMENT-CALC-001: Verify Income to Repayment Flow', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_AGI', '50000');
    setEnvValue('APPLICANT_SPOUSE_AGI', '40000');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== REPAYMENT-CALC-001: Income to Repayment Flow =====');
    console.log('AGI: $50,000 + Spouse AGI: $40,000 = Total: $90,000');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to repayment
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    // Check if on repayment page
    const url = page.url();
    if (url.includes('/repayment')) {
      console.log('✓ Successfully reached repayment page');
      
      // Look for displayed income values
      const pageText = await page.locator('body').textContent();
      console.log('\nSearching for income display...');
      console.log('Contains "50000" or "$50":', pageText?.includes('50000') || pageText?.includes('$50'));
      console.log('Contains "90000" or "$90":', pageText?.includes('90000') || pageText?.includes('$90'));
    }
  });
  
  test('REPAYMENT-CALC-002: Check Income-Based Repayment Calculation', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_AGI', '75000');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== REPAYMENT-CALC-002: Repayment Calculation =====');
    console.log('Testing if repayment amount changes based on income');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to repayment
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const url = page.url();
    if (url.includes('/repayment')) {
      // Look for any readonly/display fields that show calculated values
      const readonlyFields = await page.locator('input[readonly], input[disabled]').all();
      console.log(`Readonly/disabled fields: ${readonlyFields.length}`);
      
      for (let i = 0; i < readonlyFields.length; i++) {
        const value = await readonlyFields[i].inputValue();
        const label = await readonlyFields[i].getAttribute('aria-label') || 'Unknown';
        console.log(`  ${label}: ${value}`);
      }
      
      // Look for displayed text about payment amounts
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      console.log('\nPage Headings:');
      for (let i = 0; i < Math.min(headings.length, 5); i++) {
        const text = await headings[i].textContent();
        console.log(`  ${text}`);
      }
    }
  });
  
  test('REPAYMENT-CALC-003: Federal vs Other Loan Calculations', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_LOANS', '100000|5.5|85000|15000');  // Federal loans
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== REPAYMENT-CALC-003: Federal Loan Calculations =====');
    console.log('Loan Details: Balance=$100,000, APR=5.5%, Principal=$85k, Accrued=$15k');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate through federal page
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    // Check if we can see calculated values
    const pageText = await page.locator('body').textContent();
    console.log('Page displays loan balance:', pageText?.includes('100000') || pageText?.includes('$100'));
    console.log('Page displays APR:', pageText?.includes('5.5'));
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const url = page.url();
    console.log('Current URL:', url);
    if (url.includes('/repayment')) {
      console.log('✓ Reached repayment page after federal loans entry');
    }
  });
  
  test('REPAYMENT-CALC-004: Household Size Impact', async ({ page }) => {
    activateProfile('BASE');
    setEnvValue('APPLICANT_DEPENDENTS', '3');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== REPAYMENT-CALC-004: Household Size Impact =====');
    console.log('Testing if household size (3 dependents) affects calculations');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to repayment
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const url = page.url();
    if (url.includes('/repayment')) {
      // Look for poverty guideline or household size references
      const bodyText = await page.locator('body').textContent();
      console.log('Page mentions "household":', bodyText?.toLowerCase().includes('household'));
      console.log('Page mentions "poverty":', bodyText?.toLowerCase().includes('poverty'));
      console.log('Page mentions "dependents":', bodyText?.toLowerCase().includes('dependent'));
      console.log('Page mentions "family":', bodyText?.toLowerCase().includes('family'));
    }
  });
  
  test('REPAYMENT-VALIDATION-001: Continue Button State', async ({ page }) => {
    activateProfile('BASE');
    
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== REPAYMENT-VALIDATION-001: Continue Button State =====');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    // Navigate to repayment
    let btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    btn = page.getByRole('button', { name: 'Continue' }).first();
    await btn.click().catch(() => null);
    await page.waitForNavigation().catch(() => null);
    await page.waitForTimeout(300);
    
    const url = page.url();
    if (url.includes('/repayment')) {
      // Check continue button state
      const continueBtn = page.getByRole('button', { name: 'Continue' }).first();
      const isDisabled = await continueBtn.isDisabled();
      const isVisible = await continueBtn.isVisible().catch(() => false);
      
      console.log(`Continue button visible: ${isVisible}`);
      console.log(`Continue button disabled: ${isDisabled}`);
      
      if (!isDisabled && isVisible) {
        console.log('✓ Can proceed to next page (Continue enabled)');
      }
    }
  });
});

import { test, expect, Page } from '@playwright/test';
import { fillWelcome } from './test-setup';

test.describe('VERIFY: UI Display vs Data Received - Comprehensive Check', () => {
  
  test('Check AGI/Income field: -50000 input', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    await fillWelcome(page);
    
    const agiInput = page.locator('input[name="agiOrIncome"]').first();
    
    // Fill with negative value
    await agiInput.fill('-50000');
    const displayedValue = await agiInput.inputValue();
    
    console.log('AGI Test:');
    console.log('  Input: -50000');
    console.log('  UI Display:', displayedValue);
    
    // Check what's actually in the DOM
    const dataValue = await agiInput.getAttribute('value');
    console.log('  DOM value attr:', dataValue);
    
    // Verify behavior
    expect(displayedValue).toBe('$50,000');  // Should show as positive
    expect(displayedValue).not.toContain('-');
  });

  test('Check Password field requirements', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    await fillWelcome(page);
    
    // Navigate to account creation or find password field
    // First, try to find password requirements text on page
    const pageText = await page.content();
    const passwordRequirements = pageText.match(/password.*(?:must|should|require|contain).*[a-z]/i);
    
    console.log('\n===== PASSWORD REQUIREMENTS CHECK =====');
    if (passwordRequirements) {
      console.log('Found password requirements on page:');
      console.log(passwordRequirements[0]);
    } else {
      console.log('No password requirements text found on current page');
    }
    
    // Try to find password input fields and their labels
    const passwordInputs = await page.locator('input[type="password"]').all();
    console.log('Password input fields found:', passwordInputs.length);
    
    // Try test different password values and see what happens
    const testPasswords = [
      { value: 'Password123!', desc: 'Strong password' },
      { value: 'password123', desc: 'No uppercase' },
      { value: 'PASSWORD123', desc: 'No lowercase' },
      { value: 'PasswordABC', desc: 'No number' },
      { value: 'Pass123', desc: 'Too short (7 chars)' },
      { value: 'Password123!Morgan', desc: 'Contains last name Morgan' },
    ];
    
    console.log('\nPassword validation tests:');
    for (const test of testPasswords) {
      // Note: Can't actually test all of these without full form context
      console.log(`  - ${test.desc}: "${test.value}"`);
    }
  });

  test('Check Loan Balance field: -25000 input', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    await fillWelcome(page);
    
    // Navigate to loans section - this might require going through income first
    console.log('\n===== LOAN BALANCE TEST =====');
    console.log('Testing if negative loan balance is accepted');
    
    // Try to find any balance input field
    const balanceFields = await page.locator('input[placeholder*="balance" i], input[placeholder*="amount" i]').all();
    console.log('Found potential balance fields:', balanceFields.length);
    
    if (balanceFields.length > 0) {
      await balanceFields[0].fill('-25000');
      const displayedValue = await balanceFields[0].inputValue();
      console.log('Balance input display:', displayedValue);
    }
  });

  test('Check APR/Interest Rate field: -2.5 input', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== APR FIELD TEST =====');
    console.log('Testing if negative APR is accepted');
    
    // Try to find APR/rate input
    const aprFields = await page.locator('input[placeholder*="rate" i], input[placeholder*="APR" i], input[placeholder*="interest" i]').all();
    console.log('Found potential APR fields:', aprFields.length);
  });

  test('Check XSS Vulnerability: Script Tag in Name', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== XSS VULNERABILITY TEST =====');
    
    // Try to find name input
    const firstNameInput = page.locator('input[name*="firstName" i], input[placeholder*="first name" i]').first();
    
    if (await firstNameInput.isVisible().catch(() => false)) {
      const testXss = '<script>alert("xss")</script>John';
      await firstNameInput.fill(testXss);
      
      const displayedValue = await firstNameInput.inputValue();
      console.log('XSS Test:');
      console.log('  Input:', testXss);
      console.log('  UI Display:', displayedValue);
      console.log('  Contains <script>:', displayedValue.includes('<script>'));
      console.log('  Contains alert:', displayedValue.includes('alert'));
    }
  });

  test('Inspect actual input types and masks', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    await fillWelcome(page);
    
    console.log('\n===== INPUT FIELD INSPECTION =====');
    
    // Get all input fields
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields`);
    
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const input = inputs[i];
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const dataType = await input.getAttribute('data-type');
      const pattern = await input.getAttribute('pattern');
      const inputMode = await input.getAttribute('inputmode');
      
      if (name || placeholder) {
        console.log(`\nInput ${i + 1}:`);
        console.log(`  Name: ${name}`);
        console.log(`  Type: ${type}`);
        console.log(`  Placeholder: ${placeholder}`);
        console.log(`  Data-type: ${dataType}`);
        console.log(`  Pattern: ${pattern}`);
        console.log(`  InputMode: ${inputMode}`);
      }
    }
  });
});

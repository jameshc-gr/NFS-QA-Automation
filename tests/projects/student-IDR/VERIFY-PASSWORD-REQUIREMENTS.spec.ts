import { test, expect, Page } from '@playwright/test';
import { getEnv, loadProfile } from './test-setup';

test.setTimeout(120000);

const PROFILE = 'SCN-016';
loadProfile(PROFILE);

test.describe('VERIFY: Password Requirements - Welcome Page', () => {
  
  test('Test 1: Minimum password requirement check', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    console.log('\n===== PASSWORD REQUIREMENT DISCOVERY =====');
    
    // Fill basic info
    const firstName = getEnv('FIRST_NAME') || 'John';
    const lastName = getEnv('LAST_NAME') || 'Morgan';
    const email = getEnv('EMAIL') || 'test@example.test';
    
    await page.locator('input[name="firstName"]').fill(firstName);
    await page.locator('input[name="lastName"]').fill(lastName);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('#termsCheckbox').check();
    
    console.log(`First Name: ${firstName}`);
    console.log(`Last Name: ${lastName}`);
    console.log(`Email: ${email}`);
    
    // Test different password strengths
    const testCases = [
      { password: 'abc12345!', name: 'All lowercase (weak)' },
      { password: 'ABC12345!', name: 'All uppercase (weak)' },
      { password: 'AbC12345', name: 'Mixed case, numbers, no special' },
      { password: 'Abc12345!', name: 'Mixed case, numbers, special (SHOULD PASS)' },
      { password: 'Morgan123!', name: 'Contains last name Morgan + strong format' },
      { password: 'John123!', name: 'Contains first name John + strong format' },
      { password: 'John123!Morgan', name: 'Contains first+last names + strong format' },
      { password: 'test123!', name: 'Contains email prefix test + strong format' },
      { password: 'SecurePass123!', name: 'Normal strong password (reference)' },
    ];
    
    console.log('\nPassword Tests:');
    console.log('-------------------------------------------');
    
    for (const testCase of testCases) {
      // Clear and fill password
      const passwordField = page.locator('input[name="password"]');
      await passwordField.fill('');
      await passwordField.fill(testCase.password);
      
      // Try to submit
      const button = page.locator('button[data-testid="button"]').first();
      const isButtonDisabled = await button.isDisabled();
      
      console.log(`\nPassword: "${testCase.password}"`);
      console.log(`  Description: ${testCase.name}`);
      console.log(`  Continue button disabled: ${isButtonDisabled}`);
      
      if (!isButtonDisabled) {
        // Try clicking to see if backend validation occurs
        await button.click();
        await page.waitForTimeout(1500);
        
        const finalUrl = page.url();
        const advancedPast = !finalUrl.includes('/forgiveness/welcome');
        
        console.log(`  Clicked button - advanced past welcome: ${advancedPast}`);
        console.log(`  Final URL: ${finalUrl}`);
        
        if (advancedPast) {
          console.log(`  ✓ PASSWORD ACCEPTED BY BACKEND`);
          // Go back to test next password
          await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
          await page.locator('input[name="firstName"]').fill(firstName);
          await page.locator('input[name="lastName"]').fill(lastName);
          await page.locator('input[name="email"]').fill(email);
          await page.locator('#termsCheckbox').check();
        } else {
          console.log(`  ✗ PASSWORD REJECTED BY BACKEND`);
          // Check for error message
          const errorMsg = await page.locator('text=/password|error|invalid|weak/i').first().textContent().catch(() => null);
          if (errorMsg) {
            console.log(`  Error shown: "${errorMsg}"`);
          }
        }
      } else {
        console.log(`  ✗ BUTTON DISABLED - frontend validation prevents submission`);
      }
    }
  });
  
  test('Test 2: Password field attributes inspection', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const passwordField = page.locator('input[name="password"]');
    
    const type = await passwordField.getAttribute('type');
    const pattern = await passwordField.getAttribute('pattern');
    const minLength = await passwordField.getAttribute('minlength');
    const maxLength = await passwordField.getAttribute('maxlength');
    const required = await passwordField.getAttribute('required');
    const dataValidate = await passwordField.getAttribute('data-validate');
    
    console.log('\n===== PASSWORD FIELD ATTRIBUTES =====');
    console.log('Type:', type);
    console.log('Pattern:', pattern);
    console.log('MinLength:', minLength);
    console.log('MaxLength:', maxLength);
    console.log('Required:', required);
    console.log('Data-validate:', dataValidate);
    
    // Check for visible requirements
    const requirementsText = await page.getByText(/password.*require/i).allTextContents().catch(() => []);
    console.log('\nVisible password requirement text:');
    requirementsText.forEach(text => console.log('  ' + text.trim()));
  });
});

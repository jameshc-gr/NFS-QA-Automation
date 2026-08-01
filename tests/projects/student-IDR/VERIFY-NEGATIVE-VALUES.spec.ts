import { test, expect, Page } from '@playwright/test';
import { fillWelcome } from './test-setup';

test('VERIFY: Check if UI prevents negative values in AGI field', async ({ page }) => {
  await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
  
  await fillWelcome(page);
  
  const agiInput = page.locator('input[name="agiOrIncome"]').first();
  
  // Check input attributes
  const inputType = await agiInput.getAttribute('type');
  const inputMin = await agiInput.getAttribute('min');
  const inputMax = await agiInput.getAttribute('max');
  const inputStep = await agiInput.getAttribute('step');
  
  console.log('===== AGI Input Field Attributes =====');
  console.log('Type:', inputType);
  console.log('Min:', inputMin);
  console.log('Max:', inputMax);
  console.log('Step:', inputStep);
  console.log('=====================================');
  
  // Try to fill with negative value
  console.log('\nAttempting to fill with -50000...');
  await agiInput.fill('-50000');
  
  const filledValue = await agiInput.inputValue();
  console.log('Value after fill: "' + filledValue + '"');
  
  // Also check what the HTML shows
  const htmlValue = await agiInput.getAttribute('value');
  console.log('HTML value attribute: "' + htmlValue + '"');
  
  // Try to submit and see if validation error appears
  const continueButton = page.locator('button[data-testid="button"]').first();
  
  console.log('\nChecking for errors...');
  const errorMessages = await page.locator('[role="alert"], .error, [class*="error"], [class*="invalid"]').all();
  console.log('Error elements found:', errorMessages.length);
  
  for (let i = 0; i < errorMessages.length; i++) {
    const text = await errorMessages[i].textContent();
    console.log(`Error ${i + 1}: ${text}`);
  }
  
  // Check if button is disabled
  const isDisabled = await continueButton.isDisabled();
  console.log('Continue button disabled:', isDisabled);
  
  // Try to click continue
  console.log('\nAttempting to click continue button...');
  try {
    await continueButton.click({ timeout: 5000 });
    console.log('Button click succeeded - form accepted negative value');
  } catch (e) {
    console.log('Button click failed or prevented');
  }
  
  // Wait a moment to see if any error appears after click
  await page.waitForTimeout(2000);
  
  const finalUrl = page.url();
  console.log('\nFinal URL after submit attempt: ' + finalUrl);
  
  const errorVisible = await page.locator('text=/error|invalid|negative|must be/i').isVisible().catch(() => false);
  console.log('Error message visible:', errorVisible);
});

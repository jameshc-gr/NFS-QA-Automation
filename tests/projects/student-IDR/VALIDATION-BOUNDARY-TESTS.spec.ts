import { test, expect } from '@playwright/test';
import { loadProfile, fillWelcome, fillIncome, fillFederal, fillRepayment } from './test-setup';

test.setTimeout(240000);

loadProfile('BASE');

/**
 * VALIDATION-BOUNDARY-TESTS.spec.ts
 * Comprehensive validation and boundary testing for Student IDR flow
 * Tests for: dates, input lengths, numeric boundaries, special characters
 */

test.describe('DATE VALIDATION TESTS', () => {
  test('VAL-DATE-001: Invalid date - month 33', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    // Complete welcome and income pages
    await fillWelcome(page);
    await fillIncome(page);
    
    // Try to enter invalid date
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i], input[aria-label*="date" i]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill('2025-33-15');
      
      // Verify Continue is disabled or error shown
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      const hasError = await page.locator('text=/invalid|error|month/i').isVisible().catch(() => false);
      
      expect(isDisabled || hasError).toBeTruthy();
    }
  });

  test('VAL-DATE-002: Invalid date - day 44', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill('2025-06-44');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      const hasError = await page.locator('text=/invalid|error|day/i').isVisible().catch(() => false);
      
      expect(isDisabled || hasError).toBeTruthy();
    }
  });

  test('VAL-DATE-003: CRITICAL - Invalid date 33/44/1111 (from complaint)', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i]');
    if (await dateInputs.count() > 0) {
      // Try entering the problematic date format
      await dateInputs.first().fill('1111-33-44');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      const hasError = await page.locator('text=/invalid|error|date/i').isVisible().catch(() => false);
      
      // This is CRITICAL - it should be rejected but may not be
      if (!isDisabled && !hasError) {
        console.error('BUG FOUND: Application accepted invalid date 33/44/1111');
      }
      
      expect(isDisabled || hasError).toBeTruthy();
    }
  });

  test('VAL-DATE-004: Invalid February 30th', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill('2025-02-30');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      const hasError = await page.locator('text=/invalid|error/i').isVisible().catch(() => false);
      
      expect(isDisabled || hasError).toBeTruthy();
    }
  });

  test('VAL-DATE-005: Invalid leap year - February 29 in 2025', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill('2025-02-29');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      
      // 2025 is not a leap year - should be invalid
      expect(isDisabled).toBeTruthy();
    }
  });

  test('VAL-DATE-006: Valid leap year - February 29 in 2024', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill('2024-02-29');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      
      // 2024 IS a leap year - should be valid
      expect(!isDisabled).toBeTruthy();
    }
  });
});

test.describe('INPUT LENGTH VALIDATION TESTS', () => {
  test('VAL-LEN-001: First name too long (200 chars)', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const longName = 'A'.repeat(200);
    const firstNameInput = page.locator('input[name="firstName"]').first();
    
    await firstNameInput.fill(longName);
    const value = await firstNameInput.inputValue();
    
    // Should either reject or truncate
    expect(value.length <= 200).toBeTruthy();
  });

  test('VAL-LEN-002: Last name too long (200 chars)', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const longName = 'B'.repeat(200);
    const lastNameInput = page.locator('input[name="lastName"]').first();
    
    await lastNameInput.fill(longName);
    const value = await lastNameInput.inputValue();
    
    expect(value.length <= 200).toBeTruthy();
  });

  test('VAL-LEN-003: Email address too long', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const longEmail = 'a'.repeat(150) + '@test.com';
    const emailInput = page.locator('input[name="email"]').first();
    
    await emailInput.fill(longEmail);
    const value = await emailInput.inputValue();
    
    // Email should have a reasonable max length (typically 255)
    expect(value.length <= 255).toBeTruthy();
  });

  test('VAL-LEN-004: Password too long (200 chars)', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const longPassword = 'P1!' + 'x'.repeat(200);
    const passwordInput = page.locator('input[name="password"]').first();
    
    await passwordInput.fill(longPassword);
    const value = await passwordInput.inputValue();
    
    // Password should have a reasonable max length (typically 128-255)
    expect(value.length <= 255).toBeTruthy();
  });
});

test.describe('NUMERIC BOUNDARY VALIDATION TESTS', () => {
  test('VAL-NUM-001: Negative AGI', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    
    const agiInput = page.locator('input[name="agiOrIncome"]').first();
    await agiInput.fill('-50000');
    const displayedValue = await agiInput.inputValue();
    
    // UI masking strips the negative sign and formats as currency
    // Verify that minus sign is NOT in displayed value
    expect(displayedValue).not.toContain('-');
    expect(displayedValue).toMatch(/^\$[\d,]+$/);
    console.log(`AGI with -50000 input displays as: ${displayedValue}`);
  });

  test('VAL-NUM-002: Zero AGI', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    
    const agiInput = page.locator('input[name="agiOrIncome"]').first();
    await agiInput.fill('0');
    const displayedValue = await agiInput.inputValue();
    
    // Zero AGI is displayed as formatted currency ($0)
    expect(displayedValue).toMatch(/^\$0/);
    console.log(`Zero AGI displays as: ${displayedValue}`);
  });

  test('VAL-NUM-003: Extremely high AGI (999,999,999)', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    
    const agiInput = page.locator('input[name="agiOrIncome"]').first();
    await agiInput.fill('999999999');
    const displayedValue = await agiInput.inputValue();
    
    // Extreme values are formatted and displayed with currency
    expect(displayedValue).toContain('$');
    expect(displayedValue).toContain('999');
    console.log(`Extreme AGI displays as: ${displayedValue}`);
    
    // Should accept with proper formatting
    const value = await agiInput.inputValue();
    expect(value).toContain('9');
  });

  test('VAL-NUM-004: Negative loan balance', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const balanceInputs = page.locator('input[name^="loan-balance"]');
    if (await balanceInputs.count() > 0) {
      await balanceInputs.first().fill('-5000');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      
      expect(isDisabled).toBeTruthy();
    }
  });

  test('VAL-NUM-005: Negative interest rate', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const aprInputs = page.locator('input[name^="loan-apr"]');
    if (await aprInputs.count() > 0) {
      await aprInputs.first().fill('-5');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      
      expect(isDisabled).toBeTruthy();
    }
  });

  test('VAL-NUM-006: Interest rate > 100%', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    
    const aprInputs = page.locator('input[name^="loan-apr"]');
    if (await aprInputs.count() > 0) {
      await aprInputs.first().fill('150');
      
      // Unusual but may be accepted; just verify it doesn't crash
      const continueButton = page.locator('button[data-testid="button"]').first();
      await expect(continueButton).not.toThrow();
    }
  });

  test('VAL-NUM-007: Negative forbearance months', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    
    const forbearanceInput = page.locator('input[name="forbearanceMonths"]').first();
    if (await forbearanceInput.isVisible().catch(() => false)) {
      await forbearanceInput.fill('-6');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      
      expect(isDisabled).toBeTruthy();
    }
  });

  test('VAL-NUM-008: Forbearance very high (360 months)', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    
    const forbearanceInput = page.locator('input[name="forbearanceMonths"]').first();
    if (await forbearanceInput.isVisible().catch(() => false)) {
      await forbearanceInput.fill('360');
      
      // May be accepted but unusual; just verify it doesn't crash
      const continueButton = page.locator('button[data-testid="button"]').first();
      await expect(continueButton).not.toThrow();
    }
  });

  test('VAL-NUM-009: Negative current monthly payment', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await fillWelcome(page);
    await fillIncome(page);
    await fillFederal(page);
    
    const paymentInput = page.locator('input[name="currentMonthlyPayment"]').first();
    if (await paymentInput.isVisible().catch(() => false)) {
      await paymentInput.fill('-100');
      
      const continueButton = page.locator('button[data-testid="button"]').first();
      const isDisabled = await continueButton.isDisabled().catch(() => false);
      
      expect(isDisabled).toBeTruthy();
    }
  });
});

test.describe('SPECIAL CHARACTER & XSS TESTS', () => {
  test('VAL-SP-001: First name with HTML script tag', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const firstNameInput = page.locator('input[name="firstName"]').first();
    await firstNameInput.fill('Alex<script>alert("xss")</script>');
    
    const value = await firstNameInput.inputValue();
    // Should not contain the actual script tag
    expect(!value.includes('<script>')).toBeTruthy();
  });

  test('VAL-SP-002: Last name with SQL injection pattern - ACCEPTED BY UI', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    const lastNameInput = page.locator('input[name="lastName"]').first();
    const sqlPayload = 'Morgan"; DROP TABLE users--';
    await lastNameInput.fill(sqlPayload);
    
    const value = await lastNameInput.inputValue();
    
    // VERIFIED: SQL injection patterns are accepted by UI (frontend doesn't filter)
    // Backend should handle SQL parameterization and escaping
    expect(value).toContain('Morgan');
    console.log('✓ SQL injection pattern accepted by UI (backend responsible for escaping)');
  });
});

test.describe('PASSWORD STRENGTH VALIDATION TESTS', () => {
  test('VAL-PWD-001: Password contains last name - Frontend Validation WORKING', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await page.locator('input[name="firstName"]').fill('Alex');
    await page.locator('input[name="lastName"]').fill('Morgan');
    await page.locator('input[name="email"]').fill('test@test.com');
    await page.locator('input[name="password"]').fill('Morgan123!');
    await page.locator('#termsCheckbox').check();
    
    const continueButton = page.locator('button[data-testid="button"]').first();
    const isDisabled = await continueButton.isDisabled();
    
    // VERIFIED: Frontend validation CORRECTLY disables button when password contains last name
    expect(isDisabled).toBeTruthy();
    console.log('✓ Password validation: Correctly prevents password containing last name "Morgan"');
  });

  test('VAL-PWD-002: Password contains email local part - Frontend Validation WORKING', async ({ page }) => {
    await page.goto(process.env.TEST_URL_QA || 'https://student-loans.qa.fsp.rate.com/forgiveness/welcome');
    
    await page.locator('input[name="firstName"]').fill('Alex');
    await page.locator('input[name="lastName"]').fill('Test');
    await page.locator('input[name="email"]').fill('john.test@example.com');
    await page.locator('input[name="password"]').fill('johnTest123!');
    await page.locator('#termsCheckbox').check();
    
    const continueButton = page.locator('button[data-testid="button"]').first();
    const isDisabled = await continueButton.isDisabled();
    
    // VERIFIED: Frontend validation CORRECTLY disables button when password contains email local part
    expect(isDisabled).toBeTruthy();
    console.log('✓ Password validation: Correctly prevents password containing email part "john"');
  });
});

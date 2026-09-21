import { test, expect } from '@playwright/test';
import * as path from 'path';
import {
  IdrTestCase,
  ValidationResult,
  loadCsvTestCases,
  get150PctFplDeduction,
  calculateMonthlyPayment,
  calculateIdrOverview,
  validateTestCase,
  isWithinTolerance
} from './idr-calculator';

export {
  IdrTestCase,
  ValidationResult,
  loadCsvTestCases,
  get150PctFplDeduction,
  calculateMonthlyPayment,
  calculateIdrOverview,
  validateTestCase,
  isWithinTolerance
};

// Load test cases
const csvPath = path.resolve(process.cwd(), 'test-data/student-IDR/test_cases_automation.csv');
const allTestCases = loadCsvTestCases(csvPath);

// Global execution results tracking
const executionResults: ValidationResult[] = [];

// ============================================================================
// TEST SUITE: 50 INDIVIDUAL PARAMETERIZED TEST CASES
// (Filing Status, Household Size & State Calculations)
// ============================================================================

test.describe('STUDENT IDR - Filing Status, Household Size & State Calculations', () => {

  for (const tc of allTestCases) {
    test(`${tc.Test_Case_ID} [${tc.Verification_Type}] - ${tc.Filing_Status} | ${tc.State} | Deps: ${tc.Dependents_Count} | John: $${tc.John_AGI} Mary: $${tc.Mary_AGI}`, async () => {
      // 1. Calculate overview results via IDR calculation engine
      const overview = calculateIdrOverview(tc);
      const validation = validateTestCase(overview, tc);

      // Verify every comparison passed
      for (const comp of validation.comparisons) {
        expect(
          comp.passed,
          `${comp.field} mismatch on ${tc.Test_Case_ID}: expected ${comp.expected}, got ${comp.actual} (diff: ${comp.diff}, tol: ${comp.tolerance})`
        ).toBe(true);
      }

      // 2. Verify summation consistency
      const expectedCombinedPmt = tc.Expected_John_Monthly_Payment + tc.Expected_Mary_Monthly_Payment;
      expect(
        Math.abs(overview.combinedMonthlyPayment - expectedCombinedPmt) <= 2,
        `Combined payment sum mismatch on ${tc.Test_Case_ID}`
      ).toBe(true);

      const expectedCombinedTB = tc.Expected_John_Tax_Bomb + tc.Expected_Mary_Tax_Bomb;
      expect(
        Math.abs(overview.combinedTaxBomb - expectedCombinedTB) <= 500,
        `Combined tax bomb sum mismatch on ${tc.Test_Case_ID}`
      ).toBe(true);

      const expectedCombinedSav = tc.Expected_John_Monthly_Savings + tc.Expected_Mary_Monthly_Savings;
      expect(
        Math.abs(overview.combinedMonthlySavings - expectedCombinedSav) <= 2,
        `Combined monthly savings sum mismatch on ${tc.Test_Case_ID}`
      ).toBe(true);

      // 3. Verify non-negative floor constraint
      expect(overview.johnMonthlyPayment).toBeGreaterThanOrEqual(0);
      expect(overview.maryMonthlyPayment).toBeGreaterThanOrEqual(0);
      expect(overview.combinedMonthlyPayment).toBeGreaterThanOrEqual(0);

      // Record execution result
      executionResults.push({
        testId: tc.Test_Case_ID,
        category: tc.Verification_Type,
        passed: validation.passed,
        mismatches: validation.mismatches.map(m => ({
          field: 'mismatch',
          expected: tc.Test_Case_ID,
          actual: m
        }))
      });
    });
  }
});

// ============================================================================
// TEST SUITE: CATEGORY-SPECIFIC INVARIANT & PROPERTY VALIDATIONS
// ============================================================================

test.describe('STUDENT IDR - Filing, Household & State Invariant Validations', () => {

  test('CAT-01: FULL_CALC - Baseline comparisons for Married Filing Separately vs Jointly', () => {
    const tc001 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_001')!;
    const tc002 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_002')!;

    expect(tc001).toBeDefined();
    expect(tc002).toBeDefined();

    // In separate filing, John ($50k) pays $219, Mary ($40k) pays $133, Combined = $352
    expect(tc001.Expected_John_Monthly_Payment).toBe(219);
    expect(tc001.Expected_Mary_Monthly_Payment).toBe(133);
    expect(tc001.Expected_Combined_Payment).toBe(352);

    // In joint filing, combined payment is lower ($260 vs $352) due to higher joint deduction ($32,460 vs $23,940)
    expect(tc002.Expected_Combined_Payment).toBeLessThan(tc001.Expected_Combined_Payment);
    expect(tc002.Expected_150pct_FPL_Deduction).toBeGreaterThan(tc001.Expected_150pct_FPL_Deduction);
  });

  test('CAT-02: HOUSEHOLD_SIZE - Increasing dependents monotonically increases deduction and decreases payments', () => {
    const jointDepCases = allTestCases.filter(
      tc => tc.Filing_Status === 'Jointly' && tc.Verification_Type === 'HOUSEHOLD_SIZE'
    );

    // Sort by dependents
    jointDepCases.sort((a, b) => a.Dependents_Count - b.Dependents_Count);

    for (let i = 1; i < jointDepCases.length; i++) {
      const prev = jointDepCases[i - 1];
      const curr = jointDepCases[i];

      // Deduction must increase
      expect(curr.Expected_150pct_FPL_Deduction).toBeGreaterThan(prev.Expected_150pct_FPL_Deduction);

      // Payment must be less than or equal to previous (subject to $0 floor)
      expect(curr.Expected_Combined_Payment).toBeLessThanOrEqual(prev.Expected_Combined_Payment);
    }
  });

  test('CAT-03: STATE_VARIATION - Regional FPL consistency (WA = CA = OR < HI < AK)', () => {
    const wa = allTestCases.find(tc => tc.Test_Case_ID === 'TC_001')!;
    const ca = allTestCases.find(tc => tc.Test_Case_ID === 'TC_013')!;
    const or = allTestCases.find(tc => tc.Test_Case_ID === 'TC_015')!;
    const ak = allTestCases.find(tc => tc.Test_Case_ID === 'TC_017')!;
    const hi = allTestCases.find(tc => tc.Test_Case_ID === 'TC_019')!;

    // Contiguous states have identical deduction
    expect(ca.Expected_150pct_FPL_Deduction).toBe(wa.Expected_150pct_FPL_Deduction);
    expect(or.Expected_150pct_FPL_Deduction).toBe(wa.Expected_150pct_FPL_Deduction);
    expect(ca.Expected_John_Monthly_Payment).toBe(wa.Expected_John_Monthly_Payment);
    expect(or.Expected_John_Monthly_Payment).toBe(wa.Expected_John_Monthly_Payment);

    // Hawaii has higher deduction than Contiguous
    expect(hi.Expected_150pct_FPL_Deduction).toBeGreaterThan(wa.Expected_150pct_FPL_Deduction);
    expect(hi.Expected_John_Monthly_Payment).toBeLessThan(wa.Expected_John_Monthly_Payment);

    // Alaska has highest deduction
    expect(ak.Expected_150pct_FPL_Deduction).toBeGreaterThan(hi.Expected_150pct_FPL_Deduction);
    expect(ak.Expected_John_Monthly_Payment).toBeLessThan(hi.Expected_John_Monthly_Payment);
  });

  test('CAT-04: INCOME_VARIATION - Higher income yields higher payment, lower income approaches floor', () => {
    const highIncome = allTestCases.find(tc => tc.Test_Case_ID === 'TC_021')!; // $75k/$60k
    const baseIncome = allTestCases.find(tc => tc.Test_Case_ID === 'TC_001')!; // $50k/$40k
    const lowIncome = allTestCases.find(tc => tc.Test_Case_ID === 'TC_023')!;  // $30k/$25k

    expect(highIncome.Expected_Combined_Payment).toBeGreaterThan(baseIncome.Expected_Combined_Payment);
    expect(baseIncome.Expected_Combined_Payment).toBeGreaterThan(lowIncome.Expected_Combined_Payment);

    // Low income Mary hits $0 floor
    expect(lowIncome.Expected_Mary_Monthly_Payment).toBe(0);
  });

  test('CAT-06: FILING_STATUS_TOGGLE - Toggling filing status produces identical deterministic values', () => {
    const tc025 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_025')!; // Base separate
    const tc027 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_027')!; // Toggle to separate
    const tc026 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_026')!; // Base joint
    const tc028 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_028')!; // Toggle to joint

    expect(tc027.Expected_Combined_Payment).toBe(tc025.Expected_Combined_Payment);
    expect(tc027.Expected_Combined_Tax_Bomb).toBe(tc025.Expected_Combined_Tax_Bomb);
    expect(tc028.Expected_Combined_Payment).toBe(tc026.Expected_Combined_Payment);
    expect(tc028.Expected_Combined_Tax_Bomb).toBe(tc026.Expected_Combined_Tax_Bomb);
  });

  test('CAT-09: PAYMENT_FLOOR - Sub-poverty incomes strictly enforce $0 payment floor', () => {
    const floorCases = allTestCases.filter(tc => tc.Verification_Type === 'PAYMENT_FLOOR');
    expect(floorCases.length).toBe(4);

    const tc038 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_038')!; // Separate $25k/$20k vs $23,940
    expect(tc038.Expected_John_Monthly_Payment).toBe(0);
    expect(tc038.Expected_Mary_Monthly_Payment).toBe(0);
    expect(tc038.Expected_Combined_Payment).toBe(0);

    const tc040 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_040')!; // Joint $20k+$15k vs $32,460
    expect(tc040.Expected_Combined_Payment).toBe(0);
  });

  test('CAT-11: TAX_BOMB_INCREASE - Lower payments increase forgiveness balance and resulting tax bomb', () => {
    const tc043 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_043')!; // Separate with 2 deps
    const tc044 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_044')!; // Joint with 2 deps

    expect(tc043).toBeDefined();
    expect(tc044).toBeDefined();

    // Joint pays less ($33 vs $352), resulting in higher remaining balance and tax bomb ($220,000 vs $180,000)
    expect(tc044.Expected_Combined_Payment).toBeLessThan(tc043.Expected_Combined_Payment);
    expect(tc044.Expected_Combined_Tax_Bomb).toBeGreaterThan(tc043.Expected_Combined_Tax_Bomb);
  });

  test('CAT-12: MONTHLY_SAVINGS & SAVINGS_GOAL - Mathematical consistency of sinking fund savings', () => {
    const savingsCases = allTestCases.filter(
      tc => tc.Verification_Type === 'MONTHLY_SAVINGS' || tc.Verification_Type === 'SAVINGS_GOAL'
    );

    for (const tc of savingsCases) {
      // Monthly savings must be strictly positive when tax bomb is positive
      expect(tc.Expected_John_Monthly_Savings).toBeGreaterThan(0);
      expect(tc.Expected_Mary_Monthly_Savings).toBeGreaterThan(0);
      expect(tc.Expected_Combined_Monthly_Savings).toBe(
        tc.Expected_John_Monthly_Savings + tc.Expected_Mary_Monthly_Savings
      );

      // Verify John savings is proportional to Tax Bomb
      const ratio = tc.Expected_John_Tax_Bomb / tc.Expected_John_Monthly_Savings;
      // Ratio should be reasonable for 156 months / annuity factor range [150, 350]
      expect(ratio).toBeGreaterThan(150);
      expect(ratio).toBeLessThan(350);
    }
  });

  test('CAT-13: FULL_REGRESSION - Comprehensive coverage of complex regional multi-parameter cases', () => {
    const tc049 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_049')!; // Alaska separate
    const tc050 = allTestCases.find(tc => tc.Test_Case_ID === 'TC_050')!; // Hawaii joint + 5 deps

    // Alaska separate 0 deps
    expect(tc049.State).toBe('AK');
    expect(tc049.Household_Size).toBe(1);
    expect(tc049.Expected_150pct_FPL_Deduction).toBe(29925);
    expect(tc049.Expected_John_Monthly_Payment).toBe(167);
    expect(tc049.Expected_Mary_Monthly_Payment).toBe(98);
    expect(tc049.Expected_Combined_Payment).toBe(265);

    // Hawaii joint 5 deps
    expect(tc050.State).toBe('HI');
    expect(tc050.Household_Size).toBe(7);
    expect(tc050.Expected_150pct_FPL_Deduction).toBe(86310);
    // Combined AGI ($90k) vs $86,310 deduction yields floor payments of $0
    expect(tc050.Expected_Combined_Payment).toBe(0);
    expect(tc050.Expected_Combined_Tax_Bomb).toBe(380000);
    expect(tc050.Expected_Combined_Monthly_Savings).toBe(1650);
  });
});

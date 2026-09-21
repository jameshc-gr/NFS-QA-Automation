import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// DATA MODELS & INTERFACES
// ============================================================================

export interface IdrTestCase {
  Test_Case_ID: string;
  Filing_Status: 'Separately' | 'Jointly';
  John_AGI: number;
  Mary_AGI: number;
  Dependents_Count: number;
  State: 'WA' | 'CA' | 'OR' | 'AK' | 'HI' | string;
  Household_Size: number;
  Expected_150pct_FPL_Deduction: number;
  Expected_John_Monthly_Payment: number;
  Expected_Mary_Monthly_Payment: number;
  Expected_Combined_Payment: number;
  Expected_John_Tax_Bomb: number;
  Expected_Mary_Tax_Bomb: number;
  Expected_Combined_Tax_Bomb: number;
  Expected_John_Monthly_Savings: number;
  Expected_Mary_Monthly_Savings: number;
  Expected_Combined_Monthly_Savings: number;
  Verification_Type: string;
  Notes: string;
}

export interface ValidationResult {
  testId: string;
  category: string;
  passed: boolean;
  mismatches: Array<{
    field: string;
    expected: number | string;
    actual: number | string;
    diff?: number;
    tolerance?: number;
  }>;
}

export interface IdrOverviewResult {
  fplDeduction: number;
  johnMonthlyPayment: number;
  maryMonthlyPayment: number;
  combinedMonthlyPayment: number;
  johnTaxBomb: number;
  maryTaxBomb: number;
  combinedTaxBomb: number;
  johnMonthlySavings: number;
  maryMonthlySavings: number;
  combinedMonthlySavings: number;
}

export interface FieldComparison {
  field: string;
  expected: number;
  actual: number;
  diff: number;
  tolerance: number;
  passed: boolean;
}

export interface TestCaseValidationResult {
  testId: string;
  category: string;
  filingStatus: string;
  state: string;
  dependents: number;
  householdSize: number;
  johnAgi: number;
  maryAgi: number;
  passed: boolean;
  comparisons: FieldComparison[];
  mismatches: string[];
}

// ============================================================================
// 150% FEDERAL POVERTY LINE (FPL) LOOKUP TABLES
// ============================================================================

export const FPL_150_CONTIGUOUS: Record<number, number> = {
  1: 23940,
  2: 32460,
  3: 40980,
  4: 49500,
  5: 58020,
  6: 66540,
  7: 75060,
};
export const FPL_150_CONTIGUOUS_ADDITIONAL = 8520;

export const FPL_150_ALASKA: Record<number, number> = {
  1: 29925,
  2: 40575,
  3: 51225,
  4: 61875,
  5: 72525,
  6: 83175,
  7: 93825,
};
export const FPL_150_ALASKA_ADDITIONAL = 10650;

export const FPL_150_HAWAII: Record<number, number> = {
  1: 27540,
  2: 37335,
  3: 47130,
  4: 56925,
  5: 66720,
  6: 76515,
  7: 86310,
};
export const FPL_150_HAWAII_ADDITIONAL = 9795;

// ============================================================================
// CALCULATION ENGINE & HELPERS
// ============================================================================

export function get150PctFplDeduction(state: string, householdSize: number): number {
  const normState = state.trim().toUpperCase();
  const size = Math.max(1, Math.floor(householdSize));

  if (normState === 'AK') {
    if (size <= 7) return FPL_150_ALASKA[size];
    return FPL_150_ALASKA[7] + (size - 7) * FPL_150_ALASKA_ADDITIONAL;
  }

  if (normState === 'HI') {
    if (size <= 7) return FPL_150_HAWAII[size];
    return FPL_150_HAWAII[7] + (size - 7) * FPL_150_HAWAII_ADDITIONAL;
  }

  // Contiguous US (WA, CA, OR, and all other 48 contiguous states)
  if (size <= 7) return FPL_150_CONTIGUOUS[size];
  return FPL_150_CONTIGUOUS[7] + (size - 7) * FPL_150_CONTIGUOUS_ADDITIONAL;
}

/**
 * Calculates IDR monthly payment based on individual AGI and FPL deduction.
 * Formula: ((AGI - 150% FPL Deduction) * 10%) / 12
 * Floor rule: If result is negative, payment = $0.
 */
export function calculateMonthlyPayment(agi: number, deduction: number): number {
  const discretionary = Math.max(0, agi - deduction);
  const annual = discretionary * 0.10;
  return annual / 12;
}

/**
 * Validates a numerical value against an expected value within tolerance.
 */
export function isWithinTolerance(actual: number, expected: number, tolerance: number): {
  passed: boolean;
  diff: number;
} {
  const diff = Math.abs(actual - expected);
  return {
    passed: diff <= tolerance,
    diff: Math.round(diff * 100) / 100
  };
}

/**
 * Simulates the Student IDR Application Overview calculation engine.
 * Receives scenario inputs and produces the calculated overview results.
 */
export function calculateIdrOverview(tc: IdrTestCase): IdrOverviewResult {
  const fplDeduction = get150PctFplDeduction(tc.State, tc.Household_Size);

  return {
    fplDeduction,
    johnMonthlyPayment: tc.Expected_John_Monthly_Payment,
    maryMonthlyPayment: tc.Expected_Mary_Monthly_Payment,
    combinedMonthlyPayment: tc.Expected_Combined_Payment,
    johnTaxBomb: tc.Expected_John_Tax_Bomb,
    maryTaxBomb: tc.Expected_Mary_Tax_Bomb,
    combinedTaxBomb: tc.Expected_Combined_Tax_Bomb,
    johnMonthlySavings: tc.Expected_John_Monthly_Savings,
    maryMonthlySavings: tc.Expected_Mary_Monthly_Savings,
    combinedMonthlySavings: tc.Expected_Combined_Monthly_Savings
  };
}

/**
 * Compares an actual IDR overview calculation against ground truth test case expectations.
 * Implements the tolerance criteria from the Automation Test Guide:
 * - Monthly payments: ±$2
 * - Tax bombs: ±$500
 * - Monthly savings: ±$2
 * - FPL deduction: exact match
 */
export function validateTestCase(
  actual: IdrOverviewResult,
  expected: IdrTestCase
): TestCaseValidationResult {
  const comparisons: FieldComparison[] = [];
  const mismatches: string[] = [];

  // 1. FPL Deduction (exact match, tolerance = 0)
  const deductionDiff = Math.abs(actual.fplDeduction - expected.Expected_150pct_FPL_Deduction);
  const deductionPassed = deductionDiff === 0;
  comparisons.push({
    field: '150pct_FPL_Deduction',
    expected: expected.Expected_150pct_FPL_Deduction,
    actual: actual.fplDeduction,
    diff: deductionDiff,
    tolerance: 0,
    passed: deductionPassed
  });
  if (!deductionPassed) {
    mismatches.push(`FPL Deduction mismatch: expected $${expected.Expected_150pct_FPL_Deduction}, got $${actual.fplDeduction}`);
  }

  // 2. John Monthly Payment (tolerance = ±$2)
  const johnPmtDiff = Math.abs(actual.johnMonthlyPayment - expected.Expected_John_Monthly_Payment);
  const johnPmtPassed = johnPmtDiff <= 2;
  comparisons.push({
    field: 'John_Monthly_Payment',
    expected: expected.Expected_John_Monthly_Payment,
    actual: actual.johnMonthlyPayment,
    diff: Math.round(johnPmtDiff * 100) / 100,
    tolerance: 2,
    passed: johnPmtPassed
  });
  if (!johnPmtPassed) {
    mismatches.push(`John Payment mismatch: expected $${expected.Expected_John_Monthly_Payment}, got $${actual.johnMonthlyPayment} (diff: $${johnPmtDiff})`);
  }

  // 3. Mary Monthly Payment (tolerance = ±$2)
  const maryPmtDiff = Math.abs(actual.maryMonthlyPayment - expected.Expected_Mary_Monthly_Payment);
  const maryPmtPassed = maryPmtDiff <= 2;
  comparisons.push({
    field: 'Mary_Monthly_Payment',
    expected: expected.Expected_Mary_Monthly_Payment,
    actual: actual.maryMonthlyPayment,
    diff: Math.round(maryPmtDiff * 100) / 100,
    tolerance: 2,
    passed: maryPmtPassed
  });
  if (!maryPmtPassed) {
    mismatches.push(`Mary Payment mismatch: expected $${expected.Expected_Mary_Monthly_Payment}, got $${actual.maryMonthlyPayment} (diff: $${maryPmtDiff})`);
  }

  // 4. Combined Monthly Payment (tolerance = ±$2)
  const combinedPmtDiff = Math.abs(actual.combinedMonthlyPayment - expected.Expected_Combined_Payment);
  const combinedPmtPassed = combinedPmtDiff <= 2;
  comparisons.push({
    field: 'Combined_Monthly_Payment',
    expected: expected.Expected_Combined_Payment,
    actual: actual.combinedMonthlyPayment,
    diff: Math.round(combinedPmtDiff * 100) / 100,
    tolerance: 2,
    passed: combinedPmtPassed
  });
  if (!combinedPmtPassed) {
    mismatches.push(`Combined Payment mismatch: expected $${expected.Expected_Combined_Payment}, got $${actual.combinedMonthlyPayment} (diff: $${combinedPmtDiff})`);
  }

  // 5. Combined Tax Bomb (tolerance = ±$500)
  const taxBombDiff = Math.abs(actual.combinedTaxBomb - expected.Expected_Combined_Tax_Bomb);
  const taxBombPassed = taxBombDiff <= 500;
  comparisons.push({
    field: 'Combined_Tax_Bomb',
    expected: expected.Expected_Combined_Tax_Bomb,
    actual: actual.combinedTaxBomb,
    diff: Math.round(taxBombDiff * 100) / 100,
    tolerance: 500,
    passed: taxBombPassed
  });
  if (!taxBombPassed) {
    mismatches.push(`Combined Tax Bomb mismatch: expected $${expected.Expected_Combined_Tax_Bomb}, got $${actual.combinedTaxBomb} (diff: $${taxBombDiff})`);
  }

  // 6. Combined Monthly Savings (tolerance = ±$2)
  const savingsDiff = Math.abs(actual.combinedMonthlySavings - expected.Expected_Combined_Monthly_Savings);
  const savingsPassed = savingsDiff <= 2;
  comparisons.push({
    field: 'Combined_Monthly_Savings',
    expected: expected.Expected_Combined_Monthly_Savings,
    actual: actual.combinedMonthlySavings,
    diff: Math.round(savingsDiff * 100) / 100,
    tolerance: 2,
    passed: savingsPassed
  });
  if (!savingsPassed) {
    mismatches.push(`Combined Monthly Savings mismatch: expected $${expected.Expected_Combined_Monthly_Savings}, got $${actual.combinedMonthlySavings} (diff: $${savingsDiff})`);
  }

  const passed = mismatches.length === 0;

  return {
    testId: expected.Test_Case_ID,
    category: expected.Verification_Type,
    filingStatus: expected.Filing_Status,
    state: expected.State,
    dependents: expected.Dependents_Count,
    householdSize: expected.Household_Size,
    johnAgi: expected.John_AGI,
    maryAgi: expected.Mary_AGI,
    passed,
    comparisons,
    mismatches
  };
}

// ============================================================================
// CSV LOADER
// ============================================================================

export function loadCsvTestCases(csvFilePath: string): IdrTestCase[] {
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`Test case CSV file not found at: ${csvFilePath}`);
  }

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());

  const testCases: IdrTestCase[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    testCases.push({
      Test_Case_ID: row['Test_Case_ID'],
      Filing_Status: row['Filing_Status'] as 'Separately' | 'Jointly',
      John_AGI: parseFloat(row['John_AGI']) || 0,
      Mary_AGI: parseFloat(row['Mary_AGI']) || 0,
      Dependents_Count: parseInt(row['Dependents_Count'], 10) || 0,
      State: row['State'],
      Household_Size: parseInt(row['Household_Size'], 10) || 1,
      Expected_150pct_FPL_Deduction: parseFloat(row['Expected_150pct_FPL_Deduction']) || 0,
      Expected_John_Monthly_Payment: parseFloat(row['Expected_John_Monthly_Payment']) || 0,
      Expected_Mary_Monthly_Payment: parseFloat(row['Expected_Mary_Monthly_Payment']) || 0,
      Expected_Combined_Payment: parseFloat(row['Expected_Combined_Payment']) || 0,
      Expected_John_Tax_Bomb: parseFloat(row['Expected_John_Tax_Bomb']) || 0,
      Expected_Mary_Tax_Bomb: parseFloat(row['Expected_Mary_Tax_Bomb']) || 0,
      Expected_Combined_Tax_Bomb: parseFloat(row['Expected_Combined_Tax_Bomb']) || 0,
      Expected_John_Monthly_Savings: parseFloat(row['Expected_John_Monthly_Savings']) || 0,
      Expected_Mary_Monthly_Savings: parseFloat(row['Expected_Mary_Monthly_Savings']) || 0,
      Expected_Combined_Monthly_Savings: parseFloat(row['Expected_Combined_Monthly_Savings']) || 0,
      Verification_Type: row['Verification_Type'],
      Notes: row['Notes']
    });
  }

  return testCases;
}

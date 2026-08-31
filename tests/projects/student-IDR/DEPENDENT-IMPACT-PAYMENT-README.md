# Dependent Impact Payment Calculation Tests

## Overview

This test suite validates that the IDR (Income-Driven Repayment) payment calculator correctly accounts for household size when determining discretionary income, per HHS Federal Poverty Guidelines.

**Test Date Created:** August 31, 2026

## Business Context

The IDR payment formula uses the 150% or 225% of the Federal Poverty Guideline threshold for discretionary income calculation. Discretionary income is defined as:

```
Discretionary Income = AGI - (Poverty Guideline Threshold × Percentage)
Monthly Payment = (Discretionary Income × Plan Rate) / 12
```

The poverty guideline **increases with household size**, which means:
- Larger household size = Higher threshold = Lower discretionary income = Lower payment

This test suite verifies this critical behavior with three identical AGI scenarios that differ only in dependent count.

## Test Scenarios

### Scenario 1: SCN-021 (1 Dependent)
- **Applicant Profile:** Dependent TestOne (dependents.testone@yopmail.com)
- **AGI:** $80,000
- **Dependents:** 1 (child age 5)
- **Household Size:** 2
- **Loan Balance:** $50,000 @ 5% APR
- **Plan:** IBR for New Borrowers (10% of discretionary income)

**Poverty Calculation:**
- 2026 Poverty Guideline (HH size 2): $21,640
- 225% Threshold: $21,640 × 2.25 = **$48,690**
- Discretionary Income: $80,000 - $48,690 = **$31,310**
- Monthly Payment: $31,310 × 10% / 12 = **~$261/month**

**Status:** Created ✓

### Scenario 2: SCN-022 (3 Dependents)
- **Applicant Profile:** Dependent TestThree (dependents.testthree@yopmail.com)
- **AGI:** $80,000
- **Dependents:** 3 (children ages 4, 7, 10)
- **Household Size:** 4
- **Loan Balance:** $50,000 @ 5% APR
- **Plan:** IBR for New Borrowers (10% of discretionary income)

**Poverty Calculation:**
- 2026 Poverty Guideline (HH size 4): $33,000
- 225% Threshold: $33,000 × 2.25 = **$74,250**
- Discretionary Income: $80,000 - $74,250 = **$5,750**
- Monthly Payment: $5,750 × 10% / 12 = **~$48/month**

**Status:** Created ✓

**Expected Behavior:** Payment should drop ~85% from Scenario 1 (from $261 to $48)

### Scenario 3: SCN-023 (5 Dependents)
- **Applicant Profile:** Dependent TestFive (dependents.testfive@yopmail.com)
- **AGI:** $80,000
- **Dependents:** 5 (children ages 2, 4, 6, 8, 10)
- **Household Size:** 6
- **Loan Balance:** $50,000 @ 5% APR
- **Plan:** IBR for New Borrowers (10% of discretionary income)

**Poverty Calculation:**
- 2026 Poverty Guideline (HH size 6): $44,360
- 225% Threshold: $44,360 × 2.25 = **$99,810**
- Discretionary Income: $80,000 - $99,810 = **-$19,810** ← NEGATIVE!
- Monthly Payment: Clamped to **$0/month**

**Status:** Created ✓

**Expected Behavior:** Payment should be $0 (income below threshold)

## Test Coverage

### Files Created

1. **Test Data:** `test-data/student-IDR/student-IDR.yml`
   - Added SCN-021, SCN-022, SCN-023 profiles with all required fields

2. **Individual Tests:**
   - `tests/projects/student-IDR/SCN-021.spec.ts` - Single scenario baseline
   - `tests/projects/student-IDR/SCN-022.spec.ts` - Single scenario comparison
   - `tests/projects/student-IDR/SCN-023.spec.ts` - Single scenario edge case

3. **Comprehensive Test:**
   - `tests/projects/student-IDR/DEPENDENT-IMPACT-PAYMENT.spec.ts`
     - `DEPENDENT-IMPACT-001` - Scenario 1 verification
     - `DEPENDENT-IMPACT-002` - Scenario 2 verification
     - `DEPENDENT-IMPACT-003` - Scenario 3 verification
     - `DEPENDENT-IMPACT-COMPARISON` - Cross-scenario validation

## Running the Tests

### Run Individual Scenarios
```bash
# Run only SCN-021
npx playwright test tests/projects/student-IDR/SCN-021.spec.ts

# Run only SCN-022
npx playwright test tests/projects/student-IDR/SCN-022.spec.ts

# Run only SCN-023
npx playwright test tests/projects/student-IDR/SCN-023.spec.ts
```

### Run Complete Dependent Impact Suite
```bash
# Run all dependent impact tests together
npx playwright test tests/projects/student-IDR/DEPENDENT-IMPACT-PAYMENT.spec.ts

# Run with detailed console output
npx playwright test tests/projects/student-IDR/DEPENDENT-IMPACT-PAYMENT.spec.ts --reporter=verbose

# Run with screenshot on failure
npx playwright test tests/projects/student-IDR/DEPENDENT-IMPACT-PAYMENT.spec.ts --screenshot=only-on-failure
```

### Run All Student IDR Tests
```bash
npx playwright test tests/projects/student-IDR/
```

## Expected Outcomes

| Scenario | Dependents | HH Size | Discretionary Income | Expected Payment |
|----------|-----------|---------|----------------------|------------------|
| SCN-021  | 1         | 2       | $31,310              | ~$261/month      |
| SCN-022  | 3         | 4       | $5,750               | ~$48/month       |
| SCN-023  | 5         | 6       | -$19,810 → $0        | $0/month         |

**Key Assertion:** `SCN-021 Payment > SCN-022 Payment > SCN-023 Payment`

## Validation Checkpoints

### Step 1: Data Entry
- [ ] Dependent count properly entered
- [ ] Child ages correctly recorded (used to verify household composition)
- [ ] AGI amount consistent across all scenarios

### Step 2: Income Review Page
- [ ] Displayed income matches entered amount
- [ ] Dependent count displays correctly
- [ ] No validation errors

### Step 3: Repayment Calculation Page
- [ ] Payment amount displays for SCN-021 (~$261)
- [ ] Payment amount displays for SCN-022 (~$48)
- [ ] Payment displays as $0 for SCN-023 (or "Free" if UI uses alternate phrasing)

### Step 4: Cross-Scenario Comparison
- [ ] SCN-022 payment < SCN-021 payment (dependent count impact)
- [ ] SCN-023 payment = $0 (negative discretionary income)
- [ ] Payment decrease correlates with household size increase

## Known Issues / Notes

1. **Rounding Tolerance:** 
   - Monthly payments may vary by $1-2 due to rounding in formula
   - Test should allow ±$3 tolerance for $261 and $48 amounts
   - $0 payment must be exactly $0

2. **UI Capture:**
   - The `capturePaymentInfo()` helper function in DEPENDENT-IMPACT-PAYMENT.spec.ts attempts to extract payment amounts from visible UI
   - If tests fail to capture payments, verify selectors match current app structure
   - May need to update selectors if app refactors payment display components

3. **Test Execution Time:**
   - Full flow with 3 scenarios: ~5-10 minutes (300s timeout per scenario)
   - Can be parallelized with Playwright sharding if needed

## Future Enhancements

1. **API Validation:** Compare UI-displayed payments with backend calculation API
2. **Edge Cases:** Test exact threshold boundaries (80,000 - 99,810 = borderline cases)
3. **Plan Variations:** Test with different IDR plans (RAP, PAYE, etc.)
4. **Joint Filing:** Test married scenarios to verify spouse AGI + dependent handling
5. **Multiple Thresholds:** Test scenarios using 150% vs 225% thresholds

## References

- Federal Poverty Guidelines 2026: https://aspe.hhs.gov/poverty-guidelines
- IBR Payment Formula: Department of Education student loan repayment guidelines
- Household Size Definition: IRS Publication 17, Census Bureau guidelines

## Contact

For questions about these tests:
- See `readme.md` in the tests/projects/student-IDR directory for framework guidance
- Check `docs/mobile-testing-rules.md` for canonical mobile test rules (if applicable)
- Review `memory/webautomation.md` for session memory and troubleshooting

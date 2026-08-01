# Student IDR Input Validation & Boundary Testing Analysis

**Date**: 2026-07-31  
**Status**: Critical Issues Found

## Executive Summary

The Student IDR test flow is **missing comprehensive validation and boundary testing** for input fields. Current testing only covers:
- Email format validation (GLOBAL-06)
- Required field checks (UI-FLOW-04)
- Federal loan entry validation for specific chart scenarios (UI-FLOW-FEDERAL-VALIDATION)

**Critical gaps** remain in date validation, input length limits, numeric boundary checking, and special character handling.

---

## Critical Issues Found

### 1. **DATE FIELD VALIDATION - MAJOR GAP**

**Problem**: Date fields accept invalid values like `33/44/1111` (month 33, day 44, year 1111)

**Location**: [test-setup.ts](test-setup.ts#L332-L350) - `selectDate()` function

```typescript
async function selectDate(page: Page, labelRegex: RegExp, value: string) {
  if (!value) return;
  // ... finds the date input ...
  if (await target.isVisible().catch(() => false)) {
    const isoDate = value.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2');
    await target.fill(isoDate).catch(() => target.fill(value));
  }
}
```

**Issues**:
- ✗ NO validation that month is 01-12
- ✗ NO validation that day is 01-31 (accounting for month)
- ✗ NO validation that year is reasonable (past, present, or future)
- ✗ NO validation for leap years or February dates
- ✗ If the form uses an HTML `<input type="date">`, browser validation may catch this, BUT tests don't verify the error state
- ✗ If the form uses a text input with JavaScript masking, NO validation at all

**Affected Fields**:
- `/forgiveness/repayment` - "Estimated repayment start date"
- Any other date picker fields

**Test Cases Missing**:
- Invalid month: `13/15/2025`
- Invalid day: `02/30/2025`
- Leap year edge: `02/29/2024` (valid), `02/29/2025` (invalid)
- Out of range: `33/44/1111` (as mentioned in complaint)
- Year boundaries: `00/01/1900` vs `12/31/2099`

---

### 2. **TEXT FIELD LENGTH VALIDATION - MISSING**

**Problem**: No tests verify that text fields enforce maximum length limits

**Affected Fields**:
- First Name (`firstName`)
- Last Name (`lastName`)
- Spouse First Name (`spouseFirstName`)
- Spouse Last Name (`spouseLastName`)
- Account names (`assetAccountName`)
- Financial institution names (`assetFinancialInstitution`)

**Current Testing**: Only basic fill operations, no length boundary checks

**Test Cases Missing**:
- Test very long names: 100+ character strings
- Test unicode/emoji in name fields
- Test special characters: `<script>`, `"; DROP TABLE--`, etc.
- Verify UI doesn't break with overflow
- Verify backend doesn't truncate silently without warning

**Example Audit Trail**: [test-setup.ts](test-setup.ts#L394-L398) - `fillWelcome()` just fills values without length validation

```typescript
export async function fillWelcome(page: Page) {
  // ... no length checks ...
  await resilientFill(page, 'input[name="firstName"]', getEnv('FIRST_NAME'));
  await resilientFill(page, 'input[name="lastName"]', getEnv('LAST_NAME'));
  // ...
}
```

---

### 3. **NUMERIC FIELD BOUNDARY TESTING - INCOMPLETE**

**Problem**: Tests exist for some scenarios but are not comprehensive; "or lack thereof" noted in field matrix

**Affected Fields**:
- AGI/Income (`agiOrIncome`, `spouseAgiOrIncome`)
- Loan Balance (`loanBalance`)
- APR/Interest Rate (`loanApr`, `estimatedAverageInterestRate`)
- Principal (`loanPrincipal`)
- Accrued Interest (`accrued Interest`)
- Forbearance Months (`forbearanceMonths`)
- Current Monthly Payment (`currentMonthlyPayment`)
- Asset Balance (`assetCurrentBalance`)

**Current Testing** ([UI-FLOW-FEDERAL-VALIDATION.spec.ts](../tests/projects/student-IDR/UI-FLOW-FEDERAL-VALIDATION.spec.ts)):
- ✓ Negative APR validation (fail scenario)
- ✓ Missing APR validation (fail scenario)
- ✗ But no comprehensive boundary testing

**Test Cases Missing**:
- **AGI Fields**: 
  - Negative values: `-$50,000`
  - Zero: `$0`
  - Extremely high: `$999,999,999`
  - Non-numeric: `ABC123`
  - Decimal cents: `$50,000.99` (verify handling)

- **Interest Rate Fields**:
  - Negative: `-5%`
  - Zero: `0%`
  - Over 100%: `150%`
  - Extreme precision: `4.123456%`

- **Forbearance Months**:
  - Negative: `-12`
  - Extremely high: `360` (30 years of forbearance)
  - Decimal: `6.5`

- **Current Monthly Payment**:
  - Negative: `-$100` (should reject)
  - Very high: `$1,000,000` (salary > income?)
  - Decimal cents: `$450.99`

---

### 4. **LOAN BALANCE vs PRINCIPAL VALIDATION - "OR LACK THEREOF"**

**Problem**: [Field Matrix](01_field_matrix.csv) explicitly notes: *"Verify Balance vs Principal relationship validation **(or lack thereof)**"*

This suggests the relationship between:
- `Balance` = Current loan balance
- `Principal` = Original loan principal
- `Accrued Interest` = Accrued interest

**Expected Relationship**: `Balance = Principal + Accrued Interest` (or close to it)

**Current Testing**: [UI-FLOW-FEDERAL-VALIDATION.spec.ts](../tests/projects/student-IDR/UI-FLOW-FEDERAL-VALIDATION.spec.ts) tests ONLY when this relationship holds (lines 15-84)

```typescript
const scenarios = [
  {
    id: 'FED-VAL-CHART-01',
    name: 'Pass - two loans (30000/45000)',
    loans: '30000|3|25000|5000;45000|5|35000|10000',
    // Balance=30000, Principal=25000, Accrued=5000 ✓ Validates
    expected: 'pass',
  },
  // ...
  {
    id: 'FED-VAL-CHART-07',
    name: 'Fail - negative APR',
    loans: '30000|-1|25000|5000',
    // Only tests APR validation, NOT Balance/Principal mismatch
    expected: 'fail',
  },
];
```

**Test Cases Missing**:
- Balance > Principal + Accrued Interest (paid down faster?)
- Balance < Principal + Accrued Interest (lost money?)
- Balance = $0 but Principal > $0 (fully paid off)
- Principal = $0 (edge case)
- Accrued Interest > Principal (high interest)

---

### 5. **PASSWORD VALIDATION - INCOMPLETE**

**Currently Tested** ([GLOBAL-02 through GLOBAL-05](../tests/projects/student-IDR/)):
- ✓ Missing uppercase
- ✓ Missing symbol
- ✓ Contains part of first name
- ✓ Too short (< 8 chars)

**Test Cases Missing**:
- Contains part of last name
- Contains email address
- Maximum length limit (if any): `SuperLongPassword!@#$%^&*()_+-=[]{}|;:',.<>?/`
- Only spaces/special chars: `!@#$%^&*()`
- Unicode characters: `Pässwörd123!` (should validate or reject clearly)
- Tab/newline characters: `Pass123!\t`

---

### 6. **EMAIL VALIDATION - PARTIAL**

**Currently Tested** ([GLOBAL-06](../tests/projects/student-IDR/GLOBAL-06.spec.ts)):
- ✓ Invalid format: `not-an-email`

**Test Cases Missing**:
- Max length email: `this.is.a.very.long.email.address.that.might.exceed@somedomain.verylongextension.com`
- Plus addressing: `user+test@example.com` (Gmail pattern)
- Special chars in local part: `first.last+tag@example.com`
- Internationalized domain: `user@münchen.de`
- Duplicate @ symbol: `user@@example.com`
- Missing @ or domain: `userexample.com`
- Trailing/leading spaces: ` user@example.com ` (should trim or reject)

---

### 7. **CHILD AGE FIELDS - BOUNDARY MISSING**

**Field Matrix Note**: *"Test add multiple / remove / edge ages"*

**Currently Tested**: Via scenario profiles (SCN-003 with 1 dependent age 2, SCN-007 with 2 dependents ages 5,8)

**Test Cases Missing**:
- Age = 0 (newborn)
- Age = 1 (infant)
- Age > 26 (adult, no longer dependent)
- Age = 99 (implausible)
- Negative age: `-5`
- Non-numeric: `ABC`
- Decimal: `5.5`
- Add 50 dependent rows (performance/max rows)

---

### 8. **DROPDOWN/SELECT VALIDATION - NOT TESTED FOR TAMPERING**

**Problem**: Tests don't verify what happens if user:
- Manually sends invalid option values via browser dev tools
- Submits form with crafted POST data containing invalid plan choice
- Sends JSON with unknown enum values

**Affected Dropdowns**:
- `repaymentPlan` (should only be: IBR New, IBR Old, RAP, PAYE)
- `marriedTaxFilingStatus` (should only be: Jointly, Separated)
- `maritalStatus` (should only be: Single, Married)
- `assetAccountType` (should match known account types)
- `assetOwner` (should be: Applicant, Spouse, or Joint)

**Test Cases Missing**: None - this would require API/backend testing, not UI testing

---

### 9. **STATE FIELD - GOOGLE PLACES AUTOCOMPLETE NOT VALIDATED**

**Location**: [test-setup.ts](test-setup.ts#L520-L560)

**Current Behavior**: Uses Google Places autocomplete with fallback

**Test Cases Missing**:
- Invalid state abbreviation: `XX`, `ZZ`
- Misspelled state: `Califonia` (instead of California)
- Non-US location: `Toronto`, `London`
- Integer/number: `12`, `99`
- Special characters: `##$$`

---

### 10. **CURRENCY FIELD MASKING - VALIDATION ASSUMPTIONS**

**Problem**: [test-setup.ts resilientFill()](test-setup.ts#L185-L215) assumes currency inputs have masking and tries to work around it

```typescript
// If the field already contains the expected value (ignoring currency
// formatting), leave it alone to avoid masked inputs duplicating text.
const beforeDigits = beforeValue.replace(/[^0-9]/g, '');
const expectedDigits = strValue.replace(/[^0-9]/g, '');
if (beforeDigits === expectedDigits && beforeDigits !== '') return;
```

**Issues**:
- ✗ Assumes digits-only comparison is safe
- ✗ Doesn't validate actual currency formatting
- ✗ What if user enters: `$$$$1000$$$$` (multiple currency symbols)?
- ✗ What if user enters: `1,000,000.00.00` (multiple decimal points)?
- ✗ No tests verify the backend receives correct parsed value

---

## Test Coverage Matrix

| Field Type | Field Name(s) | Valid Cases | Invalid Cases | Boundary Cases | Status |
|---|---|---|---|---|---|
| Text (Name) | firstName, lastName, spouseFirstName, spouseLastName | ✓ | ✗ | ✗ | **MISSING** |
| Email | email | ✓ (GLOBAL-06) | ⚠ Minimal | ✗ | **INCOMPLETE** |
| Password | password | ✓ | ⚠ Partial (GLOBAL-02~05) | ✗ | **INCOMPLETE** |
| Date | repaymentStartDate | ✓ SCN-002 (old date) | ✗ | ✗ | **MISSING** |
| Currency (Income) | agiOrIncome, spouseAgiOrIncome | ✓ | ✗ | ✗ | **MISSING** |
| Percentage | loanApr, interestRate | ⚠ Partial (FED-VAL) | ✗ (only negative APR) | ✗ | **MISSING** |
| Currency (Loan) | loanBalance, principal, accrued | ✓ (SCN scenarios) | ✗ | ✗ (mismatch logic) | **MISSING** |
| Number | forbearanceMonths | ✓ (SCN-008: 24) | ✗ | ✗ | **MISSING** |
| Number | childAge | ✓ (SCN-003, SCN-007) | ✗ | ✗ (edge ages) | **MISSING** |
| Currency | currentMonthlyPayment | ✓ (set to $0) | ✗ (negative?) | ✗ | **MISSING** |
| Currency | assetBalance | ✓ (test data) | ✗ | ✗ | **MISSING** |
| Text | accountName, institution | ✓ (manual test) | ✗ | ✗ (length) | **MISSING** |
| Dropdown | repaymentPlan, filingStatus, etc. | ✓ (scenarios) | ✗ (invalid values) | ✗ | **NOT APPLICABLE** (UI only) |

---

## Recommended Fixes (Priority Order)

### P0 - CRITICAL (Must Fix)
1. **Date Validation Test** - Create `UI-FLOW-DATE-VALIDATION.spec.ts`
   - Test invalid dates: 13/45/2025, 02/30/2025, 33/44/1111
   - Test date range validation (past vs future for repayment start)
   - Verify browser date input or JS validation catches errors

2. **Numeric Boundary Tests** - Create `UI-FLOW-NUMERIC-VALIDATION.spec.ts`
   - Test negative values in all currency fields
   - Test extreme high values: $999,999,999
   - Test zero values where applicable
   - Test decimal/cents handling

### P1 - HIGH (Should Fix)
3. **Input Length Tests** - Create `UI-FLOW-INPUT-LENGTH-VALIDATION.spec.ts`
   - Test 100+ character names
   - Test very long email addresses
   - Test long password attempts
   - Document max length for each field

4. **Balance vs Principal Logic** - Enhance `UI-FLOW-FEDERAL-VALIDATION.spec.ts`
   - Add test cases for mismatched Balance/Principal/Accrued Interest
   - Verify validation catches or allows these scenarios
   - Document product behavior

### P2 - MEDIUM (Nice to Have)
5. **Special Character Tests** - Create `UI-FLOW-SPECIAL-CHARS-VALIDATION.spec.ts`
   - Test Unicode characters in name fields
   - Test SQL injection patterns (e.g., `"; DROP TABLE--`)
   - Test HTML/script tags in text fields
   - Verify sanitization or rejection

6. **Enhanced Password Validation** - Add tests to GLOBAL password suite
   - Test last name patterns
   - Test email patterns
   - Test very long passwords

---

## Root Cause Analysis

Why are these gaps present?

1. **Test Strategy Focused on "Happy Path"**: All SCN (scenario) tests use valid data only
2. **No Dedicated Validation Spec File**: Only GLOBAL-06 and UI-FLOW-04 test validation; others are scattered
3. **Field Matrix Not Fully Implemented**: Field matrix documents what *should* be tested but not all tests exist
4. **No Automated Boundary Testing Framework**: Tests manually define each scenario; no parameterized test approach
5. **Assumption That Framework Input Validation Works**: Tests assume the application validates, but don't verify errors

---

## Next Steps

1. **Audit Application Code** - Check if backend is actually validating these inputs
2. **Define Validation Rules** - Product team must specify:
   - Max length for each text field
   - Valid date ranges (e.g., repayment start date must be future?)
   - Valid ranges for all numeric fields
3. **Implement Validation Tests** - Create comprehensive test specs (P0 and P1)
4. **Document Findings** - Report actual validation behavior vs. expected

---

**Owner**: QA Team  
**Repository**: `/Users/jameshc/Automation/WebAutomation`  
**Related Files**:
- [test-setup.ts](test-setup.ts)
- [01_field_matrix.csv](01_field_matrix.csv)
- [03_test_cases.csv](03_test_cases.csv)
- [tests/projects/student-IDR/](../tests/projects/student-IDR/)

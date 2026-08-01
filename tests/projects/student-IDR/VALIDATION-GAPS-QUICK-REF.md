# Student IDR Input Validation Gaps - Quick Reference

## 🔴 CRITICAL - Date Validation Missing
**Location**: `/forgiveness/repayment` - Estimated repayment start date

**Problem**: `selectDate()` function accepts ANY date format with no validation
```javascript
// NO validation that month is 01-12, day is 01-31, year is reasonable
const isoDate = value.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2');
await target.fill(isoDate);
```

**Example Bad Inputs Accepted**:
- ❌ `33/44/1111` (month 33, day 44)
- ❌ `13/45/2025` (month 13, day 45)
- ❌ `02/30/2025` (February 30th)
- ❌ `02/29/2025` (not a leap year)

**Current Testing**: NONE - tests only use valid dates

---

## 🔴 HIGH - Input Length Boundaries Not Tested
**Affected Fields**:
| Field | Type | Max Length Tested? |
|-------|------|-------------------|
| firstName | text | ❌ NO |
| lastName | text | ❌ NO |
| spouseFirstName | text | ❌ NO |
| spouseLastName | text | ❌ NO |
| email | email | ❌ NO |
| password | password | ❌ NO |
| accountName | text | ❌ NO |
| institution | text | ❌ NO |

**Test Gap**: No tests for 100+ character strings, unicode, special characters

---

## 🟡 MEDIUM - Numeric Boundary Testing Incomplete
**Missing Scenarios**:

| Field | Negative | Zero | Extreme High | Decimal | Status |
|-------|----------|------|--------------|---------|--------|
| agiOrIncome | ❌ | ❌ | ❌ | ❌ | MISSING |
| loanBalance | ✓ (some) | ❌ | ❌ | ❌ | PARTIAL |
| loanApr | ✓ (FED-VAL) | ❌ | ❌ | ❌ | PARTIAL |
| forbearanceMonths | ❌ | ❌ | ❌ | ❌ | MISSING |
| currentMonthlyPayment | ❌ | ✓ | ❌ | ❌ | PARTIAL |
| assetBalance | ❌ | ❌ | ❌ | ❌ | MISSING |

---

## 🟡 MEDIUM - Balance vs Principal Validation Unclear
**Field Matrix Notes**: _"Verify Balance vs Principal relationship validation **(or lack thereof)**"_

**Undefined Behavior**:
- What happens if: Balance = $50,000, Principal = $100,000, Accrued Interest = $10,000?
- What happens if: Balance = $0, but Principal > $0 (fully paid)?
- Does backend validate this relationship? **UNKNOWN**

**Current Tests**: Only validate when relationship HOLDS (passes validation)

---

## Test Files Needing Updates

### ✅ Exist (Partial)
- `GLOBAL-06.spec.ts` - Invalid email format only
- `GLOBAL-07.spec.ts` - Terms checkbox only
- `UI-FLOW-04-welcome.spec.ts` - Missing required fields only
- `UI-FLOW-FEDERAL-VALIDATION.spec.ts` - Loan entry validation (limited)

### ❌ MISSING (Need to Create)
- `UI-FLOW-DATE-VALIDATION.spec.ts` - **URGENT**
- `UI-FLOW-INPUT-LENGTH-VALIDATION.spec.ts` - **URGENT**
- `UI-FLOW-NUMERIC-BOUNDARIES.spec.ts` - **HIGH**
- `UI-FLOW-SPECIAL-CHARS-VALIDATION.spec.ts` - **MEDIUM**

---

## Root Cause

1. **Test Strategy**: All SCN (scenario) tests use ONLY valid data
2. **No Validation Audit**: Assumption that app validates correctly, but never verified
3. **Incomplete Field Matrix**: Documents needed tests but not all implemented
4. **Manual Test Data**: No framework for parameterized boundary testing

---

## Immediate Actions Required

**P0 (CRITICAL)**:
1. Create date validation test - verify 33/44/1111 is REJECTED
2. Create numeric boundary tests - verify negative values are REJECTED  
3. Create input length tests - verify max length is ENFORCED

**P1 (HIGH)**:
4. Enhance password validation - test last name, email, length
5. Test Balance vs Principal logic - document product behavior
6. Test email edge cases - max length, special formats

**P2 (MEDIUM)**:
7. Special character sanitization testing
8. Child age boundary testing
9. State field invalid value handling

---

**Analysis Created**: 2026-07-31  
**Full Report**: [VALIDATION-ANALYSIS.md](./VALIDATION-ANALYSIS.md)  
**Status**: Ready for QA Implementation

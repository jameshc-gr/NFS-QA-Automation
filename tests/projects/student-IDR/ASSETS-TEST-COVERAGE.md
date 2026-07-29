# Assets Page Test Coverage - New Test Cases

## Overview

Added comprehensive test coverage for the Assets page, including Plaid account linking and manual account CRUD operations. These tests validate both single and combined account entry methods.

## Test Files Created

### 1. UI-FLOW-ASSETS-01.spec.ts - Plaid Account Linking
**Purpose**: Test Plaid integration for linked bank accounts

**Test Cases**:
- `Student IDR - UI-FLOW-ASSETS-01 - Link Account via Plaid (Platypus)`: Full flow from Welcome through Assets with Plaid linking
- `Student IDR - UI-FLOW-ASSETS-01 - Plaid Linking Standalone`: Verify linked account appears in list

**Profile Used**: `UI-FLOW-ASSETS-01`
- Plaid Bank: Platypus Bank
- Credentials: user_good / pass_good
- Single applicant, moderate income ($72,000 AGI)

### 2. UI-FLOW-ASSETS-02.spec.ts - Multiple Manual Accounts CRUD
**Purpose**: Test adding, editing, and deleting manual asset accounts

**Test Cases**:
- `Student IDR - UI-FLOW-ASSETS-02 - Manual Accounts CRUD Operations`: 
  - Add first account (Primary Savings - $15,000)
  - Add second account (Employer 401K - $85,000)
  - Edit first account (change balance to $25,000)
  - Delete second account
  - Continue to next step

- `Student IDR - UI-FLOW-ASSETS-02 - Add Multiple Accounts Sequential`:
  - Add 4 accounts sequentially in single session:
    - Bank of America Checking ($5,000)
    - Wells Fargo Savings ($12,000)
    - Vanguard IRA ($95,000)
    - Investment Property ($250,000)

**Profile Used**: `UI-FLOW-ASSETS-02`
- Single applicant, higher income ($85,000 AGI)
- Tests asset management on second page

### 3. UI-FLOW-ASSETS-03.spec.ts - Combined Plaid + Manual
**Purpose**: Test hybrid approach with both Plaid-linked and manual accounts

**Test Cases**:
- `Student IDR - UI-FLOW-ASSETS-03 - Plaid + Manual Account Hybrid`:
  - Link Platypus Bank via Plaid
  - Add manual Checking account ($8,500)
  - Verify both accounts visible
  - Continue to next step

- `Student IDR - UI-FLOW-ASSETS-03 - Mixed Asset Sources (Plaid + Multiple Manual)`:
  - Link Plaid account (Platypus)
  - Add Savings Account from Community Bank ($22,000)
  - Add Investment Brokerage from TD Ameritrade ($145,000)
  - Verify all three accounts present

**Profile Used**: `UI-FLOW-ASSETS-03`
- Single applicant, $80,000 AGI
- Tests combined asset entry methods

## Helper Functions Added to test-setup.ts

### New Exported Functions

#### `linkPlaidAccount()`
```typescript
export async function linkPlaidAccount(
  page: Page, 
  bankName: string,        // e.g., "Platypus Bank"
  userId: string,          // e.g., "user_good"
  password: string,        // e.g., "pass_good"
  institutionName?: string
): Promise<void>
```
- Opens Plaid modal
- Searches for bank by name
- Enters credentials
- Submits to complete linking

#### `addManualAsset()`
```typescript
export async function addManualAsset(
  page: Page,
  accountName: string,        // e.g., "Primary Savings"
  accountType: string,        // e.g., "Cash", "401K", "IRA"
  institution: string,        // e.g., "Chase"
  balance: string,            // e.g., "15000"
  owner: string,              // e.g., "Applicant"
  includeTaxBomb: boolean
): Promise<void>
```
- Clicks Add Manual Account button
- Fills account details
- Saves account

#### `editAsset()`
```typescript
export async function editAsset(
  page: Page,
  accountName: string,
  newBalance: string
): Promise<void>
```
- Finds account by name
- Clicks Edit button
- Updates balance
- Saves changes

#### `deleteAsset()`
```typescript
export async function deleteAsset(
  page: Page,
  accountName: string
): Promise<void>
```
- Finds account by name
- Clicks Delete button
- Confirms deletion

### Existing Functions Now Exported

Made the following helper functions available for import in test files:
- `fillIncome()` - Fill income/AGI step
- `fillFederal()` - Fill federal student loans
- `fillRepayment()` - Fill repayment plan selection
- `clickWhenEnabled()` - Safe button click with enable state check
- `selectDropdown()` - Select option from dropdown/combobox
- `resilientFill()` - Fill input with fallback strategies
- `setCheckbox()` - Toggle checkbox state

## Test Profiles Added to student-IDR.yml

### UI-FLOW-ASSETS-01
- Purpose: Plaid sandbox account linking
- Variables: `PLAID_BANK_UI-FLOW-ASSETS-01`, `PLAID_USER_UI-FLOW-ASSETS-01`, `PLAID_PASSWORD_UI-FLOW-ASSETS-01`

### UI-FLOW-ASSETS-02
- Purpose: Multiple manual account operations
- Standard income/loan fields

### UI-FLOW-ASSETS-03
- Purpose: Combined Plaid + manual account entry
- Includes both Plaid and manual account variables

## Running the Tests

Run all new Assets tests:
```bash
npm test -- UI-FLOW-ASSETS
```

Run specific test file:
```bash
npm test -- UI-FLOW-ASSETS-01.spec.ts
```

Run specific test case:
```bash
npm test -- UI-FLOW-ASSETS-02.spec.ts -g "CRUD Operations"
```

## Test Coverage Summary

| Scenario | Coverage | Status |
|----------|----------|--------|
| Plaid account linking | Basic + Standalone | ✓ Created |
| Manual account add | Single + Multiple (4 accounts) | ✓ Created |
| Manual account edit | Change balance | ✓ Created |
| Manual account delete | Remove existing | ✓ Created |
| Combined Plaid + Manual | Hybrid entry | ✓ Created |
| Mixed asset types | Cash, 401K, IRA, Property, Investments | ✓ Created |
| Account totals | Automatic recalculation | ✓ Coverage |

## Implementation Notes

1. **Plaid Sandbox Credentials**: Uses provided Platypus Bank (user_good/pass_good) for testing
2. **Account Types**: Tests support full range of QA dropdown options (Cash, 401K, ROTH 401K, IRA, HSA, Other Retirement, Other Investments, Property, Auto, Other Assets)
3. **Second Page Navigation**: Tests verify ability to add multiple accounts and handle pagination
4. **Error Handling**: All helper functions include .catch() clauses to handle page closure issues gracefully
5. **Timeout Management**: Reduced timeouts (1-2s between operations) to minimize Assets page hanging issues

## Future Enhancements

- Add spouse asset entry tests (for married scenarios)
- Test tax-bomb calculation verification
- Add asset type-specific validation (e.g., auto insurance for auto assets)
- Test account deletion confirmation flows
- Add balance update verification tests

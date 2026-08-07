# Test Cases Reference

This file documents all 50 test cases for the API testing framework. Test cases are organized by category and cover authentication, user data, loan applications, financial operations, and security features.

## Test Case Categories

- **Authentication & Tokens** (4 cases: API-001 to API-003, API-031)
- **User Profiles & Accounts** (8 cases: API-004 to API-008, API-013-014)
- **Loan Applications** (12 cases: API-009 to API-012, API-020 to API-024)
- **Financial Data** (8 cases: API-019, API-035-036, API-020, API-021-022, API-043-045)
- **Notifications & Messaging** (2 cases: API-025 to API-026)
- **Document Management** (4 cases: API-011 to API-012, API-046, API-048)
- **Account Security** (7 cases: API-015 to API-018, API-033-034)
- **Information & Legal** (3 cases: API-027 to API-030)

## Quick Reference Table

| Test ID | Endpoint | Method | Priority | Category | UI Impact |
|---------|----------|--------|----------|----------|-----------|
| API-001 | POST /api/oauth/token | POST | Critical | Auth | Sets token for app |
| API-002 | GET /actuator/info | GET | High | Health Check | Displays version |
| API-003 | GET /actuator/health | GET | Critical | Health Check | Backend connectivity |
| API-004 | GET /api/users/{userId} | GET | High | User Data | Profile screen |
| API-005 | GET /api/users/{userId}/accounts | GET | High | User Data | Accounts list |
| API-006 | GET /api/accounts/{accountId} | GET | High | Account Data | Account details |
| API-007 | GET /api/accounts/{accountId}/balance | GET | High | Account Data | Balance display |
| API-008 | GET /api/accounts/{accountId}/transactions | GET | High | Transactions | Transaction list |
| API-009 | POST /api/loans/apply | POST | Critical | Loan App | Confirmation screen |
| API-010 | GET /api/loans/{loanId}/status | GET | High | Loan Status | Status display |
| API-011 | POST /api/documents/upload | POST | High | Document | Upload success |
| API-012 | GET /api/documents/{applicationId} | GET | High | Document | Document list |
| API-013 | PUT /api/users/{userId} | PUT | Medium | User Update | Profile update |
| API-014 | POST /api/users/{userId}/verify-email | POST | High | Email Verify | Verification screen |
| API-015 | POST /api/users/{userId}/confirm-email | POST | High | Email Verify | Unlock features |
| API-016 | POST /api/security/questions | POST | Medium | Security | Confirmation |
| API-017 | POST /api/security/2fa/enable | POST | High | 2FA | Setup screen |
| API-018 | POST /api/security/2fa/verify | POST | High | 2FA | Code verification |
| API-019 | GET /api/exchange-rates | GET | Medium | Financial | Currency display |
| API-020 | POST /api/loans/calculate-payment | POST | High | Loan Calc | Calculator display |
| API-021 | GET /api/loans/offers | GET | High | Offers | Offers list |
| API-022 | POST /api/loans/offers/{offerId}/accept | POST | Critical | Loan App | Next step |
| API-023 | GET /api/applications/{applicationId} | GET | High | App Status | App progress |
| API-024 | POST /api/applications/{applicationId}/submit | POST | Critical | Submit | Confirmation |
| API-025 | GET /api/users/{userId}/notifications | GET | High | Notify | Notify center |
| API-026 | POST /api/notifications/{notificationId}/read | POST | Medium | Notify | Badge update |
| API-027 | GET /api/help/articles | GET | Low | Help | Help screen |
| API-028 | GET /api/company/contact | GET | Low | Info | Contact screen |
| API-029 | GET /api/legal/terms | GET | Medium | Legal | T&C screen |
| API-030 | GET /api/legal/privacy | GET | Medium | Legal | Privacy screen |
| API-031 | POST /api/auth/logout | POST | High | Auth | Login screen |
| API-032 | POST /api/auth/refresh-token | POST | High | Auth | Session extend |
| API-033 | POST /api/auth/reset-password | POST | High | Security | Reset code screen |
| API-034 | POST /api/auth/confirm-reset | POST | High | Security | New password |
| API-035 | GET /api/rates/interest | GET | Medium | Rates | Rate display |
| API-036 | GET /api/loans/compare | GET | Medium | Compare | Comparison view |
| API-037 | POST /api/loans/draft | POST | Medium | Draft | Draft saved |
| API-038 | GET /api/users/{userId}/drafts | GET | Medium | Draft | Drafts list |
| API-039 | DELETE /api/loans/draft/{draftId} | DELETE | Medium | Draft | Remove from list |
| API-040 | GET /api/applications/{applicationId}/co-applicant | GET | Medium | CoApp | Co-app screen |
| API-041 | POST /api/applications/{applicationId}/co-applicant | POST | High | CoApp | Add co-app |
| API-042 | PUT /api/applications/{applicationId}/co-applicant | PUT | Medium | CoApp | Update co-app |
| API-043 | DELETE /api/applications/{applicationId}/co-applicant | DELETE | Medium | CoApp | Remove co-app |
| API-044 | GET /api/users/{userId}/employment | GET | High | Employment | Employment screen |
| API-045 | PUT /api/users/{userId}/employment | PUT | Medium | Employment | Update employment |
| API-046 | GET /api/documents/income | GET | High | Income Doc | Income docs list |
| API-047 | POST /api/income/verify | POST | High | Income | Verification status |
| API-048 | GET /api/applications/{applicationId}/property | GET | High | Property | Property details |
| API-049 | PUT /api/applications/{applicationId}/property | PUT | Medium | Property | Update property |
| API-050 | GET /api/applications/{applicationId}/approval | GET | Critical | Approval | Decision screen |

## Test Case Groupings

### Critical Tests (Must Pass)
- API-001: Fetch Okta Token
- API-003: Health Check Status
- API-009: Apply Loan
- API-022: Accept Loan Offer
- API-024: Submit Application
- API-050: Get Approval Status

**Run Command:**
```bash
npm run test:api:smoke
```

### High Priority Tests (Should Pass)
- API-002, API-004 to API-008
- API-010 to API-015, API-017 to API-018
- API-020 to API-023, API-025
- API-031 to API-034, API-044, API-046 to API-049

**Run Command:**
```bash
npm run test:api:contract
```

### Medium Priority Tests (Comprehensive Coverage)
- API-013, API-016, API-019
- API-026 to API-030, API-035 to API-039
- API-042, API-045

**Run Command:**
```bash
npm run test:api:integration
```

## Usage: Running by Priority

### Quick Smoke Test (5 min)
```bash
npm run test:api:smoke
# Runs: API-001, API-003, API-031
```

### Contract Tests (15 min)
```bash
npm run test:api:contract
# Validates API data structures and types
```

### Integration Tests (30 min)
```bash
npm run test:api:integration
# Full end-to-end with mobile UI verification
```

### All Tests (45 min)
```bash
npm run test:api:all-scenarios
# Runs smoke + contract + integration
```

### Performance Tests
```bash
npm run test:api:performance
# Verifies response times < 2 seconds
# Monitors payload sizes
```

### By Tag/Category
```bash
# Authentication only
npm run test:api:by-tags auth

# Financial data
npm run test:api:by-tags financial

# Security features
npm run test:api:by-tags security
```

## Test Execution Strategy

### Phase 1: Setup & Authentication
1. API-001: Fetch token
2. API-003: Verify health
3. API-031: Test logout
4. API-032: Test refresh token

**Expected:** Token obtained, health confirmed, auth flow works

### Phase 2: User Data & Profiles
5. API-004: Get user profile
6. API-005: List accounts
7. API-006: Account details
8. API-007: Account balance
9. API-044: Employment info

**Expected:** All user data displays in mobile app

### Phase 3: Financial Operations
10. API-020: Calculate payment
11. API-021: Get offers
12. API-019: Exchange rates
13. API-035: Interest rates
14. API-036: Loan comparison

**Expected:** Calculations accurate, rates display correctly

### Phase 4: Loan Application
15. API-009: Apply for loan
16. API-022: Accept offer
17. API-024: Submit application
18. API-023: Check status
19. API-050: Get approval

**Expected:** Complete application flow works

### Phase 5: Document & Verification
20. API-011: Upload document
21. API-012: List documents
22. API-014: Verify email
23. API-015: Confirm email
24. API-047: Verify income

**Expected:** All documents and verifications complete

### Phase 6: Account Security
25. API-017: Enable 2FA
26. API-018: Verify 2FA code
27. API-033: Reset password
28. API-034: Confirm reset

**Expected:** All security features enable

## Data Requirements by Test

### Test Environment Setup
```env
BASE_URL=https://fsp.rate.com/gateway
API_TOKEN=Bearer <token-from-api-001>
TENANT_ID=gri
CUSTOMER_ID=12345
```

### Sample Test Data

**API-001 (Authentication)**
```json
{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret"
}
```

**API-004 (User Profile)**
```json
{
  "userId": "123456",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**API-009 (Loan Application)**
```json
{
  "loanAmount": 250000,
  "loanTerm": 30,
  "interestRate": 5.25,
  "monthlyPayment": 1384,
  "applicantFirstName": "John",
  "applicantLastName": "Doe",
  "applicantEmail": "john@example.com",
  "applicantPhone": "555-0123",
  "propertyAddress": "123 Main St, City, ST 12345",
  "propertyValue": 350000
}
```

## Mobile UI Verification

Each test case includes expected UI impacts. Common verification patterns:

### List Views
```typescript
// Verify API data count matches UI item count
expect(uiItemCount).toBe(apiDataArray.length);

// Verify each item data
for (let i = 0; i < apiData.length; i++) {
  const uiText = await page.locator('[data-item]').nth(i).textContent();
  expect(uiText).toContain(apiData[i].displayName);
}
```

### Detail Views
```typescript
// Verify single item details
const apiData = await getAccountDetails(accountId);
const uiData = await getDisplayedAccountDetails();

expect(uiData.accountName).toBe(apiData.name);
expect(uiData.balance).toBe(formatCurrency(apiData.balance));
expect(uiData.accountType).toBe(apiData.type);
```

### Forms
```typescript
// Verify form submission
const submitResponse = await submitLoanApplication(formData);
const confirmationNumber = await getConfirmationNumber();

expect(confirmationNumber).toBe(submitResponse.confirmationNumber);
```

## CSV Test Case File

All 50 test cases are documented in [api/tests/test-cases.csv](api/tests/test-cases.csv).

Columns:
- Test Case ID
- Test Name
- API Endpoint
- HTTP Method
- Purpose
- Expected Status
- Test Data Required
- Verification Type
- Mobile UI Impact
- Priority
- Category

**Import into Test Management:**
```bash
# Open in Excel
open api/tests/test-cases.csv

# Convert to JSON
npm run convert:csv-to-json api/tests/test-cases.csv
```

## Coverage Analysis

### Coverage by Endpoint Type
- GET (Read) - 24 cases (48%)
- POST (Create) - 18 cases (36%)
- PUT (Update) - 6 cases (12%)
- DELETE (Remove) - 2 cases (4%)

### Coverage by Feature
- Authentication - 5 cases (10%)
- User Management - 8 cases (16%)
- Account Management - 7 cases (14%)
- Loan Application - 12 cases (24%)
- Financial Services - 8 cases (16%)
- Document Management - 4 cases (8%)
- Account Security - 7 cases (14%)
- Support/Legal - 3 cases (6%)

### Coverage by Priority
- Critical - 6 cases (12%)
- High - 25 cases (50%)
- Medium - 19 cases (38%)

## Maintenance & Updates

To add new test cases:

1. **Add row to CSV** - `api/tests/test-cases.csv`
2. **Document endpoint** - Update API documentation
3. **Create test code** - Add to `api/tests/` or mobile specs
4. **Update this file** - Add to appropriate section
5. **Link in README** - Update main documentation

## Further Reading

- [../API-TESTING.md](../API-TESTING.md) - Complete API testing guide
- [../MOBILE-UI-VERIFICATION.md](../MOBILE-UI-VERIFICATION.md) - Mobile verification guide
- [../README.md](../README.md) - API runner guide
- [test-cases.csv](test-cases.csv) - Test cases in CSV format

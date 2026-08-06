# API Testing Guide

Complete guide for API testing with Postman collections, automatic token management, and mobile UI verification.

---

## Quick Start (5 minutes)

### 1. Extract Environment Config
```bash
npm run postman:extract-env
```
This auto-loads configuration from your Postman environment file.

### 2. Run Smoke Tests
```bash
npm run postman:runner:smoke
```
Expected output:
```
✅ Fetch Okta Token (200)
✅ Health Check (200)
✨ Extracted accessToken for subsequent requests
```

### 3. Run Full Test Suite
```bash
npm run test:api:contract        # All API validations
npm run test:api:integration     # With mobile UI verification
npm run test:api:performance     # Response time checks
```

---

## Setup & Configuration

### Environment Variables

Create a `.env` file or export variables:

```bash
# Required
BASE_URL=https://fsp.rate.com/gateway

# Optional (auto-extracted from Postman)
API_TOKEN=Bearer <token>
TENANT_ID=gri
CUSTOMER_ID=12345
```

### Automatic Config Loading

Configuration is auto-loaded from:
1. `api/api-configs/gateway-api-config.json` (auto-generated)
2. Environment variables (override config file)
3. Process.env fallback

**Extract Postman environment once:**
```bash
npm run postman:extract-env
```

**Result:** Creates `api/api-configs/gateway-api-config.json` with:
- Base URL
- API token
- Tenant/Customer IDs
- Timeout settings
- Retry configuration

### Postman Environment File

Place your Postman environment at: `api/postman/environment.qa.json`

```json
{
  "variables": [
    {
      "key": "baseUrl",
      "value": "https://fsp.rate.com/gateway"
    },
    {
      "key": "accessToken",
      "value": "Bearer token-will-be-fetched"
    }
  ]
}
```

### Postman Collection

Place your collection at: `api/postman/mobile/Gateway-API-Latest-Jul-29-2026.postman_collection.json`

The runner automatically:
- Locates the FetchOktaToken API
- Extracts accessToken from response
- Injects token into subsequent requests
- Manages token lifecycle

---

## Running Tests

### By Priority

```bash
# Critical APIs only (5 min)
npm run postman:runner:smoke

# High-priority APIs (15 min)
npm run test:api:contract

# Full integration with mobile UI (30 min)
npm run test:api:integration:mobile

# All scenarios (45 min)
npm run test:api:all-scenarios
```

### By Category

```bash
# Authentication flow
npm run test:api:by-tags auth

# User management
npm run test:api:by-tags user

# Loan applications
npm run test:api:by-tags loan

# Financial data
npm run test:api:by-tags financial

# Account security
npm run test:api:by-tags security

# Document management
npm run test:api:by-tags documents
```

### With Overrides

```bash
# Override base URL
BASE_URL=https://httpbin.org npm run postman:runner:smoke

# Override token
API_TOKEN="Bearer new-token" npm run test:api:contract

# Run specific project
API_PROJECT=mobile npm run test:api:contract
```

---

## Test Scenarios

### Smoke (Critical APIs)
- **APIs:** Token fetch, health check, logout
- **Duration:** 5 min
- **Purpose:** Verify basic connectivity
- **When to use:** Quick validation before full suite

### Contract (Schema Validation)
- **APIs:** All 50 test cases
- **Duration:** 15 min
- **Purpose:** Verify API response structures match expected schemas
- **When to use:** Before merging to main branch

### Integration (Mobile UI Sync)
- **APIs:** All 50 test cases + mobile UI verification
- **Duration:** 30 min
- **Purpose:** Verify API data displays correctly in mobile app
- **When to use:** Before release

### Performance (Response Time Monitoring)
- **APIs:** All endpoints
- **Duration:** 45 min
- **Purpose:** Track response times and identify bottlenecks
- **When to use:** Performance regression testing

---

## Token Management

The framework automatically handles Okta token extraction and injection.

### How It Works

1. **Identify Token API:** Looks for API with "token" in name
2. **Execute First:** Runs FetchOktaToken before other APIs
3. **Extract Token:** Gets `data.fetchOktaToken.accessToken` from response
4. **Store Token:** Saves to Map for use in subsequent requests
5. **Inject Token:** Adds `Authorization: Bearer <token>` header to all requests

### Token Extraction Pattern

```typescript
// Extracts from GraphQL response
const tokenPath = 'data.fetchOktaToken.accessToken';
const token = getNestedValue(response, tokenPath);

// Injects into headers
headers['Authorization'] = `Bearer ${token}`;
```

### Manual Token Refresh

```bash
# Get new token
npm run postman:runner -- --refresh-token

# Use specific token
API_TOKEN="Bearer my-token" npm run postman:runner:smoke
```

---

## Test Cases

**50 comprehensive test cases** covering:
- Authentication & tokens (4 cases)
- User profiles & accounts (8 cases)
- Loan applications (12 cases)
- Financial data (8 cases)
- Document management (4 cases)
- Account security (7 cases)
- Notifications (2 cases)
- Information & legal (3 cases)

For detailed test case reference, see [tests/TEST-CASES-REFERENCE.md](tests/TEST-CASES-REFERENCE.md).

---

## Mobile UI Verification

Each test includes verification that API data displays correctly in the mobile app UI.

### Verification Workflow

```
Execute API → Capture Response → Validate Schema → 
Send to Mobile App → Inspect UI → Verify Data Matches → Check Formatting
```

### Example: Verify User Profile

```typescript
// 1. Capture API response
const apiResponse = await getProfile(userId);
// { firstName: "John", lastName: "Doe", email: "john@example.com" }

// 2. Navigate to mobile profile screen
await page.click('[data-testid="profile-button"]');

// 3. Verify UI displays API data
const displayedName = await page.getByTestId('profile-name').textContent();
expect(displayedName).toBe(`${apiResponse.firstName} ${apiResponse.lastName}`);

const displayedEmail = await page.getByTestId('profile-email').textContent();
expect(displayedEmail).toBe(apiResponse.email);
```

### Verification by Feature

| Feature | API Endpoint | Mobile Screen | Test Case |
|---------|-------------|---------------|-----------|
| Authentication | POST /oauth/token | Login | API-001 |
| User Profile | GET /users/{id} | Settings/Profile | API-004 |
| Accounts | GET /users/{id}/accounts | Dashboard | API-005 |
| Transactions | GET /accounts/{id}/transactions | History | API-008 |
| Loan Application | POST /loans/apply | Confirmation | API-009 |
| Loan Status | GET /applications/{id}/status | Status Screen | API-023 |
| Loan Offers | GET /loans/offers | Offers List | API-021 |
| Document Upload | POST /documents/upload | Upload Screen | API-011 |
| Email Verification | POST /auth/verify-email | Verification | API-014 |
| 2FA Setup | POST /security/2fa/enable | Settings | API-017 |

For comprehensive verification procedures, see [MOBILE-UI-VERIFICATION.md](MOBILE-UI-VERIFICATION.md).

---

## Test Reports

### View Test Results

```bash
# Display JSON report
cat test-results/postman-test-report-*.json | jq .

# Open HTML report
npm run test:api:report

# View specific test
npm run test:api:report -- --test-name "Fetch Okta Token"
```

### Report Structure

```json
{
  "summary": {
    "total": 50,
    "passed": 48,
    "failed": 2,
    "successRate": "96%",
    "duration": "45000ms"
  },
  "tests": [
    {
      "id": "API-001",
      "name": "Fetch Okta Token",
      "status": "PASS",
      "duration": "234ms",
      "apiStatus": 200,
      "uiVerification": "PASS"
    }
  ]
}
```

### Interpreting Results

| Status | Meaning | Action |
|--------|---------|--------|
| API FAIL | API returns error | Check API logs, credentials |
| UI MISMATCH | Data doesn't match | Check field mappings, formatting |
| TIMEOUT | Test takes too long | Check performance, network |
| PARSE ERROR | Response format wrong | Verify API schema |
| VALIDATION FAIL | Data invalid | Check test data |

---

## Troubleshooting

### API Won't Connect

```bash
# Test connectivity
curl https://fsp.rate.com/gateway/actuator/health

# Verify environment
echo $BASE_URL
echo $API_TOKEN

# Extract fresh config
npm run postman:extract-env
```

### Token Extraction Fails

```bash
# Verify token API exists
npm run postman:runner:smoke -- --verbose

# Check token response format
npm run postman:runner:smoke -- --debug

# Manual token specification
API_TOKEN="Bearer <token>" npm run postman:runner:smoke
```

### Data Doesn't Appear in Mobile UI

```
1. Verify API returned 200 OK
2. Check token is fresh (not expired)
3. Inspect mobile app console for parsing errors
4. Clear app cache and retry
5. Check field name mapping
```

### Tests Are Slow

```bash
# Profile test execution
npm run test:api:contract -- --profile

# Check network timing
npm run test:api:contract -- --verbose

# Reduce payload size
npm run test:api:by-tags transactions -- --limit=10
```

### Data Mismatch Between API and UI

```bash
# Compare exact responses
npm run test:api:contract -- --compare-api-ui

# Check formatting (currency, dates)
npm run test:api:contract -- --validate-formatting

# Verify no stale data
npm run test:api:contract -- --clear-cache
```

---

## File Organization

```
api/
├── postman/
│   ├── environment.qa.json              # Postman environment
│   └── mobile/
│       └── Gateway-API-Latest-*.json    # Postman collection
├── api-configs/
│   └── gateway-api-config.json          # Auto-generated config
├── api-mappings/
│   └── mobile/
│       └── api-mapping.json             # Custom mapping (optional)
├── tests/
│   └── test-cases.csv                   # Test case reference
└── README.md                             # API runner guide
```

---

## Scripts Reference

```bash
# Configuration
npm run postman:extract-env              # Extract env from Postman

# Running Tests
npm run postman:runner:smoke             # Quick tests
npm run test:api:contract                # Schema validation
npm run test:api:integration:mobile      # With UI verification
npm run test:api:performance             # Performance testing
npm run test:api:all-scenarios           # Complete suite

# Utilities
npm run test:api:report                  # View HTML report
npm run validate:api-mapping             # Validate mapping file
npm run test:api:by-tags [tag]          # Filter by tag
```

---

## Best Practices

✅ **DO**
- Run smoke tests first to confirm connectivity
- Extract Postman env once with `npm run postman:extract-env`
- Test data in consistent order (auth → profile → data)
- Verify both API and UI in same test
- Use explicit waits, not fixed timeouts
- Clear data between test runs
- Monitor performance metrics
- Run tests before merging PRs

❌ **DON'T**
- Run tests in random order (dependencies matter)
- Assume UI updated after API call (wait explicitly)
- Use hardcoded values (read from config)
- Skip error case testing
- Test only happy path
- Mix test concerns (API vs UI)
- Cache test results indefinitely
- Ignore timezone/locale differences
- Use same token across environments

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: API & Mobile Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Extract Postman env
        run: npm run postman:extract-env
      
      - name: Smoke Tests
        run: npm run postman:runner:smoke
      
      - name: Contract Tests
        run: npm run test:api:contract
      
      - name: Mobile Verification
        run: npm run test:api:integration:mobile
      
      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-results/
```

---

## Next Steps

1. **Run smoke tests** to verify setup works
2. **Review test results** - check for failures
3. **Run full contract tests** before major changes
4. **Set up CI/CD integration** for automated runs
5. **Monitor performance** over time

---

## Documentation

- [tests/TEST-CASES-REFERENCE.md](tests/TEST-CASES-REFERENCE.md) - All 50 test cases
- [MOBILE-UI-VERIFICATION.md](MOBILE-UI-VERIFICATION.md) - Mobile UI verification guide
- [README.md](README.md) - API folder guide
- [tests/test-cases.csv](tests/test-cases.csv) - Test cases in CSV format

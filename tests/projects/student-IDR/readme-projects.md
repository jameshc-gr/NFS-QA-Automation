# Student IDR UI Automation Suite

Location: [tests/projects/student-IDR](tests/projects/student-IDR)  
Data: [test-data/student-IDR/student-IDR.yml](test-data/student-IDR/student-IDR.yml)

## Scope

This Playwright suite covers the Income-Driven Repayment (IDR) / federal student loan forgiveness flow. It is derived from the attached CSV matrices:

- [test-data/student-IDR/01_field_matrix.csv](../../../test-data/student-IDR/01_field_matrix.csv) — field inventory per page
- [test-data/student-IDR/02_scenario_matrix.csv](../../../test-data/student-IDR/02_scenario_matrix.csv) — persona scenarios
- [test-data/student-IDR/03_test_cases.csv](../../../test-data/student-IDR/03_test_cases.csv) — test intents and expectations

## Files

- `test-setup.ts` — YAML profile loader, page helpers, and `runIdrFlow` orchestrator
- `idr-calculator.ts` — 150% FPL calculation engine, monthly payment formulas, tax bomb projections, and sinking fund savings evaluator
- `loan-amortization-calculator.ts` — loan amortization simulation, negative amortization detector, interest coverage comparator, asset tax bomb offsets, and plan duration calculator
- `FILING-HOUSEHOLD-STATE-CALCULATION.spec.ts` — 50 comprehensive CSV test cases covering filing status (Separate vs Joint), household size, state variations (WA, CA, OR, AK, HI), income tiers, payment floors, tax bomb calculations, and sinking fund savings goals
- `DATA-RETENTION-ZERO-PERSISTENCE.spec.ts` — zero-value data retention and persistence suite addressing defect [FAL-3672](https://rate.atlassian.net/browse/FAL-3672) across Personal Data, Loans, and Assets
- `FAL-3673-AMORTIZATION-TAX-BOMB.spec.ts` — loan amortization, interest coverage, asset offsets, and tax bomb suite guarding against [FAL-3673](https://rate.atlassian.net/browse/FAL-3673)
- `SCN-001.spec.ts` through `SCN-020.spec.ts` — one spec per scenario from `02_scenario_matrix.csv`
- `DASHBOARD-COVERAGE.spec.ts` — dashboard Overview, Scenarios, Personal Data, Settings, and Feedback discovery checks
- `DEPENDENT-CRUD.spec.ts` — dependent add/edit/delete/re-add lifecycle with boundary ages
- `UI-FLOW-ASSETS-01.spec.ts` through `UI-FLOW-ASSETS-03.spec.ts` — legacy asset CRUD/Plaid checks pending route confirmation

## Running tests

Run the loan amortization, interest coverage & tax bomb suite (FAL-3673):

```bash
# Playwright Chromium test execution
npm run test:fal-3673

# Standalone calculation suite runner with formatted summary
npm run test:fal-3673:runner
```

Run the data retention & zero-value persistence suite (FAL-3672):

```bash
npm run test:data-retention
```

Run the filing, household size & state calculation suite (50 test scenarios):

```bash
# Playwright Chromium test execution
npm run test:filing-calc

# Standalone TypeScript runner with formatted summary
npm run test:filing-calc:runner

# Across browsers (Chromium, Firefox, WebKit)
TEST_PROJECT=student-IDR node ./scripts/run-playwright.js tests/projects/student-IDR/FILING-HOUSEHOLD-STATE-CALCULATION.spec.ts
```

Run the baseline single-applicant scenario:

```bash
npx playwright test tests/projects/student-IDR/SCN-001.spec.ts --project=chromium
```

Run the full student-IDR suite:

```bash
npx playwright test tests/projects/student-IDR --project=chromium
```

Run across browsers:

```bash
npx playwright test tests/projects/student-IDR --project=chromium --project=firefox --project=webkit
```

## Test data

Profiles live in [test-data/student-IDR/student-IDR.yml](../../../test-data/student-IDR/student-IDR.yml). Each `SCN-XXX` override block is loaded automatically when a spec calls `loadProfile('SCN-XXX')`.

The final execution-oriented case matrix, including profile data references and expected results, is maintained in [test-data/student-IDR/04_final_test_cases_with_data.csv](../../../test-data/student-IDR/04_final_test_cases_with_data.csv). The Jira-style execution report is [test-results/student-IDR-test-execution-report-2026-07-28.md](../../../test-results/student-IDR-test-execution-report-2026-07-28.md).

### Unique credentials per run

To avoid duplicate-account conflicts in QA, every call to `runIdrFlow` generates a unique email address and password and applies them to the active profile before submitting Welcome:

- Format: `<base-local>.<run-id>.w<worker>.<counter>@<domain>`
- `run-id` is a timestamp + random suffix generated once per worker process, so separate test runs never reuse the same email sequence.
- Generated credentials are appended to `test-data/student-idr/student-IDR-emails.json` for audit and overlap protection.

### Login fallback

If the welcome-page signup redirects to a login screen mid-run (meaning the account already exists for the generated email), the framework automatically enters the email and password that were just used and submits the login form. After login, if the app lands on `my.gr-dev.com/dashboard`, the framework navigates back to `/forgiveness/income` so the flow can continue.

### Known execution blockers

The standalone validation specs (`SCN-016`, `SCN-017`, `SCN-018`, `GLOBAL-06`, `GLOBAL-07`, and `UI-FLOW-04-welcome`) do not require a completed signup. The 2026-07-27 Chromium run reached `/forgiveness/assets` for a new applicant but the page transitioned to a permanent loading state when `Enter manually` was selected. This is tracked in the execution report as `IDR-001`; it prevents all full-flow tests from reaching dashboard.

If a QA run is redirected to authentication before Income, alternatives include:

1. Record a `storageState` JSON with an authenticated session and point Playwright to it in `playwright.config.ts`.
2. Supply existing OKTA credentials via environment variables and log in before each flow test.
3. Use an API pre-step to create/authenticate the user and seed the session.

The dashboard and dependent CRUD specs require the same authenticated flow. They intentionally fail when the dashboard route, section controls, or dependent delete action is unavailable, so missing coverage is not reported as a false pass. The legacy asset specs still target `/forgiveness/assets`; update them after confirming the current dashboard asset route and control labels.

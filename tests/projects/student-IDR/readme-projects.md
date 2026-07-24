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
- `SCN-001.spec.ts` through `SCN-020.spec.ts` — one spec per scenario from `02_scenario_matrix.csv`

## Running tests

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

Profiles live in [test-data/student-IDR/student-IDR.yml](../../../test-data/student-IDR/student-IDR.yml). Each `SCN-XXX` override block is loaded automatically when a spec calls `loadProfile('SCN-XXX')`. The framework also appends a timestamp to the email address at runtime to avoid duplicate-account conflicts in QA.

## Authentication prerequisite

The current QA environment redirects newly created accounts to `my.gr-dev.com/dashboard` after the welcome-page signup. To run the full flow specs (`SCN-001` through `SCN-015`, `SCN-019`, `SCN-020`), the Playwright context must be pre-authenticated, or the environment must be configured to return to the forgiveness flow after signup.

Options:

1. Record a `storageState` JSON with an authenticated session and point Playwright to it in `playwright.config.ts`.
2. Supply existing OKTA credentials via environment variables and log in before each flow test.
3. Use an API pre-step to create/authenticate the user and seed the session.

The standalone validation specs (`SCN-016`, `SCN-017`, `SCN-018`) do not require a completed signup.

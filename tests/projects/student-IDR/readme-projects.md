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

Profiles live in [test-data/student-IDR/student-IDR.yml](../../../test-data/student-IDR/student-IDR.yml). Each `SCN-XXX` override block is loaded automatically when a spec calls `loadProfile('SCN-XXX')`.

The final execution-oriented case matrix, including profile data references and expected results, is maintained in [test-data/student-IDR/04_final_test_cases_with_data.csv](../../../test-data/student-IDR/04_final_test_cases_with_data.csv). The Jira-style execution report is [docs/student-IDR-test-execution-report-2026-07-27.md](../../../test-results/student-IDR-test-execution-report-2026-07-27.md).

### Unique credentials per run

To avoid duplicate-account conflicts in QA, every call to `runIdrFlow` generates a unique email address and password and applies them to the active profile before submitting Welcome:

- Format: `<base-local>.<run-id>.w<worker>.<counter>@<domain>`
- `run-id` is a timestamp + random suffix generated once per worker process, so separate test runs never reuse the same email sequence.
- Generated credentials are appended to `test-results/student-IDR-emails.json` for audit and overlap protection.

### Login fallback

If the welcome-page signup redirects to a login screen mid-run (meaning the account already exists for the generated email), the framework automatically enters the email and password that were just used and submits the login form. After login, if the app lands on `my.gr-dev.com/dashboard`, the framework navigates back to `/forgiveness/income` so the flow can continue.

### Known execution blocker

The standalone validation specs (`SCN-016`, `SCN-017`, `SCN-018`, `GLOBAL-06`, `GLOBAL-07`, and `UI-FLOW-04-welcome`) do not require a completed signup. The 2026-07-27 Chromium run reached `/forgiveness/assets` for a new applicant but the page transitioned to a permanent loading state when `Enter manually` was selected. This is tracked in the execution report as `IDR-001`; it prevents all full-flow tests from reaching dashboard.

If a QA run is redirected to authentication before Income, alternatives include:

1. Record a `storageState` JSON with an authenticated session and point Playwright to it in `playwright.config.ts`.
2. Supply existing OKTA credentials via environment variables and log in before each flow test.
3. Use an API pre-step to create/authenticate the user and seed the session.

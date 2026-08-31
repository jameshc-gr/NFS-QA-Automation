# Student IDR Validation Report

**Date:** 2026-08-25  
**Environment:** QA  
**Browser executed:** Chromium

## Scope

Compared `01_field_matrix.csv`, `02_scenario_matrix.csv`, and `03_test_cases.csv` with the current Student IDR Playwright suite. Added dashboard section cases for Overview, Scenarios, Personal Data, Settings, and Feedback, plus CRUD lifecycle cases for assets, spouse, dependents, and federal loans.

## Changes

- Added five dashboard field-inventory rows and nine executable case rows.
- Added three scenario rows for dashboard CRUD, married dashboard persistence, and dependent boundary lifecycle.
- Added `DASHBOARD-COVERAGE.spec.ts` for dashboard section discovery.
- Added `DEPENDENT-CRUD.spec.ts` for add/edit/delete/re-add/save behavior.
- Updated `test-setup.ts` so income navigation waits for an enabled Continue button instead of attempting a disabled click.
- Updated Student IDR suite documentation and synchronized new case statuses.

## Execution

| Suite | Result |
|---|---:|
| Signup validation (`GLOBAL-06`, `GLOBAL-07`, `UI-FLOW-04-welcome`) | 3 passed, 0 failed |
| Dashboard and dependent new specs | 0 passed, 6 failed |
| Dependent CRUD focused rerun | 0 passed, 1 failed |
| Existing repayment focused suite | 0 passed, 3 failed |
| Existing federal focused scenario | 0 passed, 1 failed |

Reports:

- `test-results/2026-08-25/student-idr/playwright-summary-1787698079874.md`
- `test-results/2026-08-25/student-idr/playwright-summary-1787698463122.md`
- `test-results/2026-08-25/student-idr/playwright-summary-1787698570173.md`

Evidence for the dependent blocker:

- `test-results/2026-08-25/student-idr/runs/projects-student-IDR-DEPEN-96029--re-add-and-save-dependents-chromium/test-failed-1.png`
- `test-results/2026-08-25/student-idr/runs/projects-student-IDR-DEPEN-96029--re-add-and-save-dependents-chromium/error-context.md`

## Defects and blockers

### IDR-001: QA authentication prevents full-flow and dashboard validation

**Steps:** Start a Student IDR flow from `/forgiveness/welcome` with the configured QA profile.  
**Expected:** Flow reaches income, federal, repayment, and dashboard.  
**Actual:** QA redirects to `login.dev.rate.com/oauth2/...`; no authenticated storage state is configured.  
**Impact:** Dashboard, spouse, federal, asset, and persistence tests cannot execute.

### IDR-002: Income Continue remains disabled after dependent lifecycle data entry

**Steps:** Reach `/forgiveness/income`, enter AGI, select Single, add two child ages, delete one, re-add one, and enter `CA` in the state field.  
**Expected:** Continue enables after all required values are valid.  
**Actual:** Continue remains disabled. The screenshot shows AGI, two child ages, Single, and `CA` populated.  
**Impact:** Blocks dependent save/persistence and every downstream page.

### IDR-003: Assets route is not present in the observed current flow

**Steps:** Complete the available welcome/income flow and follow Continue.  
**Expected:** Reach `/forgiveness/assets` according to the existing asset requirements.  
**Actual:** Prior evidence consistently reached `/forgiveness/repayment`; asset CRUD specs therefore test a route not present in the observed application flow.  
**Impact:** Asset add/edit/delete/re-add and Plaid coverage remains unverified.

### IDR-004: Dashboard section and field contract is undocumented

**Steps:** Attempt dashboard coverage after authenticating the full flow.  
**Expected:** Stable routes, labels, field names, and save/delete semantics for Overview, Scenarios, Personal Data, Settings, and Feedback.  
**Actual:** No dashboard selectors or route contract exist in the repository.  
**Impact:** New dashboard tests are discovery checks and are blocked until an authenticated run captures the live controls.

## Coverage gaps and next actions

1. Provide a QA storage state or approved authentication fixture, then rerun dashboard, spouse, federal, dependent, and persistence cases.
2. Capture dashboard routes and stable selectors for all five requested sections.
3. Confirm whether assets moved into dashboard or were removed; then update the legacy asset specs and add full asset persistence assertions.
4. Investigate why state autocomplete/validation leaves income Continue disabled despite visible `CA`.
5. Add the dashboard field names and supported options to the field matrix after live capture.
6. Repair or regenerate `04_final_test_cases_with_data.csv`; it is currently deleted in the pre-existing worktree state.

## Additional validation note

The repository-wide TypeScript check remains blocked by a pre-existing syntax error in `scripts/wdio-codegen-to-wdio-generator.ts` (`TS1160: Unterminated template literal`).

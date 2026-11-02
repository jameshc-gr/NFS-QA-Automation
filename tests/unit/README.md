# Unit Tests

## 2026-11-02 - Portable lab data isolation

- Added a subprocess regression that forbids reads of both customer/workbook
  datasets in explicit portable mode; catalog and scenario lists start empty.
  Normal-mode contract/catalog tests still preserve all 125 inputs.
- All 50 focused checks and scoped typecheck passed. Separate archive validation
  restored local dependencies in an extracted folder with spaces and rejected
  module imports outside it. UI/templates/restart/offline suite/full report,
  reset and compiled worker discovery passed without live inquiries.

## 2026-11-02 - Exact shared automation income selection

- Added native/custom fixtures covering every supported income source, primary
  and additional retirement selection, unknown sources and a missing retirement
  option. Missing options fail without silently choosing employment.
- All 49 focused checks and scoped typecheck passed. Two targeted live GRI
  browser tests also passed: five form-only calendar probes and one real
  retirement inquiry with exact submitted DOB/source/type/amount assertions.
- The original retirement spec is now included in the scoped typecheck.
  These tests distinguish Navigator's observed UI threshold from federal SSI
  benefits rules and do not certify benefit eligibility.

## 2026-11-02 - Retired SSI and daily calendar boundaries

- Added birthday/midnight/year/leap/under-18 age checks, dynamic SF-22 rollover,
  retired age/type validation, editor source/type synchronization and corrected
  SF-12 template/suite persisted-input coverage. All 125 catalog inputs runnable.
- All 48 focused checks, scoped typecheck and browser syntax passed.
  Independent GRI form-only probes verified the 62nd-birthday availability
  boundary and automatic Social Security mapping. No live inquiries submitted.

## 2026-11-02 - Generated SF-22 underage input

- Verify generated DOB is age 17, donor business inputs are preserved except
  DOB/residence-date consistency, original source stays null, and SF-22 is
  selectable/editable rather than unavailable.
- Offline single/suite executions preserve the generated DOB in snapshots.
  Updated original-group count to 22 runnable inputs; SF-12 stays disabled.
- All 45 focused checks and scoped typecheck passed. These checks do not
  certify live application age eligibility or rejection behavior.

## 2026-11-02 - Lab reset regressions

- Added full-workspace reset checks for JSON/tables/preview, source notices,
  tenant/defaults, suite selections/confirmations, offers/profiles/screenshots,
  errors and selected history. Retained saved suite/run/template access.
- Verify reset locks during running suites and delayed preview requests,
  performs no submissions/deletions and fits a 390px viewport.
- All 44 focused checks and scoped typecheck passed using offline fixtures.

## 2026-11-02 - Separate full-suite report regressions

- Added browser popup and progressive report tests: all scenarios remain
  visible with distinct offer/no-offer results, raw JSON and screenshot links.
  Preserve expanded JSON, show failed/skipped/missing-suite states, reload
  saved results and keep mobile layout/read-only GET behavior.
- All 43 focused checks and strict scoped typecheck passed using offline
  workers. Separate read-only verification reopened a prior real suite with
  no new inquiry submissions.

## 2026-11-02 - Two-way lab tenant synchronization

- Browser tests select all five tenants through each tenant control and verify
  matching selectors, intake URL, suite target label, reset confirmations and
  unchanged case selections. Suite execution checks the chosen tenant and
  locks both controls while active.
- All 41 focused checks and scoped strict typecheck passed without live
  inquiries.

## 2026-11-02 - Suite checkbox usability regression

- Replaced native multi-select selectors in lab browser tests with ordinary
  checkbox selections. Assert both independent scenarios remain checked and
  unavailable original inputs cannot be selected.
- All 40 focused checks and scoped typecheck passed, retaining group selection,
  clearing/authorization, batch progress/stop, history and mobile coverage.
  Worker responses remain explicitly offline fixtures.

## 2026-11-02 - Solution Finder lab suite regressions

- Request: run selected saved scenarios as suites without bypassing the
  existing fixed runner, one-browser limit or explicit QA authorization.
- Extended [solution-finder-lab.test.cjs](solution-finder-lab.test.cjs) with
  protected prevalidation, immutable sequential queues, single/suite exclusion,
  failure/skip behavior, stop-after-current, shutdown/non-resuming restart,
  combined result persistence and Chromium suite selection/evidence/mobile.
- Validation: `npm run test:solution-finder:lab` passed all 40 focused checks;
  strict scoped typecheck and root hygiene passed. Fixture inputs/child results
  are isolated and cleaned; retained screenshots/logs stay in test-results.
- Limits: Local worker responses are explicitly simulated. These checks do not
  establish a fresh live tenant suite outcome or certify pricing/underwriting.
  See the [lab suite workflow](../../scripts/solution-finder/lab/README.md#run-a-suite).

## 2026-10-30 - DMX browser regressions

- Request/decision: Protect DMX login and residence repairs with intercepted
  Chromium fixtures, without external requests, account creation or real MFA.
- Added [dmx-login.test.cjs](dmx-login.test.cjs), run with `npm run test:dmx:unit`.
  Covers delayed widgets, separate login screens, automatic redirects, simulated
  manual MFA completion/expiry, existing-loan navigation, three registration
  outcomes and both residence form contracts.
- Validation: 12/12 passed; strict focused engine TypeScript and root hygiene
  passed. See [DMX maintenance](../projects/DMX/README.md) for live follow-up.
- Limits: These fixtures do not establish live existing-account login/MFA or
  full-suite coverage. Existing unit tests are retained unchanged.
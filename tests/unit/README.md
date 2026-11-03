# Unit Tests

## 2026-11-02 - IR reference and action-gate regressions

- IR normalization/table tests moved from scripts to the existing
  `tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/` folder,
  alongside importer/runtime and lab browser tests. Utilities remain in scripts;
  completed live `screening.spec.ts` was not duplicated or rerun.
- Added all40 reference joins/source-versus-returned-score/status coverage and
  deterministic overlapping Load/selection regression. Scenario/load/launch/
  save controls disable while actions are pending, preventing stale UI updates.
- Final `npm run test:solution-finder:lab` passed93/93; scoped typecheck and JS
  syntax passed. Live comparison verified all40 source rows/120 product counts
  with zero POSTs/page errors; clean internal165 extraction passed integrity,
  isolation, persistence, offline suite and worker discovery.
- Prior products remain historical context, not expected new-run offers.
  This documentation sync uses supplied evidence; no suite rerun.

## 2026-11-02 - Named IR controls and editable PRIMARY subjects

- Expanded catalog tests from125 to165 choices, preserving the prior groups
  and adding all40 existing IR inputs by profile ID/name. Source equality,
  last-four-only data, separate suite choices and synthetic5 isolation checked.
- PRIMARY tests reproduce differing valid subject/residence input before
  validation, then assert mapped preview/tables/JSON, saved/load copies and
  mock-run snapshots. SECONDARY/INVESTMENT and originals remain unchanged.
- 65 combined checks and scoped typecheck passed. Clean165/internal and
  five/synthetic installs passed offline browser/persistence/discovery checks.
  Final live-lab preview also passed without creating application inquiries.
  A verification-locator scope error was corrected and its focused probe passed.
- No pricing/eligibility approval or new live screening was performed.

## 2026-11-02 - Portable IR and reporter unit coverage

- Added all102 report-row checks for comparison modes, exact IR IDs and pending
  pricing/eligibility approval notices, plus obsolete/reordered catalog rejection.
  Expanded malformed IR provenance checks before browser execution.
- Replaced historical-response-dependent table unit inputs with controlled
  normalized-profile fixtures. Historical/raw-workbook audits run when present
  and disclose absence; unit contracts do not invent missing evidence.
- 62 combined checks passed with zero failures/skips in this checkout; scoped
  typecheck passed. Missing-local-assets simulation also passed, explicitly
  skipping the unavailable source-only IR audit. No live inquiries or baseline
  approvals; the original regression suite and125 lab inventory are preserved.

## 2026-11-02 - IR replacement contracts and offline coverage

- Split 50 typed workbook baseline comparisons from 52 explicit no-baseline IR
  scenarios. Test unknown modes, missing/malformed baselines, stale expectations,
  option conflicts, full-flow wiring and pending-provenance guards.
- Verify exact all40 identity/last-four mapping against supplied source, preserved
  first50/original23 hashes, permitted financial/DOB/property differences,
  renamed workbook SHA, lossless export and 102 generated specs.
- Lab still has125 runnable inputs and now exposes IR context; offline no-offer
  report mocks use unchanged NSF-042, not discarded IR expectations.
- 18 new-unit tests and all53 lab tests passed; scoped typecheck/root guard and
  discovery passed. No new live submissions; 52 variants not yet live rerun.
  See [migration history](../../test-data/solution-finder/workbook-scenarios/README.md).

## 2026-11-02 - Explicit internal 125-case packaging

- Added checks that original-data packaging uses a boolean opt-in, includes
  exactly two catalog files, and rejects misspelled/extra CLI flags.
  Existing synthetic isolation and normal 125-case contracts remain intact.
- All 51 focused checks and scoped typecheck passed. Clean ZIP verification
  checked source-byte equality, all 125 case loads/previews/suite checkboxes and
  stale environment-mode override. Internal and default editions passed isolated
  install, template restart, offline suite/results/reset and compiled discovery.
  No live inquiries; macOS only.

## 2026-11-02 - Synthetic portable starter catalog

- Initial portable catalog was empty by design. The isolation subprocess now
  expects five labeled synthetic starters, validates all payloads/provenance and
  underage year rollover, and still forbids reading the two original datasets.
  Normal 125-case contracts are unchanged.
- All 50 focused checks and scoped typecheck passed. Independent archive
  verification loaded/previewed every starter and confirmed suite availability,
  persisted templates, offline suite/results/reset and worker discovery. No
  live inquiries; Windows/Linux not certified.

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
# Scripts

Use the [root guide](../README.md) for supported suite commands.

## Repository-root hygiene

- `npm run check:root` rejects unexpected root files and default output folders.
- `npm run test:root-hygiene` exercises the guard and shared runner offline.
- `run-playwright.js` checks before running and after each batch, including failures.
- `check-test-results-root.js` checks the repository root before its existing
  dated-results check; the latter can still reject legacy result layouts.
- Keep intentional new root source/config files in `check-repository-root.js`'s
  allowlist. Do not allowlist generated evidence; change its writer instead.
- Always create explicit destinations under
  `test-results/<YYYY-MM-DD>/<project>/<run>/` before writing evidence.

## Work history

### 2026-11-02 - Sanitized IR reference tooling

- Added `import:solution-finder:ir-reference` for the supplied IR chart;
  utilities stay under `scripts/solution-finder/`, all IR test scripts under
  the existing `tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/`.
  The normalization/table test moved there; live screening was not duplicated
  or rerun.
- Lab joins 40 sanitized references to existing165 inputs, separating source/
  returned scores and historical product statuses. Internal v1.4.1 packages
  four sanitized JSONs, never full SSNs/raw chart; synthetic5/legacy125 isolated.
- Fixed pending-action Load/selection race; 93/93 lab checks, scoped typecheck/
  JS syntax, zero-POST all40/120 live comparison and clean165 extraction/runtime
  verification passed. References are not current offers or baselines.
  See [IR utility history](solution-finder/README.md#2026-11-02---sanitized-chart-reference-import).

### 2026-11-02 - All Solution Finder scripts synchronized

- Request: update all related cases/scripts after the IR replacement.
- Corrected reporter-wide workbook wording; JSON/HTML rows now carry actual
  comparison mode/profile and pending-approval notices for the replacement52.
  Shared runtime schema rejects stale catalogs, wrong slot/source-row mapping,
  DOB provenance drift and invalid PRIMARY subject/residence mapping.
- Regenerated all102 specs through the reviewed workbook exporter/generator;
  preserved original suite/input scope. npm unit commands now include IR/table/
  reporter checks; added offline report/table/validation aliases.
- Validation: 62 combined checks, scoped typecheck, 102 workbook discovery and
  26 tests in25 original files passed. Missing-local-evidence simulation passed
  with an explicit restricted-workbook audit skip. v1.2.1 clean ZIP verification
  and idle-only local restart verified all125 inputs and52 IR mappings.
- No new inquiries, approved variant baselines or historical report rewrites.
  See [unit history](../tests/unit/README.md) and [lab history](solution-finder/lab/README.md).

### 2026-11-02 - Offline 52-slot IR source migration

- Added bounded XLSX migration/archive tooling; exporter reads the renamed
  source with lossless comparison-mode/provenance/notes metadata. Generator
  requires 50 strict baseline plus 52 explicit no-baseline cases; 102 specs stay.
- Lab additional-case notes expose profile/DOB assumption/pending baseline and
  PRIMARY adjustment context while preserving group labels/count125.
- 18 focused new-unit and 53 lab tests passed; scoped typecheck/root guard,
  source SHA/export round-trip and 102-case discovery passed. No new live
  submissions, package rebuild or server restart by this migration.
  See [input history](../test-data/solution-finder/workbook-scenarios/README.md);
  all 52 financial variants remain unrerun and unbaselined.

### 2026-11-02 - Actual 125-case internal lab edition

- User requested actual inputs, not synthetic substitutes. Added explicit
  `package:solution-finder:lab -- --include-scenarios`, copying only the two
  catalog datasets, with an internal archive name, mode marker and restricted
  notice/setup guide. No credentials or previous execution data included.
- 51 focused checks/typecheck passed. Clean internal ZIP loaded/previewed all
  125 cases with source-byte equality and suite availability. Both editions
  passed isolated install, persistence/offline suite/report and worker discovery;
  zero live inquiries, macOS only. See the
  [internal guide/history](solution-finder/lab/README.md#2026-11-02---internal-zip-with-the-actual-125-scenarios).

### 2026-11-02 - Starter-enabled standalone Solution Finder Lab

- Coworkers found no scenarios in the initial privacy-safe ZIP. Added five
  synthetic inputs, a portable-only catalog and visible Load/upgrade instructions.
  Original customer/workbook inputs remain excluded; normal mode is unchanged.
- Expanded packaging and clean-extraction verification for every starter.
  All 50 focused checks, scoped typecheck, isolated install/UI/template/offline
  suite/report and worker discovery passed. No live inquiries; macOS only.
  See the [replacement history/download](solution-finder/lab/README.md#2026-11-02---synthetic-starters-for-the-portable-copy).

### 2026-11-02 - Standalone Solution Finder Lab archive

- Added `package:solution-finder:lab` and `verify:solution-finder:lab`: explicit
  compiled-runtime allowlist, minimal pinned dependencies, portable launcher,
  privacy-safe empty catalog, setup guide, ZIP/hash and clean-install verification.
- Customer/workbook data, secrets, saved templates/results, account registries
  and unrelated framework tools are excluded. Existing repo mode is unchanged.
- Validation: 50 focused checks, scoped typecheck and syntax passed. Extracted
  install/UI/template/suite/report/worker discovery passed with module isolation
  on macOS and no live inquiry. Windows/Linux not certified.
  See the [standalone guide](solution-finder/lab/README.md#standalone-zip-for-coworkers).

### 2026-11-02 - Automation and benefits-label clarification

- The lab/workbook runner now reuses the strict original/shared income selector;
  no fallback to employment if retired income is unavailable.
- Clarified that the observed Navigator age-62 option is not a federal SSI
  eligibility determination. The UI label and API Social Security mapping
  require Product clarification, not an assumed age-65 application change.
- Validation: 49 focused checks and scoped typecheck passed; two targeted
  live GRI tests passed with five form-only probes and one inquiry, zero retries.
  See the [project history](../tests/projects/solution-finder/README.md#2026-11-02---original-retirement-automation-corrected-and-tested).

### 2026-11-02 - Retired income and daily age validation

- Removed the lab's employment-only limitation: validate retired SSI with Social
  Security and age 62+, update editor mapping and enable corrected SF-12.
  SF-22's generated underage DOB refreshes on load/queue across New Year.
- All 48 focused checks, scoped typecheck and syntax passed. Real GRI browser
  clock probes verified exact birthday/leap boundaries; interception confirmed
  automatic Social Security payload mapping without creating an inquiry.
  See the [retirement history](solution-finder/lab/README.md#2026-11-02---retired-ssi-and-calendar-accurate-age).

### 2026-11-02 - Authorized SF-22 underage input

- Filled missing SF-22 lab input from SF-1 with an age-17 DOB at startup and
  explicit generated-data notice; original workbook/export remains untouched.
  Enabled single/suite selection without changing underage application behavior.
- All 45 focused checks and scoped typecheck passed using offline fixtures.
  See the [underage-case history](solution-finder/lab/README.md#2026-11-02---authorized-underage-input-for-sf-22).

### 2026-11-02 - Lab workspace reset

- Added top-level reset for all inquiry/suite workspace inputs and displayed
  evidence, retaining saved history/templates and restoring initial defaults.
  Blocked during execution/pending requests; no delete/cancel/submit API calls.
- All 44 focused checks, scoped typecheck and script syntax passed with offline
  workers. Unsupported/missing original cases remain unchanged.
  See the [reset history](solution-finder/lab/README.md#2026-11-02---reset-for-a-new-run).

### 2026-11-02 - Full-suite results in a separate browser tab

- Added the read-only all-suite report assets and startup-snapshotted routes.
  The lab opens every scenario's offers/declines, IDs, JSON/UI/logs/screenshots
  in a separate auto-updating tab without replacing single-case inspection.
- All 43 focused checks and scoped typecheck passed. Reopened an existing
  completed four-case live suite after an idle restart: 4 cases, 12 product
  cards, 4 screenshot references, no new inquiries or page errors.
  See the [full-suite report guide](solution-finder/lab/README.md#full-results-in-a-separate-tab).

### 2026-11-02 - Shared suite/inquiry tenant selection

- Added Tenant above the suite Scenario group, synchronized both ways with
  the inquiry selector, intake link, target label and authorization reset.
  Both selectors lock during execution and preserve scenario selections.
- All 41 focused checks and scoped typecheck passed, including all five tenant
  choices in both directions and the tenant actually sent to the suite API.
  See the [lab workflow/history](solution-finder/lab/README.md).

### 2026-11-02 - Discoverable suite multi-selection

- Replaced the lab's native multi-select with explicit grouped checkboxes:
  no modifier keys required. Group/Clear controls, disabled unavailable cases,
  selected count and authorization invalidation retain their behavior.
- All 40 focused checks and scoped typecheck passed, including ordinary
  checkbox multi-selection, batch execution, stop and mobile layout.
  See the [lab history](solution-finder/lab/README.md#work-history).

### 2026-11-02 - Solution Finder lab suite queue

- Added prevalidated multi-scenario batches using the same fixed single-inquiry
  runner sequentially. Group selection and count/tenant confirmation precede
  any real launch; unsaved editor variations must be saved as templates first.
- Suite state/snapshots and combined results live under dated lab results;
  child JSON/UI/screenshots keep their existing per-run evidence. Added mutex,
  fail-fast skipped remainder, stop-after-current and restart-safe non-resume.
- All 40 focused checks, scoped typecheck and root hygiene passed, including
  browser suite selection/results/history/mobile and simulated failure/stop/
  restart lifecycles. No live inquiries were executed for these checks.
  See the [suite workflow](solution-finder/lab/README.md#run-a-suite).

### 2026-11-02 - Solution Finder lab startup blocked by Firebase diagnostic

- Report: the lab startup command stopped because `firebase-debug.log` was
  present at the repository root.
- Preserved that diagnostic under dated Solution Finder `lab-startup` results,
  without reading its contents or relaxing the repository-root guard.
- Validation: `npm run check:root` passed after relocation. The lab command
  can be retried; no new inquiries or Firebase operations were executed.
- The log was already tracked in the worktree, so relocating it appears as a
  root-file deletion in Git; the diagnostic contents remain in local results.

### 2026-11-04 - Solution Finder lab diagnostic relocation

- The lab startup preflight again found `firebase-debug.log` at the repository
  root. Preserved this ignored local diagnostic, without reading its contents,
  at `test-results/2026-11-04/solution-finder/lab-startup/firebase-debug.log`.
- Kept the root guard unchanged; generated logs must remain under
  `test-results/`, not the project source folder.
- Validation: `npm run check:root` passed and `npm run test:root-hygiene`
  passed all 7 tests. No Firebase operations or live inquiries were run.

### 2026-10-30 - Lab paste visibility and version-consistent assets

- Restored the always-visible JSON paste/editor area above request tables.
- Diagnosed undefined groups as a stale 102-case server API without group
  labels serving updated files. Added legacy group labels and explicit restart
  notice; new servers snapshot static assets alongside their runtime API.
- All 33 focused checks and scoped typecheck passed, including legacy bootstrap
  reproduction and paste/table synchronization before Load. No inquiries were
  launched for this UI compatibility fix. See the [lab history](solution-finder/lab/README.md#work-history).

### 2026-10-30 - Structured Solution Finder editing and run identification

- Added property/borrower/repeatable-income tables synchronized with advanced
  JSON, plus eight human-readable parsed-input lines using actual request values.
- Saved runs now show borrower, submitted email and typed returned identifiers
  with a basic profile; missing loan IDs never become relabeled application IDs.
- All 31 focused checks and scoped typecheck passed. Desktop/mobile verification
  reopened existing real history without new inquiries. See the
  [lab workflows/history](solution-finder/lab/README.md).

### 2026-10-30 - Solution Finder editable template copies

- Added **Save as new template** to the existing lab: edit loaded/pasted JSON,
  name the validated copy, and reload it from **Saved templates** after restart.
- The protected API stores input-only JSON atomically inside the existing
  Solution Finder fixture subtree. Original scenarios/previous copies stay
  unchanged; saves do not execute inquiries or establish expected offers.
- All 27 focused tests and scoped strict typecheck passed, including browser
  edit/save/reload, storage errors, validation, source immutability and no-launch
  checks. See the [lab workflow/history](solution-finder/lab/README.md).

### 2026-10-30 - Original Solution Finder lab catalog

- Added the original 23 workbook templates ahead of the existing 102, using
  `SF-N-Original` names and separate picker groups.
- The lab-local exporter reconstructs multiline/escaped source JSON and retains
  the original request alongside an explicit browser-form projection. Unsupported
  retired-income and missing source input remain visible, not substituted.
- All 24 focused tests and scoped typecheck passed; source workbook hashes,
  original business inputs and the existing 102 templates are preserved.
- Independent QA-agent lab-UI samples passed on GRI (Original1, 3 eligible
  offers) and Owning (Original18, 0 eligible with provider declines). HTTP200,
  zero UI/API differences, 390px layout, persisted history, and all tenant links
  were verified. See the [lab history/report](solution-finder/lab/README.md#work-history).

### 2026-10-30 - Solution Finder JSON lab

- Added the [local lab](solution-finder/lab/README.md), following the DMX Lab's
  local setup/run/results workflow without changing DMX.
- `npm run solution-finder:lab` starts the loopback-only server; its fixed
  runner reuses existing Solution Finder UI steps and the five-tenant registry.
  Input snapshots and all evidence/history stay under dated Solution Finder
  results, not test-data. No approved response baseline is inferred from a quote.
- Live GRI and Owning submissions, parsed results, real API/UI checks,
  screenshots, mobile layout and history reload were verified. Other tenant
  selectors were checked locally; their live loan creation was not claimed.
  All 23 focused tests, scoped typecheck, documented CLI startup and root hygiene
  passed. The lab rejects concurrent runs and refuses to overwrite a still-live
  owning process's run state.

### 2026-10-30 - Solution Finder workbook path consolidation

- Reused the existing `solution-finder` project for the 102-case workbook group.
  Export/spec generation now target `solution-finder/workbook-scenarios/` within
  test data and tests; the environment helper writes beneath the same group in
  dated Solution Finder results, with tenant/run isolation preserved.
- Existing `:solution-finder:new` package commands remain valid. No additional
  project folder is created for scenario sets, workbooks or environments.
- Validation: 16 unit/environment tests and scoped typecheck passed; exporter
  and generator preserved fixture/spec contents. Discovery kept 102 workbook
  cases separate from the original 25, including focused first/last selection.
  Historical report links were locally browser-verified without new inquiries.

### 2026-10-30 - Root artifact cleanup and prevention

- Request: remove generated testing files from the repository root and prevent
  recurrence without removing configuration, test inputs or supported runners.
- Cause: ad hoc diagnostics used cwd-relative/default output locations. The old
  results checker inspected only inside `test-results/`; the report organizer
  handled named execution reports and reporter defaults, not arbitrary JSON or
  Firebase logs.
- Change: added a root allowlist guard and offline regression tests; wired the
  shared runner, npm lifecycle and existing results checker to it. CI browser
  jobs also check after failures.
- Validation (completed evidence supplied for documentation sync):
  `npm run test:root-hygiene` passed all 7 Node tests: root configs preserved;
  arbitrary diagnostic extensions rejected; default MCP/reporter directories
  rejected; sorted names without reading contents; wrapper guard before/after
  each batch; guard after failure preserving exit status; halt on root pollution.
  `npm run check:root` passed. `node --check` passed for
  `check-repository-root.js`, `check-test-results-root.js` and
  `run-playwright.js`. All three modified browser CI workflow YAML files parsed
  and their `if: always()` guard steps were verified. Newly added README relative
  links in `scripts/`, `.github/workflows/`, `ai/jobs/` and `memory/` resolved;
  focused `git diff --check` passed. No live browsers/devices, authentication
  sign-ins or GitHub jobs ran; this sync did not rerun validation.
- Limit: arbitrary shell tools, direct Playwright invocations and externally
  managed MCP servers must still be given explicit output destinations. The
  external browser MCP launch configuration must set `--output-dir` under
  `test-results/` and be restarted externally. The guard detects violations;
  it does not intercept filesystem writes. No active repository source writer
  was found; the exact one-off JSON/log creation command was not recoverable
  from available source/session history. Playwright reporter destinations
  were already correct. See the [root cleanup history](../README.md#2026-10-30---root-cleanup-and-durable-history)
  for retained inputs and relocated diagnostics.

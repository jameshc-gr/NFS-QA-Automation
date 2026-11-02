# Solution Finder

- Original general regression: 25 specs in this folder, kept separate.
- [Workbook scenarios](workbook-scenarios/): 102 independently selectable cases
  using the dedicated workbook runner and reusable scenario inputs.
- [Lab runner](lab/inquiry.spec.ts): fixed, one-inquiry UI/API runner launched
  only by the [Solution Finder Lab](../../../scripts/solution-finder/lab/README.md).

Use the [root guide](../../../README.md#solution-finder-general-regression)
for the separate run commands. The original config excludes workbook and lab
groups; the workbook config matches only its 102 cases. Never create a separate
project folder for another scenario set, workbook or tenant.

## Work history

### 2026-11-02 - Standalone compiled lab runner

- The fixed worker/config support compiled JS in the portable distribution;
  repository mode continues using TS and its unchanged 125-case lab catalog.
- Portable mode deliberately skips customer/workbook dataset loading while
  retaining schemas and the shared real-browser runner. No baseline is
  fabricated; recipients supply approved inputs and save their own templates.
- Validation: 50 focused checks, scoped typecheck, clean dependency restore,
  independent module resolution, offline suite/report and discovery of the
  single compiled worker passed. No live inquiries; macOS only.
  See [portable setup](../../../scripts/solution-finder/lab/portable/README.md).

### 2026-11-02 - Original retirement automation corrected and tested

- Request: ensure automation, not only the lab editor, reflects retirement
  handling and validate narrowly.
- Found the original retired-income spec's custom dropdown still selected
  full-time employment and its shared form helper could fall back to the
  first available option. Added one strict
  [income selector](helpers/README.md) for original/shared/workbook/lab paths,
  including additional income. Native and custom widgets select only the
  requested source; a missing retirement option fails before submission.
- The original retirement spec now asserts actual submitted DOB and complete
  income source/type/amount, retains request/response evidence and screenshot,
  and checks offer identities without requiring product ordering.
- Added a reusable form-only browser test for day-before/on/after the 62nd
  birthday and non-leap February/March dates for a leap-day birth.
- Validation: 49 focused offline checks, scoped typecheck and two targeted
  live GRI browser tests passed (five no-submit probes, one real inquiry,
  zero retries). Report:
  [retirement automation](../../../test-results/2026-11-02/solution-finder/reports/test-report-retirement-automation-20261102T1900/index.html).
  Full 25/102 suites and other tenants were not executed.
- Important: these tests certify observed Navigator UI mapping, not federal
  SSI eligibility. Social Security retirement at 62 and age-based SSI at 65
  are distinct programs; the application's "Retired SSI" label needs Product
  clarification, not an unapproved automation cutoff change.

### 2026-11-02 - Retired SSI runner support and age correctness

- Extended shared input contract and primary/additional income label mapping
  for Retired SSI. Submitted-input checks now compare income type too, treating
  omitted/null employment types equivalently but preserving Social Security.
- Lab SF-12 uses an explicitly corrected retirement DOB; SF-22 regenerates
  its age-17 input on load/queue. Original source and 25/102 test sets unchanged.
- All 48 focused checks and scoped typecheck passed. GRI form/intercept probes
  verified actual income mapping and exact 62nd-birthday/leap behavior.
  No new live inquiries or full regression reruns were performed.

### 2026-11-02 - All-case suite report coverage

- Added separate-tab checks for all case/offer/screenshot results, live
  progression, no-offer decisions, failure/skipped states, open JSON sections,
  missing-suite errors, reload, mobile and GET-only/no-new-inquiry behavior.
- All 43 focused checks and scoped typecheck passed. The existing completed
  four-case live suite was reopened read-only and rendered all cases/products/
  screenshots without rerunning the browser inquiry workflow.

### 2026-11-02 - Synchronized suite tenant coverage

- Added all-five-tenant browser checks in both suite-to-inquiry and
  inquiry-to-suite directions, intake link/target labels, confirmation resets,
  retained scenario selections and locked controls while running.
- Suite launch verifies the tenant chosen through the suite selector.
  All 41 focused checks and scoped typecheck passed with offline workers only.

### 2026-11-02 - Checkbox suite selection regression

- Suite browser checks now select independent checkbox controls with ordinary
  clicks and verify both selections persist, without Ctrl/Cmd multi-select.
- Unsupported originals remain disabled. Group/Clear, launch/stop, history and
  mobile checks pass; all 40 focused tests and scoped typecheck remain green.
  No live tenant suite was executed.

### 2026-11-02 - Lab suite execution coverage

- Added suite prevalidation, authorization, duplicate/unknown/unavailable input
  rejection, immutable saved-input queues, one-worker sequencing, single/suite
  mutual exclusion, persisted aggregate evidence and fail/skip semantics.
- Browser checks cover runnable group selection, count/tenant authorization,
  combined results, per-case screenshot/JSON/details, saved-history reload,
  stop-after-current and 390px layout. Lifecycle tests cover launch errors,
  shutdown and interrupted-owner restart without resubmission.
- All 40 focused tests and strict scoped typecheck passed using clearly
  separated offline workers; no live suite execution is claimed. Original and
  workbook specs remain unchanged; lab suites compare actual UI/API values.
  See the [lab suite workflow](../../../scripts/solution-finder/lab/README.md#run-a-suite).

### 2026-10-30 - Legacy dropdown and JSON-paste regression checks

- Added reproduction of old bootstrap responses without group labels; verify
  no undefined group, a visible restart notice and usable JSON paste area before
  Load. Malformed IDs/names show explicit errors rather than undefined options.
- The paste area is always visible above synchronized tables. All 33 focused
  checks and scoped typecheck passed without live inquiry submissions.

### 2026-10-30 - Structured editor and saved-profile checks

- Added exact eight-row readable-preview and table/JSON/save/reload tests:
  name ordering, SSN strings, income totals, primary-address copy, explicit
  unsupported-data errors, stale validation responses and mobile layout.
- History tests verify actual submitted email, true returned loan IDs and
  correctly labeled application/inquiry fallbacks, including server restart.
- All 31 focused checks and scoped strict typecheck passed. Read-only visual
  verification reopened a prior real run without executing another inquiry.
  Regression/workbook specs and decisioning comparisons were unchanged.

### 2026-10-30 - Lab scenario copy/save workflow

- Added browser/API coverage for editing loaded scenarios and saving named
  reusable copies without changing the existing 125 inputs or launching an
  inquiry. Saved templates are inputs, not newly generated regression specs.
- All 27 focused tests and scoped strict typecheck passed, including Chromium
  save/reload/fork, server-restart persistence, 390px layout, explicit validation
  errors and isolated temporary template storage. Existing runner behavior is
  unchanged. See the [lab save workflow](../../../scripts/solution-finder/lab/README.md#edit-and-save-a-reusable-scenario).

### 2026-10-30 - Original workbook templates exposed in the lab

- The lab picker now lists 23 original workbook templates as `SF-N-Original`,
  followed by the unchanged 102 additional inputs. These are input templates,
  not 23 newly generated regression specs.
- Original source JSON is retained separately from its explicit form mapping.
  Unsupported retired income and the missing underage-case request are surfaced
  for review instead of substituted.
- All 24 focused tests and scoped strict typecheck passed. Original regression
  discovery remains 25 and workbook discovery 102.
- Team QA Engineer completed exactly two real lab-UI samples: Original1/GRI
  (3 eligible offers) and Original18/Owning (0 eligible, provider declines).
  Both returned HTTP200 with no UI/API differences. Screenshot/JSON evidence,
  mobile layout and persistent history passed; no full regression rerun or
  completed-loan coverage is implied. See the
  [QA report](../../../test-results/2026-10-30/solution-finder/lab-qa/originals-2026-10-31T02-18-23-850Z-29252/index.html).

### 2026-10-30 - Shared flow reused for the local JSON lab

- Request: paste JSON and inspect real multi-tenant API/UI results and screenshots
  in a DMX-style lab.
- Exported the existing workbook UI flow with an explicit lab mode: supplied
  inputs, optional preserved email, checkpoint progress, actual UI/API checks,
  and evidence capture without asserting provisional workbook expectations.
- Added one fixed lab spec/config and excluded it from original regression
  discovery. Default workbook behavior remains strict and separately selectable.
- Validation: original discovery remains 25 and workbook discovery 102.
  All 23 focused tests and scoped typecheck passed; actual GRI and Owning lab submissions
  returned HTTP 200 with no UI/API differences. No full-loan completion or
  other-tenant live approval coverage is claimed.

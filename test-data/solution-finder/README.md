# Solution Finder Inputs

Original workbook inputs remain in [workbook-scenarios/](workbook-scenarios/).
The default synthetic standalone edition uses [portable-scenarios.json](portable-scenarios.json), a
synthetic base request plus five variations. It contains no customer records,
captured responses, inquiry IDs or approved eligibility/pricing expectations.
Replace dummy profile/address data with approved QA inputs before live execution.
See the [lab guide](../../scripts/solution-finder/lab/README.md).
The explicit **internal-125** edition copies the two original/NSF JSON datasets
unchanged, not this synthetic catalog. They contain inquiry data and must only
be shared with authorized internal QA recipients through approved channels.

## Work history

### 2026-11-02 - Bounded 52-slot IR identity replacement

- Kept original23 and first50 unchanged; all 102 IDs/financial variations remain.
  Exactly NSF-051–102 now use all40 IR profiles with explicit pending-baseline
  provenance, last-four-only data and actual UI/API comparison.
- Renamed the active workbook, replaced its persona sheet with IR/mapping/mode
  metadata, and archived then removed old active workbook/registry. A narrow
  ignore exception preserves the new required source workbook; unrelated inputs
  and historical reports are untouched.
- 18 new-unit/53 lab tests, scoped typecheck/root guard and 102-spec discovery
  passed. No live rerun or financial rebaseline; synthetic DOB/contact and two
  PRIMARY subject adjustments are disclosed in the
  [detailed input history](workbook-scenarios/README.md).

### 2026-11-02 - Internal standalone copy of actual catalog inputs

- User required the actual 125-case catalog. Opt-in packaging now copies the
  existing original 23 and additional 102 source files unchanged, preserving
  existing lab SF-12/SF-22 overrides without modifying either dataset.
- Verification confirmed byte-for-byte source equality and loaded/previewed
  all 125 cases with enabled suite checkboxes. All 51 checks/typecheck and
  isolated install/persistence/offline suite/report passed in both editions.
- No live inquiries or new response baselines; macOS only. Distribution
  contains inquiry data and remains restricted to authorized internal QA use.

### 2026-11-02 - Synthetic portable starter inputs

- Request: recipients could not find existing scenarios in the first standalone
  ZIP because all original borrower/workbook data had been excluded.
- Added synthetic primary/secondary/investment, retirement, low-income and
  underage starter variations. Only portable mode uses them; the 125-case
  repository catalog and source inputs are unchanged. Underage age stays 17
  through date-aware construction; no source customer data is copied.
- Validation: 50 focused checks and scoped typecheck passed; extracted ZIP
  loaded/previewed all five starters and enabled their suite checkboxes.
  Template persistence/offline suite/report/worker discovery also passed.
  No live inquiry or actual eligibility baseline; macOS only.

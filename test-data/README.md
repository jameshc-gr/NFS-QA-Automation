# Test Data Directory

## 2026-11-02 - Restricted internal 125-case lab distribution

- User explicitly requested actual scenarios rather than synthetic substitutes.
  The opt-in internal ZIP copies existing original/NSF source datasets unchanged;
  default packaging still excludes them. No credentials or prior run evidence.
- Byte equality and all 125 loads/previews/suite selections were verified in a
  clean extraction. All 51 focused checks/typecheck and both-edition isolated
  install/offline suite/report passed. No live inquiries; macOS only.
- Inquiry data is restricted to authorized internal QA recipients and approved
  sharing channels. See [input history](solution-finder/README.md).

## 2026-11-02 - Synthetic standalone lab starters

- The original standalone lab excluded all customer/workbook inputs, leaving
  recipients without built-ins. Added five synthetic definitions under the
  existing Solution Finder input folder; private original datasets stay excluded.
- Portable mode validates/loads these starters, with dynamic underage DOB.
  Normal 125-case inputs remain unchanged. No responses or run evidence stored here.
- All 50 focused checks and scoped typecheck passed; every starter loaded/previewed
  in a clean extracted ZIP, with offline suite/report and no live inquiries.
  See [input history](solution-finder/README.md). macOS only.

## 2026-11-02 - Local-only generated evidence

- Request: prevent shared-checkout conflicts from generated test/script output.
- Previously committed browser sessions and legacy screenshot/hierarchy captures
  are removed from the Git index only; existing local files are not deleted.
  Future evidence still belongs under `../test-results/`, not this directory.
- The shared ignore rules target legacy capture names, not all images, JSON,
  CSV or YAML. Reviewed localization CSV references, snapshot integrity data,
  fixtures, account registries/counters and required build inputs remain tracked.
- Saved browser sessions are machine-local; recreate them with the relevant
  setup script. Back up wanted tracked sessions/captures before the first pull
  containing their removal. Older Git history is not rewritten.
- Validation: the ignore matrix kept 12 source/input paths visible and ignored
  22 generated paths; all 99 selected generated files left the index, while
  reusable account registries/counters stayed tracked and local sessions stayed
  on disk. Root hygiene and scoped whitespace checks passed.

## Retention rule

Store only inputs and supporting resources necessary to execute or reproduce
tests here: fixtures, scenarios, expected-data contracts, configuration, account
registries/counters, and required application builds. Do not store screenshots,
execution reports, diagnostic captures, or generated run evidence here; use
`../test-results/` instead. Required input assets and resources inside application
bundles (for example app icons) must be preserved.

## October 2026 continuation guide

Updated 2026-10-27. Start here for the reusable test inputs and next-task workflow.
This guide consolidates October additions and updates; it deliberately excludes
execution results, screenshots, pass/fail histories, and defect verdicts.
CSV/YAML/XLSX inputs remain in place because runners and editors consume them.
Older project notes remain reference material, not separate required handoffs.

### Input inventory

| Area | Source of truth | What to reuse |
| --- | --- | --- |
| Rate Wealth state comparisons, added October 2 | [rw-payoffvsidr-test-cases.csv](rate-wealth/rw-payoffvsidr-test-cases.csv) | 12 planned cases: WA/AK/HI baselines, contiguous-state equivalence, joint filing, and payment-floor scenarios. Columns include AGI, dependents, filing status, paired states/FPL deductions, expected payments/tax bombs, and variances. Expected values are historical test assumptions, not measured outcomes or a certified current financial model. |
| Rate Wealth broad regression, added October 23 | [rate-wealth-regression-gherkin.csv](rate-wealth/rate-wealth-regression-gherkin.csv) | 48 Given/When/Then scenarios with detailed steps and expected behavior. Ignore the historical status/notes column when planning a fresh run. |
| Rate Wealth focused regression, added October 26 | [rate-wealth-regression-test-plan-2026-10-26.csv](rate-wealth/rate-wealth-regression-test-plan-2026-10-26.csv) | Seven cases covering registration copy, signup activation, plan preview/chart/edit/delete isolation, and Plaid linking. Reuse preconditions, steps, expected behavior, spec mapping, and command columns; do not carry forward observed results/status. Activation is manual; the signup smoke spec is not activation coverage. |
| Rate Wealth automation map, updated October | [rate-wealth-automation-catalog.csv](rate-wealth/rate-wealth-automation-catalog.csv) and [rate-wealth.yml](rate-wealth/rate-wealth.yml) | 172 catalog entries mapping IDs to specs/modes; shared profile inputs. Catalog size is not a count of verified tests or coverage. |
| Solution Finder address regression, added October 9 | [inquiry specs](../tests/projects/solution-finder/) and [dashboard-auth.yml](one-loan-rtl/dashboard-auth.yml) | Separate cases for Miami address/unit, apartment number, leading-zero ZIP, no unit, and restructured inquiry. The Playwright config uses the shared One Loan dashboard config as a base-URL fallback. Keep per-spec inputs and existing account recording; no new consolidated runtime data format is introduced. |
| Solution Finder additional inquiry fixtures | [102-case workbook](solution-finder/HELOAN_102_scenarios_with_Fannie_Mae_personas.xlsx), [Fannie Mae persona inputs](solution-finder/fannie-mae-personas.json), and [runnable scenario contracts](solution-finder/workbook-scenarios/scenarios.json) | One scenario per row with exactly four columns: Scenario, Inquiry Request, Inquiry Response, UI offers. The separate Personas sheet keeps the requested eight columns; cell notes hold source characteristics, public address sources, QA-assigned fields and provider limitations. SSN last four digits remain text, including leading zeros. The separately selectable Solution Finder workbook group uses exported JSON; these provisional expectations are not independent eligibility certification. |
| One Loan workbook, added October 27 | [CFEN_Encompass_fields.xlsx](one-loan-rtl/CFEN_Encompass_fields.xlsx) | Existing `Sheet1` template: loan numbers in column A, field IDs in row 2 from column C onward, descriptions in row 3, loan data starting at row 4. Preserve duplicate field-ID columns, descriptions, formatting, and other sheets. Do not copy borrower values into this guide. |
| One Loan RTL fixtures | [one-loan-rtl/](one-loan-rtl/) | Existing per-loan `*-rtl-patches.yml` fixtures and dashboard auth configuration remain inputs for extraction. Keep these separate from generated result files. |
| Mobile build selection, updated October | [Android config](mobile-app/gri/android/config.yml) and [iOS config](mobile-app/gri/ios/config.yml) | Select named builds explicitly. Android includes `qa`, `qa-local`, `stage`, `dev`, `prod`; iOS includes `qa-simulator`, `qa-31.3-simulator`, `stage-simulator`, `dev-simulator`, `prod-simulator`, and IPA/TestFlight profiles. Do not infer the installed version from a profile name; inspect its current config and versioned `build-info.json`. |
| DMX continuing regression | [dmx-scenarios.yml](DMX/dmx-scenarios.yml), [dmx.yml](DMX/dmx.yml), [dmx-test-cases.csv](DMX/dmx-test-cases.csv) | 14 complete scenarios plus five incomplete/resume definitions; 21 generated catalog rows including relogin and entry checks. The local dashboard and generator remain regression tools. |
| Student IDR and refinance continuing regression | [student-IDR.yml](student-IDR/student-IDR.yml), [student-loan-refi.yml](student-loan-refi/student-loan-refi.yml) | Keep suffix-based profiles and the existing shared calculator/flow helpers. The IDR calculation runner references `student-IDR/test_cases_automation.csv`, which is absent in this checkout; restore an approved input before using that runner. |

### Rate Wealth: next task

1. Pick a case ID from the focused seven-case plan or the 48-case Gherkin input.
2. Read the mapped spec in [tests/projects/rate-wealth](../tests/projects/rate-wealth/).
   Shared setup remains in [test-setup.ts](../tests/projects/rate-wealth/test-setup.ts).
   Use the configured dedicated planner account for mutating plan tests, not an
   arbitrary existing account. Supply credentials through approved local
   configuration/environment variables; this guide is not a credential store.
3. Use a single worker when cases share an account. Plan editing uses a Buying a
   Home goal with cost `450000` and down payment `90000`; assert edited values
   after reopening and assert that deletion does not leak goals into a new plan.
   Plaid uses the approved sandbox flow, not real-bank credentials.
4. Discover first, then execute only the selected case:

   ```bash
   TEST_PROJECT=rate-wealth npx playwright test \
     tests/projects/rate-wealth/rw-05-plan-builder.spec.ts \
     --project=rate-wealth --list --reporter=list

   TEST_PROJECT=rate-wealth npx playwright test \
     tests/projects/rate-wealth/rw-05-plan-builder.spec.ts \
     --project=rate-wealth --workers=1 --grep RW-PLAN-021
   ```

The old interactive/state-variance capture specs were removed: they printed
expectations and screenshots rather than asserting calculator values. The
12-case CSV remains the implementation backlog. For new assertions, confirm the
app's supported plan/year, household/FPL rules, amortization assumptions, and
rounding first. Historical guidance used payment tolerance `+/- $2` and tax-bomb
tolerance `+/- $500`; these are planning inputs, not blanket acceptance of a
current calculation. Do not report those planned cases as automated coverage.

### Solution Finder and DMX: next task

Use the existing [Solution Finder specs](../tests/projects/solution-finder/)
as the original general regression set, following the
[canonical run commands](../README.md#solution-finder-general-regression).
Keep them separate from the explicitly requested
[Solution Finder workbook group](../tests/projects/solution-finder/workbook-scenarios/), whose
[commands and tenant choices](../README.md#new-solution-finder-102-workbook-scenarios)
use the [102 exported contracts](solution-finder/workbook-scenarios/scenarios.json) and
[five tenant URLs](solution-finder/workbook-scenarios/environments.json).
Reuse existing project folders; create a new project folder only for an
explicitly identified new project, not for another workbook or environment.
Do not regenerate approved expectations from failed execution output.
Workbook APR checks ignore hundredths/thousandths without rounding, while
UI/API APR equality remains exact. Ignored APR values are logged in QA comments;
all other pricing, eligibility and product-identity checks remain unchanged.

For ad hoc pasted JSON, use the
[Solution Finder Lab](../scripts/solution-finder/lab/README.md)
(`npm run solution-finder:lab`). It can load these cases as input templates
without treating their provisional responses as approved baselines. Its actual
submitted inputs, responses, screenshots and saved run history belong only in
dated `test-results/.../solution-finder/lab/`, not in test-data.
The lab also loads the separate
[original 23-case snapshot](solution-finder/workbook-scenarios/original-scenarios.json)
as `SF-1-Original` through `SF-23-Original`, ahead of the additional 102.
Original source requests are retained; unsupported retired income and the
original underage case's `N/A` request are flagged explicitly.
Use the lab's property/borrower/income tables or synchronized advanced JSON to
edit inputs. Validate the readable address/currency/SSN-last-four preview.
Edited lab requests can be saved as named reusable copies via **Save as new
template**. Their input-only JSON is stored locally in
`solution-finder/workbook-scenarios/lab-templates/`, gitignored for borrower-data
hygiene. Built-in inputs and previously saved copies are never overwritten;
execution evidence and response expectations are not stored with these copies.

Fannie Mae identities are fictitious DU test profiles and are each submitted as
a single borrower, including people listed as co-borrowers in the source.
Their source scores, freezes and credit events must not be presented as live
Navigator results unless the providers actually return them. The source does
not supply income, DOB or addresses; these are explicitly QA-assigned.
DTI probes reference FAL-3356 and occupancy/Max LTV probes reference FAL-3147.
Rounded summary DTI is not exact ECS debt, and the UI's Max CLTV label is not
proof of a universal provider cutoff. Ignore offer ordering; verify product
identity and displayed data. Explicit no-offer placeholder cards are not
additional eligible offers. Screenshot links in cell notes/contents point
outside test-data to test-results; no screenshots are embedded in the workbook.

```bash
# Discovery only: no loan creation or sign-in.
TEST_PROJECT=solution-finder npx playwright test \
  tests/projects/solution-finder --project=solution-finder --list --reporter=list

# After changing scenario YAML, regenerate the DMX catalog and per-case specs.
npm run dmx:test-cases

# Run one approved DEV case, not the whole loan-creation suite.
TEST_PROJECT=DMX npx playwright test tests/projects/DMX/PUR-01 \
  --project=chromium --workers=1
```

DMX generated specs call shared flows; edit scenario YAML/shared handlers rather
than hand-editing generated specs. Keep the append-only account registries and
email counters: they prevent accidental reuse and are not disposable results.
Tenant entry checks are read-only and do not establish loan creation. Production
loan creation remains outside the approved DEV regression path.

### One Loan: next task

Use the retained [exporter](../scripts/export-one-loan-excel.cjs) and
[workbook writer](../scripts/update-one-loan-workbook.py) to refresh selected
loans in the existing template. The writer requires Python `openpyxl`.

```bash
# Offline verification against temporary synthetic workbooks.
PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_one_loan_workbook.py

# Requires authorized dashboard access and manual sign-in/MFA when prompted.
npm run export:one-loan-excel -- APPROVED_DEV_LOAN_NUMBER
```

The exporter defaults to the workbook above; `ONE_LOAN_EXCEL_PATH` selects an
existing alternate template, `ONE_LOAN_DASHBOARD_BASE_URL` selects the dashboard,
and `ONE_LOAN_ENV` selects its company. Verify loan identity before writing.
Missing fields must be reported, not invented; retain zeroes and leading-zero
text and do not treat formula-like data as executable spreadsheet formulas.

### Mobile: next task

Keep the existing create-user, login/logout, forgot-password, launch, unit, and
TikTok reference-comparison suites. One-off localization/media crawlers, capture
specs, diagnostic probes, and their report/backlog helpers were retired in the
October cleanup; old continuation commands for them are no longer supported.
October reference snapshots remain untouched as historical evidence, not inputs
that prove a future build's behavior.

- Use the native [WDIO config](../mobile/wdio.conf.ts), not browser Playwright,
  for app regression. Pin `MOBILE_ANDROID_DEVICE_UDID` or
  `MOBILE_IOS_DEVICE_UDID` to an authorized, already available device.
- Inventory devices and workers before/after a run; never stop another tester's
  device. The existing iOS preflight requires an already booted selected UDID
  and caps booted simulators at 10.
- Both platforms share Android-side auth configuration. Preserve environment
  routing: QA uses Outlook; PROD create-account email uses Guerrilla Mail.
  Complete manual session setup/MFA using the existing helpers.
- Assert page readiness and verbiage at every transition, stop on a failed
  checkpoint, and diagnose before retrying. Do not replace these with sleeps.
- `docs/mobile-testing-rules.md` is referenced by repo instructions but missing
  from this checkout. Do not invent or relax its rules; resolve that missing
  source before adding/changing mobile rules or workflows.
- The package commands `build:mobile:android` and `build:mobile:ios` reference
  missing `fetch-android-app.ts` and `build-ios-app.ts` helpers in this checkout.
  Do not assume those commands work; use an approved existing local build or the
  retained download helpers after reviewing their prerequisites.

```bash
npm run test:mobile:unit
npm run typecheck:mobile

# Only after selecting an authorized QA build and an online test-owned device:
MOBILE_ANDROID_DEVICE_UDID=YOUR_DEVICE_UDID \
  npm run test:mobile:android:login-logout:qa
```

### Cleanup and result policy

- On 2026-10-27, only generated result files dated before October 1 were selected
  for removal. October/newer results and uncertain-age items are preserved.
  Dated result paths take priority over file modification times; undated files
  use their modification time. Result contents are not used in this handoff.
- All generated result/report directories remain Git-ignored, including nested
  `test-results`, `allure-results`, `allure-report`, `playwright-report`, and
  `blob-report` directories. Do not add blanket ignores for CSV/YAML/XLSX inputs.
- One-off exploration, diagnostics, hard-coded issue migrations, static analysis
  report generators, and obsolete data/report assembly scripts were removed.
  Regression runners, reporters, authentication/build setup, account recording,
  and live input-generation/export helpers remain.
- Do not delete account registries, email counters, app binaries, build metadata,
  saved sessions, or October reference snapshots as though they were old results.
  Never copy cookies, tokens, OTPs, passwords, or borrower values into this guide.

---

This directory contains test configuration files, test data matrices, and build metadata. **Large binary files (APK, APP, IPA) are NOT stored in this repository.**

## Why Binary Builds Are Excluded

Mobile app builds (Android `.apk`, iOS `.app`, `.ipa` files) are excluded from version control because:
- They are large (50MB - 500MB+), slowing down clones and causing storage bloat
- They are ephemeral artifacts generated from source code
- Each developer/CI run may need different builds for different environments
- Builds should be downloaded on-demand when needed for testing

## Downloading Builds

### Android Builds

Android APK files are obtained from Firebase App Distribution. Use the build script to automatically download builds:

```bash
# Download the default Android build (usually QA)
npm run build:mobile:android

# Download a specific environment
npm run build:mobile:android -- --build qa
npm run build:mobile:android -- --build prod

# List available builds
npm run build:mobile:android -- --list
```

**Required Setup:**
- Firebase CLI configured locally or CI environment variables set
- Google account with access to Firebase App Distribution projects
- `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to service account JSON (for CI)

**Location after download:** `test-data/mobile-app/gri/android/<version>/<environment>/app.apk`

**Manual download (if script fails):**
1. Navigate to [Firebase Console](https://console.firebase.google.com)
2. Select the appropriate Firebase project for your environment
3. Go to **App Distribution** → **Release notes**
4. Download the APK for the desired environment
5. Place it in the appropriate `test-data/mobile-app/gri/android/<version>/<environment>/` folder
6. Run the script with `--verify` to generate build metadata

### iOS Builds

iOS builds are downloaded from GitHub releases. Use the release downloader script:

```bash
# Download the latest QA build
npm run ios:download-build -- --download v30.3-qa --env qa

# Download stage build
npm run ios:download-build -- --download v30.3-stage --env stage

# Download prod build
npm run ios:download-build -- --download v30.3 --env prod

# List available releases
npm run ios:download-build -- --list
```

**Required Setup:**
- GitHub CLI configured or `GITHUB_TOKEN` environment variable set
- Access to the private or public SuperApp-iOS repository

**Location after download:** `test-data/mobile-app/gri/ios/<version>/<environment>/GRI*.app` or `.ipa`

**Manual download (if script fails):**
1. Navigate to [SuperApp-iOS Releases](https://github.com/Guaranteed-Rate/SuperApp-iOS/releases)
2. Find the release matching your version (e.g., `v30.3-qa`)
3. Download the `.app` or `.ipa` artifact from the release assets
4. Create the folder structure: `test-data/mobile-app/gri/ios/<version>/<environment>/`
5. Extract the downloaded archive into that folder
6. The build metadata (build-info.json) will be auto-generated on test run

### Local/Pre-built Builds

If you have builds available locally (e.g., from Xcode or previous downloads):

**Android:**
```bash
npm run build:mobile:android -- --build qa-local
```
This uses the pre-existing APK at `test-data/mobile-app/gri/android/app.apk`

**iOS:**
- Configure the path in `test-data/mobile-app/gri/ios/config.yml` under `ios.builds.<name>.ipaPath`
- Use: `npm run build:mobile:ios -- <build-name>`

## Build Metadata

When builds are downloaded or published, metadata files are created for reproducibility:

```
test-data/mobile-app/gri/android/<version>/<environment>/build-info.json
test-data/mobile-app/gri/ios/<version>/<environment>/build-info.json
```

These JSON files record:
- Version name / marketing version
- Version code / build number
- Package/bundle ID
- Build timestamp
- Source (Firebase, GitHub, Xcode, etc.)
- Git commit (if applicable)

**These metadata files ARE committed to the repo.** They provide a record of exactly which build was tested.

## Directory Structure

```
test-data/
├── README.md                                    # This file
├── mobile-app/
│   └── gri/
│       ├── android/
│       │   ├── README.md                        # Android-specific notes
│       │   ├── config.yml                       # Build configuration
│       │   ├── login.yml                        # Login credentials/profiles
│       │   ├── 1.43/
│       │   │   └── qa/
│       │   │       ├── app.apk                  # ⚠️ NOT in repo (gitignore)
│       │   │       └── build-info.json          # ✓ In repo
│       │   └── 1.48/
│       │       ├── prod/
│       │       └── qa/
│       └── ios/
│           ├── README.md                        # iOS-specific notes
│           ├── config.yml                       # Build configuration
│           ├── 30.3/
│           │   ├── qa/
│           │   │   ├── GRI QA.app/              # ⚠️ NOT in repo (gitignore)
│           │   │   └── build-info.json          # ✓ In repo
│           │   ├── stage/
│           │   └── prod/
│           └── 30.0/
│               └── stage/
├── rate-wealth/
│   ├── rate-wealth-automation-catalog.csv
│   ├── rate-wealth-test-cases.csv
│   ├── rate-wealth-test-cases.xlsx
│   └── rate-wealth.yml
├── student-loan-refi/
│   └── student-loan-refi.yml
└── student-IDR/
    ├── student-IDR.yml
    └── student-IDR-counters/
```

## CI/CD Environment

In CI environments:

1. **Android:** Configure Firebase service account in GitHub Secrets
2. **iOS:** Configure GitHub token with access to SuperApp-iOS releases
3. Builds are downloaded automatically before tests run
4. Build artifacts are cleaned up after test completion to save storage

Example GitHub Actions setup:
```yaml
env:
  GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Download builds
  run: |
    npm run build:mobile:android
    npm run build:mobile:ios -- --download v30.3-qa --env qa
```

## Work history

### 2026-10-30 - Structured lab editing preserves source fixtures

- Request tables now edit the same reusable request used by preview/save/run;
  formatting does not rewrite original fixtures or adopt example borrower values.
- Invalid/unsupported fields remain available for explicit correction.
  SSN last four preserves leading zeros; multiple incomes remain separate inputs.
  Existing saved-run identification derives from results, not fixture changes.
- All 31 focused tests and scoped typecheck passed; source fixtures remained
  unchanged and UI screenshots/verification logs stayed under test-results.

### 2026-10-30 - Reusable edited lab templates

- Added local input-only storage beneath the existing Solution Finder fixture
  subtree for validated, named scenario copies, with source ID and creation time.
- These ad hoc inputs are gitignored; source originals and approved fixtures
  are untouched. Screenshots, responses, logs and other run evidence remain in
  test-results, not template files.
- All 27 focused checks and scoped typecheck passed, including independent
  copy/fork storage, server restart, duplicate/invalid input and visible failure
  paths. Tests isolate and remove their own temporary inputs.

### 2026-10-30 - Original 23 Solution Finder lab inputs

- Added only a reusable original-case JSON snapshot under the existing Solution
  Finder fixture folder. The source workbook and additional 102-case JSON were
  preserved.
- Kept original names/numbering, source requests and mapped form inputs.
  Decoded two CSV-escaped request cells without changing business values.
  Missing/unsupported cases stay visible with notices.
- All 24 focused tests and scoped typecheck passed; source hashes and original
  fields were verified. Live sample execution evidence stays in test-results.
- Independent QA submitted only Original1/GRI and Original18/Owning through the
  lab UI, verifying actual request values, HTTP200 and zero UI/API differences.
  Their 3/0 eligible-offer outcomes and screenshots are in the
  [readable QA report](../test-results/2026-10-30/solution-finder/lab-qa/originals-2026-10-31T02-18-23-850Z-29252/index.html);
  no generated evidence was added to test-data.

### 2026-10-30 - Solution Finder Lab input reuse

- The local lab loads existing workbook requests as templates; no fixture copies
  or generated evidence were added to test-data. All 102 input requests validate.
- The lab separates provisional response expectations from actual UI/API checks.
  Run input snapshots, JSON responses, logs, screenshots and history are written
  only beneath dated Solution Finder lab results.
- Real GRI and Owning runs were verified; no other-tenant live submissions or
  completed-loan coverage is claimed.

### 2026-10-30 - Solution Finder workbook inputs consolidated

- Request: keep new scenarios within the existing Solution Finder project,
  rather than creating another project folder for a workbook or environment.
- Moved the two runtime JSON inputs to
  [solution-finder/workbook-scenarios/](solution-finder/workbook-scenarios/).
  Added targeted ignore exceptions so they remain trackable; private/local
  extraction files keep their existing ignore rules.
- Updated the exporter, contract loader and five-tenant registry. Export/generate
  commands were exercised and both JSON files remained byte-identical.
- Validation: 16 unit/environment tests and scoped typecheck passed. Original
  and workbook discovery stayed separate at 25 and 102 cases. Source workbooks
  were not changed and no new live inquiries were submitted.

### 2026-10-30 - Root-output cleanup

- Replaced the obsolete repository-root `firebase login` troubleshooting advice
  with the existing saved-browser-profile setup/access-check commands.
- Firebase CLI diagnostics were present in the repository root. Separate CLI
  investigations must run from an explicit `test-results/` directory.
- Reusable inputs, app resources, saved sessions and account registries were
  preserved. No authentication or mobile business rules changed; no live
  sign-in/device tests ran.

## Troubleshooting

### "Build not found" error

**Android:** Verify Firebase project has App Distribution enabled and builds are published
**iOS:** Check GitHub releases exist for the requested version

### Large disk usage after downloads

Downloaded builds are temporarily extracted during test setup. They are typically cleaned up after test completion. To manually clean:

```bash
# Clean all build artifacts (keeps metadata)
npm run clean:builds

# Clean specific environment
rm -rf test-data/mobile-app/gri/android/1.48/prod/*.apk
rm -rf test-data/mobile-app/gri/ios/30.3/qa/*.app
```

### Authentication errors

**Android + Firebase:**
```bash
npm run setup:gv-session
npm run verify:firebase-access
```

Use the existing saved Google browser profile; sign in manually. Do not run
`firebase login` from the repository root: CLI authentication diagnostics can
create `firebase-debug.log` there. If a separate CLI investigation is required,
run it from an explicitly created directory under `test-results/`.
The Solution Finder lab startup preserves this exact root diagnostic under its
dated `test-results/` folder before applying the normal root guard; this does
not make the repository root a valid location for Firebase CLI output.

**iOS + GitHub:**
```bash
gh auth login
# or set GitHub token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

## More Information

- See [mobile-app/gri/android/README.md](mobile-app/gri/android/README.md) for Android-specific build details
- See [mobile-app/gri/ios/README.md](mobile-app/gri/ios/README.md) for iOS-specific build details
- See [root readme.md](../readme.md#setup) for general test setup instructions

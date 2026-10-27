# Test Data Directory

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
firebase login
# or set GOOGLE_APPLICATION_CREDENTIALS
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

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

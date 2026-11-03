# Solution Finder Lab

## Start

```bash
npm run solution-finder:lab
```

Open `http://127.0.0.1:4180`. `SF_LAB_PORT` selects another port. The server
binds only to loopback; do not expose it through a network proxy or tunnel.
Use one lab instance at a time. Stop with Ctrl+C; an active runner receives
an interrupt. A restart marks interrupted runs failed, rather than retrying
and potentially creating duplicate inquiries. Startup refuses to relabel an
active run whose owning process is still alive.

## Workflow

1. Select GRI, Owning, Citywide, Certainty or OnQ (the existing QA URL registry).
2. Paste the complete `type` / `applicationInquiryInput` request, or load a
   workbook case as an input template. The **Original 23 scenarios** group
   appears first, labeled `SF-1-Original: scenario name` through `SF-23-Original`,
   followed by the preserved **Additional 102 scenarios** (`NSF-*`) and separate
   **Tri-Bureau IR 40 profiles** (`TB-*`): 165 total. The added group shows
   PROFILE ID and BORROWER FULL NAME in both single and suite choices.
   Loading never submits data.
3. Edit the **Request data editor** tables, then validate the readable parsed
   borrower/address/occupancy/amount/income preview. Validation performs no
   application API call.
4. Choose whether to generate a fresh email (default) or preserve the pasted
   one. Confirm these are authorized QA inputs, then create the inquiry.
5. Follow the browser checkpoints/logs. Inspect actual request, response,
   parsed offers/credit/ratios, returned application IDs, UI/API comparison,
   Navigator link and full offers-page screenshot.
6. Select a saved run by borrower name, email and returned identifiers to
   revisit its basic profile and evidence, including after server restart.

Use synthetic/approved QA identities only. Inputs require single-borrower
fields supported by the existing UI: valid past/current YYYY-MM-DD dates,
10-digit phone, four-character SSN suffix, US addresses, whole-dollar amounts,
and supported income-source enums. To represent Navigator's observed
**Retired SSI** option, the lab requires calendar age 62+
and `incomeType: "SOCIAL_SECURITY"`; employment/self-employment requires null
or omitted income type. Selecting Retired SSI in the editor synchronizes Social
Security; switching to employment clears it. Navigator supplies Social Security
automatically, not via a second dropdown. DOB is entered before income selection.
This tests the application's label/mapping only, not benefit eligibility.
Social Security retirement can start at 62 with enough work credits; age-based
SSI starts at 65 (disability/blindness can qualify younger). Product should
clarify the "Retired SSI" label submitting Social Security. Do not silently
change the UI-compatibility check to 65 or claim the lab certifies federal SSI.
For PRIMARY occupancy, enter any valid subject address; validation automatically
maps it to borrower residence in tables, JSON and preview, with an explanatory
note. Before validation, the prior residence can remain visible. Secondary and
investment inputs keep their separate residence; source inputs are not mutated.
Unknown fields and unsupported income types are rejected, not silently dropped.

The selected tenant UI controls request type, consent, channel and loan-officer/
cost-center routing. Pasted routing metadata is not injected. The **actual**
request is retained so these UI-managed fields and the generated email are
visible. Other intended business inputs are checked against the real submission.

## Original workbook templates

The [original input snapshot](../../../test-data/solution-finder/workbook-scenarios/original-scenarios.json)
retains all 23 names in workbook order plus original request JSON. It reconstructs
multiline request cells and decodes CSV-style quote escaping in originals 15
and 18. The lab form projection preserves borrower, address, amount, occupancy,
income and date inputs, but excludes legacy routing/IP and address-display
metadata that the tenant UI supplies. A load notice and expandable original JSON
make that mapping explicit.

- **23 original-labeled lab cases** validate: 21 mapped originals plus the
  explicitly corrected SF-12 and generated SF-22 below.
- **SF-12-Original:** original retired-SSI income is preserved, not converted
  into employment. The user-approved lab DOB is `1950-01-01`, matching the
  title; the source request remains `1962-01-02`. A load notice records the
  correction. Retired SSI / Social Security is now supported for single/suite use.
- **SF-22-Original:** source request remains `N/A`. With explicit user approval,
  the lab generates an input from SF-1 using January 1 of the current local year
  minus 17 as DOB (currently `2009-01-01`, age 17). Residence start is clamped
  to DOB if needed to avoid residence before birth. It is selectable for
  single/suite execution; the load notice clearly identifies generated data.
  Reloading/queueing resolves the current year, even across New Year without a
  server restart. Already-loaded edits and persisted run snapshots stay unchanged.
- Source workbooks, original 25 regression specs and existing 102 cases are
  unchanged. These 23 workbook templates are not a replacement regression set.

Neither SF-12 nor SF-22 is greyed out. SF-22's generated request is not an original customer request or
an approved offer/underwriting baseline. If Navigator blocks the underage
request before offers, normal fail-fast diagnostics apply; enabling selection
does not claim the application accepts minors or that a live age-rule test passed.

After an explicitly reviewed source workbook change, refresh only this snapshot:

```bash
node scripts/solution-finder/lab/export-originals.cjs
```

Restart a running lab server and refresh the browser to load a changed catalog.

## Edit and save a reusable scenario

1. Load a built-in or saved scenario, or paste your own supported request.
2. Edit the property, borrower and income table fields. Add/remove income
   sources as needed; total income is the sum of all validated sources.
   The **Paste or edit inquiry request JSON** area is always visible above the
   tables, including before Load, and stays synchronized in both directions.
   The preview becomes stale until you validate again; unsupported fields/types
   are preserved for explicit validation errors, never silently discarded.
3. Enter a **New template name** and click **Save as new template**.
   The server validates the name and request before writing anything.
4. The new copy is selected under **Saved templates**, ready to load again
   after a page refresh or server restart. Choose any tenant independently.

Each save creates a new `SF-CUSTOM-<UUID>` input with its name, source case ID
(when loaded from a case), creation time and validated request. To revise a
saved template, load it, edit it and save under another name. Case-insensitive
duplicate saved names, blank/overlong names, invalid JSON and unsupported
requests produce visible errors instead of overwriting or claiming success.
The source originals and all previous copies remain unchanged.

Files are atomically saved with restrictive permissions beneath
`test-data/solution-finder/workbook-scenarios/lab-templates/`. This local
input-only directory is gitignored to avoid accidental sharing of borrower
data; review QA inputs explicitly before sharing. Tests use isolated disposable
input directories and never modify your saved templates.

Saving does **not** create an inquiry, run Playwright, save response expectations
or generate a regression spec. It resets inquiry authorization; execution still
requires explicit confirmation and the **Create Navigator inquiry** button.
No placeholder expected offers are promoted into an approved baseline.

## Readable preview and saved-run identification

The parsed input preview shows eight `Label = Value` rows: **Subject Property**,
**Occupancy Type**, **Existing Mortgage Amount**, **Requested Loan Amount**,
**Borrower Name**, **Borrower Address**, **Borrower SSN (last 4)** and
**Annual Income**. Addresses include unit lines, city, state and ZIP; dollars
use currency separators. Names use explicit first/middle/last/suffix order,
not JSON key order. SSN last four remains a string so leading zeros survive.
Values come from the loaded/edited request, not the example or expected response.

Primary occupancy still requires matching subject and borrower addresses.
The **Use subject as borrower address** button copies the address explicitly;
changing occupancy does not silently replace residence data. Table edits reset
inquiry confirmation and invalidate old previews; late validation responses
cannot overwrite newer edits. Missing/invalid raw JSON disables the table editor
with a notice instead of retaining stale borrower fields.

Saved-run labels contain tenant/status, borrower name, email, returned identifier
and timestamp. The profile panel shows borrower/email, subject property, occupancy,
loan amount, total income and identifiers without an inner scroll hiding IDs.
Profile data is derived from existing persisted requests/responses, so older
runs also gain the readable labels after restart.

- Use the **actual submitted email** when captured (including generated emails).
  Until then, saved input email is clearly labeled as input, not submitted.
- Display **Loan ID** only for actual `loanId` fields returned by the API.
- If no loan ID was returned, say so and show **Application ID (internalAppId)**
  and **Inquiry ID** with their correct labels. Do not treat officer IDs,
  offer IDs or application IDs as loan IDs.
- SSN last four appears in the current request preview, not in the multi-run
  history/profile metadata.

## Scope and outcomes

- Creates an inquiry through Navigator, capturing its real
  `POST /api/application/inquiry` response. No direct backend replay or mocks.
- May return HELOAN/Figure internal application IDs; these are labeled by their
  real field names, not renamed to loan numbers.
- Does **not** select an offer, send it to a borrower, or complete/fund a loan.
- PASS checks input mapping and exact actual UI/API agreement. Product order
  is irrelevant; product identity and eligibility reasons remain asserted.
- No placeholder workbook response expectations are used. A valid no-credit-
  match/no-offer result can pass consistency checks without proving eligibility.
- No automatic retries. Failed steps halt and preserve diagnostics. No response
  or a worker exiting without complete evidence is a failure, even with exit 0.

## Run a suite

1. Select the target **Tenant** above **Scenario group** in the suite panel,
   or in **Configure an inquiry**. Both dropdowns synchronize immediately in
   either direction; intake routing/target labels update and both confirmations
   reset. Both are locked while an inquiry/suite runs. The fresh-email setting
   in the input panel also applies to every scenario in the suite.
2. In **Run a scenario suite**, check each desired scenario's checkbox with
   ordinary clicks; no Ctrl/Cmd key is needed. Or choose a group and click **Select group**. **Clear** resets
   the selection. The count and target tenant are shown before authorization.
3. Confirm authorization for **one real QA inquiry per selected scenario**.
   Click **Run selected suite**. Selection/tenant/email-setting changes clear
   authorization.
4. Follow passed/failed/skipped/pending/running counts and each case's result.
   **View run details** opens the standard full request/response/offer view;
   individual evidence links open API JSON, captured UI offers and screenshots.
   **Open all suite results in a new tab** displays every scenario's full
   results side by side in one report rather than replacing the single-case
   **Actual results** panel. The separate tab auto-updates while running.
5. Use **Stop after current scenario** to finish the current inquiry and skip
   the rest, or reopen a previous summary using **Saved suite runs**.

Suites run saved original/NSF/custom-template inputs in selected/catalog order.
Unsaved JSON/table edits are not part of a suite; save those as a new template
and select that template. Requests are snapshotted for the entire suite before
the first launch, so edits to input files during execution cannot change queued
cases. Suite selections must be nonempty and distinct; the API accepts at most
500 cases per suite. Original12 supports retired SSI / Social Security and
Original22 uses the user-authorized generated underage request; both are selectable.
Any invalid/unknown selected input rejects the entire launch before an inquiry.

Only **one browser inquiry runs at a time**, shared with the single-run button.
No retries or parallel case launches. A failed case retains evidence, stops the
queue and marks remaining cases skipped. Stop requests are honored between
cases, not by interrupting the current browser. Closing the server interrupts
its current worker and never starts pending cases.

Each child uses the existing fixed actual-UI/API lab runner and gets its own
normal run directory/history. Suite state and immutable input snapshots live
in `test-results/<date>/solution-finder/lab/sf-suite-<timestamp>-<suffix>/suite.json`;
finished suites also save a combined `suite-summary.json` with counts,
profiles/returned IDs, offers and evidence links. No execution evidence goes in
test-data. A live owning suite prevents another lab instance from taking it over.
On restart after interruption, the suite is failed, unfinished cases are
failed/skipped and **nothing automatically resumes or resubmits**. Inspect the
saved evidence before explicitly starting another suite.

PASS remains actual input/UI/API consistency, not confirmation of preliminary
workbook expectations or independent pricing/eligibility certification.
These batch runs do not replace the original25 regression or separate102
workbook runner. Other-tenant URLs use the existing registry unchanged.

### Full results in a separate tab

After launching a suite or selecting **Saved suite runs**, click **Open all
suite results in a new tab**. Its local URL includes the suite ID, so you can
bookmark/reload it while that server and saved evidence are available.

Each scenario remains visible with status, borrower/submitted email, correctly
labeled inquiry/application/loan IDs, all eligible and declined products,
amounts/APR/payment/reasons, raw actual request/response, parsed results,
UI/API comparison, logs and screenshot/evidence links. Pending and skipped
scenarios are explicitly labeled, not rendered as successful empty responses.
Open JSON sections remain open as other cases finish. The report refreshes
while a suite runs, then stops polling when complete; **Refresh results** is
also available. Server/network/missing-suite errors remain visible.

The report is read-only and uses GET requests only. Opening it does not select
offers, create/retry inquiries, or resume a stopped suite. Completed results
remain cached in the tab while active child results are refreshed. The existing
single-case panel remains available for targeted inspection.

## Data and runner boundaries

All generated execution evidence, including run input snapshots, saved run state, logs,
response JSON, DOM/source, screenshots and failure traces, stays under:

`test-results/<YYYY-MM-DD>/solution-finder/lab/<run-id>/`

No evidence is placed in test-data or the root. The lab uses a fixed
[runner](../../../tests/projects/solution-finder/lab/inquiry.spec.ts) and
[configuration](playwright.config.ts), one Chromium worker and no retries.
Existing regression and workbook runners exclude it. Local POSTs require the
page token and same-origin/Host checks; artifact routes are restricted to saved
run files. Saved page-source HTML downloads instead of executing in the lab.
Run directories/input/state are created with restrictive permissions.

## Validation

```bash
npm run test:solution-finder:lab
npm run typecheck:solution-finder:new
npm run check:root
```

The local tests use clearly separated offline worker fixtures and Chromium UI
checks; they do not submit live inquiries.

## Standalone ZIP for coworkers

```bash
npm run package:solution-finder:lab
# Authorized internal distribution of the actual catalog:
npm run package:solution-finder:lab -- --include-scenarios
npm run verify:solution-finder:lab -- <generated-ZIP-path>
```

Builds go to `test-results/<local-date>/solution-finder/lab-distribution/`
with a SHA-256 file. Building uses the installed TypeScript compiler and the
`zip` CLI; verification uses `unzip` and restores the archive's own dependencies.
These tools are needed by the package maintainer, not recipients.

The packager compiles only the fixed lab runtime dependency closure and checks
an explicit file allowlist. It includes a pinned standalone npm lockfile and
platform-neutral Node launcher. No TypeScript source/build, `.env`, auth state,
account registry, templates, run evidence,
original spreadsheets, node_modules or browser binaries are copied. Original
scenario datasets are excluded by default; only the explicit internal edition
copies four allowlisted JSON inputs: three unchanged catalog datasets and a
sanitized prior-screening reference. Added profile/reference inputs retain
last-four SSN only; full-SSN workbooks, the full chart and raw captures are excluded.

Recipients follow the [included setup guide](portable/README.md):
Node.js 22/24 LTS, extract, `npm ci`, `npm run setup`, `npm start`, then
`http://127.0.0.1:4180`. QA access/VPN and installation downloads are still
required; the package does not grant application permissions. Share internally.
The default portable copy includes five **Synthetic starter scenarios** (SF-DEMO-01
through SF-DEMO-05). Select one and click **Load**. Replace dummy
identities/addresses with approved QA inputs before live submission, or paste
approved JSON and save templates. These are not the internal 165 catalog cases
or expected eligibility/pricing baselines. All editing/execution/reporting features
remain available. Do not send a used working folder containing local QA data.

The **internal-165** v1.4.1 edition includes **Original 23 scenarios**,
**Additional 102 scenarios**, and a separately selectable **Tri-Bureau IR 40 profiles**
group. Each added choice shows PROFILE ID and BORROWER FULL NAME in the single
picker and suite checklist. Select and **Load**, or check suite cases.
TB choices additionally show last-four SSN, source TU/XPN/EFX and prior eligible
products/pending count. The reference panel distinguishes source scores from
previously returned scores and shows all prior offer statuses/pricing/reasons.
The observation is prior GRI QA screening on 2026-11-02: secondary occupancy,
50k request/70k mortgage/250k income and assumed DOB1980. Changing inputs/tenant
may change outcomes. Reference only, not current results, a baseline or approval.
TB-007 remains included without usable credit; TB-026 retains waiting states.
The current revision keeps NSF-001..050 and replaces Fannie borrower data in
NSF-051..102 with the supplied 40 IR profiles. These existing 125 slots are
preserved; all 40 normalized TB-001..040 requests are added irrespective of
screening outcome, for 165 runnable choices. The added group retains normalized
financial setup and assumed/not IR-certified DOB, without response/UI baselines.
For custom PRIMARY inputs, validation maps the entered subject to residence
without changing source inputs; secondary/investment residences stay separate.
Loaded notes expose profile ID, DOB assumptions, address adjustments and pending
new baselines; the original 23 and existing financial variations are preserved.
It contains original borrower/contact/property data and is restricted to
authorized internal QA recipients through approved company channels.
See its [included guide](portable/README-internal.md). The existing SF-12
user-authorized DOB correction and SF-22 generated age-17 input are preserved;
source datasets are not rewritten or replaced with demo profiles.

The launcher reads the explicit `sfLabCatalog` package marker. Synthetic mode
sets `SF_LAB_PORTABLE=1` and skips all four private source datasets. Internal mode sets it
to `0`, loads four datasets and shows a restricted-data notice, overriding stale
portable environment settings. Unknown catalog markers fail.
Normal mode exposes 165 cases and still rejects missing/corrupt source files.
Legacy `original125` archives retain their 125-case marker/launcher semantics;
extract v1.4.1 separately rather than overlaying or reinterpreting an older ZIP.
Compiled config/spec discovery uses `.js`; repository execution still uses `.ts`.
Verification rejects module imports outside the extracted copy, works in a
folder with spaces, checks every included case's load/preview/suite availability,
byte-identical internal sources, clean startup, two saved templates across restart,
an offline two-case suite/full results tab/reset and fixed worker discovery.
It creates no live inquiries and cleans its exact temporary install folder.
macOS is verified; Windows/Linux execution is not certified.

## Work history

### 2026-11-02 - Internal165 v1.4.1 release patch

- Packaged the parent-supplied overlapping Load/selection race fix. Parent
  reports a passing deterministic gated HTTP browser regression; this follow-up
  performed packaging/extraction verification only, without reviewing parent code.
- Bumped package and current portable-guide surfaces to1.4.1; reference-required
  verification covers both1.4.0 and1.4.1. Catalog inputs/reference data unchanged.
- Final [internal v1.4.1 ZIP](../../../test-results/2026-11-02/solution-finder/lab-distribution/solution-finder-lab-internal-165-2026-11-03T00-55-12-319Z.zip)
  SHA-256: `3947b040bda768ca7206a8a49032691f94ce0a3df1c3fd32b77fe9829c19524f`.
  [Clean-extraction evidence](../../../test-results/2026-11-02/solution-finder/lab-distribution/solution-finder-lab-internal-165-2026-11-03T00-55-12-319Z.zip.verification.json)
  passed all165 loads/previews, all40 reference panels/120 offers, four
  byte-identical datasets, isolated dependency restore, template persistence,
  offline two-case suite/report and one compiled-worker discovery test.
- Zero live inquiries. Existing ZIPs and the live lab were left untouched;
  cleanup/restart belongs to the parent. Verified on macOS only.

### 2026-11-02 - Bounded IR chart data/reference packaging v1.4.0

- Request: expose SSN scenario/source scores and prior offers, not names alone.
  Added a sanitized fixture covering all40 canonical IDs and all120 detail rows.
- Import with `node scripts/solution-finder/import-ir-profile-reference.cjs`.
  The local XLSX library reads the chart; identity/last-four/source-score joins,
  unique/count checks, product/status/reason validation and summary/usable-credit
  conflicts fail explicitly without private raw values. Full chart stays local.
- Catalog exports typed strict reference schemas, validates startup alignment,
  and attaches historical data/provenance only to new40 TB objects. Existing125
  inputs/names/notes and TB full names are unchanged. Legacy125/synthetic5
  skip profile/reference reads. No workbook runtime dependency.
- Internal1.4 adds only the fourth allowlisted JSON and manifest marker
  `sfLabReferenceSource: ir-profile-offer-chart`; default excludes private data.
  Extraction checks exact source/returned labels, values, product-keyed offer
  rows and rich dropdown/suite summaries without requiring row order.
- Validation: 27 focused importer/runtime/isolation tests passed via
  `node --test tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/profile-reference.test.cjs`;
  catalog strict typecheck and importer/packager/verifier syntax checks passed.
- After parent readiness, combined offline lab checks passed **93/93** and scoped
  typecheck passed. Final [internal1.4 ZIP](../../../test-results/2026-11-02/solution-finder/lab-distribution/solution-finder-lab-internal-165-2026-11-03T00-49-54-928Z.zip)
  SHA-256: `0025c6281b3b8aba33486d59b7e7ce56fc62affee671350419cc2fb2984037f4`.
  [Extraction evidence](../../../test-results/2026-11-02/solution-finder/lab-distribution/solution-finder-lab-internal-165-2026-11-03T00-49-54-928Z.zip.verification.json)
  passed all165 loads/previews, all40 reference panels/120 offers, four
  byte-identical datasets, isolated restore, saved templates, offline suite/report
  and compiled-worker discovery. Source null is N/A; returned null is Not returned.
- One prior extraction attempt timed out at TB-008 borrower-preview rendering;
  unchanged-archive rerun passed with diagnostic-only instrumentation, with no
  weakened assertions. Cause remains unconfirmed. No live inquiries; no live lab
  stopped or existing archive deleted. Root/docs and shared lab-test assertions
  belong to the parent. macOS only; Windows/Linux not certified.

### 2026-11-02 - Separate normalized IR group, internal v1.3.0

- Request: add all 40 existing normalized IR profiles separately without
  replacing the 125 built-ins or filtering by prior screening.
- Added PROFILE ID/full-name choices only in UI/input, assumed DOB/normalized
  financial-source notes and no baselines. Internal packaging allowlists the
  third last-four-only JSON; synthetic default remains five private-data-free
  starters. Full-SSN workbooks remain excluded.
- Updated catalog/launcher markers to 165, preserving legacy original125
  semantics and historical outcomes below. Added custom PRIMARY unit/HTTP/
  browser mapping coverage, save/load and offline launch checks.
- Validation: combined `npm run test:solution-finder:lab` passed **65/65**;
  `npm run typecheck:solution-finder:new` passed. Clean-extraction verifiers
  passed **165 internal / 5 synthetic** loads/previews, all40 named single/
  suite choices, three byte-identical internal source files, isolated install,
  two-template persistence, offline two-case suite/report and one compiled
  worker test per edition. Custom PRIMARY screenshot uses only synthetic data
  at `test-results/2026-11-02/solution-finder/lab/custom-primary/before-validation.png`.
- Final [internal v1.3.0 ZIP](../../../test-results/2026-11-02/solution-finder/lab-distribution/solution-finder-lab-internal-165-2026-11-02T23-25-14-088Z.zip)
  was rebuilt and clean-verified by the parent after correcting the static
  PRIMARY hint: enter any valid subject; validation uses it as residence
  automatically, with no manual matching.
  SHA-256: `33115bfa47c6bf5c7f5dcf24b203321ab9b5949047b1b14e001840c1393152b6`;
  adjacent `.sha256` and `.verification.json` contain aggregate evidence.
- Parent-supplied readiness evidence: the owned loopback lab was safely
  restarted while idle; HTTP verified 165 choices and 40 named profiles.
  Actual browser custom PRIMARY editing successfully validated preview,
  JSON/residence mapping and corrected static/dynamic hints, with zero remote
  submissions. Screenshot:
  `test-results/2026-11-02/solution-finder/lab-verification/primary-property/live-primary-preview.png`.
- This follow-up only updates documentation using supplied evidence; no
  tests/builds were rerun. Original sources remain unchanged. Parent owns
  previous candidate/synthetic/125 ZIP cleanup and final canonical sync.
- Limits: offline QA fixtures do not certify IR DOB, eligibility/pricing or
  other operating systems. Root/framework/memory sync and live-server lifecycle
  remain parent-owned.

### 2026-11-02 - IR script synchronization v1.2.1

- Request: propagate reviewed IR data and comparison rules to all related
  cases/scripts. Compiled shared runtime rejects stale catalog composition,
  wrong profile/source-row assignments, DOB drift and PRIMARY mapping errors.
- Rebuilt the historical [v1.2.1 internal125 ZIP](../../../test-results/2026-11-02/solution-finder/lab-distribution/solution-finder-lab-internal-125-2026-11-02T22-59-33-942Z.zip)
  with its updated guide. Clean extraction verified all125 load/preview/suite
  selections, all52 mappings, source equality, isolated dependencies, template
  persistence, offline suite/report/reset and worker discovery.
- 62 combined checks, scoped typecheck and102-case discovery passed. Owned
  loopback lab restarted only after idle and HTTP-verified all125 inputs.
  Superseded v1.2.0 ZIP/sidecars removed; historical execution evidence retained.
- No new live inquiries, no approved variant baselines; refresh the browser.
  macOS verified, Windows/Linux not certified.

### 2026-11-02 - IR-backed 125-case distribution

- User requested replacing Fannie profiles with Tri-Bureau IR profiles. Source
  migration replaced exactly NSF-051..102, using all40 IR profiles; first50
  and original23 remain unchanged. Old inputs were archived, not left active.
- Updated standalone v1.2.0 guide/profile marker and verifier. Both source JSONs
  are byte-identical to current repository inputs. Verified all52 mappings,
  absent obsolete response/UI baselines, visible IR notes and all125 loads/
  previews/suite checkboxes in clean extraction; default synthetic copy remains
  isolated. Template persistence/offline suite/report and worker discovery pass.
- Validation: 53 focused checks, scoped typecheck and 102-case discovery passed.
  Changed52 declare actual-ui-api; no new live submissions or approved variant
  baselines. Two PRIMARY subjects now match IR residence as UI requires.
- This v1.2.0 archive was superseded by the v1.2.1 ZIP linked above.
  Superseded Fannie-containing ZIP and validation-only synthetic ZIP removed.
- The existing local server had active work, so restart was deferred until idle.
  Then restarted the owned server safely on port 4180; all52 IR mappings/notes
  and125 built-ins were verified without submitting inquiries. Refresh the
  browser to load the updated options. Active historical/saved runs were kept.

### 2026-11-02 - Superseded ZIP cleanup

- Request: delete previous lab ZIPs. Removed the three older empty/synthetic
  archives and their six checksum/verification sidecars; retained the verified
  internal 125-case ZIP and its sidecars. Unrelated reports and inputs remain.
- Removed obsolete chat download entries and historical broken archive links.
  Older validation entries below remain historical evidence, not downloads.
- Validation: only the current lab ZIP remains; its checksum and root hygiene
  passed. No application code or scenario data changed.

### 2026-11-02 - Internal ZIP with the actual 125 scenarios

- Request: the user rejected synthetic substitutes and requested the actual
  125-case catalog. Added opt-in `--include-scenarios`, an internal-125 archive
  name, two strictly allowlisted source files and a separate restricted-data guide.
- Launcher selects the packaged edition and overrides stale environment mode;
  missing/corrupt original datasets are not hidden. Added a visible internal
  notice. Default synthetic edition and normal repository mode are preserved.
- Validation: 51 focused checks and scoped typecheck passed. Clean extraction
  verified all 125 original/NSF IDs, loaded requests/previews and enabled suite
  checkboxes; both packaged source files are byte-identical to repository files.
  Isolated install, template restart, two-case offline suite/report/reset and
  compiled worker discovery passed in both internal and synthetic editions.
  No live inquiries; macOS verified, Windows/Linux not certified.
- This first internal ZIP was superseded and deleted after the IR profile
  replacement. The current download is linked in the IR-backed history above.
  Prior synthetic/empty ZIPs described below were deleted at the user's request.

### 2026-11-02 - Synthetic starters for the portable copy

- Request: coworkers could not find existing scenarios. The first ZIP deliberately
  excluded borrower/workbook inputs and its catalog was empty.
- Added five strict synthetic starter definitions and an explicitly labeled
  portable-only group. Original customer data remains excluded; normal repository
  mode retains 125 cases. Underage DOB refreshes on load/queue to remain 17;
  retirement uses the observed Social Security pairing, not federal SSI eligibility.
- Updated the privacy notice, included setup guide and upgrade instructions.
  Expanded compiler allowlist and independent verifier for the safe fixture.
- Validation: 50 focused checks and scoped typecheck passed. Clean extracted
  install/module isolation, all five starter loads/previews and suite checkboxes,
  saved templates/restart, offline suite/report/reset and compiled worker discovery
  passed on macOS. No live inquiries; Windows/Linux not certified.
- The starter-enabled ZIP was superseded by the internal 125-case edition and
  deleted on 2026-11-02. Validation above describes that historical edition.

### 2026-11-02 - Compiled standalone distribution

- Request: share only Solution Finder Lab as a separate laptop-runnable ZIP.
- Added allowlisted compiled packaging, pinned minimal dependencies, Node
  launcher and standalone setup guide. Kept private inputs, credentials and
  execution history out of the archive; portable mode explicitly starts empty.
- Added clean-extraction verification with independent npm installation and
  a module-resolution guard against fallback to repository dependencies.
  Verified startup/UI, persisted templates, two-case offline suite/report,
  reset and compiled fixed worker discovery. No live inquiries created.
- Validation: 50 focused regression checks, scoped typecheck and JS syntax
  passed. The normal 125-case catalog remains intact. Clean archive checks
  passed on macOS; Windows/Linux were not executed.
- The initial empty-catalog ZIP and its checksum/verification sidecars were
  superseded and deleted on 2026-11-02.
  Standard borrower/workbook inputs must be reviewed/shared separately, not
  inferred to be safe merely because they are test fixtures.

### 2026-11-02 - Shared automation retirement verification

- Corrected the original retirement test's employment selection and unified
  strict native/custom income selection across original/shared/workbook/lab
  automation, including additional income. Missing options fail, not substitute.
- Added permanent real-browser birthday/leap probes and submitted DOB/income
  type/amount assertions with request/response/screenshot evidence.
- Validation: 49 focused checks, scoped typecheck and two targeted live GRI
  tests passed: five form-only probes and one real retirement inquiry, no retries.
  No full suite, other-tenant or federal benefits-eligibility claim is made.
- Clarified UI label versus Social Security retirement/SSI program rules in
  the editor and canonical docs; Product clarification remains needed.

### 2026-11-02 - Retired SSI and calendar-accurate age

- Request: enable SF-12 with the title-aligned retirement DOB and verify age
  remains correct as the current date changes.
- Root cause: schema/editor/runner allowed employment inputs only. GRI
  Navigator shows Retired SSI from age 62 and automatically submits Social
  Security. Verified an intercepted request before network submission.
- Added Retired SSI / Social Security through validation, editor, actual UI
  runner and submitted-income-type checks. Correct SF-12's lab DOB explicitly;
  preserve original source/workbook. All 23 originals are now selectable.
- Validate age by local calendar birthday on every request. Browser clock
  probes confirmed age 61 excludes Retired SSI, 62 includes it, and availability
  changes on the exact birthday. A leap-day DOB qualifies March 1, not February
  28, in a non-leap year. Refreshed SF-22's generated year per load/queue so
  the input remains age 17 across New Year without server restart.
- Validation: 48 focused checks, scoped typecheck and browser syntax passed.
  Unit tests cover midnight/year/leap/birthday/18th-birthday boundaries,
  invalid income combinations, editor synchronization, templates and snapshots.
  Live GRI probes were form-only/intercepted: no new inquiries or offer/decision
  claims. Boundary evidence is under
  [retired-income verification](../../../test-results/2026-11-02/solution-finder/lab-verification/retired-income/).
  Other tenants' retirement thresholds were not independently probed.

### 2026-11-02 - Authorized underage input for SF-22

- Request: supply any under-18 DOB for the missing original request.
- Generate SF-22's lab input from SF-1 with January 1 of the startup year
  minus 17 as DOB; keep residence start no earlier than DOB. Mark generated
  provenance visibly and enable single/suite selection. Source workbook and
  exported original22 null request/source remain unchanged.
- Validation: 45 focused checks and scoped typecheck passed. Covered age 17,
  preserved source, editable DOB, preview and single/suite persisted snapshots
  using offline workers. No live underage inquiry/eligibility result is claimed.
- SF-12's unrelated retired-income runner limitation remains unchanged.

### 2026-11-02 - Reset for a new run

- Request: clear the workspace from a top-level button rather than manually
  removing each prior input/result.
- Added **Reset / New run**: clears JSON/tables, preview, source notices,
  template name, case/group/history selections, authorizations, logs, offers,
  profiles, screenshots and suite results. Restores GRI/fresh-email defaults.
- Saved templates and execution history remain available and unchanged.
  Active execution and pending UI requests disable reset, preventing late
  responses from repopulating a cleared workspace; reset never submits,
  cancels or deletes persisted work.
- Validation: 44 focused checks, scoped typecheck and browser syntax passed.
  Chromium covered reset, retained history/template access, in-flight blocking
  and mobile layout using offline workers, not new live inquiries.
- SF-12 retains unsupported retired-SSI income; SF-22 still lacks source
  request data. Neither original was changed or enabled.

### 2026-11-02 - Separate all-scenario suite results tab

- Request: see every suite case's full results in another tab instead of the
  original one-case Actual results panel showing only the followed scenario.
- Added a read-only auto-updating report link/page with persistent case cards,
  all offers/declines, profiles/IDs, JSON/UI comparisons, logs and screenshots.
  Saved suite history opens the same report; missing/failed/skipped results and
  fetch failures stay explicit. Single-case inspection is retained.
- All **43 focused checks**, scoped strict typecheck and browser syntax passed.
  Tests cover popup behavior, all-case visibility, distinct/no-offer responses,
  progressive updates, preserved JSON disclosure state, failures/skips, invalid
  suite IDs, reload, mobile and no write requests.
- The live lab was idle and restarted. Its existing completed four-case suite
  was opened read-only in the new tab: **4 case cards, 12 product cards and
  4 screenshot references**, zero page errors/390px overflow, no new inquiries.
  These are existing-run display checks, not a fresh live suite execution.

### 2026-11-02 - Synchronized tenant selector in suite panel

- Request: put Tenant above Scenario group in Run a scenario suite and keep
  it synchronized with Configure an inquiry.
- Both controls use the same tenant registry/state; either updates both,
  intake links and target labels, clears both confirmations, and is locked
  while running. Scenario checkbox selections are retained.
- All 41 focused checks and scoped strict typecheck passed, including every
  tenant in both directions, actual suite request tenant, busy locks and
  authorization reset. No live inquiries were used during validation.

### 2026-11-02 - Running lab restarted to activate suite checkboxes

- Report: refreshing still allowed only one scenario. The listener at port
  4180 was an older idle server without suite support; refresh could not replace
  its startup-snapshotted assets or in-memory API.
- Confirmed no active inquiry, gracefully stopped that exact server process
  and started the current lab on the same loopback URL.
- Live Chromium verification selected NSF-001 and NSF-002 together and
  confirmed both stayed checked with a count of two. All 125 catalog cases,
  suite API support and visible JSON input were present; no page errors or new
  inquiries occurred. The current lab remains running for the user.
- [Live two-checkbox verification screenshot](../../../test-results/2026-11-02/solution-finder/lab-verification/live-checkbox-restart/two-scenarios-checked.png).

### 2026-11-02 - Explicit scenario checkboxes for suite selection

- Report: there appeared to be no way to select multiple scenarios. The native
  multi-select required undiscoverable Ctrl/Cmd-click gestures.
- Replaced it with grouped, individually labeled checkboxes and visible selected
  states. Ordinary clicks accumulate selections; group selection, Clear,
  unavailable-case disabling and authorization reset remain intact.
- All 40 focused checks and scoped typecheck passed. Chromium now checks two
  distinct boxes without modifiers and verifies both remain selected before
  launching; stop/history/mobile coverage remains green. No live inquiries
  were submitted for validation. Restart the lab and refresh for new assets.

### 2026-11-02 - Sequential multi-scenario lab suites

- Request: run suites rather than launching every scenario manually.
- Added grouped multi-selection with count/tenant confirmation, prevalidated
  immutable input snapshots, and sequential use of the existing fixed runner.
  Singles/suites share a mutex; original12/22 are visibly unavailable.
- Added combined results/evidence, persisted suite history and summaries,
  stop-after-current, fail-fast skipped remainder and interrupted-owner
  non-resume. Child runs retain existing actual JSON/UI/screenshot/profile
  behavior; no placeholder expected responses were promoted into baselines.
- Validation: **40 focused checks**, scoped strict typecheck and root hygiene
  passed. Checks cover authorization/input rejection before launch, max-one
  child concurrency, immutable saved copies, failure/launch errors, stop UI,
  shutdown, interrupted restart, persisted evidence, grouped selection,
  individual run details, reload and 390px mobile layout.
- [Offline suite UI preview](../../../test-results/2026-11-02/solution-finder/lab-verification/suite-runner/offline-suite-ui-desktop.png)
  is from explicitly simulated local worker fixtures, not a new live tenant run.
  No real inquiries were submitted for this feature validation.

### 2026-10-30 - Visible JSON paste area and stale-server dropdown fix

- Report: existing scenario groups displayed `undefined` and the JSON paste
  area appeared missing. The running lab returned the older 102-case response
  without group labels while reading the updated page assets from disk.
- Restored an always-visible copy/paste textarea above the tables, not a
  collapsed Advanced section. Loading remains explicit; pasting also populates
  the structured editor without needing Load.
- Legacy IDs receive their correct group labels with an explicit old-server
  restart notice; malformed case names/IDs show an error rather than undefined.
  New servers snapshot page assets at startup with their API implementation,
  preventing mixed running-server/new-static-asset versions after code edits.
- All **33 focused checks** and scoped strict typecheck passed, including
  reproduced legacy bootstrap/grouping, visible paste-before-Load, synchronized
  field edits and malformed-label errors. Restart an idle old server to load the
  full current catalog and features; refresh to see the visible paste area.

### 2026-10-30 - Table editor, readable preview and identifiable saved runs

- Request: edit request data without JSON and display the supplied readable
  preview format; identify saved runs by email, profile and actual loan IDs.
- Added synchronized property/borrower/income tables and collapsed advanced
  JSON, explicit primary-address copy and add/remove income controls. Added
  eight formatted preview rows, stable name order and last-four SSN handling.
- Saved history now derives borrower/submitted-email/profile and actual returned
  IDs from persisted evidence, including older runs. Missing loan IDs are stated
  explicitly; application/inquiry IDs retain their real labels.
- Validation: **31 focused checks** and scoped strict typecheck passed,
  including copy/save/reload, unsupported-data preservation, currency/address
  formatting, income totals, primary matching, stale-preview races, leading
  zeros, returned loan IDs/fallbacks and restarted history. An actual existing
  GRI saved run was reopened read-only; desktop/390px screenshots had no
  horizontal overflow or page errors, and no new inquiries were launched.
- [Readable preview screenshot](../../../test-results/2026-10-30/solution-finder/lab-verification/structured-editor-2026-10-31T02-35-50-470Z/readable-input-preview.png)
  and [saved-run profile screenshot](../../../test-results/2026-10-30/solution-finder/lab-verification/structured-editor-2026-10-31T02-35-50-470Z/saved-run-profile.png).

### 2026-10-30 - Edit and save named scenario copies

- Request: edit an existing scenario and save a new reusable template.
- Added name/save controls, protected validated save API, atomic input storage
  and a persisted **Saved templates** picker group. Copies retain source
  lineage without overwriting built-ins or previous templates.
- Invalid names/inputs, duplicate names, corrupt storage and filesystem failures
  surface explicit errors. Saving creates no inquiry or approved baseline.
  Custom inputs stay in the existing Solution Finder fixture subtree and are
  gitignored; results/screenshots remain in test-results.
- Validation: all **27** focused tests and strict scoped typecheck passed,
  including actual Chromium edit/save/fork/reload, server-restart persistence,
  immutable originals, same-origin/token checks, duplicate/concurrent saves,
  visible failures and 390px mobile layout. No live inquiries were needed for
  this input-storage feature.

### 2026-10-30 - Original 23 scenarios added to the picker

- Request: expose the beginning/original set using `SF-N-Original` plus its
  scenario name, separate from the additional 102.
- Added the original input snapshot/exporter and a combined ordered catalog.
  All 125 cases load by their own IDs; the picker has separate original and
  additional groups. Original JSON and mapping/unsupported/missing-data notices
  are visible. No source data or existing cases were replaced.
- All 24 focused tests and scoped strict typecheck passed, including original
  workbook hash, exact names/IDs, source/business-field preservation, all 23
  load endpoints, grouped UI selection and original12/original22 notices.
  Root hygiene and scoped syntax/whitespace checks passed.
- Independent **Team QA Engineer** sample runs:

  | Original / tenant | Result | Observation |
  | --- | --- | --- |
  | SF-1-Original / GRI | PASS; HTTP 200; 3 eligible offers | HELOAN, variable-rate HELOC and fixed-rate HELOC rendered consistently with the API. |
  | SF-18-Original / Owning | PASS; HTTP 200; 0 eligible offers | $1,000 annual income; HELOAN DTI declines and both HELOC asset-prequalification/manual-verification reasons rendered consistently with the API. |

  Both had zero UI/API differences, fresh emails and intended business inputs
  verified against actual requests. Actual JSON, parsed counts/IDs, screenshots,
  logs and Navigator links were checked. Saved-run reload and server-restart
  persistence, 390px mobile with no horizontal overflow, all five tenant URLs
  and original12/original22 warnings passed; no browser page errors occurred.
  Exactly two live inquiries were submitted, with no live retries or other
  tenant submissions. Two temporary QA-helper checkpoint/disclosure errors were
  repaired without application changes; persistence follow-up was read-only.
- [Readable independent QA report and screenshots](../../../test-results/2026-10-30/solution-finder/lab-qa/originals-2026-10-31T02-18-23-850Z-29252/index.html).
  PASS means actual UI/API consistency, not independent eligibility/pricing
  certification, approved workbook expectations or completed loans.

### 2026-10-30 - DMX-style JSON inquiry lab

- Request: create a Solution Finder equivalent of DMX Lab with pasted JSON,
  parsed data, multi-tenant Navigator submission, actual API response and
  screenshot results.
- Reused the existing step-gated browser inquiry helper and five-tenant
  registry; added explicit live UI/API mode without placeholder baselines.
  Kept all files within Solution Finder and left DMX unchanged.
- Real lab-UI submissions passed on GRI (one eligible offer) and Owning
  (three), both HTTP 200 with zero UI/API differences. GRI Figure products
  returned `WAITING_FOR_LIEN_DATA`, retained as actual no-offer reasons.
- Desktop/mobile layout, history reload, source JSON/schema and screenshot
  retrieval were checked. All 102 existing request templates validate.
  All 23 focused tests and scoped strict typecheck passed. Tests cover
  rejection/authorization/concurrency, active-run ownership, persistent history,
  no-offer outcomes, failure evidence, absent-result failure and UI behavior.
- The documented package command was started on an alternate loopback port;
  its HTTP bootstrap returned all five tenants, 102 templates and the two
  persisted live results. Root hygiene and scoped whitespace checks passed.
- Limits: Citywide, Certainty and OnQ selectors/URLs are supported and locally
  checked, but no new live submission to those tenants was made. This is not
  full loan completion, a pricing certification or an approval-rule oracle.
  Temporary verification servers/browsers were closed after use.

# Solution Finder Lab - 165 Choices with Tri-Bureau IR Profiles

**RESTRICTED INTERNAL QA DISTRIBUTION.** This ZIP contains original inquiry
data, including borrower/contact/property information. Give it only to authorized
internal QA recipients through approved company channels. Do not publish it,
upload it to public file sharing, or expose the local server through a tunnel.

## Install and start

1. Install **Node.js 22 or 24 LTS**, including npm.
2. Stop any older lab server with Ctrl+C after active work finishes.
3. Extract this ZIP into a new writable folder, not over an old installation.
4. Open Terminal or PowerShell in the extracted `solution-finder-lab` folder:

   ```text
   npm ci
   npm run setup
   npm start
   ```

5. Open or refresh **http://127.0.0.1:4180**.

No full repository, Git, Copilot or TypeScript build is required. Setup downloads
matching Chromium. Corporate VPN/QA access and installation downloads are still
needed; no credentials, auth state or `.env` are included. Linux may require
`npx playwright install-deps chromium`. macOS is verified; Windows/Linux are not
certified.

## Find the 165 choices

The **Start from an existing scenario** dropdown contains:

- **Original 23 scenarios**: SF-1-Original through SF-23-Original.
- **Additional 102 scenarios**: NSF-001 through NSF-102.
- **Tri-Bureau IR 40 profiles**: TB-001 through TB-040, separately selectable
  in both single and suite modes with PROFILE ID and BORROWER FULL NAME visible.

NSF-001 through NSF-050 retain their existing inquiries. NSF-051 through
NSF-102 now use the 40 supplied **Tri-Bureau IR profiles** instead of the
previous Fannie Mae profiles, while keeping the financial scenario variations.
The new separate group includes all 40 existing normalized profiles irrespective
of screening outcome, including the no-credit-response profile. Its financial
setup stays exactly the normalized source request; DOB remains assumed, not
IR-certified. No copied prior response/UI baseline is included in this group.
The existing 125 built-ins (23 original + 102 variants) are preserved.

Select a scenario and click **Load** to populate its editable JSON and tables.
The workspace is initially blank until Load; the built-in catalog is not blank.
These are the actual repository catalog inputs, not the five synthetic starters
from the synthetic ZIP. Four source JSON datasets are included: the three
existing catalog inputs unchanged and one sanitized prior-screening reference.
The normalized profile and reference JSON contain SSN last-four only. Neither
the original full-SSN IR workbook nor the full profile/offer chart is packaged.

The TB group displays source-workbook TU/XPN/EFX separately from previously
returned scores, with prior eligible/declined/pending products and pricing/reasons.
The chart observation date is **2026-11-02**, from prior GRI QA screening with
secondary occupancy, 50k request, 70k mortgage, 250k income and assumed DOB1980.
Editing inputs or changing tenants may change outcomes. **Reference only, not
current results, a new baseline, or eligibility approval.** All40 are included:
TB-007 has no usable returned credit and TB-026 retains waiting/pending products.
Products are not expectations of card/row order. Zero and unavailable scores or
pricing are distinct; unavailable values are not silently converted to zero.

The existing lab behavior is preserved:

- SF-12 uses the user-authorized DOB 1950-01-01 and Retired SSI / Social Security;
  the original source DOB remains in the dataset and visible source notes.
- SF-22 originally has no request. Its user-authorized generated input stays
  age 17 on load/queue, with explicit notes; it is not captured customer data.
- These two adjustments are not new replacements introduced by this package.
- All 165 cases are selectable. No copied expected response decides lab PASS:
  live UI/API consistency is checked, not assumed workbook pricing/eligibility.
- IR profile/DOB/provenance notes are shown when loaded. The IR workbook has
  no DOB; dates are assumptions or documented age-specific scenario variations.
  For custom PRIMARY occupancy, enter any valid subject address. Validation
  maps it to borrower residence automatically in tables, JSON and preview.
  Before validation the prior residence can still be visible; no manual
  matching is required. Secondary/investment residences are not remapped.
- Old Fannie Mae credit/offer baselines are not used for replacement IR cases.
  The separate automated workbook suite keeps existing baselines for the first
  50 cases; replacement cases explicitly compare actual UI/API pending approved
  new baselines. The earlier 40-profile screening does not certify different
  financial variations or other tenants.
- The runtime also checks the approved scenario-slot/profile/source-row mapping,
  DOB provenance and PRIMARY subject/residence mapping before catalog loading.

## Run a suite and inspect every result

1. Under **Run a scenario suite**, choose the tenant and scenario group.
   Suite/inquiry tenant selectors stay synchronized.
2. Check the scenarios you want, or select the group. No Ctrl/Cmd multi-select.
3. Review the requests and confirm authorized QA execution, then run.
4. Use **Open all suite results in a new tab** to view every completed case,
   all offers/declines, actual JSON, identifiers, logs and screenshots.

Suites run sequentially and stop on the first failure. Stop-after-current never
interrupts an inquiry; interrupted work is not automatically retried/resumed.
Saved suite runs are execution history, not reusable named suite definitions.

Fresh QA emails are enabled by default. For approved same-email scenarios such
as SF-21, turn that option off deliberately. Every live run requires QA
authorization and can create QA inquiries/applications. It does not select an
offer, fund a loan or send offers to a borrower.

Save edited inputs as new templates; originals are never overwritten.
**Reset / New run** clears the workspace but preserves saved history/templates.
Retired SSI is the observed Navigator label, not certification of federal SSI
eligibility.

## Local data and troubleshooting

Templates: `test-data/solution-finder/workbook-scenarios/lab-templates/`.
Results/screenshots: `test-results/<date>/solution-finder/lab/`.
Restrict access to this folder and follow company retention rules. Never
redistribute a used folder containing additional saved evidence/auth data.

- Still see only five/zero cases: stop the old server and start this
  **internal-165** v1.4.1 ZIP from its new extraction folder, then refresh.
  Legacy original125 archives stay 125-case editions; do not overlay them.
- Port in use: finish/stop the older lab, or use another port:
  PowerShell `$env:SF_LAB_PORT = "4181"; npm start`;
  macOS/Linux `SF_LAB_PORT=4181 npm start`.
- Missing dependencies/browser: run `npm ci` and `npm run setup`.
- QA access failure: check VPN and application permissions. Do not disable
  company security controls to work around blocked downloads/access.

## Work history

### 2026-11-02 - Internal165 v1.4.1 load-action serialization

- Packages the parent-supplied fix for overlapping Load/selection actions.
  Parent reports a passing deterministic gated HTTP browser regression.
- Historical references and all165 catalog inputs are unchanged. This patch
  does not add baselines, authorize inquiries or alter prior observations.
- Extract into a new folder; finish active work before stopping an older lab.
  Clean extraction/runtime verification is performed by the release maintainer.

### 2026-11-02 - Internal165 v1.4.0 historical chart reference

- Added a fourth sanitized reference JSON, joined by all40 canonical IDs,
  source names/last-four and expected scores before identity fields are removed.
- Catalog startup validates reference schema/count/IDs/last-four/source scores;
  no raw workbook is needed at runtime. Previous125 and synthetic5 editions
  do not read the added profile/reference datasets.
- Source and returned scores remain distinct; all120 prior offers preserve
  eligible/declined/pending observations, pricing and reasons without identifiers.
- Focused importer/startup/isolation tests pass (27 tests). The extraction
  verifier checks all40 panels, source/returned labels, unordered offer details,
  and dropdown/suite summaries. Final ZIP verification is a separate gated step.
- No live inquiries, new baselines, credit/eligibility approval or OS certification.

### 2026-11-02 - Internal165 v1.3.0, separate all40 normalized profiles

- Added the independently selectable all40 group, with ID/full name visible
  only in UI/input, assumed DOB and normalized financial-source notes.
- Preserved all125 built-ins; no screening filter or copied response baselines.
  Added only the allowlisted last-four JSON, not the full-SSN source workbook.
- Clean extraction checks all165 loads/previews/notes/suite choices, isolated
  dependency restore, offline suite/report and compiled worker discovery.
  Custom PRIMARY coverage checks nonmutation, mapped preview/JSON/residence,
  saved copies and offline launch input.
- Default synthetic edition stays five with no private datasets. No live
  inquiries or pricing/DOB certification; macOS only, other OS not certified.
  Existing ZIPs/servers are managed separately by the parent.

### 2026-11-02 - Tri-Bureau IR profile replacement

- Replaced the Fannie Mae borrower data in NSF-051 through NSF-102 with the
  supplied IR profiles. Kept the first 50 inquiries, original 23, scenario IDs
  and financial variations; do not interpret this as a new live validation
  of all replacement variations.
- This distribution uses the updated repository datasets. Earlier private
  ZIPs contained the previous profile revision and must not be reused.
- Live interactions still fill/verify UI fields, enter only SSN last-four,
  click Submit, capture the actual API response and compare rendered offers.
  This is not API-only execution.

### 2026-11-02 - Actual 125-case standalone catalog

- The user explicitly requested the actual original catalog, not synthetic
  substitutes. Added an opt-in internal edition with unchanged original 23 and
  additional 102 datasets and the same documented lab adjustments.
- The launcher selects the packaged catalog even if an old portable environment
  variable remains set. Missing/corrupt datasets fail instead of hiding cases.
- Verification checks exact source bytes, all 125 visible/loaded/previewed inputs,
  suite availability, isolated dependency install, template restart, offline
  suite/report/reset and compiled worker discovery. No live inquiries submitted.
- Credentials, account registries, original spreadsheets, prior templates/runs
  and unrelated framework files remain excluded.

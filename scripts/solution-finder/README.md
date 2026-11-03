# Solution Finder narrow screening tooling

Existing lab tooling is under [lab/](lab/README.md). The Tri-Bureau 40 helper is separate from the lab queue and makes no backend submissions.

- `tri-bureau-40.cjs`: installed XLSX importer, source hashing, actual-evidence HTML/JSON report builder and pure FICO/discovery/Figure-label checks.
- `import-ir-profile-reference.cjs`: imports the provided IR chart into sanitized
  `profile-reference.json`; historical selection context only, no submissions.
- [IR test scripts](../../tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/): existing browser screening plus normalization, chart-reference import and lab-display tests. Reuse this folder; do not duplicate the live screening specs.
- `tri-bureau-40-validate.cjs`: local-browser report/image validation and evidence/submission checks. Creates diagnostics only inside this run results root; no server or remote uploads.

Commands from repository root:

```bash
node scripts/solution-finder/tri-bureau-40.cjs import
node --require ts-node/register --test tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/*.test.cjs
npm run import:solution-finder:ir-reference
node --require ts-node/register scripts/solution-finder/tri-bureau-40.cjs report
node scripts/solution-finder/tri-bureau-40.cjs table
node scripts/solution-finder/tri-bureau-40-validate.cjs
```

All evidence resolves under `test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/`. Runner commands/authorization limitations are in the [spec README](../../tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/README.md). Never repeat live commands in this already-attempted run; a future separately authorized screening needs a reviewed new results destination, not retries/resume. Report regeneration/validation is read-only with respect to inquiries.

Chart-reference lab verification instead lives under
`test-results/2026-11-02/solution-finder/lab-verification/ir-chart-reference/`.

## 2026-11-02 - Sanitized chart-reference import

- Request: expose the supplied IR chart as historical lab selection context.
  Import joins all40 profiles, keeping source TU/XPN/EFX separate from returned
  scores, credit Y/N and120 product records (63 eligible/55 declined/2 pending),
  including pricing/reasons. Output retains SSN last four only; no raw chart
  or full SSNs in the internal package.
- All IR tests now live in the existing tri-bureau-40 spec folder; utilities
  remain here. The completed `screening.spec.ts` is reused, not duplicated/rerun.
  Import alias: `npm run import:solution-finder:ir-reference`.
- Validation supplied:93/93 lab checks, scoped typecheck/JS syntax and live
  all40-row/120-product comparison passed with zero POSTs/page errors.
  Corrected probe waits for HTTP completion and normalizes mixed cell types/
  missing-value labels. Clean v1.4.1 extraction verified165 inputs/40 references,
  dataset isolation/persistence/offline suite/worker discovery.
- Limitation: historical data is not a current offer, guarantee or baseline;
  existing inputs and financial approval status remain unchanged.

## 2026-11-02 - IR offline script and test synchronization

- Added root npm aliases `report:solution-finder:ir`,
  `table:solution-finder:ir` and `validate:solution-finder:ir`; these operate on
  completed evidence only, never submit inquiries.
- Included all seven IR checks in the existing combined unit commands.
  Table tests now use controlled normalized-profile inputs instead of requiring
  ignored historical response files or treating observed outcomes as baselines.
  Source-identity audit is explicitly skipped when its restricted workbook is
  not installed; it still runs here against the supplied workbook.
- 62 combined unit checks and scoped typecheck passed; simulated missing-local
  evidence passed with one explicit source-audit skip. Existing source/profile
  table and all40 execution records remain unchanged.

## 2026-11-02 — Narrow all-40 offer discovery

- Request: actual browser-submitted offers/declines and readable per-profile evidence without lab fail-fast skips or automatic duplicate submissions.
- Decision: reuse `runScenario(compareWorkbook:false)`, not a backend submission script. Discovery is separate from consistency PASS; missing/invalid/ambiguous responses are errors, not denial/pass. FICO comparisons use only actually returned bureau values. Figure HELOC-to-HELOAN relabeling is an independent consistency failure, never normalized away.
- Changes: importer/report helper, five focused unit checks and local report/evidence validator. Source workbook and existing datasets/specs/distribution remain unchanged.
- Validation: five focused checks and 12 canonical UI/API comparison tests passed; scoped Solution Finder typecheck and root guard passed. Final execution/link counts are appended after completion.
- Limits: missing DOB/contact inputs, one tenant/one setup, last-four SSN lookup; returned route names do not independently certify lender underwriting or pricing.

### Completed execution / validation evidence

- Both authorized browser phases completed: 40/40 attempted, 40 actual single POST submissions, 40 unique inquiry IDs/fresh QA emails, zero blocked/unexecuted profiles; no retries or repeat inquiries.
- Discovery: 30 offer-positive profiles, 63 eligible offers (17 HELOAN, 23 variable-rate HELOC, 23 fixed-rate HELOC); 10 profiles returned no eligible offers under this setup. All 40 UI/API consistency checks passed; zero Figure relabeling discrepancies observed (no claim that the known defect was fixed).
- Returned FICO comparisons: 27 matching bureau pairs, 40 differing pairs, 53 not comparable, including unreturned Equifax. These data differences are not hidden by UI/API PASS and are routed to PM/data owners for review; missing DOB limits identity conclusions. Generic no-match is not definitive ineligibility.
- Final validation: all 400 evidence references existed/nonempty, all 40 screenshots decoded in a local browser, source workbook checksum unchanged; five narrow plus 12 canonical comparison unit checks passed, scoped typecheck/root guard passed, no-repeat pre-cleanup guard preserved earlier evidence. Local README links and owned-source whitespace checks passed.
- Reports: `test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/index.html` and `summary.json`; link/image validation and two browser previews are under `validation/final/` in the same run.
- Handoff: PM should review workbook-versus-returned bureau differences and assumed-DOB/no-match limitations. No shared infrastructure blocker or confirmed UI/API defect remained. Existing 125 inputs/specs, the standalone ZIP, detached lab and unrelated worktree changes were not modified. Root/framework/memory synchronization is left to the parent handoff as requested.

### 2026-11-02 - Source-column credit/offer table

- Request: tabulate First/Middle/Last/Street/City/State/Zip/SSN/TU/XPN/EFX with
  actual offers and credit-return Y/N. Added the offline `table` command and
  pure source/result join; all 40 rows are included, including the N result.
- Outputs are `profile-offer-table.xlsx` and `profile-offer-table.html` in the
  existing run results folder. Excel includes Profile Results, Offer Details
  and Read Me sheets; HTML has sticky headers and links to original screenshots.
  Requested full SSNs appear only in restricted exports, not input registries,
  console logs or documentation. Do not publish these files.
- Kept original expected scores separate from returned scores; listed eligible
  offers separately from declines/pending products. Pending is not a denial.
  Preserved ZIP/SSN leading zeros and source workbook bytes.
- Validation: seven focused tests and scoped typecheck passed; all 40 x 19
  workbook/browser cells matched, 120 product records were exported, credit
  totals were 39 Y / 1 N. Source unchanged; no new live inquiries submitted.
  Browser preview/validation is under `validation/profile-table/` in the run.

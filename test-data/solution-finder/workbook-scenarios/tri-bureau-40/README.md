# Tri-Bureau 40 screening inputs

Restricted QA inputs normalized from `../../Tri-Bureau_TestCases_40_IR.xlsx` Sheet1, all 40 rows. The workbook is read-only and SHA-256 checked. `profiles.json` preserves exact First/Middle/Last and borrower residence; ZIP and SSN digit normalization preserves leading zeros. Only last-four SSN is retained/submitted; Navigator does not accept full SSN.

## Consistent offer-friendly setup

Secondary occupancy preserves workbook residence separately from the unchanged SF-1-Original subject property. Requested loan $50,000; existing mortgage $70,000; full-time annual income $250,000. SF-1 residence-start date is retained. No DOB/email/phone exists in the workbook: DOB **1980-01-01 is assumed, NOT verified bureau identity**; use controlled fresh QA emails and a fictional QA phone as specified in fixture assumptions. No synthetic identity replacements or age-driven DOB modifications. N/A bureau scores become null/not comparable; unreturned Equifax is never a mismatch. Generic no-match does not establish definitive borrower ineligibility.

Importer: `node scripts/solution-finder/tri-bureau-40.cjs import` (from root). Import reads source only and must not be used to rewrite a reviewed fixture during execution. Actual evidence is never written here.

## Historical chart reference

`profile-reference.json` is the sanitized join from the provided
`IR_profile-offer-table.xlsx`, imported with
`npm run import:solution-finder:ir-reference`. It adds context to all40 existing
lab controls, not new scenarios. It separates source TU/XPN/EFX from actually
returned scores, credit Y/N and120 products (63 eligible/55 declined/2 pending)
with pricing/reasons. Only SSN last four is retained; the raw chart/full SSNs
are not packaged. Historical products are not current/guaranteed offers or
approved eligibility/pricing baselines. Generated evidence belongs in
`test-results/`, never here.

## 2026-11-02 - Sanitized historical chart reference

- Added the40-profile chart join while preserving existing normalized inputs
  and165-case lab inventory. Internal v1.4.1 packages four sanitized catalog/
  reference JSONs; synthetic5 and legacy125 remain isolated.
- Validation supplied:93/93 lab checks, scoped typecheck/JS syntax and live
  all40 source rows/120 product counts passed, with zero POSTs/page errors.
  Clean extraction verified165 inputs/40 references, integrity, isolation,
  persistence, offline suite and worker discovery.
- No source screening rerun, identity certification or new financial baseline.

## 2026-11-02 — Authorized all-row browser discovery

- Request: independent live GRI QA screening of all 40 workbook profiles with actual offers/declines, FICO and UI/API evidence.
- Decision: fixed secondary/SF-1 setup isolates workbook identity; missing DOB makes identity/credit-match conclusions limited. Bureau N/A cells are explicit non-comparisons.
- Changes: reproducible normalized fixture, exact identity/residence checks and source checksum; no edits to workbook or existing 125 cases.
- Validation: focused preservation/normalization/classification checks passed; final execution and link validation are recorded in the linked spec history/report.
- Scope: one tenant/one setup, last-four lookup, assumed DOB/contact inputs; no verified eligibility certification.

### Completed execution / validation evidence

- Both authorized browser phases completed: 40/40 attempted, 40 actual single POST submissions, 40 unique inquiry IDs/fresh QA emails, zero blocked/unexecuted profiles; no retries or repeat inquiries.
- Discovery: 30 offer-positive profiles, 63 eligible offers (17 HELOAN, 23 variable-rate HELOC, 23 fixed-rate HELOC); 10 profiles returned no eligible offers under this setup. All 40 UI/API consistency checks passed; zero Figure relabeling discrepancies observed (no claim that the known defect was fixed).
- Returned FICO comparisons: 27 matching bureau pairs, 40 differing pairs, 53 not comparable, including unreturned Equifax. These data differences are not hidden by UI/API PASS and are routed to PM/data owners for review; missing DOB limits identity conclusions. Generic no-match is not definitive ineligibility.
- Final validation: all 400 evidence references existed/nonempty, all 40 screenshots decoded in a local browser, source workbook checksum unchanged; five narrow plus 12 canonical comparison unit checks passed, scoped typecheck/root guard passed, no-repeat pre-cleanup guard preserved earlier evidence. Local README links and owned-source whitespace checks passed.
- Reports: `test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/index.html` and `summary.json`; link/image validation and two browser previews are under `validation/final/` in the same run.
- Handoff: PM should review workbook-versus-returned bureau differences and assumed-DOB/no-match limitations. No shared infrastructure blocker or confirmed UI/API defect remained. Existing 125 inputs/specs, the standalone ZIP, detached lab and unrelated worktree changes were not modified. Root/framework/memory synchronization is left to the parent handoff as requested.

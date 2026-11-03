# Tri-Bureau 40 independent browser screening

## Chart-reference tests and lab metadata

All IR-specific test scripts live in this existing workbook scenario folder:
`screening.spec.ts` is the already-executed live suite; `tri-bureau-40.test.cjs`
is the moved normalization/table unit suite, not a duplicate.
`profile-reference.test.cjs` checks chart import/joins and
`lab-profile-reference.test.cjs` checks all40 source/returned credit values and
prior offers in the lab without creating inquiries.

```bash
node --require ts-node/register --test tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/*.test.cjs
npm run import:solution-finder:ir-reference
```

The provided IR chart is selection context only: expected/source scores differ
from returned scores. Eligible, declined and pending products stay distinct.
The lab shows only SSN last four; it never packages the full-SSN spreadsheet.
Prior offers are not new-run results, nor approved price/eligibility baselines.
Do not rerun the completed browser phases just to refresh this metadata.

## 2026-11-02 - Chart context without repeat screening

- Request: use the provided IR chart as lab selection context for the existing40
  controls, without adding cases or rerunning the completed live screening.
  All IR test scripts remain here: moved normalization/table unit test,
  importer/runtime tests and lab browser test; utilities remain in scripts.
- Sanitized references distinguish source TU/XPN/EFX from returned scores,
  credit Y/N and120 products (63 eligible/55 declined/2 pending), pricing and
  reasons. Labels expose SSN last four only. No raw chart/full SSNs packaged.
- Validation supplied:93/93 lab checks, scoped typecheck/JS syntax, all40/120
  localhost comparisons with zero POSTs/page errors, deterministic pending-action
  gate regression and clean internal165 package verification passed.
  Probe HTTP waits and mixed cell normalization were corrected before success.
- References are historical, never new results, guaranteed offers or approved
  baselines; identity/DOB limitations and no-repeat guards remain unchanged.

This is a narrow additive 40-row screening set, not a replacement for the existing original23/workbook102 suites or the user lab. It uses the existing `runScenario` browser flow with `compareWorkbook:false`, fresh Playwright page/context per profile, checkpoint-gated interactions, one worker, zero retries and `maxFailures:0`. Each failure stops only that profile. No order assertions; no manufactured offers.

## Authorized execution (already attempted phases must NOT be rerun)

```bash
TB_PHASE=preflight SF_TENANT=gri npx playwright test --config=tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/playwright.config.ts
TB_PHASE=remaining SF_TENANT=gri npx playwright test --config=tests/projects/solution-finder/workbook-scenarios/tri-bureau-40/playwright.config.ts
```

Preflight selects TB-001; remaining selects TB-002 through TB-040. GRI QA intake only: `https://falcon.qa.fsp.rate.com/inquiry/intake/?playwright=true`. The configuration rejects already-attempted phases before Playwright can clean the phase output directory. Do not bypass that guard. Future separately authorized execution requires a reviewed new evidence destination, not resume/retry.

Actual POST tracking is persisted at request dispatch even if no response returns. All screenshots/source/JSON/diagnostics remain under `test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/`; separate preflight/remaining artifacts prevent output cleanup of earlier profiles. Restricted reporter prints only profile IDs/status/counts, not worker errors or raw inputs. Report links actual request/response, all eligible offers/explicit declines, inquiry IDs, FICO comparisons, consistency differences and viewable images.

Setup: secondary occupancy, unchanged SF-1 subject property, workbook borrower residence, $50,000 loan / $70,000 existing mortgage / $250,000 full-time income. DOB 1980-01-01 is **assumed**, not verified bureau identity; fresh controlled QA email and fictional QA phone are documented in input assumptions. No identity replacements, no offer baseline. No-match may reflect missing DOB/last-four lookup rather than definitive ineligibility. Equifax not returned is not a mismatch. See [inputs](../../../../../test-data/solution-finder/workbook-scenarios/tri-bureau-40/README.md).

## 2026-11-02 — All-row live GRI screening

- Request: preflight one, then all remaining independent profiles, actual offer/decline evidence, separate discovery/consistency outcomes, without retry/resume or interference with the detached lab.
- Changes: additive spec, isolated config and restricted reporter; browser submission tracking and per-step checkpoints reuse the canonical flow. Preflight returned three eligible offers and passed UI/API consistency.
- Validation: scoped typecheck passed; five narrow unit checks and 12 canonical comparison checks passed. Final run/evidence counts follow completion.
- Limitations: one tenant/one offer-friendly setup, assumed DOB and QA contacts, only last-four SSN; UI/API consistency is not eligibility/pricing certification. No application code was changed.

### Completed execution / validation evidence

- Both authorized browser phases completed: 40/40 attempted, 40 actual single POST submissions, 40 unique inquiry IDs/fresh QA emails, zero blocked/unexecuted profiles; no retries or repeat inquiries.
- Discovery: 30 offer-positive profiles, 63 eligible offers (17 HELOAN, 23 variable-rate HELOC, 23 fixed-rate HELOC); 10 profiles returned no eligible offers under this setup. All 40 UI/API consistency checks passed; zero Figure relabeling discrepancies observed (no claim that the known defect was fixed).
- Returned FICO comparisons: 27 matching bureau pairs, 40 differing pairs, 53 not comparable, including unreturned Equifax. These data differences are not hidden by UI/API PASS and are routed to PM/data owners for review; missing DOB limits identity conclusions. Generic no-match is not definitive ineligibility.
- Final validation: all 400 evidence references existed/nonempty, all 40 screenshots decoded in a local browser, source workbook checksum unchanged; five narrow plus 12 canonical comparison unit checks passed, scoped typecheck/root guard passed, no-repeat pre-cleanup guard preserved earlier evidence. Local README links and owned-source whitespace checks passed.
- Reports: `test-results/2026-11-02/solution-finder/workbook-scenarios/tri-bureau-40/gri/tri-bureau-40-20261102T2135Z/index.html` and `summary.json`; link/image validation and two browser previews are under `validation/final/` in the same run.
- Handoff: PM should review workbook-versus-returned bureau differences and assumed-DOB/no-match limitations. No shared infrastructure blocker or confirmed UI/API defect remained. Existing 125 inputs/specs, the standalone ZIP, detached lab and unrelated worktree changes were not modified. Root/framework/memory synchronization is left to the parent handoff as requested.

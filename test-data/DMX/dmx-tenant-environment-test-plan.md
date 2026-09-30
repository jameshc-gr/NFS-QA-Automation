# DMX Tenant and Environment Entry Test Plan

## Objective

Verify that the provided DEV and PROD tenant URLs resolve to the expected application host, tenant brand, entry route, and visible start controls. This suite is a read-only smoke check. It must not select a loan purpose, enter applicant data, register accounts, submit applications, or create loans.

## Sources and constraints

- DEV tenant list and employee IDs were supplied by the user on 2026-09-30.
- PROD tenant URLs and employee IDs were supplied by the user on 2026-09-30.
- Tenant/flow names for both sets are taken from the supplied dashboard screenshots.
- `GRA PROD` is unavailable and is omitted.
- Owning DEV and OP now have separate user-confirmed URLs: Owning uses `apply-owning.dev.saas.rate.com?emp-id=100000029`; OP uses `apply-op.dev.saas.rate.com/apply/loan-purpose?emp-id=921`.
- PROD entry smoke only: never launch loan creation against PROD.
- Loan creation through the dashboard remains restricted to validated GRI Enhanced DEV / LO-B until tenant-specific end-to-end loan flows have owner approval and separate verification.

## DEV test targets

| Target | Entry URL | Expected brand/flow | Observed entry |
| --- | --- | --- | --- |
| Certainty | `https://apply-certainty.dev.saas.rate.com/?emp-id=100000073` | Certainty Home Lending | `/apply/loan-purpose` |
| Citywide | `https://apply-cwhm.dev.saas.rate.com/?emp-id=100000088` | Citywide Home Mortgage | `/apply/loan-purpose` |
| GRA | `https://apply-gra.dev.saas.rate.com/?emp-id=12075` | Guaranteed Rate Affinity | `/apply/loan-purpose` |
| GRI Original | `https://apply-gri.dev.saas.rate.com/?emp-id=4723&ef=0` | Rate, Original Flow | `/apply/loan-purpose` |
| GRI Enhanced | `https://apply-gri.dev.saas.rate.com/?emp-id=4723` | Rate, Enhanced Flow | `/apply/loan-purpose` |
| GRI EF PVP LO | `https://apply-gri.dev.saas.rate.com/?emp-id=12657` | Rate, PVP LO Enhanced Flow | `/apply/loan-purpose` |
| KBHS | `https://apply-kbhs.dev.saas.rate.com/?emp-id=921` | KBHS Home Loans | `/apply/loan-purpose` |
| OnQ | `https://apply-qhl.dev.saas.rate.com/?emp-id=100000090` | On Q Home Loans | `/apply/loan-purpose` |
| OP | `https://apply-op.dev.saas.rate.com/apply/loan-purpose?emp-id=921` | OriginPoint | `/apply/loan-purpose` |
| Owning | `https://apply-owning.dev.saas.rate.com/apply/loan-purpose?emp-id=100000029` | Owning | `/apply/loan-purpose` or `/apply/express-loan` |
| Premia | `https://apply-premia.dev.saas.rate.com?emp-id=921` | Premia Mortgage | `/apply/loan-purpose` |

## PROD test targets (read-only)

| Target | Entry URL | Expected brand/flow | Observed entry |
| --- | --- | --- | --- |
| Certainty | `https://apply.certaintyhomelending.com/apply/loan-purpose?emp-id=33117` | Certainty Home Lending | not yet verified |
| Citywide | `https://apply.citywidehm.com/?emp-id=36067` | Citywide Home Mortgage | not yet verified |
| GRI Original | `https://apply.rate.com/?emp-id=4723&ef=0` | Rate, Original Flow | not yet verified |
| GRI Enhanced | `https://apply.rate.com/apply/loan-purpose?emp-id=4723` | Rate, Enhanced Flow | not yet verified |
| KBHS | `https://apply.kbhshomeloans.com/apply/loan-purpose?emp-id=921` | KBHS Home Loans | not yet verified |
| OnQ | `https://apply.onqhomeloans.com/?emp-id=36704` | On Q Home Loans | not yet verified |
| OriginPoint | `https://apply.originpoint.com/?emp-id=927` | OriginPoint | not yet verified |
| Owning | `https://apply.owning.com/?emp-id=32873` | Owning | `/apply/express-loan` observed in initial PROD exploration |
| Premia | `https://apply.premiarelocationmortgage.com/?emp-id=927` | Premia Mortgage | not yet verified |

## Test cases

1. Resolve exact target URL and expected hostname. Fail on redirect to an unrelated marketing site or unexpected tenant host.
2. Verify application `<main>` is visible and document title includes the configured tenant brand.
3. Verify the expected entry route; allow known SPA redirects (Owning PROD to `/apply/express-loan`).
4. Verify visible first-page controls. For standard tenants, verify Purchasing and Refinancing choices are visible without selecting either. GRI GEF/PVP and PROD target availability is tracked in target config; unavailable targets are never queued.
5. Record requested URL, landed URL, title, route, duration, and screenshot.
6. Mark a successful check `entry-ready`, explicitly recording `loanCreated: false`.
7. Never type applicant information, click Continue, create credentials, select products, or submit.

## Current verification status

- Automated target catalog contains 20 entries, with 20 enabled for checks; GRA PROD is absent. `DMX_ENTRY_TARGET_ID` filters the spec to one selected target for the dashboard.
- Read-only DEV browser exploration confirmed the supplied DEV hosts/employee IDs and the expected loan-purpose page for Certainty, Citywide, GRA, GRI Original, GRI Enhanced, GRI PVP, KBHS, OnQ, OP, and Premia. The automated Certainty DEV check passed in Chromium without selecting loan purpose or creating a loan. The remaining 18 enabled targets have not all been executed by the new suite.
- Owning DEV and OP target definitions are separated using the latest user-provided URLs; both remain read-only entry checks.
- Read-only PROD exploration verified the application brand and entry host for Certainty, Citywide, GRI enhanced/original, KBHS, OnQ, OP, Owning, and Premia with the supplied employee IDs. GRI Enhanced resolves to `/apply/express-loan`; Owning resolves to `/apply/express-loan`; other verified targets resolve to `/apply/loan-purpose`. GRA PROD is unavailable per user. No PROD form interaction was performed.
- No tenant loan creation has been validated by this plan.

# Student IDR Test Data

This directory contains the source-of-truth test data for the Student IDR (Income-Driven Repayment) UI automation suite.

## Files

| File | Purpose |
|------|---------|
| [student-IDR.yml](student-IDR.yml) | Centralized profile data for all IDR scenarios |
| [01_field_matrix.csv](01_field_matrix.csv) | Field inventory per page (from QA walkthrough) |
| [02_scenario_matrix.csv](02_scenario_matrix.csv) | Persona scenarios driving the regression suite |
| [03_test_cases.csv](03_test_cases.csv) | Detailed test intents and expected results |
| [04_final_test_cases_with_data.csv](04_final_test_cases_with_data.csv) | Final executable case matrix with profile and input data references |

## Profile structure

`student-IDR.yml` supports two levels of values:

1. **Base values** — used when no scenario override exists.
2. **Scenario overrides** — keys suffixed with `_SCN-XXX` are loaded automatically when a spec calls `loadProfile('SCN-XXX')`.

Example:

```yaml
FIRST_NAME: "Alex"
FIRST_NAME_SCN-002: "Marcus"
EMAIL_SCN-002: "marcus.older@yopmail.com"
```

At runtime, the framework also appends a sequential per-worker number to every email address and varies the password, so no two test runs reuse the same credentials.

## Scenario coverage

| Scenario | Persona | Spec file | Status |
|----------|---------|-----------|--------|
| SCN-001 | Alex single moderate income | [SCN-001.spec.ts](../../tests/projects/student-IDR/SCN-001.spec.ts) | Full flow (needs auth) |
| SCN-002 | Marcus older IBR high income | [SCN-002.spec.ts](../../tests/projects/student-IDR/SCN-002.spec.ts) | Full flow (needs auth) |
| SCN-003 | Elena low income RAP | [SCN-003.spec.ts](../../tests/projects/student-IDR/SCN-003.spec.ts) | Full flow (needs auth) |
| SCN-004 | Priya PAYE mapping | [SCN-004.spec.ts](../../tests/projects/student-IDR/SCN-004.spec.ts) | Full flow (needs auth) |
| SCN-005 | Jordan no loans | [SCN-005.spec.ts](../../tests/projects/student-IDR/SCN-005.spec.ts) | Full flow (needs auth) |
| SCN-006 | Sam very low income | [SCN-006.spec.ts](../../tests/projects/student-IDR/SCN-006.spec.ts) | Full flow (needs auth) |
| SCN-007 | Casey very high debt | [SCN-007.spec.ts](../../tests/projects/student-IDR/SCN-007.spec.ts) | Full flow (needs auth) |
| SCN-008 | Taylor long forbearance | [SCN-008.spec.ts](../../tests/projects/student-IDR/SCN-008.spec.ts) | Full flow (needs auth) |
| SCN-009 | Avery married joint both borrowers | [SCN-009.spec.ts](../../tests/projects/student-IDR/SCN-009.spec.ts) | Full flow (needs auth) |
| SCN-010 | Blake married separate applicant debt | [SCN-010.spec.ts](../../tests/projects/student-IDR/SCN-010.spec.ts) | Full flow (needs auth) |
| SCN-011 | Chris married joint spouse no savings | [SCN-011.spec.ts](../../tests/projects/student-IDR/SCN-011.spec.ts) | Full flow (needs auth) |
| SCN-012 | Dana paid off early | [SCN-012.spec.ts](../../tests/projects/student-IDR/SCN-012.spec.ts) | Full flow (needs auth) |
| SCN-013 | Elliot PSLF attested | [SCN-013.spec.ts](../../tests/projects/student-IDR/SCN-013.spec.ts) | Full flow (needs auth) |
| SCN-014 | Frank high return sensitivity | [SCN-014.spec.ts](../../tests/projects/student-IDR/SCN-014.spec.ts) | Full flow (needs auth) |
| SCN-015 | Grace zero savings | [SCN-015.spec.ts](../../tests/projects/student-IDR/SCN-015.spec.ts) | Full flow (needs auth) |
| SCN-016 | Signup edge - weak password | [SCN-016.spec.ts](../../tests/projects/student-IDR/SCN-016.spec.ts) | Passing |
| SCN-017 | Signup edge - existing user login | [SCN-017.spec.ts](../../tests/projects/student-IDR/SCN-017.spec.ts) | Smoke (navigates to Okta) |
| SCN-018 | Married toggle back to single | [SCN-018.spec.ts](../../tests/projects/student-IDR/SCN-018.spec.ts) | Full flow (needs auth) |
| SCN-019 | Asset - Plaid linked both spouses | [SCN-019.spec.ts](../../tests/projects/student-IDR/SCN-019.spec.ts) | Full flow (needs auth) |
| SCN-020 | Asset - excluded from tax bomb calc | [SCN-020.spec.ts](../../tests/projects/student-IDR/SCN-020.spec.ts) | Full flow (needs auth) |
| GLOBAL-06 | Invalid email format | [GLOBAL-06.spec.ts](../../tests/projects/student-IDR/GLOBAL-06.spec.ts) | Passing |
| GLOBAL-07 | Terms checkbox unchecked | [GLOBAL-07.spec.ts](../../tests/projects/student-IDR/GLOBAL-07.spec.ts) | Passing |
| UI-FLOW-04-welcome | Missing required fields on welcome | [UI-FLOW-04-welcome.spec.ts](../../tests/projects/student-IDR/UI-FLOW-04-welcome.spec.ts) | Passing |

## Notes

- "Full flow (needs auth)" specs automate the pages from `/forgiveness/welcome` through `/forgiveness/assets`, but currently require a pre-authenticated session because the QA environment redirects newly created accounts to `my.gr-dev.com/dashboard`.
- See [tests/projects/student-IDR/readme-projects.md](../../tests/projects/student-IDR/readme-projects.md) for execution commands and authentication options.
- See [test-results/student-IDR-test-execution-report-2026-07-28.md](../../test-results/student-IDR-test-execution-report-2026-07-28.md) for the latest pass/fail results and Jira-ready bugs.

## Generated credentials and counters

- `student-IDR-counters/`: per-worker counter files used by the email-generation helper to allocate unique email suffixes. Each file is named `email-counter-worker-<N>.txt` and contains a single integer representing the next counter value for that worker.
- Run artifacts containing generated credentials are written to `test-data/student-idr/student-IDR-emails.json`. This file lists the generated `email`, `password`, `runId`, `workerIndex`, `testTitle`, `testFile`, and `createdAt` timestamp for each generated account.

Usage summary:
1. Tests read and update `student-IDR-counters/email-counter-worker-<N>.txt` to reserve a unique suffix for worker `N`.
2. The email helper writes the generated credential to `test-data/student-idr/student-IDR-emails.json` for traceability and post-run analysis.
3. Counters are kept in `test-data/` because they are small, shareable artifacts that may persist across runs.

Maintenance:
- Do not commit `test-results/*.json` files; treat them as ephemeral run artifacts.
- Reset counters by editing the files in `student-IDR-counters/` if you need to reuse email ranges.
- Consider adding a cleanup script to remove generated accounts from shared QA environments.

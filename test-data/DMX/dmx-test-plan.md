# DMX (Digital Mortgage Experience) Test Plan

Entry: `https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=4723` (Loan Officer John Sample, NMLS 12345)
Tenant/environment read-only plan: [dmx-tenant-environment-test-plan.md](dmx-tenant-environment-test-plan.md). Multi-tenant entry checks are isolated from loan creation; all PROD targets are smoke-only.
Handoff milestone (definition of "complete"): `https://my.gr-dev.com/loan/<gr-loan-guid>/overview` showing `Purchase|Refinance #<loanNumber>DEV`, the subject address, the Overview / Tasks / Loan details / Documents tabs and the loan officer, plus a matching loan card on `https://my.gr-dev.com/loans`.
Accounts: `my-dmx-<tag><n>--ra@yopmail.com` / `Test123!`. Every account created is logged to `dmx-created-accounts.csv` (append-only; the last row for an email is its current state).

## 1. Files

| Path | Purpose |
| :--- | :--- |
| `test-data/DMX/dmx-scenarios.yml` | Scenario data: borrowers, co-borrowers, income, assets, property, loan, and the incomplete-loan cases |
| `test-data/DMX/dmx.yml` | Route and field-ID reference for every DMX page discovered |
| `test-data/DMX/dmx-created-accounts.csv` | Registry of every account/loan the tests created |
| `test-data/DMX/Test credit report characteristics Sept 2026.pdf` | Fannie Mae DO/DU test credit borrowers (source of all names/SSNs) |
| `tests/projects/DMX/dmx-engine.ts` | Route-to-handler driver that walks any product to the dashboard (or stops at a route) |
| `tests/projects/DMX/dmx-data.ts` | YAML loader and account registry writer |
| `tests/projects/DMX/dmx-dashboard.ts` | Dashboard, Accounts-card and loan-officer assertions |
| `test-data/DMX/dmx-test-cases.csv` | The 21 test cases (generated from the YAML by `npm run dmx:test-cases`) |
| `tests/projects/DMX/dmx-flows.ts` | Shared runners: complete loan, resume, logout/login resume, entry check |
| `tests/projects/DMX/<test_id>.spec.ts` | One generated spec file per CSV row (21 files) |

Run: `npm run test:dmx:complete`, `npm run test:dmx:resume`, or `npm run test:project:DMX` (about 3-5 minutes per loan; 5 workers).

## 2. Complete applications (each ends on the MyAccount overview)

| ID | Product | Borrower(s) (Fannie Mae test credit) | Profile |
| :--- | :--- | :--- | :--- |
| PUR-01 | Purchase | Ron Tintin | single, good credit, low DTI |
| PUR-02 | Purchase | Ron Tintin | single, high income, $1.4M loan |
| PUR-03 | Purchase | Penny Public | single, high DTI, 5% down |
| PUR-04 | Purchase | Ross Blemished | single, poor credit (595-625) |
| PUR-05 | Purchase | Pitt Rock | single, very poor credit (BK/foreclosure) |
| PUR-06 | Purchase | Alice Firstimer | single, small loan, first-time buyer |
| PUR-07 | Purchase | John + Mary Homeowner | co-borrowers, excellent credit, low DTI, high income |
| PUR-08 | Purchase | Wanna + Needa House | co-borrowers, poor credit, high DTI |
| PUR-09 | Purchase | Patrick + Lorraine Purchaser | co-borrowers, good credit, California |
| REF-01 | Refinance | Ron Tintin | single, rate-and-term |
| REF-02 | Refinance | Homer Loanseeker | single, cash-out, fair credit |
| REF-03 | Refinance | Andy + Amy America | co-borrowers, rate-and-term |
| PRE-01 | Pre-approval | Alice Firstimer | single, first-time buyer |
| PRE-02 | Pre-approval | Dad + Mom Firstimer | co-borrowers |

Assertions per scenario: loan officer attribution on the referral page and dashboard; every DMX step reached without validation dead-ends; dashboard URL, loan number, product label, address and tabs; the Accounts card links to the same loan and shows the same loan number.

## 3. Incomplete applications (resume)

| ID | Abandoned at | Loan |
| :--- | :--- | :--- |
| INC-01 | `user-residence-ef` (after marital status) | purchase |
| INC-02 | `credit-check-consent-borrower-ef` | purchase |
| INC-03 | `add-income-information` | purchase |
| INC-04 | `interest-rate-refi2` | refinance |
| INC-05 | `government-questions-hmda` | purchase with co-borrower |

Each test: register, walk to the stop route, record the account as `incomplete`, close the page, reopen the saved loan URL in the same session, assert it resumes on the same route and same `gr-loan-guid`, finish to the dashboard, assert the Accounts card, record `resumed-complete`.

`INC-01-relogin` additionally calls `/api/logout`, asserts the loan URL now requires Okta login, signs in with the account credentials and finishes the loan.

## 4. Known limits (need a decision, not a code change)

- **MFA on direct MyAccount login.** Logging in from the DMX resume URL works with email + password (covered by `INC-01-relogin`). Logging in directly at `my.gr-dev.com` with a brand-new account showed Okta's "Set up security methods" (phone SMS code) screen, so a real MyAccount login is not automated. Automating OTP retrieval is a new auth provider and needs owner approval per `AGENTS.md`. `INC-01-relogin` still guards against that screen: it skips unless run headed with `DMX_MFA_MANUAL=1` and a person enters the code.
- **Accounts before completion.** `my.gr-dev.com` has no session until the DMX handoff, so an in-progress loan card cannot be inspected in Accounts without a real login; resume is verified through the saved DMX loan URL instead.
- **Not yet covered:** speed-bump behaviour and creating a second/third loan on the same account (starting a new application inside a live DMX session creates a new `gr-loan-guid`, and no speed bump appeared in DMX itself); incomplete cases for pre-approval; other refinance goals (shorten term, add/remove borrower); FHA/VA and self-employed income; military, gift funds and additional-property (REO) branches.
- **Data caveats.** The PDF gives names, SSNs and credit scores only. Birthdates, phones, addresses, employers, incomes and property prices are synthetic and not verified against Zillow. The PDF's "Joint" borrowers are used as joint applications.

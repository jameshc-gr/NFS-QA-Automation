# DMX Maintenance

## 2026-11-13 - Consumer Direct incomplete case

- Request: save the observed No-LO Consumer Direct flow as an incomplete test
  case and make it launchable from the DMX Lab without creating more live loans.
- Decision: add one separate generated category/runner. It signs in to the
  existing MyAccount account at run time, starts from the Profile menu, saves
  initial purchase details, selects **No** for loan-officer relationship and
  exits before credit consent or completion. It does not use account registration
  or the LO entry URL.
- Changes: added a GRI Enhanced DEV-only Lab policy exception for this category;
  all other loan cases remain LO-B-only. Manual MFA is headed and explicit.
  Credentials and loan GUIDs are not retained in the account registry, dashboard
  history, run config or diagnostics; case screenshots/traces/video are disabled.
- Validation: offline DMX regressions passed 21/21; focused TypeScript,
  JavaScript/package syntax, JSON checks and `git diff --check` passed.
  Playwright discovery found one test without executing it, and root-hygiene
  tests passed 7/7.
- Limitation: no live browser, MyAccount login or loan creation was run. The
  direct-flow selectors, account-card assertion and manual MFA experience still
  need an authorized headed DEV validation. `npm run check:root` is blocked by
  the pre-existing root `firebase-debug.log`; it was left untouched.

## 2026-11-14 - Existing-account loan batch retry

- Request: create five saved incomplete and six completed loans through the
  signed-in MyAccount flow for the supplied test account.
- Outcome: verified five active incomplete drafts and one completed loan. One
  separate earlier draft displays an expired application-session notice and is
  not counted as an active incomplete loan. Five requested completed loans
  remain outstanding.
- Changes: completed one application and verified its matching MyAccount
  overview and Accounts card; saved one additional refinance draft and exited
  after its loan record was created. The DMX Loan Lab was not used. No account
  credentials, loan identifiers, or raw browser captures were retained here.
- Validation: the MyAccount Accounts page showed five incomplete cards, one
  completed loan card matching its overview, and one separate expired draft.
  Soft-credit consent was selected for the completed application; hard-pull
  and monitoring consent remained unchecked. `npm run check:root` was run
  after browser-output cleanup but remains blocked by the pre-existing root
  `firebase-debug.log`.
- Remaining limitation: the requested batch is partial (1/6 completed); five
  more completed applications remain.

## 2026-11-13 - Requested account loan batch blocked by network

- Request: create five saved incomplete loans and six completed loans for the
  supplied test account.
- Outcome: no loans were created. The first run failed before the DMX entry
  page loaded because the approved GRI Enhanced DEV endpoint reset connections
  from both Playwright and curl. The local Loan Lab bootstrap remained
  responsive.
- Changes: the temporary runner was removed and the account registry was not
  updated. No account credentials or loan identifiers were added to this
  history.
- Validation: the dashboard exposed the configured 16 complete and 5
  incomplete cases, with GRI Enhanced DEV and LO-B selected. The live entry
  endpoint was unreachable. `npm run check:root` remains blocked by the
  pre-existing root `firebase-debug.log`.
- Evidence: [Playwright run log](../../../test-results/2026-11-13/DMX/manual-account-loans/playwright-run.log).
- Remaining limitation: retry the requested batch when QA DEV network access
  is available.

## 2026-11-13 - Direct MyAccount flow follow-up

- The user clarified that incomplete loans must be created by signing in first,
  opening Profile, choosing **Create a new loan**, then exiting each saved
  application before starting another. The QA agent retried this direct UI flow
  with Playwright, without using the DMX Lab.
- Outcome: MyAccount at `my.gr-dev.com` returned `ERR_CONNECTION_RESET` before
  any page loaded. No credentials were entered, no account was confirmed, and
  no loans were created.
- Evidence: [sanitized direct MyAccount reachability check](../../../test-results/2026-11-13/DMX/profile-account-loans/direct-myaccount-reachability.json).
- Remaining limitation: resume only when the direct DEV host is reachable.

## 2026-11-13 - Direct login stopped at MFA

- The user supplied the direct login URL and authorized use of the existing
  account. The QA agent reached the sign-in security-method checkpoint but
  stopped at MFA before verifying the account or environment.
- Outcome: no loans were created (0/5 incomplete, 0/6 completed). The browser
  context was closed, and no credentials or loan identifiers were added to
  this history.
- Evidence: [sanitized run status](../../../test-results/2026-11-13/DMX/profile-account-loans/profile-account-loans-run.json).
- Remaining limitation: continue only after the account's supported MFA flow
  is completed and the signed-in account/environment can be verified.

## 2026-11-12 - Purchase intent and refinance route coverage

- Request: audit the DMX cases, add Alice Firstimer's single-borrower signed-
  contract purchase and Andy America's single-borrower refinance, and confirm
  the fourth purchase-needs choice is covered.
- Added `PUR-10` and `REF-04`; the purchase intent is explicit in the scenario
  data. The offline fixture includes all four purchase-needs choices and asserts
  that the signed-agreement choice is selected. Pre-approval continues to select
  the affordability/research choice.
- Full-run evidence: 37/43 passed. The run found a shared refinance UI variant:
  the `/apply/property-address-refi2` route rendered the property confirmation
  form instead of address fields. The handler now detects either form; the
  focused rerun passed all five affected refinance cases, including Andy.
- Validation: offline DMX checks passed 16/16; focused engine/data TypeScript
  passed; discovery found 43 tests. The only remaining full-run failure is the
  read-only GRI Enhanced PROD route assertion (`/apply/express-loan` expected,
  `/apply/loan-purpose` observed). No PROD loan was submitted. Root hygiene
  passed after the pre-existing Firebase diagnostic was preserved under
  `test-results/2026-11-12/DMX/maintenance/`.
- Evidence: [initial full-run summary](../../../test-results/2026-11-12/dmx/playwright-summary-1794530682798.md),
  [refinance rerun summary](../../../test-results/2026-11-12/dmx/playwright-summary-1794531647553.md).
- Limits: the full suite was not rerun after the refinance fix; the five
  affected cases were rerun separately with one worker. Credentials and account
  identifiers are intentionally kept out of this history.

## 2026-10-30 - Login and residence reliability

- Request: Repair failing and timing-out DMX scripts without weakening assertions.
- Root causes: Login checked inputs before the widget rendered, used an invalid
  Okta selector and nonserializable browser wait, swallowed manual MFA expiry,
  and treated URL objects as strings. Residence now displays Years*/Months*
  instead of the legacy move-in date input.
- Changes: Wait for rendered login fields, support separate username/password
  screens, verify redirect completion, fail expired manual MFA, and distinguish
  authenticated registration from account creation. Preserve the selected entry
  in registration/dashboard fallback. Convert MM/YYYY residence inputs to elapsed
  years/months while retaining legacy date support.
- Validation: `npm run test:dmx:unit` passed 12/12 intercepted Chromium tests;
  strict focused engine TypeScript and `npm run check:root` passed. The first
  live PUR-01 attempt exposed the residence mismatch. After repair, fresh-account
  GRI Enhanced DEV LO-B PUR-01 passed 1/1 in two minutes, including completed-loan
  and matching Accounts-card assertions.
- Evidence: [live log](../../../test-results/2026-10-30/DMX/maintenance-live-20261031T014721Z-21839/live-run.log).
  Earlier independent [Loan Lab startup checks](../../../test-results/2026-10-30/DMX/login-reliability/qa/qa-summary.json)
  and [read-only DEV entry smoke](../../../test-results/2026-10-30/DMX/login-reliability/smoke-summary.json)
  passed. Lab checks verified 20 enabled cases, three officers and default LO-B.
- Limits: Live existing-account login/MFA and other suites were not verified.
  The offline MFA fixture simulates an operator redirect, not challenge solving.
  No production mutations were performed; account-registry entries were retained.

Run offline checks with `npm run test:dmx:unit`. See the
[root guide](../../../README.md#dmx-digital-mortgage-experience-end-to-end-loans)
for approved DEV live commands and restrictions.
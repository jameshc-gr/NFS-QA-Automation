# DMX Maintenance

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
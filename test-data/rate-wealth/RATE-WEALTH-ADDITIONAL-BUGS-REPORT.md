# Rate Wealth: Zero/Empty Value & Workflow Bug Investigation Report

**Date:** 2026-09-28  
**Environment:** `https://wealth.dev.fitbux.com`  
**Test Suite / Automation:**
- `tests/projects/rate-wealth/goal-input-edge-cases.spec.ts`
- `tests/projects/rate-wealth/goal-type-zero-inputs.spec.ts`
- `scripts/run-goal-matrix.ts`
- Visual Artifacts: `test-results/goal-type-zero/*.png`

---

## Executive Summary

During the investigation and live execution of test scenarios targeting the known **"0-Value Custom Goal"** defect, live testing and automation revealed **multiple additional critical defects and vulnerabilities** across authentication lifecycle, plan builder workflow, UI state management, and input boundary validation.

The original defect was believed to be isolated to custom goals ("Saving for other goal") causing Goal Ranking calculations to hang. Testing revealed that the issue is **architectural and systemic**: client-side validation is completely missing across all non-custom life events/goals, the plan builder navigation flow prematurely dumps users into an incomplete dashboard state, and session tokens exhibit critical SSO redirect loop failures.

---

## Bug Inventory & Detailed Findings

### Bug 1: Pervasive Missing Client-Side Validation Across All Non-Custom Goals (Severity: High)
- **Component:** Goal Builder / Life Events Modals (`/plan-builder`)
- **Observed Behavior:**
  - All non-custom goal forms (13 life event types discovered in the live catalog, including *Buying a Home*, *Getting Married*, *Buying an Investment Property*, *Purchasing a Vehicle*, *Having a Child*, *Moving*, etc.) completely lack client-side numeric validation.
  - On *Buying a Home*, entering `0` in `cost` and `0` in `down` payment displays **no validation error**, no warning indicator, and no requirement for positive amounts (`> 0`).
  - Fields accept empty values or default placeholder `0`s directly into form submission.
- **Impact:** Invalid, impossible financial commitments ($0 home purchase, $0 down payment, $0 wedding) are accepted into the financial model, poisoning calculation matrices downstream.
- **Evidence:** Captured screenshots in `test-results/goal-type-zero/01-getting-married.png` through `09-expected-decrease-in-income.png`.

---

### Bug 2: Premature Plan Exit & Abrupt Redirection on Goal Save (Severity: High)
- **Component:** Plan Setup Flow (`/plan-builder` → `/financial-plans`)
- **Observed Behavior:**
  - When clicking "Save" on a Life Event/Goal (e.g. *Buying a Home* with 0 values), the application abruptly navigates the user away from the active `/plan-builder` wizard to the `/financial-plans` index page.
  - The wizard's subsequent steps (*Day-To-Day Money*, *Money For Future Self*, *Risk Management*, *Emergency Fund*, *Goal Ranking*) are skipped.
- **Impact:**
  - User flow is broken midway through plan configuration.
  - The newly created plan is saved in an orphaned `0% Completed` state on `/financial-plans`.
- **Evidence:** Tested live in `inspectWhereItLand()` script; URL abruptly changed from `/plan-builder` to `https://wealth.dev.fitbux.com/financial-plans` with card showing `0% Completed`.

---

### Bug 3: Incomplete Plan Card State & Inert / Broken Resumption (Severity: High)
- **Component:** Financial Plans Dashboard (`/financial-plans`)
- **Observed Behavior:**
  - Plans created with 0-value goals appear on `/financial-plans` as:
    ```text
    ZeroGoalPlan-...
    0% Completed
    Finish Building Your Plan
    Finish building your plan to view plan projections and start tracking your progress.
    ```
  - When a user attempts to resume by clicking "Finish Building Your Plan", the plan reloads into `/plan-builder`, but navigating forward to "Simulate & Preview plan" displays a modal blocker:
    ```text
    "Complete All Steps: You need to complete all steps before previewing your plan."
    ```
  - The plan setup sidebar steps remain locked or out of sync, preventing normal completion.
- **Impact:** Users are trapped in an unfinishable plan state where the UI instructs them to finish, but the calculation engine cannot simulate projections due to zeroed financial parameters.

---

### Bug 4: Infinite SSO Loop & Short-Lived JWT Desynchronization (Severity: Critical / Infra)
- **Component:** Authentication / Okta SSO Integration (`/home`, `/sso`, `/plan-select`)
- **Observed Behavior:**
  - The JWT access token (`fitBUX-jwt`) in `localStorage` has an exceptionally short expiration window (only ~15 minutes: `iat: 1790642633`, `exp: 1790643533`).
  - While the refresh token (`fitBUX-refresh-jwt`) remains valid for 24 hours, the client-side single-page app fails to perform silent in-flight token refresh upon navigating to protected routes like `/plan-select`.
  - Instead of refreshing transparently, the application triggers a cascade of rapid HTTP 302 redirects back to `login.dev.rate.com/oauth2/.../authorize`.
  - This results in an **SSO redirect loop** (navigating between `/sso?code=...` and Okta authorization), eventually wiping `fitBUX-jwt` from `localStorage` and stranding the user on a blank page or login screen.
- **Impact:** Test automation and real users experience sudden session eviction and white screens during routine navigation between `/home` and `/plan-select`.
- **Evidence:** Network traces captured during test runs logged rapid cycles of 10+ consecutive Okta SSO authorization round-trips within 15 seconds.

---

### Bug 5: Navigation Blockers & Unresponsive Step Transitions in Profile Builder (Severity: Medium)
- **Component:** Profile Onboarding Wizard (`/profile-builder`)
- **Observed Behavior:**
  - During onboarding prior to reaching `/plan-select`, select dropdowns (specifically the profession/occupation combobox and education radio buttons) do not emit change events on click alone; they require forced focus/blur to enable the "Next" button.
  - If a user reaches `/plan-select` without an active completed profile payload, `/plan-select` renders an empty screen without the manual/guided plan cards.
- **Impact:** Causes onboarding abandonment and blocks users from reaching plan selection.

---

## Defect Summary Matrix

| Defect ID | Category | Summary | Severity | Status |
| :--- | :--- | :--- | :--- | :--- |
| **RW-BUG-01** | Validation | 0-value & empty inputs permitted on custom goal ("Saving for other goal") | Critical | Confirmed (Original baseline) |
| **RW-BUG-02** | Validation | All 13 non-custom goal forms completely lack client-side >0 validation | High | Confirmed (Discovered in live DOM) |
| **RW-BUG-03** | Workflow | Saving a life event causes abrupt premature redirect to `/financial-plans` | High | Confirmed (Reproduced live) |
| **RW-BUG-04** | State Mgmt | 0% completed plans cannot preview or simulate ("Complete All Steps" blocker) | High | Confirmed (Reproduced live) |
| **RW-BUG-05** | Auth / SSO | Short JWT expiration (15m) triggers infinite Okta SSO redirect loop | Critical | Confirmed (Captured in network logs) |
| **RW-BUG-06** | UX / Forms | Profile builder comboboxes require forced blur to trigger Next step validation | Medium | Confirmed (Observed in onboarding) |

---

## Recommendations & Next Steps

1. **Implement Global Currency Input Boundaries:**
   - Enforce minimum value boundaries (`min: 1` or `> 0`) on all currency inputs across both custom and non-custom goal modal components.
   - Disable the modal "Save" / "Add Goal" action while numeric values are `0`, empty, or whitespace.

2. **Fix Wizard Flow Redirection:**
   - Saving a goal must return the user to the active `/plan-builder` step list rather than navigating directly to `/financial-plans`.

3. **Silent Token Refresh Middleware:**
   - Configure Axios/Fetch interceptors to intercept 401s or impending token expiration and use `fitBUX-refresh-jwt` to renew `fitBUX-jwt` before triggering navigation to Okta.

---

## 2026-09-30 Re-verification (Playwright suite `rw-01` to `rw-06`)

Each row below is backed by a test in `tests/projects/rate-wealth/`. "Known-defect" tests assert the expected behaviour and are marked `test.fail`, so the suite stays green while the defect exists and turns red ("expected to fail, but passed") when it is fixed.

### Corrections to the earlier inventory

| Earlier ID | Result on 2026-09-30 | Why |
| :--- | :--- | :--- |
| BUG-002 / BUG-007 (`/day-to-day-money`, `/student-loans` redirect to `/home`) | **False positive** | Real routes are `/budget` and `/studentloans`; unknown paths redirect to `/home` by design (`RW-NAV-003/004`). |
| BUG-004 / BUG-005 (Add Transaction / Add Account Manually do nothing) | **Not reproducible** | Both open their dialogs (`RW-TX-002`, `RW-ACCT-003`). |
| BUG-006 (orphaned `euiOverlayMask`) | **Not reproducible** | No overlay remains after closing the dialog (`RW-ACCT-004`). |
| RW-BUG-05 (expired JWT causes Okta loop) | **Not reproduced** | A forged-expired access token is refreshed silently (`RW-AUTH-007`). Re-check if it recurs with a genuinely aged session. |
| RW-BUG-03 (Save on a life event redirects to `/financial-plans`) | **Not reproduced** | The form submits with **Next Step** and stays in the wizard. |
| Goal Ranking blank page / infinite loader for 0-value goals | **Not reproduced** | `Review Plan` shows a "Creating your financial plan" loader for roughly 10-25 s, then the preview (`RW-PLAN-018`, `RW-GOAL-003`). |
| `RW-BUG-02` (no validation on money fields) | **Confirmed, all 14 event types** | 0 and negative amounts are accepted and the wizard advances (`RW-GOAL-002`). |

### New confirmed findings (automated)

| ID | Sev | Finding | Test |
| :--- | :--- | :--- | :--- |
| RW-BUG-07 | Low | `GET /api/tracking/purchase/subscribe.php` returns 500 after the SSO callback | RW-AUTH-008 |
| RW-BUG-08 | Low | "discrepency" misspelled in the registration page translation notice (my.dev.rate.com) | RW-REG-006 |
| RW-BUG-09 | Med | `PATCH /api/v2/actionitem/TRANS_REVIEW` returns 404 on every Transactions load | RW-TX-004 |
| RW-BUG-10 | High | `PUT /api/plan/liabilities.php` returns 500 while stepping through the plan wizard | RW-PLAN-017 |
| RW-BUG-11 | Med | `GET /api/invest/portfolio.php` returns 404 while stepping through the plan wizard | RW-PLAN-017 |
| ACCESS-001 | Med | Phone and mail header icon buttons have no accessible name | RW-NAV-006 |
| ACCESS-003 | Med | "Select plans to compare" checkboxes have no label | RW-PLAN-014 |
| CALC-001 | Med | Home "Financial Net Worth" ($36k) and Snapshot "Net Wealth" ($597k) use near-identical names for different figures | RW-HOME-003 |
| CALC-005 | Med | Plan Budget Overview: $5,417 income - $1,088 household = $4,329, but Available Funds shows $4,327 | RW-PLAN-016 |
| UX-004 | Low | Projected Net Wealth y-axis repeats labels ("$1M, $1M, $1M, $800k") | RW-SNAP-003 |
| ARCH-001 | High | Clicking **Manually** immediately persists a draft plan that counts toward the 3-plan limit, even if the user cancels | RW-PLAN-006 |
| DATA-003 | Med | Plan name is marked required but an empty name advances and is silently named "My Financial Plan" | RW-PLAN-004 |
| DATA-004 | Low | Preview heading reads "Plan 1" instead of the name the user entered | RW-PLAN-019 |
| UX-007 | Low | AI-Powered Assistant card is disabled with no explanation | RW-PLAN-002 |
| UX-008 | Med | **Implement** is enabled on an incomplete plan | RW-PLAN-009 |
| UX-009 | High | **Delete** removes a plan immediately with no confirmation | RW-PLAN-012 |

### New findings observed with Playwright exploration (automated test written in `rw-04`, pending a human-completed MFA session for `my-rw-jc003`)

| ID | Sev | Finding |
| :--- | :--- | :--- |
| DATA-001 | High | Date of Birth accepts a future date (05/20/2030) and 01/01/1900; both save and advance |
| CALC-004 | Med | DOB 01/01/1900 makes the header Wealth Score render `NaN` until reload |
| UX-001 | Low | A 4-digit ZIP is rejected with the generic "This field is required." |
| DATA-002 | Med | Annual salary of $99,999,999,999 is accepted (no upper bound) |
| CALC-003 | Low | $65,000/yr shows $5,416/mo in onboarding (truncated) but $5,417 in the plan Budget Overview |
| ACCESS-002 | Med | 16 of 18 expense inputs on "Household expenses" have no label or aria-label |

### Questions for the product team

1. Is a $0 / negative life-event amount ever valid (for example a $0 down payment)?
2. "Go on Vacation" saved with a cost still shows Target Amount `N/A` in the goals table; is the target computed later in the wizard?
3. Wealth Score reaches 803 for a user with income only and no expenses or assets; is that intended?
4. The Settings address of jc001 reads "Norcross, GA 90210"; is ZIP/state consistency validated anywhere?
5. Okta asks `my-rw-jc003` for an MFA method when the browser uses Playwright's Desktop Chrome profile but not a default headless profile. Can the QA accounts get an Okta policy exemption so the onboarding suite can run unattended? Until then a human completes MFA (`RW_MFA_MANUAL=1 ... --headed`, or `npm run setup:rate-wealth-session`).

---

## 2026-10-26 Resumed Regression Run

### Execution evidence

- Regression command used `TEST_PROJECT=rate-wealth npx playwright test` for `rw-01` through `rw-06`, with `--project=rate-wealth --workers=1`.
- Full run summary: **12 passed, 13 failed, 143 skipped (168 total)**. Twelve failures stopped at login because neither `TEST_PASSWORD` nor the encrypted `test-data/rate-wealth/rate-wealth-auth.yml` was available. The remaining failure was the registration-copy assertion below. The other five authenticated spec fixtures could not initialize, so their cases were not exercised; the skipped count is not a pass.
- Focused public-registration rerun: **5 passed, 1 failed (6 total)**. `RW-REG-006` again found the misspelling **"discrepency"** on the registration page. This reproduces **RW-BUG-08** on 2026-10-26.
- No signup, checkout, account creation, or plan mutation was performed by these runs. The goal and plan specs stopped at login, before their setup/cleanup could touch the planner account.
- Artifacts: `test-results/2026-10-26/rate-wealth/playwright-summary-1793043408580.md` and `test-results/2026-10-26/rate-wealth/playwright-summary-1793043465184.md`.

### CSV scenario disposition

The regression CSV contains **40** scenario rows. These dispositions describe the 2026-10-26 run only; earlier dated results above remain historical evidence and are not being presented as a fresh pass.

| Current disposition | CSV scenario IDs |
| :--- | :--- |
| Passed in this run | `RW-AUTH-001`, `RW-REG-001` |
| Blocked by unavailable authenticated QA credentials | `RW-AUTH-002` through `RW-AUTH-004`; `RW-NAV-001` through `RW-NAV-003`; `RW-DASH-001` through `RW-DASH-002`; `RW-SNAP-001`; `RW-ACCT-001`; `RW-TX-001`; `RW-BUD-001`; `RW-RISK-001`; `RW-TOOLS-001`; `RW-ONB-001` through `RW-ONB-005`; `RW-PLAN-001` through `RW-PLAN-006`; `RW-GOAL-001` through `RW-GOAL-003`; `RW-API-001`; `RW-A11Y-001`; `RW-CALC-001` |
| Not fully covered by current automated assertions; requires additional UI-focused tests/manual execution | `RW-UI-001` through `RW-UI-007` |

The reproduced `RW-REG-006` typo check is additional to the 40 CSV scenario IDs. Previously recorded defects and product questions are retained; this run does not reconfirm any authenticated finding because those fixtures could not log in.

## 2026-10-26 Signup Retry and Failure Rerun

- Restarted at the public registration page and reused the pending synthetic address `rwqa.copilot.20261026194600@yopmail.com`; no login attempt or duplicate address was used.
- Registration accepted the activation resend and displayed “We've sent an email with an activation link.” The Yopmail inbox still showed `0 mail` after a normal refresh, so the account remains unactivated. This is an account-setup blocker, not a product failure.
- Reran the public registration suite with `--grep @registration`: **6 passed, 0 failed, 0 skipped**. The summary is at `test-results/2026-10-26/rate-wealth/playwright-summary-1793046905087.md`.
- Isolated `RW-REG-006` with Playwright's detailed reporter. Its spelling assertion still detects `discrepency`; `test.fail(true, ...)` correctly classifies this known defect as an expected failure, so Playwright reports the case as passed rather than an unexpected test failure.
- The login-dependent failures were not rerun because activation mail was not delivered and no usable password/session could be established. They remain setup-blocked and are not counted as product failures.

## 2026-10-26 Planner Edit, Delete/Recreate, and Plaid Rerun

- `RW-PLAN-018` passed on dedicated planner account `jc002`: the simulation loader completed and rendered the populated preview.
- `RW-PLAN-020` passed the distinct Buying-a-Home scenario (purchase price `$450,000`, down payment `$90,000`) through Goal Ranking, Review Plan, and Implement Plan. The Home `Progress Towards Your Top Goal` card rendered a circular SVG progress chart at `7%`, with `$7,000/$90,000` shown for the down-payment goal; screenshot: `test-results/rw-plan-020-home-goal-card.png`. The current profile skips four investment/account substeps. Three full end-to-end repeats passed without a blank screen; this does not rule out an intermittent failure.
- `RW-PLAN-021` reproduced a saved-edit defect: after changing the home purchase price from `$450,000` to `$475,000`, selecting Next Step and Save and Exit, reopening the plan showed `$450,000` again. The test is marked `test.fail` as known defect **RW-BUG-12**. Down-payment persistence was changed in the same attempt but was not independently confirmed after the price assertion failed.
- `RW-PLAN-022` passed: after deleting a plan containing a Buying-a-Home goal, a newly created plan did not contain that goal. This narrows the observed stale-value issue to editing the existing plan; it does not disprove stale state in other delete/edit sequences.
- `RW-ACCT-005` could not reach Plaid credentials or institution selection. Rate Wealth opened the owner picker, then Plaid Link loaded with an empty `token=` parameter; no application link-token request was issued. The `user_good` / `pass_good` sandbox credentials were therefore not entered and Platypus was not linked. The test records **RW-BUG-13** as an expected failure. Separate `/api/profile/calendar.php` (500) and `/api/invest/portfolio.php` (404) requests appeared during page load and were not the missing Plaid token request.
- No MFA prompt appeared in these planner runs. Test source: `tests/projects/rate-wealth/rw-05-plan-builder.spec.ts` and `tests/projects/rate-wealth/rw-07-plaid-account.spec.ts`.

## 2026-10-26 Full Regression Delivery

### Saved automation and rerun commands

- Registration copy: `tests/projects/rate-wealth/rw-01-auth-registration.spec.ts` (`RW-REG-006`).
- Plan creation, preview, edit persistence, and delete/recreate: `tests/projects/rate-wealth/rw-05-plan-builder.spec.ts` (`RW-PLAN-018`, `RW-PLAN-020` through `RW-PLAN-022`).
- Plaid Link: `tests/projects/rate-wealth/rw-07-plaid-account.spec.ts` (`RW-ACCT-005`). Shared authentication, navigation, and HTTP tracking are in `tests/projects/rate-wealth/rw-helpers.ts`.
- Detailed case steps and dispositions: `test-data/rate-wealth/rate-wealth-regression-test-plan-2026-10-26.csv`.
- The commands below intentionally omit the password. Set `TEST_PASSWORD` in the local environment or use the encrypted auth file; do not copy credentials into reports.

```bash
TEST_PROJECT=rate-wealth npx playwright test tests/projects/rate-wealth/rw-01-auth-registration.spec.ts --project=rate-wealth --workers=1 --headed --grep @registration --reporter=list
TEST_PROJECT=rate-wealth RW_PLAN_EMAIL=my-rw-jc002@yopmail.com npx playwright test tests/projects/rate-wealth/rw-05-plan-builder.spec.ts --project=rate-wealth --workers=1 --headed --grep RW-PLAN-018 --reporter=list
TEST_PROJECT=rate-wealth RW_PLAN_EMAIL=my-rw-jc002@yopmail.com npx playwright test tests/projects/rate-wealth/rw-05-plan-builder.spec.ts --project=rate-wealth --workers=1 --headed --grep RW-PLAN-020 --repeat-each=3 --reporter=list
TEST_PROJECT=rate-wealth RW_PLAN_EMAIL=my-rw-jc002@yopmail.com npx playwright test tests/projects/rate-wealth/rw-05-plan-builder.spec.ts --project=rate-wealth --workers=1 --headed --grep RW-PLAN-021 --reporter=list
TEST_PROJECT=rate-wealth RW_PLAN_EMAIL=my-rw-jc002@yopmail.com npx playwright test tests/projects/rate-wealth/rw-05-plan-builder.spec.ts --project=rate-wealth --workers=1 --headed --grep RW-PLAN-022 --reporter=list
TEST_PROJECT=rate-wealth RW_PLAN_EMAIL=my-rw-jc002@yopmail.com npx playwright test tests/projects/rate-wealth/rw-07-plaid-account.spec.ts --project=rate-wealth --workers=1 --headed --grep RW-ACCT-005 --reporter=list
```

### Account inventory for this run

| Account | Use/status |
| :--- | :--- |
| `my-rw-jc002@yopmail.com` | Existing dedicated planner account; reused for planner cases. The planner suite clears its plans before/after cases because the app caps the account at three plans. No new login account was created. |
| `rwqa.copilot.20261026194600@yopmail.com` | Synthetic signup address used for a registration retry; resend confirmation appeared but the mailbox remained empty. Treat as pending/unactivated, not a usable created account. |
| `my-rw-jc001@yopmail.com` | Existing complete-profile account; not used in this run. |
| `my-rw-jc003@yopmail.com` | Existing onboarding account; not used in this run. |

No account was created or linked through Plaid during this run. The sandbox credentials were not entered because Plaid Link had no token. No passwords are included in this report.

### Bug report disposition

| ID | Finding | Evidence/status |
| :--- | :--- | :--- |
| RW-BUG-08 | Registration translation notice spells “discrepency” incorrectly. | Reproduced by `RW-REG-006`; test remains marked expected failure. |
| RW-BUG-12 | Editing the existing Buying-a-Home goal does not persist its purchase price. | `$475,000` reverted to `$450,000` after Save and Exit and reopening; reproduced by `RW-PLAN-021`. Down-payment persistence was not independently verified. |
| RW-BUG-13 | Plaid Link initializes with an empty token and the app makes no link-token request. | Reproduced by `RW-ACCT-005`; credentials and Platypus selection were not reached. This is an app integration blocker, not a sandbox credential failure. |

The fresh-plan isolation check `RW-PLAN-022` passed: the replacement plan did not restore the deleted Buying-a-Home goal. This does not prove that stale values are cleared in every edit/delete sequence. The complete plan flow displayed the Home goal chart in three repeat runs and subsequent focused runs; the reported intermittent blank screen was not observed, but is not ruled out. The activation-mail delay is a setup blocker, not a product bug. Severity for the newly reported defects remains for product triage.

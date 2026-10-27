# Rate Wealth Bug Cross-check and Candidate Drafts

- **Date:** 2026-10-26
- **Environment:** `https://wealth.dev.fitbux.com`
- **Epic:** [FAL-3564 - [QA] [Rate Wealth] BUGS & ISSUES - OCT 2026](https://rate.atlassian.net/browse/FAL-3564)

## Scope and Method

This report compares all 23 findings in the supplied [Rate-Wealth-Consolidated-Bug-Report (1).md](../../../../Downloads/Rate-Wealth-Consolidated-Bug-Report%20%281%29.md) against existing Bug work items directly under FAL-3564. A read-only query for `parent = FAL-3564 AND issuetype = Bug` returned 49 rows with a limit of 100. Existing Jira duplicates and similar issues are identified below; findings without a matching Jira bug are written as new candidate bug drafts using the supplied format. These drafts are report content only, not Jira tickets.

No Jira issues were created, edited, transitioned, linked, or deleted. Statuses below are the values returned on 2026-10-26.

## Evidence Boundary

- The 2026-10-26 full regression was blocked from authenticated cases by the missing Rate Wealth password. The summary records the onboarding and goal suites stopping before their test bodies: [playwright-summary-1793043408580.md](../../test-results/2026-10-26/rate-wealth/playwright-summary-1793043408580.md).
- A focused run of `RW-PLAN-009` and `RW-PLAN-012` also stopped in login setup before either test body. Its diagnostic is [error-context.md](../../test-results/2026-10-26/rate-wealth/runs/rw-05-plan-builder-RW-PLAN-35fd8--plan-cannot-be-implemented-rate-wealth/error-context.md), with a login-state screenshot at [test-failed-1.png](../../test-results/2026-10-26/rate-wealth/runs/rw-05-plan-builder-RW-PLAN-35fd8--plan-cannot-be-implemented-rate-wealth/test-failed-1.png). This is setup evidence, not proof of a product defect.
- Planner and goal tests are configured for `my-rw-jc002@yopmail.com`; onboarding tests are configured for `my-rw-jc003@yopmail.com`. A configured account is not proof that the account was used in a particular Jira reproduction. The onboarding account was not authenticated in the October 26 run.
- Historical local confirmations below are attributed to the dated report and test sources. Per-case traces/logs from the 2026-09-30 run were not retained in the current artifact inventory. Jira screenshot/video attachments are named where returned; use the linked Jira item to view them.
- `RW-PLAN-021` and `RW-ACCT-005` were exercised on October 26 using the planner account, but their observed purchase-price reversion and empty Plaid token are different symptoms from FAL-3765 and FAL-3871. They are not presented as confirmation of those Jira bugs.

## Epic Bug Crosswalk

| Jira bug | Status | Relationship to example | Local verification |
|---|---|---|---|
| [FAL-3720](https://rate.atlassian.net/browse/FAL-3720) - No inline validation / loading / error handling | Will Not Do | Broad, possible umbrella for zero/negative goal validation; not a precise one-to-one description | `RW-GOAL-002` historically reported 0/negative accepted; October 26 rerun blocked |
| [FAL-3729](https://rate.atlassian.net/browse/FAL-3729) - Plan delete has no confirmation | Will Not Do | Exact match for plan deletion without confirmation | `RW-PLAN-012` historical confirmation; October 26 rerun blocked |
| [FAL-3730](https://rate.atlassian.net/browse/FAL-3730) - Future DOB and 1900 hides Wealth Score | Will Not Do | Exact match for the future/1900 DOB and score findings | `RW-ONB-006/007` encode expected failures; historical report says onboarding awaited MFA, so no local reproduction is established |
| [FAL-3877](https://rate.atlassian.net/browse/FAL-3877) - Reskin onboarding accepts future DOBs | Backlog | Partial match; title also covers spouse and children, which the local test does not | Only primary DOB is covered locally; no October 26 authenticated run |
| [FAL-3763](https://rate.atlassian.net/browse/FAL-3763) - Invalid ZIP message | Backlog | Related validation theme, but Jira repro is the Rent vs Buying calculator, not onboarding | `RW-ONB-004` checks a four-digit onboarding ZIP; it is not the calculator flow |
| [FAL-3876](https://rate.atlassian.net/browse/FAL-3876) - Moving-plan ZIP accepts letters | Backlog | Related ZIP validation, distinct from the example's onboarding error message | No local test for the Moving goal ZIP field |
| [FAL-3716](https://rate.atlassian.net/browse/FAL-3716) - Spouse DOB instructions/character validation | Will Not Do | Related date validation, distinct from future-date acceptance | No local spouse DOB test |
| [FAL-3724](https://rate.atlassian.net/browse/FAL-3724) - Date field accepts special characters and changes year to 1902 | Will Not Do | Related date validation, distinct from future/1900 DOB behavior | `RW-ONB-005` checks malformed primary DOBs, not the spouse/dependent year-change flow |
| [FAL-3725](https://rate.atlassian.net/browse/FAL-3725) - Spouse/dependent fields accept arbitrary characters | Will Not Do | Related validation, broader than and distinct from the example's primary DOB case | No local spouse/dependent field matrix |
| [FAL-3764](https://rate.atlassian.net/browse/FAL-3764) - Wealth Score has no tooltip | Backlog | Same UI element as the NaN finding, but a different issue | No local tooltip test; not evidence for the NaN report |
| [FAL-3765](https://rate.atlassian.net/browse/FAL-3765) - N/A life events cannot be edited after save | Will Not Do | Related edit persistence, but the ticket specifically requires an N/A/empty saved life event | `RW-PLAN-021` tests a changed home purchase price, not N/A; do not treat as a duplicate confirmation |
| [FAL-3718](https://rate.atlassian.net/browse/FAL-3718) - Simulate/preview appears during plan setup | Will Not Do | Related plan-state UX, distinct from Implement being enabled on an incomplete plan | `RW-PLAN-009` tests Implement; it does not assert preview visibility during setup |
| [FAL-3871](https://rate.atlassian.net/browse/FAL-3871) - Plaid popup closes during onboarding | Backlog | Related Plaid integration, distinct from an empty link token on Accounts | `RW-ACCT-005` tests Accounts, not onboarding's Your debts step |
| [FAL-3602](https://rate.atlassian.net/browse/FAL-3602) - Asset owner does not persist / no joint Plaid owner | Done | Related Plaid/owner area, distinct from an empty link token; Jira description identifies the Student Loan Forgiveness app | No equivalent local owner-persistence test |
| [FAL-3672](https://rate.atlassian.net/browse/FAL-3672) - Loan/financial field does not update when value is changed to 0 | Done | Related zero-value input behavior, but a value-update defect rather than acceptance of invalid goal amounts | Not the `RW-GOAL-002` behavior |
| [FAL-3673](https://rate.atlassian.net/browse/FAL-3673) - Overview misstates loan payment estimate | Backlog | Related calculation concern, but different from Available Funds arithmetic | Not the `RW-PLAN-016` calculation |
| [FAL-3726](https://rate.atlassian.net/browse/FAL-3726) - New transactions and asset accounts/debts do not appear | Closed | Related Transactions/account display area, but not the repeated TRANS_REVIEW mutation | Not the `RW-TX-004` request behavior |

## Source Finding Disposition

| # | Finding from supplied report | Disposition | Existing Jira reference |
|---|---|---|---|
| 1 | Life-event goals accept zero and negative monetary values | Similar existing validation issue; neither ticket is an exact duplicate | [FAL-3720](https://rate.atlassian.net/browse/FAL-3720); [FAL-3672](https://rate.atlassian.net/browse/FAL-3672) is zero-value update behavior |
| 2 | Buying-a-Home goal edits are not persisted | New candidate; related N/A-edit issue has a different trigger | [FAL-3765](https://rate.atlassian.net/browse/FAL-3765), related only |
| 3 | Plaid Link opens without a link token | New candidate; onboarding popup-close issue is a different flow | [FAL-3871](https://rate.atlassian.net/browse/FAL-3871), related only |
| 4 | Manual plan selection immediately consumes a plan slot | New candidate; no matching bug identified in the epic query | None identified |
| 5 | Plans can be deleted without confirmation | Already tracked; duplicate finding | [FAL-3729](https://rate.atlassian.net/browse/FAL-3729) |
| 6 | Implement is enabled for an incomplete plan | New candidate; preview-during-setup issue is different behavior | [FAL-3718](https://rate.atlassian.net/browse/FAL-3718), related only |
| 7 | Required plan name can be left blank | New candidate; no matching bug identified in the epic query | None identified |
| 8 | Plan preview displays “Plan 1” instead of the entered name | New candidate; no matching bug identified in the epic query | None identified |
| 9 | Buying-a-Home liability save returns HTTP 500 | New candidate; no matching bug identified in the epic query | None identified |
| 10 | Portfolio endpoint returns HTTP 404 during plan building | New candidate; no matching bug identified in the epic query | None identified |
| 11 | Transactions page sends a failing TRANS_REVIEW request | New candidate; FAL-3726 is related to the Transactions area but describes a different symptom | [FAL-3726](https://rate.atlassian.net/browse/FAL-3726), related only |
| 12 | Home and Snapshot show differently named net-worth figures | New candidate; no matching bug identified in the epic query | None identified |
| 13 | Available Funds does not reconcile with displayed income and expenses | New candidate; FAL-3673 is a different loan-payment calculation | [FAL-3673](https://rate.atlassian.net/browse/FAL-3673), related only |
| 14 | DOB accepts future and implausibly old dates | Similar/overlapping existing issues; family-member coverage differs | [FAL-3730](https://rate.atlassian.net/browse/FAL-3730), [FAL-3877](https://rate.atlassian.net/browse/FAL-3877) |
| 15 | Extreme DOB causes Wealth Score to display NaN | Similar/overlapping existing issue; Jira describes score disappearing, not explicitly NaN | [FAL-3730](https://rate.atlassian.net/browse/FAL-3730); [FAL-3764](https://rate.atlassian.net/browse/FAL-3764) is tooltip-only |
| 16 | Annual salary accepts an unrealistic value | New candidate; no matching bug identified in the epic query | None identified |
| 17 | Household expense inputs lack accessible labels | New candidate; no matching bug identified in the epic query | None identified |
| 18 | Header phone and email buttons lack accessible names | New candidate; no matching bug identified in the epic query | None identified |
| 19 | Plan comparison checkboxes lack accessible labels | New candidate; no matching bug identified in the epic query | None identified |
| 20 | Projected Net Wealth chart repeats y-axis labels | New candidate; no matching bug identified in the epic query | None identified |
| 21 | Registration notice misspells “discrepency” | New candidate; no matching bug identified in the epic query | None identified |
| 22 | Invalid ZIP shows an incorrect required-field message | New candidate; calculator and Moving ZIP tickets describe different flows | [FAL-3763](https://rate.atlassian.net/browse/FAL-3763), [FAL-3876](https://rate.atlassian.net/browse/FAL-3876), related only |
| 23 | AI-Powered Assistant is disabled without explanation | New candidate; no matching bug identified in the epic query | None identified |

## Existing Jira Findings (Already Tracked or Similar)

The following source findings are already tracked or similar to existing epic bugs; they are not new Jira ticket requests. FAL-3720's Jira description is empty, so the first entry documents the local source finding rather than asserting Jira's exact scope.

### 1. Life-Event Goals Accept Zero or Negative Amounts

- **Jira reference:** [FAL-3720](https://rate.atlassian.net/browse/FAL-3720) - No inline validation / loading / error handling
- **Disposition:** Similar existing Jira issue; exact scope not confirmed
- **Status:** Will Not Do
- **Severity / Priority:** High / High in the supplied report
- **Component:** Plan Builder / Life Events / Input Validation
- **Environment:** `https://wealth.dev.fitbux.com`
- **Test:** `RW-GOAL-002`

**Summary**

Life-event goal forms reportedly allow zero or negative monetary values and permit the user to continue.

**Description**

The supplied report says 14 tested life-event types accepted zero or negative amounts. Such values can represent impossible expenses or purchases and may feed into goal ranking and plan calculations. This is a plausible overlap with FAL-3720's broad validation theme, not a verified one-to-one mapping: FAL-3720 has no Jira description and does not specify these cases.

**Preconditions**

- User is authenticated and can access Plan Builder.
- User has started a financial plan and opened a life-event goal form.

**Steps to Reproduce**

1. Select a goal such as Buying a Home.
2. Enter `0` in a required purchase-price field and `0` in the down-payment field.
3. Attempt to continue or save the goal.
4. Repeat with a negative amount such as `-1000`, then check other goal types.

**Actual Result**

The historical local report says zero and negative values were accepted across 14 event types and the wizard advanced. Its `RW-GOAL-002` case expects an error and to remain on the form, but no fresh authenticated October 26 run was possible.

**Expected Result**

Required monetary fields should reject values outside their product-defined valid range and show a field-level message. The user should not continue while a required amount is invalid. If zero is valid for an optional field, that exception should be defined per field.

**Customer Impact**

Customers can save financially impossible goals, potentially distorting calculations, projections, recommendations, and goal ranking.

**Acceptance Criteria**

- Validation is consistent across supported life-event types.
- Required monetary fields reject blank, zero, and negative values where those values are invalid.
- Validation appears on blur or when continuing, and invalid values are rejected by the API.
- Valid decimal and currency-formatted values remain supported.

**Evidence State**

Historical confirmation is recorded in the existing report; the October 26 rerun was blocked by missing authentication. Treat the mapping to FAL-3720 as plausible rather than exact until the Jira scope is confirmed.

### 2. Plans Delete Without Confirmation

- **Jira reference:** [FAL-3729](https://rate.atlassian.net/browse/FAL-3729) - Plan delete has no confirmation
- **Disposition:** Already tracked; duplicate finding, not a new ticket
- **Status:** Will Not Do
- **Severity / Priority:** High / High in the supplied report
- **Component:** Financial Plans / Delete Plan
- **Test:** `RW-PLAN-012`

**Summary**

Selecting Delete removes a saved financial plan without asking the customer to confirm.

**Description**

The local test and Jira report describe the same destructive action and missing confirmation. A user can lose a saved plan, its goals, assumptions, and projections through a single menu action.

**Preconditions**

- User is authenticated.
- At least one saved financial plan exists.

**Steps to Reproduce**

1. Open Financial Plans.
2. Open the actions menu for a saved plan.
3. Select Delete.

**Actual Result**

The plan is deleted immediately without a confirmation dialog.

**Expected Result**

A destructive confirmation should identify the plan and explain what will be removed. Deletion should occur only after explicit confirmation; cancel should leave the plan unchanged.

**Customer Impact**

An accidental selection can permanently remove a customer's financial plan and its saved data.

**Acceptance Criteria**

- Delete opens a confirmation dialog naming the plan and describing the impact.
- Cancel is the safe default and leaves the plan intact.
- Delete occurs only after explicit confirmation.
- On API failure, the plan remains visible and the customer receives an error.

**Evidence State**

The historical report records `RW-PLAN-012` as a confirmed automated finding. The October 26 focused recheck stopped at login setup before the test body; it did not delete or otherwise change a plan.

### 3. DOB Range and Wealth Score Behavior

- **Jira references:** [FAL-3730](https://rate.atlassian.net/browse/FAL-3730) - Future DOB and 1900 hides Wealth Score; [FAL-3877](https://rate.atlassian.net/browse/FAL-3877) - Reskin onboarding accepts future DOBs
- **Disposition:** Similar/overlapping Jira issues; NaN wording and family-member scope need separate confirmation
- **Statuses:** Will Not Do; Backlog
- **Severity / Priority:** High / High for DATA-001 and Medium / High for CALC-004 in the supplied report
- **Component:** Profile Builder / Personal Information / Date Validation; Wealth Score
- **Tests:** `RW-ONB-006`, `RW-ONB-007`

**Summary**

The supplied report says a future date and `01/01/1900` can be saved during onboarding; it separately reports that the 1900 date causes the Wealth Score to display `NaN` until reload.

**Description**

FAL-3730 describes future DOB acceptance and the Wealth Score disappearing when a 1900 DOB is entered. FAL-3877 concerns future DOB acceptance in the reskinned onboarding flow, including spouse and child fields. The supplied local tests cover only the primary user's DOB. The local `NaN` claim and Jira's “hides” wording may describe different visible outcomes, so they should not be treated as identical without an authenticated reproduction.

**Preconditions**

- User can access Profile Builder or profile editing.
- For the FAL-3877 scope, the relevant spouse or child DOB field is available.

**Steps to Reproduce**

1. Enter a future DOB such as `05/20/2030` and attempt to continue.
2. Enter `01/01/1900` and continue.
3. Observe whether onboarding advances and whether the Wealth Score remains visible and numeric.
4. For FAL-3877, repeat in spouse and child DOB fields in the reskinned onboarding flow.

**Actual Result**

The supplied report states both dates are accepted and onboarding advances; it reports the Wealth Score as `NaN` after the 1900 DOB until reload. Jira FAL-3730 describes the score disappearing, and FAL-3877 extends the future-date concern to spouse and child fields. Local automated cases are marked expected failures, but the historical report says onboarding awaited human-completed MFA; these are authored checks, not established authenticated local reproductions.

**Expected Result**

Future DOBs and ages outside the product-supported range should be rejected with a specific message, and the user should not continue with invalid data. The interface should never show `NaN`; when a score cannot be calculated, it should render a controlled unavailable state.

**Customer Impact**

Invalid age data can undermine age-dependent projections and recommendations. A missing or non-numeric Wealth Score also exposes a calculation failure in a prominent customer-facing metric.

**Acceptance Criteria**

- UI and API enforce the product-defined DOB range for the user and, where supported, spouse and child fields.
- Invalid DOBs show an actionable validation message and block progression.
- Wealth Score never renders `NaN`, `undefined`, or a broken blank state.
- Correcting DOB recalculates the score without requiring a page reload.

**Evidence State**

Jira screenshots are historical evidence. The October 26 authenticated onboarding rerun was blocked before the test body. The configured local account `my-rw-jc003@yopmail.com` is not proof of account use in the Jira reproductions; no Jira attachment identified an account.

## New Candidate Bug Drafts

Each item below is a report draft, not a Jira ticket. Candidate IDs are retained from the supplied source. Related FAL-3564 issues are called out where the trigger or workflow differs; they are not classified as duplicates.

### 2. Buying-a-Home Goal Edits Are Not Persisted

- **Candidate ID:** RW-BUG-12
- **Severity / Priority:** High / High
- **Component:** Plan Builder / Goal Editing / Data Persistence
- **Environment:** Rate Wealth DEV
- **Test:** `RW-PLAN-021`
- **Related Jira:** [FAL-3765](https://rate.atlassian.net/browse/FAL-3765) concerns N/A or empty life-event fields becoming uneditable; this purchase-price persistence issue is a different trigger and is not a duplicate.

**Summary**

Editing an existing Buying-a-Home purchase price appears successful, but the saved value reverts after reopening the plan.

**Description**

An existing home purchase goal was edited from `$450,000` to `$475,000`. After Next Step, Save and Exit, and reopening the plan, the purchase price returned to `$450,000`. The down payment was also changed but was not independently verified.

**Preconditions**

- User has an existing editable financial plan containing a Buying-a-Home goal.
- Purchase price is `$450,000`; down payment is `$90,000`.

**Steps to Reproduce**

1. Open the plan and navigate to its Buying-a-Home goal.
2. Change purchase price to `$475,000`.
3. Select Next Step, then Save and Exit.
4. Reopen the plan and review the purchase price.

**Actual Result**

The purchase price displays `$450,000` after reopening instead of the saved `$475,000`.

**Expected Result**

The edited value persists after saving and reopening and is used in calculations. A failed save must be surfaced rather than appearing successful and silently reverting.

**Customer Impact**

Customers may make decisions using outdated home purchase assumptions without realizing their edits were lost.

**Acceptance Criteria**

- Purchase price persists after Next Step, Save and Exit, reopen, and refresh.
- Updated values feed goal progress and projections.
- Down payment, target date, and other editable fields are tested independently.
- Failed saves show an actionable error and retain entered values for retry.

### 3. Plaid Link Opens Without a Link Token

- **Candidate ID:** RW-BUG-13
- **Severity / Priority:** High / High
- **Component:** Accounts / Plaid Integration
- **Environment:** Rate Wealth DEV
- **Test:** `RW-ACCT-005`
- **Related Jira:** [FAL-3871](https://rate.atlassian.net/browse/FAL-3871) concerns the Plaid popup closing during onboarding's Your debts flow. The empty-token failure occurs on Accounts and is not the same reproduction.

**Summary**

Plaid Link initializes with an empty token parameter because the application does not request a link token.

**Description**

When connecting an account, Rate Wealth opens the owner selection flow and launches Plaid Link with an empty `token=` parameter. No application link-token request is issued, so institution selection and authentication cannot begin.

**Preconditions**

- User is authenticated and has a completed profile.
- User can access Accounts and connect an external account.

**Steps to Reproduce**

1. Navigate to Accounts and start connecting an external account.
2. Select the account owner when prompted.
3. Continue to Plaid Link and inspect its initialization and browser network requests.

**Actual Result**

Plaid Link opens with an empty token, no link-token request is sent, and institution selection is not displayed. Sandbox credentials were not entered.

**Expected Result**

The application requests a valid link token and opens Plaid only after receiving it. If token creation fails, Plaid must not open and the user should receive an actionable error.

**Customer Impact**

Customers cannot connect external accounts or provide linked financial data for planning.

**Acceptance Criteria**

- A valid token is requested before Plaid initializes.
- Institution selection is reachable after successful initialization.
- Token failures produce a useful customer message and correlated diagnostic logging without exposing token values.

### 4. Manual Plan Selection Consumes a Plan Slot Immediately

- **Candidate ID:** ARCH-001
- **Severity / Priority:** High / High
- **Component:** Financial Plans / Plan Creation / Draft Lifecycle
- **Test:** `RW-PLAN-006`

**Summary**

Selecting Manually creates a persisted draft that counts toward the three-plan limit, even if the customer cancels without entering plan information.

**Description**

Plan creation appears to persist as soon as the customer selects a building method. Abandoned drafts can consume the account's plan allowance.

**Preconditions**

- User is authenticated and has fewer than three plans.
- User is on the plan-selection page.

**Steps to Reproduce**

1. Record the current number of plans.
2. Select Create Plan, then Manually.
3. Enter no plan information; exit or cancel.
4. Return to Financial Plans and inspect the plan count. Repeat as needed to test the limit.

**Actual Result**

A draft is persisted and counts toward the three-plan maximum despite the user not completing or confirming creation.

**Expected Result**

Selecting a creation method alone should not consume a plan slot. Abandoned drafts should be discarded or excluded from the limit until the customer confirms creation.

**Customer Impact**

Customers can unintentionally exhaust their plan allowance while exploring the builder.

**Acceptance Criteria**

- Selecting Manually alone does not create a counted plan.
- Canceling before a confirmed save leaves plan count unchanged.
- Abandoned drafts do not count toward the limit; legitimate saved drafts remain resumable.
- Repeated clicks and concurrent creation do not create duplicate drafts.

### 6. Implement Is Enabled for an Incomplete Plan

- **Candidate ID:** UX-008
- **Severity / Priority:** Medium / High
- **Component:** Financial Plans / Plan Status / Implementation
- **Test:** `RW-PLAN-009`
- **Related Jira:** [FAL-3718](https://rate.atlassian.net/browse/FAL-3718) concerns Simulate/Preview visibility during setup, not the Implement action on an incomplete plan; not a duplicate.

**Summary**

The Implement action is available before the customer completes required plan-building steps.

**Description**

An incomplete plan can expose an enabled Implement action even though required information is missing.

**Preconditions**

- User has an incomplete financial plan with one or more required sections unfinished.

**Steps to Reproduce**

1. Start a plan and complete only part of the builder.
2. Save and exit.
3. Open the plan actions and inspect Implement.
4. Attempt to select Implement.

**Actual Result**

The action is enabled while required plan information is incomplete.

**Expected Result**

Implementation is unavailable until required sections pass validation and the plan has a valid projection. The interface should identify what remains incomplete.

**Customer Impact**

Customers may mistake an incomplete plan for one ready to use and rely on missing or unreliable recommendations.

**Acceptance Criteria**

- UI and backend prevent implementation of an incomplete plan.
- Incomplete sections are identified to the user.
- The disabled action explains what must be completed.

### 7. Required Plan Name Can Be Left Blank

- **Candidate ID:** DATA-003
- **Severity / Priority:** Medium / Medium
- **Component:** Plan Builder / Plan Details / Validation
- **Test:** `RW-PLAN-004`

**Summary**

The plan name is marked required, but the user can continue with an empty value and the system silently assigns “My Financial Plan.”

**Description**

The required indicator conflicts with the form behavior. The user can advance without entering a name and may not know which value will be saved.

**Preconditions**

- User has started manual plan creation and the plan name field is displayed.

**Steps to Reproduce**

1. Leave the required plan name empty.
2. Select Next Step and continue or save the plan.
3. Review the saved plan name.

**Actual Result**

The user advances and the system silently assigns “My Financial Plan.”

**Expected Result**

Either require a non-whitespace name with a clear validation message, or display the intended default in the field before the user continues.

**Customer Impact**

Customers may create multiple indistinguishable plans and misunderstand what name was saved.

**Acceptance Criteria**

- Required names reject empty and whitespace-only input with a specific message.
- If a default is intended, it is visible before continuing and the field is not misleadingly marked required.
- Duplicate/default names remain distinguishable in the plan list.

### 8. Plan Preview Displays “Plan 1” Instead of the Entered Name

- **Candidate ID:** DATA-004
- **Severity / Priority:** Low / Medium
- **Component:** Plan Preview / Display Data
- **Test:** `RW-PLAN-019`

**Summary**

The preview heading uses the generic “Plan 1” label instead of the customer's plan name.

**Description**

After the customer enters a distinctive name and opens the preview, the heading does not preserve that customer-facing identity.

**Preconditions**

- User can create a financial plan and enter a distinctive plan name.
- The plan has enough completed steps to access preview.

**Steps to Reproduce**

1. Create a plan with a distinctive name, such as “2027 Home Purchase Plan.”
2. Complete enough steps to open the preview.
3. Review the preview heading.

**Actual Result**

The preview heading displays “Plan 1.”

**Expected Result**

The preview displays the customer-entered plan name consistently with the plan card and edit workflow.

**Customer Impact**

Customers with multiple plans may not know which plan they are reviewing or preparing to implement.

**Acceptance Criteria**

- Preview heading reflects the saved customer-entered name.
- Name remains consistent after save, reopen, and edit.
- Internal sequence names are not substituted in customer-facing views.

### 9. Buying-a-Home Liability Save Returns HTTP 500

- **Candidate ID:** RW-BUG-10
- **Severity / Priority:** High / High
- **Component:** Plan Builder / Liabilities API
- **Endpoint:** `PUT /api/plan/liabilities.php`
- **Test:** `RW-PLAN-017`

**Summary**

The liabilities update endpoint returns HTTP 500 while the customer progresses through the plan wizard.

**Description**

The plan workflow sends a liability update that fails with a server error, potentially preventing liability data from being saved.

**Preconditions**

- User is authenticated and building or editing a plan with liability-related data.

**Steps to Reproduce**

1. Start or reopen a financial plan.
2. Progress through the wizard to liability-related data.
3. Enter or review liabilities and continue or save.
4. Inspect the network response for `PUT /api/plan/liabilities.php`.

**Actual Result**

The endpoint returns HTTP 500.

**Expected Result**

Valid liability data saves successfully and remains available after reload. The UI must not show success or continue as if data persisted when the request failed.

**Customer Impact**

Liability information may be lost or excluded from projections, producing incomplete financial recommendations.

**Acceptance Criteria**

- Valid liability updates return a successful response and persist.
- Empty-state cases are handled without server errors.
- Failures return actionable errors and allow retry without falsely advancing the workflow.

### 10. Portfolio Endpoint Returns HTTP 404 During Plan Building

- **Candidate ID:** RW-BUG-11
- **Severity / Priority:** Medium / Medium
- **Component:** Plan Builder / Investment Portfolio API
- **Endpoint:** `GET /api/invest/portfolio.php`
- **Test:** `RW-PLAN-017`

**Summary**

The plan workflow requests the investment portfolio endpoint, which returns HTTP 404.

**Description**

The application requests an unavailable portfolio route during plan building, including when a customer may have no portfolio records.

**Preconditions**

- User is signed in with a profile eligible to create a plan.
- User is progressing through investment or account-related plan steps.

**Steps to Reproduce**

1. Start or reopen a plan.
2. Progress through investment/account-related steps.
3. Inspect network activity for `GET /api/invest/portfolio.php`.

**Actual Result**

The request returns HTTP 404.

**Expected Result**

The frontend calls a supported endpoint. A customer with no portfolio receives a successful empty-state response rather than 404.

**Customer Impact**

Investment data may be omitted from calculations, and repeated failing requests add error noise.

**Acceptance Criteria**

- The request uses a valid supported route, or is removed if obsolete.
- No-portfolio customers receive a successful empty state and can continue.
- Portfolio data persists and is reflected in plan calculations when present.

### 11. Transactions Sends a Failing TRANS_REVIEW Request on Every Load

- **Candidate ID:** RW-BUG-09
- **Severity / Priority:** Medium / Medium
- **Component:** Transactions / Action Items API
- **Endpoint:** `PATCH /api/v2/actionitem/TRANS_REVIEW`
- **Test:** `RW-TX-004`

**Summary**

Opening Transactions sends a TRANS_REVIEW PATCH request that returns HTTP 404 on every page load.

**Description**

Viewing Transactions triggers a mutation for an invalid or absent action item, and the request repeats on subsequent loads.

**Preconditions**

- User is signed in and can navigate to Transactions.

**Steps to Reproduce**

1. Navigate to Transactions and inspect network requests.
2. Refresh the page.
3. Navigate away and return; observe the request again.

**Actual Result**

Each page load sends `PATCH /api/v2/actionitem/TRANS_REVIEW`, which returns HTTP 404.

**Expected Result**

Merely viewing the page should not send an unnecessary mutation. If an applicable action item exists, the endpoint and identifier should be valid and the update should not be repeatedly submitted.

**Customer Impact**

The action-item state may not be recorded and customers see an avoidable failure in the workflow.

**Acceptance Criteria**

- No update is sent when there is no applicable action item.
- Applicable updates use a valid identifier and succeed once.
- Repeated page loads do not generate repeated failing mutations.

### 12. Home and Snapshot Show Unexplained Net-Worth Differences

- **Candidate ID:** CALC-001
- **Severity / Priority:** Medium / Medium
- **Component:** Home Dashboard / Snapshot / Financial Metrics
- **Test:** `RW-HOME-003`

**Summary**

Home and Snapshot display materially different values under near-identical net-worth labels without explaining the difference.

**Description**

Home displays Financial Net Worth at approximately `$36,000`, while Snapshot displays Net Wealth at approximately `$597,000`. The customer is not shown how these values differ.

**Preconditions**

- User is signed in with financial data populated in the profile.

**Steps to Reproduce**

1. Record Financial Net Worth on Home.
2. Navigate to Snapshot and record Net Wealth.
3. Compare the terms, values, and any visible calculation definitions.

**Actual Result**

Near-identical metric names show materially different values without a definition or reconciliation.

**Expected Result**

Equivalent concepts use consistent calculations and data. If the metrics intentionally differ, they should have distinct names and definitions that explain included and excluded categories.

**Customer Impact**

Customers may not know which figure represents their financial position or whether either figure is incorrect.

**Acceptance Criteria**

- Metrics use consistent sources and effective dates when they represent the same concept.
- Different calculations have distinct names and explanatory definitions.
- Customers can reconcile each displayed value with underlying assets and liabilities.

### 13. Available Funds Does Not Reconcile With Displayed Budget Values

- **Candidate ID:** CALC-005
- **Severity / Priority:** Medium / High
- **Component:** Plan Builder / Budget Overview / Calculations
- **Test:** `RW-PLAN-016`

**Summary**

Available Funds does not equal the displayed monthly income less displayed household expenses.

**Description**

Budget Overview shows monthly income of `$5,417` and household expenses of `$1,088`, which subtract to `$4,329`, but Available Funds displays `$4,327`.

**Preconditions**

- User has an affected financial plan with the stated income and expense values.

**Steps to Reproduce**

1. Open the affected plan and navigate to Budget Overview.
2. Confirm monthly income is `$5,417` and household expenses are `$1,088`.
3. Compare Available Funds with the subtraction of the displayed values.

**Actual Result**

Available Funds shows `$4,327`, two dollars below the result calculated from the visible values.

**Expected Result**

Available Funds reconciles with the displayed inputs, or any additional deductions and unrounded values are shown and explained.

**Customer Impact**

Visible arithmetic inconsistencies reduce trust in the plan's calculations and recommendations.

**Acceptance Criteria**

- The displayed result follows a documented rounding policy.
- Any additional deductions are visible and explained.
- The total can be reconciled from customer-visible amounts.

### 16. Annual Salary Accepts an Unrealistic Value

- **Candidate ID:** DATA-002
- **Severity / Priority:** Medium / Medium
- **Component:** Profile Builder / Income / Boundary Validation

**Summary**

The annual salary field accepts `$99,999,999,999` and allows onboarding to continue.

**Description**

The salary input has no effective upper boundary for values beyond the supported calculation range.

**Preconditions**

- User is completing the income section of Profile Builder.

**Steps to Reproduce**

1. Enter `99999999999` as annual salary.
2. Save and continue onboarding.
3. Review resulting monthly income and financial metrics.

**Actual Result**

The value is accepted and the user can continue.

**Expected Result**

The field and API reject values above the product-approved maximum with a clear message. Supported high values calculate without overflow or truncation.

**Customer Impact**

An extreme value may distort Wealth Score, budgets, taxes, projections, and recommendations.

**Acceptance Criteria**

- UI and API enforce the same approved salary range.
- Out-of-range values show an actionable validation error and cannot be saved.
- Valid high values calculate and format correctly.

### 17. Household Expense Inputs Lack Accessible Labels

- **Candidate ID:** ACCESS-002
- **Severity / Priority:** Medium / Medium
- **Component:** Plan Builder / Household Expenses / Accessibility

**Summary**

Sixteen of eighteen Household Expenses inputs lack an associated accessible name.

**Description**

Screen-reader and other assistive-technology users cannot identify the purpose of most expense fields from their accessible names.

**Preconditions**

- User can navigate to Household Expenses in the plan workflow.
- Accessibility tree or screen reader is available for inspection.

**Steps to Reproduce**

1. Open Household Expenses.
2. Inspect or focus each of the 18 inputs using an accessibility tool.
3. Review each input's accessible name.

**Actual Result**

Sixteen inputs have no associated label or `aria-label`.

**Expected Result**

Every expense field exposes a unique accessible name that identifies its category.

**Customer Impact**

Assistive-technology users cannot reliably determine which expense amount they are entering.

**Acceptance Criteria**

- Every input has a valid accessible name associated through a label or equivalent accessible naming method.
- Names identify the expense category and match visible text.
- Labels remain unique and usable with keyboard and screen-reader navigation.

### 18. Header Phone and Email Buttons Lack Accessible Names

- **Candidate ID:** ACCESS-001
- **Severity / Priority:** Medium / Medium
- **Component:** Global Header / Accessibility
- **Test:** `RW-NAV-006`

**Summary**

The global header's phone and email icon buttons do not expose meaningful accessible names.

**Description**

Assistive technology announces the controls as unlabeled buttons or cannot identify their actions.

**Preconditions**

- User is signed in on a page containing the global header.
- Screen reader or accessibility tree is available.

**Steps to Reproduce**

1. Navigate to a page with the global header.
2. Inspect or focus the phone icon button.
3. Inspect or focus the email icon button.

**Actual Result**

The buttons have no meaningful accessible names.

**Expected Result**

The phone button exposes an action name such as “Call support,” and the email button exposes “Email support.” Keyboard activation works like pointer activation.

**Customer Impact**

Customers using screen readers may not know the purpose of the support controls.

**Acceptance Criteria**

- Both controls expose descriptive action-based accessible names.
- Keyboard and pointer activation trigger the same action.
- Names are clear and do not redundantly repeat nearby text.

### 19. Plan Comparison Checkboxes Lack Accessible Labels

- **Candidate ID:** ACCESS-003
- **Severity / Priority:** Medium / Medium
- **Component:** Financial Plans / Plan Comparison / Accessibility
- **Test:** `RW-PLAN-014`

**Summary**

Plan comparison checkboxes do not expose labels identifying the plan they select.

**Description**

Screen-reader users cannot determine which plan will be included when focusing a checkbox.

**Preconditions**

- Multiple financial plans are available.
- User can open the plan-comparison interface.

**Steps to Reproduce**

1. Open plan comparison.
2. Navigate through each plan-selection checkbox with a screen reader or accessibility inspection tool.
3. Review the announced name and checked state.

**Actual Result**

Checkboxes are announced without a label identifying the associated plan.

**Expected Result**

Each checkbox has a unique accessible name that includes its plan name and exposes its checked state.

**Customer Impact**

Screen-reader users cannot confidently choose which plans to compare.

**Acceptance Criteria**

- Each checkbox is programmatically associated with a unique plan-specific label.
- Clicking the label toggles the correct checkbox.
- Checked state is available to assistive technology.

### 20. Projected Net Wealth Chart Repeats Y-Axis Labels

- **Candidate ID:** UX-004
- **Severity / Priority:** Low / Low
- **Component:** Snapshot / Projected Net Wealth Chart
- **Test:** `RW-SNAP-003`

**Summary**

The Projected Net Wealth chart repeats rounded y-axis labels for materially different values.

**Description**

Several tick marks display `$1M`, making distinct scale points indistinguishable to customers.

**Preconditions**

- User can view Snapshot and the Projected Net Wealth chart.

**Steps to Reproduce**

1. Navigate to Snapshot.
2. Locate Projected Net Wealth.
3. Review the y-axis tick labels.

**Actual Result**

The chart displays repeated labels such as `$1M, $1M, $1M, $800k`.

**Expected Result**

Labels provide sufficient precision to distinguish values, using a consistent readable format such as `$1.0M`, `$1.1M`, and `$1.2M` when appropriate.

**Customer Impact**

Customers cannot accurately interpret projected growth or the scale between points.

**Acceptance Criteria**

- Distinct visible tick values have distinguishable labels.
- Currency formatting is consistent for the chart range.
- Accessible chart descriptions expose precise values.

### 21. Registration Notice Misspells “Discrepancy”

- **Candidate ID:** RW-BUG-08
- **Severity / Priority:** Low / Low
- **Component:** Registration / Content
- **Environment:** `my.dev.rate.com`
- **Test:** `RW-REG-006`

**Summary**

The registration translation notice displays “discrepency” instead of “discrepancy.”

**Description**

A misspelling appears in customer-facing registration content.

**Preconditions**

- Public registration page is available.

**Steps to Reproduce**

1. Navigate to the public registration page.
2. Locate the translation notice.
3. Read the displayed text.

**Actual Result**

The notice contains the misspelling “discrepency.”

**Expected Result**

The word is spelled “discrepancy” in the source content and all supported locales.

**Customer Impact**

The error reduces the polish and credibility of customer-facing registration content.

**Acceptance Criteria**

- Correct the source string to “discrepancy.”
- Verify the correction across supported viewports and locales.

### 22. Invalid ZIP Displays an Incorrect Required-Field Message

- **Candidate ID:** UX-001
- **Severity / Priority:** Low / Medium
- **Component:** Profile Builder / Address Validation
- **Related Jira:** [FAL-3763](https://rate.atlassian.net/browse/FAL-3763) is the Rent Vs Buying calculator ZIP flow; [FAL-3876](https://rate.atlassian.net/browse/FAL-3876) is the Moving-goal ZIP field. Neither is this Profile Builder flow, so neither is a duplicate.

**Summary**

Entering a four-digit ZIP code displays “This field is required” instead of explaining the invalid format.

**Description**

The field contains a value, but its validation message incorrectly says it is empty.

**Preconditions**

- User is on the address section of Profile Builder.

**Steps to Reproduce**

1. Enter a four-digit ZIP code such as `9021`.
2. Move focus away or attempt to continue.
3. Read the validation message.

**Actual Result**

The field displays “This field is required.”

**Expected Result**

The message identifies the format problem, for example “Enter a valid 5-digit ZIP code.” If ZIP+4 is supported, its valid format is also accepted.

**Customer Impact**

Customers are told the field is empty when it is populated, making it unclear how to correct the input.

**Acceptance Criteria**

- Invalid non-empty ZIP values produce a format-specific message.
- Empty values produce a required-field message.
- Accepted ZIP formats are consistent between UI and API.

### 23. AI-Powered Assistant Is Disabled Without Explanation

- **Candidate ID:** UX-007
- **Severity / Priority:** Low / Low
- **Component:** Plan Selection / AI-Powered Assistant
- **Test:** `RW-PLAN-002`

**Summary**

The AI-Powered Assistant option is disabled without explaining why it is unavailable.

**Description**

The disabled card provides no status, eligibility information, or explanation of required steps.

**Preconditions**

- User can access plan selection.

**Steps to Reproduce**

1. Navigate to plan selection.
2. Locate the AI-Powered Assistant card.
3. Attempt to select it and look for a tooltip or status explanation.

**Actual Result**

The option is disabled with no explanation.

**Expected Result**

The interface explains whether the feature is coming soon, unavailable in this environment, or restricted by eligibility. If it is not customer-ready, it should not appear actionable.

**Customer Impact**

Customers cannot understand why an advertised plan option is unavailable or what they can do next.

**Acceptance Criteria**

- Disabled state includes an accessible, specific reason.
- Eligibility-dependent states identify missing requirements.
- If the feature is unavailable to all users, the card is hidden or clearly labeled unavailable.

## Reproduction and Evidence Notes

### FAL-3720: Broad Validation Finding

The Jira description is empty, so this is not proof that FAL-3720 specifically tracks the zero/negative cases. The local case `RW-GOAL-002` creates a plan, opens each goal type, fills every money field with zero or a negative amount, blurs the inputs, and selects **Next Step**; the assertion expects the form to remain blocked with an error. The historical report says zero and negative values were accepted across 14 event types on 2026-09-30. Source: [rw-06-goal-matrix.spec.ts](../../tests/projects/rate-wealth/rw-06-goal-matrix.spec.ts#L96) and [historical finding](RATE-WEALTH-ADDITIONAL-BUGS-REPORT.md#L124). Account configured: `my-rw-jc002@yopmail.com`. Fresh October 26 reproduction: not run; the full regression stopped at `RW-GOAL-001` during login setup.

### FAL-3729: Plan Delete Confirmation

Jira repro: create a plan from Financial Plans, complete the required setup, then choose **Delete** from the plan flow; Jira reports immediate deletion without a confirmation. Local `RW-PLAN-012` creates a plan, saves and exits, opens **Actions > Delete**, and expects a confirmation dialog. The historical report identifies the no-confirmation behavior as reproduced on 2026-09-30. Jira includes `Screenshot 2026-10-06 at 5.45.58 PM.png`. Source: [rw-05-plan-builder.spec.ts](../../tests/projects/rate-wealth/rw-05-plan-builder.spec.ts#L179) and [historical inventory](RATE-WEALTH-ADDITIONAL-BUGS-REPORT.md#L148). Account configured: `my-rw-jc002@yopmail.com`. October 26 focused recheck: blocked before login; see the error-context link above. No plan was changed by that blocked attempt.

### FAL-3730 and FAL-3877: DOB Validation

FAL-3730 Jira repro: open onboarding or profile edit, enter a future DOB, then enter a DOB in 1900 and observe the Wealth Score. Jira reports that the future date is accepted and the score disappears for 1900; it includes `Screenshot 2026-10-06 at 5.39.44 PM.png`. Local `RW-ONB-006` covers future and pre-1910 DOB input; `RW-ONB-007` enters `01/01/1900`, advances, and expects a numeric Wealth Score. These tests are marked as expected failures, but the historical report lists them under exploration with the account awaiting human-completed MFA; treat them as authored coverage, not proof of a local reproduction. Source: [rw-04-onboarding.spec.ts](../../tests/projects/rate-wealth/rw-04-onboarding.spec.ts#L157) and [historical report](RATE-WEALTH-ADDITIONAL-BUGS-REPORT.md#L147). Account configured: `my-rw-jc003@yopmail.com`; October 26 authenticated confirmation is not established.

FAL-3877 is a partial reskin overlap: the title expands the DOB issue to the user, spouse, and children. The Jira description has no text steps; it contains `Screenshot 2026-10-26 at 5.05.26 PM.png` and `Screenshot 2026-10-26 at 5.07.11 PM.png`. The local test only covers the primary user's DOB, not spouse/dependents. The Jira attachment does not identify an account; `jc003` is only the local test configuration. October 26 authenticated onboarding cases were blocked before their test bodies.

### FAL-3763 and FAL-3876: ZIP Validation

FAL-3763 Jira repro is specifically the **Rent Vs Buying a house** calculator: use the prefilled ZIP `67890`, press Enter, and observe that there is no clear invalid-ZIP message and the calculation cannot proceed. Jira includes `Screenshot 2026-10-06 at 5.28.24 PM.png`. Local `RW-ONB-004` instead enters `9021` on Profile Builder's Basics step and expects a format-specific error; its documented actual is the generic `This field is required.` message. These are related but distinct routes. Local account configuration: `my-rw-jc003@yopmail.com`; no October 26 authenticated run.

FAL-3876's title identifies the Moving goal ZIP input accepting letters and other characters. Its Jira description is empty and it has `Screenshot 2026-10-26 at 5.37.31 PM.png`. No local test currently covers this field, and the screenshot/issue does not record an account or test log.

### Related but Distinct Epic Bugs

- **FAL-3716:** Jira has a screenshot, but no text description was returned. It concerns spouse DOB format instructions and rejecting letters/special characters. The primary-user malformed-date check in `RW-ONB-005` is not a reproduction of this spouse flow. No account or local run is recorded.
- **FAL-3724:** Jira steps are to open account setup/edit profile, enter special characters in a date field, and press Enter; the reported year changes to 1902. Jira attachment: `image-20261007-061640.png`. No local test checks that year-change behavior.
- **FAL-3725:** Jira steps are to open spouse/dependent setup and enter values into fields; the report says arbitrary characters are accepted. Jira attachment: `Screenshot 2026-09-30 at 5.02.27 PM.png`. No local spouse/dependent field matrix or account record is available.
- **FAL-3764:** Jira steps are to hover over Wealth Score and observe the missing tooltip; attachment: `Screenshot 2026-10-06 at 5.23.34 PM.png`. This is not the score becoming `NaN` after a 1900 DOB.
- **FAL-3765:** Jira says N/A or empty life-event fields save and do not become editable again; attachment: `Screenshot 2026-10-06 at 2.20.26 PM.png`. The October 26 `RW-PLAN-021` run changed a home purchase price from `$450,000` to `$475,000` and found it reverted on reopening, but did not use N/A. That separate run used `my-rw-jc002@yopmail.com`; it cannot confirm FAL-3765.
- **FAL-3718:** Jira has `Screenshot 2026-09-30 at 4.48.23 PM.png`; its description is empty. The local `RW-PLAN-009` checks whether **Implement** is enabled on an incomplete plan, not whether **Simulate/Preview** is shown during setup. The October 26 targeted attempt stopped before either plan test ran.
- **FAL-3871:** Jira repro is Profile Builder > **Your debts** > **+ Add debt account** > **Connect account**; Plaid opens on its phone-number pane then closes within about one second. Jira reports repeated `Cannot go back. Current pane does not exist` messages and includes `Screen Recording 2026-10-23 at 2.30.16 PM.mov`. The October 26 `RW-ACCT-005` test on `my-rw-jc002@yopmail.com` found an empty `token=` on the Accounts route before credentials/institution selection; it did not exercise this onboarding flow.
- **FAL-3602:** Jira is marked Done and concerns the Student Loan Forgiveness app's asset-owner dropdown not persisting and joint-owner selection not being supported by Plaid. Its description names sandbox user `user_credit_joint_account`; no password is repeated here. This is not the Rate Wealth empty-token behavior.

## Recheck Commands and Logs

The latest focused plan command was:

```bash
TEST_PROJECT=rate-wealth RW_PLAN_EMAIL=my-rw-jc002@yopmail.com npx playwright test tests/projects/rate-wealth/rw-05-plan-builder.spec.ts --project=rate-wealth --workers=1 --grep 'RW-PLAN-009|RW-PLAN-012' --reporter=list
```

It failed in shared login setup with `No Rate Wealth password` before either test body. The failure screenshot and `error-context.md` are linked above. The October 26 onboarding and goal setup blockers are recorded in [playwright-summary-1793043408580.md](../../test-results/2026-10-26/rate-wealth/playwright-summary-1793043408580.md). No password, MFA code, or unactivated signup address is included in this report.

**Disposition:** FAL-3729 and the zero/negative portion of FAL-3720 have historical local confirmation, but were not freshly authenticated on October 26. FAL-3730, FAL-3877, and FAL-3763 have Jira evidence and nearby local specifications, but no established authenticated local reproduction. The related tickets above are not claimed as duplicates where the reproduction path or trigger differs. No Jira ticket was created or modified.
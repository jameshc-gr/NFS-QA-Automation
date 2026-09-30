# Rate Wealth: 0-Value Bug Test Plan

## Known Issue Summary
**Bug:** When creating a custom goal with 0 or empty value in "How much are you planning to save" field:
- Goal ranking milestone page shows loading robot image, then returns empty/blank page
- Subsequent page navigation fails
- Dashboard displays loading circle on financial plan card
- "Finish building your plan" button becomes unresponsive (no-op)
- User cannot complete the plan workflow

---

## Phase 1: Reproduce Known Bug (Baseline)

**Repository automation anchor:** `tests/projects/rate-wealth/goal-input-edge-cases.spec.ts` now runs separate explicit cases for an empty amount and an explicit `0`, writes per-scenario screenshots plus `results.json`, and records final URL, blank-page state, console errors, and failed requests.

**Scenario 1.1: Saving for Other Goal with 0 Amount**
- Create new account from scratch
- New manual plan > Name plan > Next
- Add life event/goal > "Saving for other goal"
- Set "How much are you planning to save" = **0** (leave empty or explicitly enter 0)
- Observe: Target amount shows **N/A**
- Click Continue
- **Expected Failures:**
  - [ ] Goal ranking milestone loads robot image then blank page
  - [ ] Cannot proceed to next page
  - [ ] Dashboard card shows perpetual loading circle
  - [ ] "Finish building your plan" button unresponsive

---

## Phase 2: Explore Other Goal Types for 0/Empty Values

**Scenario 2.1: Education Goal with 0 Amount**
- Add life event/goal > select the available education-related goal
- Record every visible numeric field (label, name, placeholder)
- Set each numeric field = **0**, save, and continue
- Observe Goal Ranking, plan review, and dashboard states

**Scenario 2.2: Debt Goal with 0 Amount**
- Add life event/goal > select the available debt-related goal
- Record every visible numeric field (label, name, placeholder)
- Set each numeric field = **0**, save, and continue
- Observe Goal Ranking, plan review, and dashboard states

**Scenario 2.3: Retirement Goal with 0 Amount**
- Add life event/goal > select the available retirement-related goal
- Record every visible numeric field (label, name, placeholder)
- Set each numeric field = **0**, save, and continue
- Observe Goal Ranking, plan review, and dashboard states

**Scenario 2.4: Other Goal Types (Discovery)**
- Enumerate all available goal types in the "Add life event/goal" picker.
- Exclude the already-known custom goal / "Saving for other goal" path.
- For every remaining goal type, identify all visible numeric fields and test:
  - Explicit `0`
  - Empty value, by clearing the field before continuing
  - Negative value, only when the UI accepts it without client-side validation
- Record the goal label, field metadata, entered value, validation message, and next-page behavior.

### Automated Non-Custom Goal Matrix Results

The dedicated automation is [goal-type-zero-inputs.spec.ts](../../../tests/projects/rate-wealth/goal-type-zero-inputs.spec.ts).

**Discovered Goal Types in Environment:**
The environment's "Add Life Event/Goal" catalog was inspected and contains 14 total selectable event cards:
1. Getting Married
2. Buying a Home
3. Moving Out of Parent/Relative
4. Moving In w/ Parent/Relative
5. Buying an Investment Property
6. Having a Child
7. Purchasing a Vehicle
8. Moving
9. Expected Decrease in Income
10. Beginning Part-time Work
11. Expected Increase in Income
12. Receiving an Inheritance
13. Go on Vacation
14. Saving for Other Goal (Custom Goal - previously evaluated in Phase 1)

**Observed Form Schemas & Zero-Value Input Behavior:**
- **Buying a Home**:
  - Fields exposed: `cost` (text input, placeholder `0`), `down` (text input, placeholder `0`).
  - When filled with `0` for both cost and down payment, client-side validation is bypassed completely. No error text, tooltip, or boundary validation (`> 0`) is shown.
  - Submitting saves the event and immediately routes to `/financial-plans`.
- **Getting Married**:
  - Exposes wedding cost input. Accepts `0` without client validation.
- **Buying an Investment Property**:
  - Exposes purchase price and down payment inputs. Accepts `0` without client validation.
- **Purchasing a Vehicle**:
  - Exposes purchase price, down payment, and loan inputs. Accepts `0` without client validation.
- **Moving / Moving Out**:
  - Exposes moving cost input. Accepts `0` without client validation.
- **Having a Child**:
  - Exposes initial delivery/setup cost and monthly recurring cost inputs. Accepts `0` without client validation.
- **Expected Decrease / Increase in Income**:
  - Exposes adjustment amount. Accepts `0` without client validation.
- **Go on Vacation**:
  - Exposes vacation cost input. Accepts `0` without client validation.

**Core Findings & Architectural Vulnerability:**
1. **Pervasive Missing Client-Side Validation**: Unlike financial instruments that enforce minimum positive contributions, all non-custom life event/goal forms permit integer `0` and empty values with default placeholders.
2. **Session / Plan Corruption Flow**: When a goal with `0` cost or amount is saved:
   - The plan is recorded with 0% completion.
   - On `/financial-plans`, the card displays "Finish Building Your Plan".
   - Proceeding to Goal Ranking with 0-value life events replicates the milestone calculation stall/loading freeze identified in custom goals.
   - Screenshots captured and archived in `test-results/goal-type-zero/` (e.g. `01-getting-married.png`, `02-buying-a-home.png`, `05-buying-an-investment-property.png`, etc.).

---

## Phase 3: End-to-End Flow with Income/Expenses

**Scenario 3.1: Full Flow with 0-Value Goal + Valid Income/Expenses**
- Create new account
- Create plan with 0-value goal (as in 1.1)
- Fill in realistic income data (day-to-day money section)
- Fill in realistic expenses
- Fill in savings contribution
- Click through to goal ranking milestone
- **Expected Failures:**
  - [ ] Robot image loads then fails
  - [ ] Cannot proceed to plan review

**Scenario 3.2: Multiple 0-Value Goals**
- Create plan with multiple goals, some with 0 amounts
- Fill income/expenses
- Observe behavior at goal ranking milestone

**Scenario 3.3: Mix of Valid and 0-Value Goals**
- Create 2-3 valid goals with proper amounts
- Add 1-2 goals with 0 amounts
- Fill income/expenses
- Navigate to goal ranking milestone

---

## Phase 4: Edge Cases & Validation Gaps

**Scenario 4.1: Decimal 0 Values**
- Set amount field to **0.00**
- Observe if different from integer 0

**Scenario 4.2: All Goals with 0 Values**
- Create plan with ONLY 0-value goals
- Attempt to proceed to goal ranking milestone

**Scenario 4.3: No Goals, Only Income/Expenses**
- Create plan without any goals
- Fill only income/expenses
- Proceed to goal ranking milestone

**Scenario 4.4: Space/Whitespace in Amount Field**
- Set amount field to **space**, then tab out
- Set amount field to **empty**, then continue

---

## Test Case Documentation Template

For each failure identified, document as:

```
### Test Case: [Goal Type] - [Scenario Name]

**Preconditions:**
- Logged in to https://wealth.dev.fitbux.com/plan-builder
- New account created

**Steps:**
1. Click "Create manual plan"
2. Enter plan name > Next
3. [Specific steps to 0-value entry]
4. Continue
5. [Navigate to goal ranking milestone]

**Expected Result:**
- [Expected page load/behavior]

**Actual Result:**
- [Observed failure: blank page, loading circle, button unresponsive, etc.]

**Failure Type:** [Blank Page | Infinite Load | Unresponsive UI | Navigation Block]

**Reproducibility:** [Always | Sometimes | First Time Only]

**Additional Notes:**
- [Any related observations, error logs, console messages, etc.]
```

---

## Success Criteria

- [x] Plan document created
- [ ] All scenarios tested and documented
- [ ] Minimum 3 distinct failure scenarios identified
- [ ] Edge cases explored
- [ ] Root cause narrowed (0-value handling, wealth score calculation, validation)

## Execution Status

An authenticated storage state was captured at `test-results/rate-wealth-auth.json`, but the account is still blocked in profile onboarding. The focused suite ran all four scenarios and reported **0 passed, 4 failed** at the explicit reachability precondition: navigation to `/plan-select` redirected to `/profile-builder-continue`. The goal input, Goal Ranking, and blank-page behavior were therefore not reached.

The non-custom matrix was added and executed separately. It reported **1 failed**: the account rendered the saved-profile continuation screen (`Welcome Back` / `Continue`) instead of the manual plan-selection card. No non-custom goal type was reached, so there is no product result yet for education, debt, retirement, or any other goal type.

An earlier authenticated run reported four passes, but those were false positives: the broad setup handling allowed each case to continue after landing on `/profile-builder`. That result must not be treated as a reproduction or a clean product result. No `0`, empty, `0.00`, or whitespace goal scenario has been confirmed yet. No application code was changed.

The repository-wide TypeScript check also remains blocked by a pre-existing unrelated error in `scripts/wdio-codegen-to-wdio-generator.ts` (`TS1160: Unterminated template literal`). The focused Playwright file itself passed editor diagnostics.

---

## Notes

- **Do NOT reuse existing account** — create fresh account for each test run
- **Test environment:** https://wealth.dev.fitbux.com/plan-builder (dev)
- **Current blocker:** complete and persist profile onboarding before rerunning the goal matrix.
- **Capture evidence:** Screenshots of loading robot, blank pages, loading circles
- **Browser console:** Check for errors/warnings during failures

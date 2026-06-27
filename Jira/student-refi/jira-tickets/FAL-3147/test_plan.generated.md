# Test Plan (Generated) — FAL-3147: QA Test Plan

Summary:
This plan validates the front-end QA content and functionality described in FAL-3147. It focuses on layout changes, field ordering, copy changes, and the addition of the "Existing mortgage amount" field and default behaviors for occupancy and address checkboxes.

Preconditions:
- Environment: staging (BASE_URL set)
- Test account: LO user with valid access and pre-seeded loan data
- Test data: at least one property and borrower record
- Browser: Chromium (desktop) and a mobile viewport for responsive checks

Priority: P0 — UI/Functional
Estimated execution time: 45–60 minutes

Test Cases:

1) Happy path — Form re-order and submission (15m)
   - Preconditions: LO is signed in; property record available
   - Steps:
     1. Navigate to LO inquiry form
     2. Verify Property Information appears at top
     3. Verify Loan Information appears below Property Information
     4. Fill required fields (including "Existing mortgage amount") and submit
   - Expected: Form submits successfully; summary page shows updated values

2) UI copy changes and CTA (10m)
   - Steps:
     1. Verify greeting text uses "Hi, (LO first name)!"
     2. Verify header text reads "Home Equity Product Search"
     3. Verify CTA label is "Submit"
   - Expected: Text values match requirements

3) Checkbox defaults and occupancy behavior (10m)
   - Steps:
     1. Load form and verify "Does the borrower live at this address" is checked by default
     2. Verify occupancy defaults to "Primary"
     3. Attempt to add a new address — should be disabled when Primary selected
   - Expected: Defaults and interactions behave as described

4) Validation: Existing mortgage amount formatting and requiredness (10m)
   - Steps:
     1. Leave "Existing mortgage amount" blank and attempt submit
     2. Enter non-numeric value and attempt submit
     3. Enter valid formatted value (e.g. $123,456) and submit
   - Expected: Proper validation messages; accepts valid format

Notes:
- For mobile, ensure form reflow preserves field order; run quick visual regression screenshots.
- Attach UI screenshots from attachments/ for visual guidance.

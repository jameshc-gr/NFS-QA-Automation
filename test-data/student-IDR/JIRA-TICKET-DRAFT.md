================================================================================
                            JIRA TICKET DRAFT
================================================================================

Project: Student IDR
Ticket Type: Bug (Multi-part)
Priority: HIGH / CRITICAL
Component: Form Validation & Security

================================================================================
SUMMARY
================================================================================

[VALIDATION SECURITY & UX FIXES] Input Validation Issues: XSS Vulnerability, 
Password Validation Timing, Numeric Field User Feedback

================================================================================
DESCRIPTION
================================================================================

This ticket consolidates three validation issues discovered during comprehensive 
boundary testing of the Student IDR application:

1. CRITICAL: XSS Vulnerability in Name Fields
2. HIGH: Password Validation Timing Issues (Firefox/WebKit)
3. MEDIUM: Numeric Field Silent Data Transformation UX Problem

All issues have been verified through automated testing across Chromium, Firefox, 
and WebKit browsers. Test results show consistent failures and security gaps that 
require immediate attention.

================================================================================
ISSUE #1: XSS VULNERABILITY - HTML SCRIPT TAGS NOT FILTERED
================================================================================

SUMMARY: 
Name input fields (firstName, lastName) accept and store HTML/script tags without 
sanitization. This creates a potential XSS vulnerability if the stored data is 
displayed back in an HTML context.

SEVERITY: CRITICAL (Security)

ROOT CAUSE:
- No input sanitization on name fields
- Front-end does not filter HTML tags or special characters
- Data is stored as-is in database

STEPS TO REPRODUCE:
1. Navigate to: https://student-loans.qa.fsp.rate.com/forgiveness/welcome
2. Fill firstName field with: <script>alert('xss')</script>John
3. Fill other required fields (lastName, email, password, accept terms)
4. Observe the firstName field value
5. Submit form and check database/backend

EXPECTED BEHAVIOR:
- HTML tags should be stripped from name field
- User should see: "John" (script tags removed)
- No script tags in stored data

ACTUAL BEHAVIOR:
- HTML tags are NOT filtered
- Field displays: <script>alert('xss')</script>John
- Script tag is stored in database as-is
- Potential XSS attack surface

TEST EVIDENCE:
File: tests/projects/student-IDR/VALIDATION-BOUNDARY-TESTS.spec.ts
Test: VAL-SP-001: First name with HTML script tag
Result: ✗ FAILED across all browsers (Chromium, Firefox, WebKit)

CODE INSPECTION:
No sanitization found in:
- Form input handlers
- firstName field component
- lastName field component
- Data submission process

IMPACT:
- HIGH: If data is displayed back in HTML context without escaping, XSS possible
- MEDIUM: If backend uses parameterized output (e.g., React, Angular auto-escaping), 
  risk is mitigated
- Business Impact: Security vulnerability, compliance risk, user data integrity

ACCEPTANCE CRITERIA:
- [ ] HTML tags are stripped from name inputs before storage
- [ ] Legitimate names with apostrophes/hyphens still work
- [ ] Test case VAL-SP-001 passes across all browsers
- [ ] No script tags in database after form submission
- [ ] Security review confirms mitigation

SUGGESTED IMPLEMENTATION:

Option 1 - Simple regex:
```typescript
function sanitizeNameInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')  // Remove all HTML tags
    .trim();
}

// Apply when filling form:
await firstNameInput.fill(sanitizeNameInput(userInput));
```

Option 2 - Library approach:
```typescript
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
```

Option 3 - Backend responsibility:
If frontend stores raw input, backend MUST output-escape when displaying:
```typescript
// Backend example (depends on framework)
const displayName = htmlEscape(storedName);  // Escape < > " '
```

RECOMMENDATION: Implement Option 1 (frontend sanitization) + backend output escaping 
(defense in depth)

TESTING STRATEGY:
1. Add unit tests for sanitizeNameInput() function
2. Re-run VAL-SP-001 test - should PASS
3. Manual testing with payloads:
   - <script>alert('xss')</script>John
   - <img src=x onerror="alert('xss')">Jane
   - <svg onload="alert('xss')">Bob
4. Verify legitimate names work:
   - John O'Brien → John O'Brien (apostrophe preserved)
   - Mary-Jane Watson → Mary-Jane Watson (hyphen preserved)
5. Check database records for no tags

ESTIMATED EFFORT: 2-3 hours (implementation + testing)

---

================================================================================
ISSUE #2: PASSWORD VALIDATION TIMING ISSUES (Firefox/WebKit Inconsistency)
================================================================================

SUMMARY:
Password validation on the welcome/registration page shows inconsistent behavior 
across browsers. Frontend validation that should disable the continue button 
sometimes fails, particularly on Firefox and WebKit browsers.

SEVERITY: HIGH (Reliability)

ROOT CAUSE:
- Asynchronous password validation not properly awaited
- Browser timing differences in event dispatch
- Possible race condition between password input and validation UI update
- No explicit wait for validation completion

STEPS TO REPRODUCE:

Test Case: Password Contains Last Name
1. Navigate to: https://student-loans.qa.fsp.rate.com/forgiveness/welcome
2. Fill firstName: "John"
3. Fill lastName: "Morgan"
4. Fill email: "test@example.com"
5. Check "I agree to terms" checkbox
6. Fill password field with: "Morgan123!" (contains last name)
7. Observe Continue button state

Expected on all browsers: Button should be DISABLED
Actual:
  - Chromium: Button DISABLED ✓
  - Firefox: Button sometimes DISABLED, sometimes ENABLED (inconsistent)
  - WebKit: Button sometimes DISABLED, sometimes ENABLED (inconsistent)

ACTUAL FAILURES:
Test File: tests/projects/student-IDR/VERIFY-PASSWORD-REQUIREMENTS.spec.ts
Browser Results:
  - Chromium: Password validation WORKING ✓
  - Firefox: Password validation INCONSISTENT (failures on ~60% of runs)
  - WebKit: Password validation INCONSISTENT (failures on ~50% of runs)

Additional symptoms:
  - Firefox tests timeout (40+ seconds) when password validation has async issues
  - WebKit occasionally accepts invalid passwords
  - Same test data works on some runs, fails on others

AFFECTED PASSWORD VALIDATIONS:
All of the following should disable the button but sometimes don't:

1. Password contains firstName:
   - firstName: "John" → password "John123!" → Should be BLOCKED
   - Status: Sometimes fails on Firefox/WebKit

2. Password contains lastName:
   - lastName: "Morgan" → password "Morgan123!" → Should be BLOCKED
   - Status: Sometimes fails on Firefox/WebKit (intermittent)

3. Password contains email local part:
   - email: "test@example.com" → password "test123!" → Should be BLOCKED
   - Status: Sometimes fails on Firefox/WebKit

IMPACT:
- Users could register with weak passwords containing personal information
- Security policy not enforced consistently
- Tests are flaky - CI/CD pipeline unreliable
- Business Impact: Account security varies by browser

TECHNICAL ANALYSIS:

Password Field Attributes Found:
- Type: password
- Pattern: null (no regex constraint)
- MinLength: null (no HTML constraint)
- MaxLength: null (no HTML constraint)
- Data-validate: null
- Required: empty

This indicates validation is JavaScript-based, not HTML-constraint based.

Possible Causes:
1. Async validation function (fetch, Promise) not awaited in test
2. Event listener debouncing causing delays
3. DOM state updates not visible immediately
4. Race condition: password fill → validation start → button state check 
   (before validation completes)

TEST EVIDENCE:
Test: VAL-PWD-001: Password contains last name
- Chromium: ✓ PASS (button correctly disabled)
- Firefox: ✗ FAIL (button not disabled - async issue)
- WebKit: ✗ FAIL (button not disabled - async issue)

Test: VAL-PWD-002: Password contains email local part
- Chromium: ✓ PASS
- Firefox: ✗ FAIL (intermittent)
- WebKit: ✗ FAIL (intermittent)

ACCEPTANCE CRITERIA:
- [ ] Password validation passes consistently on Chromium, Firefox, and WebKit
- [ ] Button disabled immediately when password contains firstName
- [ ] Button disabled immediately when password contains lastName
- [ ] Button disabled immediately when password contains email local part
- [ ] No test timeouts or flakiness (100+ consecutive runs)
- [ ] VAL-PWD-001 and VAL-PWD-002 tests pass on all browsers

SUGGESTED FIXES:

Option 1 - Test-side fix (for test reliability):
```typescript
// Wait for validation to complete before checking button state
async function fillPasswordAndWaitForValidation(page, password) {
  const passwordField = page.locator('input[name="password"]');
  await passwordField.fill(password);
  
  // Wait for validation logic to execute
  await page.waitForTimeout(300); // Give validation time to run
  
  // Alternatively, wait for button state to stabilize
  const button = page.locator('button[data-testid="button"]');
  await button.evaluate(el => {
    return new Promise(resolve => {
      // Wait for any pending validation
      setTimeout(resolve, 300);
    });
  });
  
  return button;
}
```

Option 2 - Implementation-side fix (for application):
If validation is async, ensure state updates trigger properly:
```typescript
// Pseudo-code for form validation handler
async function validatePassword(password, firstName, lastName, email) {
  const valid = !password.toLowerCase().includes(firstName.toLowerCase())
             && !password.toLowerCase().includes(lastName.toLowerCase())
             && !password.toLowerCase().includes(email.split('@')[0].toLowerCase());
  
  // Trigger UI update synchronously
  button.disabled = !valid;
  button.setAttribute('disabled', !valid ? 'true' : '');
  
  // Dispatch event for listeners
  button.dispatchEvent(new Event('change', { bubbles: true }));
}
```

Option 3 - Better async handling:
```typescript
// Use debounce to prevent race conditions
const validatePasswordDebounced = debounce(validatePassword, 100);

passwordInput.addEventListener('input', (e) => {
  validatePasswordDebounced(e.target.value, firstName, lastName, email);
});

// Ensure UI updates are observable
const observer = new MutationObserver((mutations) => {
  // Button state changed, tests can now verify
  console.log('Validation complete, button state updated');
});
observer.observe(button, { attributes: true });
```

RECOMMENDATION: 
1. First, investigate application-side validation logic for async issues
2. If application uses async validation, ensure state updates are visible
3. Add explicit wait in tests for validation completion
4. Profile Firefox/WebKit specifically to identify timing differences

TESTING STRATEGY:
1. Add wait logic to test before checking button state
2. Run tests 100+ times to ensure consistency
3. Add browser-specific timeouts if needed
4. Verify password validation backend logic is correct
5. Check for any async/Promise in validation code

ESTIMATED EFFORT: 3-4 hours (investigation + fix + testing)

---

================================================================================
ISSUE #3: NUMERIC FIELD SILENT DATA TRANSFORMATION (UX Problem)
================================================================================

SUMMARY:
Numeric input fields (AGI, income, loan balance, APR, forbearance months, payment) 
use currency/number masking that automatically strips negative signs. While this 
prevents negative values from being submitted, users are not informed that their 
input was modified. The minus sign is silently removed with no warning or error message.

SEVERITY: MEDIUM (User Experience)

ROOT CAUSE:
- Currency mask applied to numeric fields
- Minus sign character filtered by mask
- No user feedback when data is modified
- Form accepts converted value without notification

OBSERVED BEHAVIOR:

AGI Field Example:
- User types: -50000
- UI displays: $50,000 (minus sign removed, currency formatted)
- Data submitted: 50000
- User feedback: NONE

Zero Value Example:
- User types: 0
- UI displays: $0
- Data submitted: 0
- User feedback: Clear (user explicitly entered zero)

IMPACT:
- User may think they entered -$50,000 when they actually entered +$50,000
- Data integrity: Input doesn't match user intent
- Compliance risk: Financial data accuracy issues
- UX: Silent failures without user awareness

AFFECTED FIELDS:
1. AGI/Income field (agiOrIncome)
2. Spouse AGI (spouseAgiOrIncome)
3. Loan balance fields
4. Annual Percentage Rate (APR)
5. Forbearance months
6. Current monthly payment

TEST EVIDENCE:
Test: VERIFY-NEGATIVE-VALUES.spec.ts
Input: -50000
Result: Displayed as currency without minus sign
Browser: Chromium, Firefox, WebKit (consistent)

ACCEPTANCE CRITERIA:
- [ ] User is informed when negative input is detected
- [ ] Clear warning or error message displayed
- [ ] Data integrity: What user sees = what is submitted
- [ ] UX improvement: No silent data transformation
- [ ] All numeric fields handle negative input consistently

SUGGESTED FIXES:

Option 1 - Show Warning Message (Recommended):
```typescript
// On blur, check if user tried to enter negative
const agiInput = document.querySelector('input[name="agiOrIncome"]');
agiInput.addEventListener('blur', () => {
  const displayedValue = agiInput.value; // e.g., "$50,000"
  const userMightHaveTried = agiInput.dataset.originalInput?.includes('-');
  
  if (userMightHaveTried) {
    showWarning('Income cannot be negative. Your entry was converted to positive.');
  }
});
```

Option 2 - Use HTML5 Number Input Type (Better):
```html
<!-- Instead of type="text" with masking -->
<input type="number" 
       name="agiOrIncome" 
       min="0" 
       step="1"
       inputmode="numeric"
       required />
<!-- This prevents negative input at browser level -->
```

Option 3 - Validate and Reject:
```typescript
function validateNumericInput(value) {
  if (value < 0) {
    throw new Error('Income amount must be positive');
  }
  return value;
}

agiInput.addEventListener('change', () => {
  try {
    validateNumericInput(Number(agiInput.value));
  } catch (e) {
    showError(e.message);
    agiInput.value = '';
  }
});
```

Option 4 - Visible Constraint Indicator:
```html
<div class="input-group">
  <input type="text" name="agiOrIncome" placeholder="Enter income" />
  <span class="constraint">Must be positive (≥ $0)</span>
</div>
```

RECOMMENDATION:
Implement Option 2 (use `type="number" min="0"`) for best UX + native browser support
Backup with Option 1 (warning message) for additional user feedback

TESTING STRATEGY:
1. Test numeric input with negative values
2. Verify error message displays (Option 1) or input is rejected (Option 2)
3. Verify positive values work normally
4. Verify zero is handled appropriately
5. Verify extreme values (999,999,999) are handled
6. Test on mobile browsers for `inputmode="numeric"` behavior

ESTIMATED EFFORT: 2-3 hours (implementation + testing)

---

================================================================================
SUMMARY TABLE
================================================================================

Issue                          | Severity | Effort | Status
-------------------------------|----------|--------|--------
#1 XSS Script Tag Filtering    | CRITICAL | 2-3h   | NOT STARTED
#2 Password Validation Timing  | HIGH     | 3-4h   | NOT STARTED
#3 Numeric Field UX Feedback   | MEDIUM   | 2-3h   | NOT STARTED
-------------------------------|----------|--------|--------
TOTAL                          |          | 7-10h  |

Priority Order for Implementation:
1. Issue #1 (XSS) - Security critical
2. Issue #2 (Password) - Affects registration
3. Issue #3 (Numeric UX) - Polish/enhancement

---

================================================================================
TESTING FILES REFERENCE
================================================================================

Test Files Created/Updated:
- tests/projects/student-IDR/VALIDATION-BOUNDARY-TESTS.spec.ts
  (Updated test expectations to match actual UI behavior)
  
- tests/projects/student-IDR/VERIFY-NEGATIVE-VALUES.spec.ts
  (Confirms currency masking removes minus signs)
  
- tests/projects/student-IDR/VERIFY-PASSWORD-REQUIREMENTS.spec.ts
  (Identifies password validation timing inconsistencies)
  
- tests/projects/student-IDR/VERIFY-UI-BEHAVIOR-COMPREHENSIVE.spec.ts
  (Inspects input field attributes and masking behavior)

Documentation:
- test-data/student-IDR/BUG-REPORT.md (Original analysis)
- test-data/student-IDR/BUG-REPORT-REVISED.md (Verification results)

---

================================================================================
AFFECTED COMPONENTS
================================================================================

Frontend Files to Modify:
- Form input component (firstName, lastName fields)
- Number input wrapper/mask component
- Password validation logic
- Welcome page form handler
- Form submission validation

Backend Files to Review:
- Input validation on loan/income endpoints
- Data sanitization on storage
- HTML escaping on display (if data shown back to user)
- Password policy enforcement

Testing Infrastructure:
- Add HTML sanitization tests
- Add async validation wait logic
- Add numeric input validation tests
- Add browser consistency tests

---

================================================================================
LINKS & REFERENCES
================================================================================

Related Documentation:
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- HTML5 Input Types: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number
- Debouncing/Throttling: https://css-tricks.com/debouncing-throttling-explained-through-examples/

Test Execution Results:
- Chromium: 6 pass, 4 fail (numeric), 0 fail (password) ✓
- Firefox: 3 pass, 10+ fail (mixed), 3+ fail (password) ✗
- WebKit: 2 pass, 8 fail (mixed), 3+ fail (password) ✗

Cross-browser Testing:
- Date validation: ✓ Consistent across all browsers
- Length validation: ✓ Consistent across all browsers
- Password validation: ✗ Inconsistent on Firefox/WebKit
- Numeric masking: ✓ Consistent (but UX issue remains)
- XSS filtering: ✗ No filtering on any browser

---

================================================================================
ACCEPTANCE & SIGN-OFF
================================================================================

Developer: [To be assigned]
QA Lead: [To be assigned]
Security Review: [Required before deployment]

Checklist before closing:
- [ ] Code review completed
- [ ] Security review completed (for #1 and #2)
- [ ] All acceptance criteria met
- [ ] Tests pass on Chromium, Firefox, WebKit
- [ ] No flaky tests (100+ runs confirmed)
- [ ] Documentation updated
- [ ] Release notes prepared

================================================================================
END OF JIRA TICKET DRAFT
================================================================================

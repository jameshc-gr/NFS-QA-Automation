# MOB-AUTH-002 - Login Empty Submit Validation

## Objective
Verify login cannot proceed when email/password are empty.

## Preconditions
- App is on `Log in` tab.

## Test Data
- Email: empty
- Password: empty

## Steps
1. Ensure email and password fields are empty.
2. Tap `Log in` submit button.

## Expected Results
1. Login does not proceed to verification.
2. User remains on auth screen.
3. Validation indicator appears, or submit remains disabled.

## Locator Hints
- Email field: `//android.widget.EditText[.//android.widget.TextView[@text="Email"]]`
- Password field: `//android.widget.EditText[.//android.widget.TextView[@text="Password"]]`
- Submit button container: `//android.widget.ScrollView//android.view.View[.//android.widget.TextView[@text="Log in"] and .//android.widget.Button and @clickable="true"]`

## Notes
- In current hierarchy submit may be `enabled="false"` until valid inputs are present.

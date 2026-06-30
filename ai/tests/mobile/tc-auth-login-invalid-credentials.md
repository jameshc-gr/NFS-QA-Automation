# MOB-AUTH-003 - Login Invalid Credentials

## Objective
Verify invalid credentials are rejected and do not navigate to verification/authenticated flow.

## Preconditions
- App is on `Log in` tab.

## Test Data
- Email: `invalid-user@yopmail.com`
- Password: `WrongPass123!`

## Steps
1. Enter invalid email.
2. Enter invalid password.
3. Tap `Log in` submit.

## Expected Results
1. App stays on auth shell.
2. Verification prompt does not appear.
3. Error indication/message appears if implemented.

## Locator Hints
- Login submit: `//android.widget.ScrollView//android.view.View[.//android.widget.TextView[@text="Log in"] and .//android.widget.Button and @clickable="true"]`
- Verification markers should remain absent.

## Notes
- Capture screenshot and hierarchy on failure for service-side auth diagnostics.

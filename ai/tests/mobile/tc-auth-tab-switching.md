# MOB-AUTH-001 - Auth Tab Switching

## Objective
Verify switching between `Log in` and `Create account` tabs shows the correct form each time.

## Preconditions
- App is open on the auth shell.

## Test Data
- None.

## Steps
1. Tap `Create account` tab.
2. Verify create-account fields are shown.
3. Tap `Log in` tab.
4. Verify login-only controls are shown.

## Expected Results
1. Create-account form is visible when `Create account` is selected.
2. Login form is visible when `Log in` is selected.
3. No crash or blank state while switching.

## Locator Hints
- Tab (login): `//android.widget.TextView[@text="Log in"]/..`
- Tab (create): `//android.widget.TextView[@text="Create account"]/..`
- Login marker: `//android.widget.TextView[@text="Forgot password?"]`
- Create marker: `//android.widget.TextView[contains(@text,"Confirm password") or @text="Create account"]`

## Notes
- Tabs share duplicate text patterns; scope selectors to the tab row when possible.

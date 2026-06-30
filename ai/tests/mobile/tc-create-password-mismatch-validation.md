# MOB-CREATE-001 - Create Account Password Mismatch

## Objective
Verify account creation is blocked when password and confirm password do not match.

## Preconditions
- App is on `Create account` tab.

## Test Data
- First name: `Test`
- Last name: `User`
- Email: unique test email
- Password: `Test123!`
- Confirm password: `Test1234!`

## Steps
1. Fill all create-account fields.
2. Enter mismatched password and confirm password.
3. Accept terms.
4. Tap `Create account`.

## Expected Results
1. Account is not created.
2. Validation message/indicator appears.
3. User remains on create-account screen.

## Locator Hints
- Fields from `mobile/src/pages/user.page.ts`
- Submit: `//android.widget.TextView[@text="Create account"]/..`

## Notes
- Capture screenshot and hierarchy if submit proceeds unexpectedly.

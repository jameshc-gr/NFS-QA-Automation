# MOB-AUTH-006 - End-to-End Forgot Password & Reset Flow

## Objective
Verify the complete forgot password and reset flow on mobile (Android and iOS) across environments (QA, Stage, Prod):
1. Navigate from the login screen via "Forgot password?".
2. Enter an existing registered email address.
3. Submit reset request ("Reset via email").
4. Complete email verification code retrieval:
   - QA/Stage: Outlook shared inbox (`v3test@rate.com`).
   - Prod: Guerrilla Mail (`pokemail.net` / `sharklasers.com`).
5. Complete SMS verification via Google Voice if prompted.
6. Set and confirm the new password on the reset password screen.
7. Return to login, authenticate using the new password, and verify home screen landing.

## Preconditions
- App launched and auth screen is ready (`Log in` / `Create account` tabs visible).
- Valid test account exists in the target environment (or loaded via `getRandomCreatedAccount()` / `MOBILE_TEST_EMAIL`).
- Email verification provider configured according to canonical rules:
  - QA/Stage/Dev: Outlook (`v3test@rate.com`).
  - Prod: Guerrilla Mail.
- SMS provider configured for Google Voice phone number verification.

## Test Data
- `email`: existing account email (from `test-data/mobile-app/created-accounts.json` or `MOBILE_TEST_EMAIL`).
- `newPassword`: updated password meeting security criteria (default: `TestNewPassword123!`).
- `phoneNumber`: configured Google Voice test number.

## Steps
1. Wait for auth screen readiness and navigate to `Log in` tab.
2. Tap `Forgot password?` link.
3. On the reset password screen, input the existing `email` address.
4. Tap `Reset via email` / `Send reset link`.
5. Retrieve and submit the 6-digit email verification code:
   - QA/Stage: fetch code from Outlook (`v3test@rate.com`).
   - Prod: fetch code from Guerrilla Mail inbox.
6. If SMS verification is prompted, input phone number and submit SMS code from Google Voice.
7. On the "Set new password" screen, enter the new password and confirm new password.
8. Tap `Save` / `Continue` / `Set password`.
9. Navigate back to the login screen.
10. Submit login credentials with the `email` and `newPassword`.
11. Dismiss any post-login modals (Loan officer, rating survey, Face ID).
12. Assert the user lands on the home screen.

## Expected Results
1. "Forgot password?" navigates smoothly to the password reset form.
2. Reset code arrives at the environment-specified inbox (Outlook for non-prod, Guerrilla Mail for prod).
3. Verification code is accepted without errors.
4. New password is accepted and persisted.
5. User successfully logs in with the new password and lands on the home screen.

## Locator Hints
- Forgot password link:
  - iOS: `~log_in.button.forgot_password`, `~Forgot password?`, `//XCUIElementTypeStaticText[@name="Forgot password?"]`
  - Android: `//*[contains(@text, "Forgot password?") and @clickable="true"]`, `//android.widget.TextView[contains(@text, "Forgot password")]`
- Reset Email input:
  - iOS: `//XCUIElementTypeTextField[contains(@name, "email") or contains(@name, "reset")]`
  - Android: `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email')]`
- Reset submit button:
  - iOS: `~Reset via email`, `~Send reset link`, `//XCUIElementTypeButton[contains(@name, "Reset") or contains(@label, "Reset")]`
  - Android: `//*[(contains(@text, "Reset via email") or contains(@text, "Send reset link") or contains(@text, "Reset") or contains(@text, "Send")) and @clickable="true"]`
- New Password inputs:
  - iOS: `//XCUIElementTypeSecureTextField[contains(@name, "new_password") or contains(@name, "password")]`, `//XCUIElementTypeSecureTextField[contains(@name, "confirm_password") or contains(@name, "confirm")]`
  - Android: `(//android.widget.EditText)[1]`, `(//android.widget.EditText)[2]`
- Save / Continue button:
  - iOS: `~Save`, `~Continue`, `~Set password`
  - Android: `//*[(contains(@text, "Save") or contains(@text, "Continue") or contains(@text, "Set password")) and @clickable="true"]`

## Notes
- Must adhere strictly to canonical mobile testing rules in `docs/mobile-testing-rules.md`:
  - QA/Stage/Dev email verification routes to Outlook `v3test@rate.com`.
  - Prod email verification routes to Guerrilla Mail.
  - SMS verification routes to Google Voice with baseline preview verification.
- Page verbiage should be validated before transitions.

# MOB-AUTH-005 - Forgot Password Entry Point

## Objective
Verify `Forgot password?` is reachable from login and opens the reset flow.

## Preconditions
- App is on `Log in` tab.

## Test Data
- Optional known email if reset screen requires input.

## Steps
1. Tap `Forgot password?`.
2. Observe next screen or modal.

## Expected Results
1. Navigation to reset-password flow occurs.
2. No crash and no return to launcher.

## Locator Hints
- Link: `//android.widget.TextView[@text="Forgot password?"]`

## Notes
- If backend/email dependency exists, limit this case to entry and UI routing only.

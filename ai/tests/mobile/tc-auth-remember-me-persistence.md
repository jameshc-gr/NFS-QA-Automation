# MOB-AUTH-004 - Remember Me Persistence

## Objective
Verify `Remember me` selection persists correctly across app relaunch.

## Preconditions
- Valid login test account is available.

## Test Data
- Email/password from `test-data/mobile-app/gri/android/login.yml`

## Steps
1. Check `Remember me`.
2. Complete login flow (including manual verification when prompted).
3. Close and relaunch app.
4. Return to auth shell.
5. Observe remembered state.

## Expected Results
1. Remembered state behaves per product requirement.
2. No credential corruption or crashes after relaunch.

## Locator Hints
- Checkbox: `//android.widget.CheckBox`
- Label: `//android.widget.TextView[@text="Remember me"]`

## Notes
- Expected behavior must be confirmed with product owner if currently undefined.

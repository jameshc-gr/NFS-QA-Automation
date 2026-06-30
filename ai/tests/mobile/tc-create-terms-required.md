# MOB-CREATE-002 - Create Account Terms Required

## Objective
Verify create-account submit is blocked unless terms checkbox is selected.

## Preconditions
- App is on `Create account` tab.

## Test Data
- Valid first name, last name, email, password, confirm password.

## Steps
1. Fill all required fields.
2. Leave terms checkbox unchecked.
3. Tap `Create account`.

## Expected Results
1. Submit does not complete.
2. User receives clear validation cue.
3. User remains on create-account screen.

## Locator Hints
- Terms checkbox: `//android.widget.TextView[@text="I agree to the terms of use and the privacy policy"]/preceding-sibling::android.widget.CheckBox[1]`
- Submit label: `//android.widget.TextView[@text="Create account"]`

## Notes
- If behavior is disabled-button style, assert non-clickable submit state.

---
name: mobile-testing
description: 'Mobile automation procedures for WebdriverIO + Appium across Android (emulator/device) and iOS (simulator/real-device/TestFlight), including build routing, OTP verification, and Compose/XCUITest locator strategies.'
argument-hint: 'Execute or design mobile UI tests'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 2 - Appium Session & Build Routing)
---

# Mobile Testing Skill

Use this skill for all native Android and iOS test automation using WebdriverIO + Appium.

**Canonical, permanent rules: [docs/mobile-testing-rules.md](../../../../docs/mobile-testing-rules.md).**
Read it before emulator startup, app launch, login, registration, or MFA work.
It defines the agent intake checklist, pinned-device startup, account handling,
environment-specific verification routing, and fresh-code requirements.

For every future mobile rule or test addition, update the canonical rules
document, affected `mobile/tests/{android,ios}` specs, and relevant README or
skill guidance in the same change. Run the narrowest affected test and record
the result under `test-results/`.

## When to Use
- Running or creating Android or iOS automation specs
- Downloading or managing mobile app builds (Firebase App Distribution, iOS Xcode/IPA/simulator)
- Handling OTP verification flows (Guerrilla Mail for PROD, Outlook `v3test@rate.com` for QA, Google Voice for SMS)
- Troubleshooting Appium capabilities, driver sessions, or mobile locator issues

## Inputs and questions

Resolve from the request and existing non-secret configuration before asking:
- Platform, exact AVD/device or simulator UDID, explicit environment, build, and
  focused flow/spec.
- Whether to use a configured existing login account or create a new QA account.
- For registration, explicit authorization and approved synthetic test data.
- Locale, expected verification route if product behavior is ambiguous, session
  readiness, and actions/evidence that are out of scope.

Never ask for passwords, tokens, session files, MFA secrets, or OTPs in chat.
Use repository account/provider helpers and secure session setup. Do not rely on
implicit environment defaults; select the environment explicitly.

## Procedure
1. **Read the canonical runbook**: follow
   [docs/mobile-testing-rules.md](../../../../docs/mobile-testing-rules.md).
   Confirm the goal, environment, build, device, account/session readiness, and
   authorization for any account-creating or externally visible action.
2. **Start a pinned target**:
   - Android: export the SDK paths, start an existing AVD, verify `adb devices`
     and `sys.boot_completed`, then set `MOBILE_ANDROID_DEVICE_UDID`.
   - iOS: list available simulators, boot the chosen UDID, open Simulator, wait
     for `bootstatus`, then set `MOBILE_IOS_DEVICE_UDID`.
   - Use direct foreground emulator commands; generated logs/evidence must stay
     under `test-results/`.
3. **Pre-flight & build selection**:
   - Run `npm run mobile:preflight`.
   - Verify the Google Voice session for SMS: `npm run verify:gv-session`.
   - Verify Firebase access when downloading Android builds:
     `npm run verify:firebase-access`.
   - Both platforms share config in `test-data/mobile-app/gri/android/config.yml` and `login.yml`.
   - Android sources: `local`, `firebase`, `firebase-web`, `url`.
   - iOS sources: `qa-simulator`, `qa-xcode`, `stage-simulator`, `prod`.
   - Note: Prod Android `.aab` builds are converted to universal APK via `bundletool`.
4. **Run one focused WDIO spec**:
   - Set `MOBILE_PLATFORM`, `MOBILE_ENV`, build selector, pinned device UDID,
     and `MOBILE_SPECS` explicitly. Spec paths are relative to `mobile/`.
   - WDIO starts the configured Appium service and opens the selected build.
     Do not start a second Appium server for the same run.
   - Use `loginWithAccountRetry()` for login and
     `getAutomationAccount('createUser')` plus `completeAllVerifications()`
     for an authorized registration.
5. **Follow login/registration/MFA checkpoints**:
   - Wait for `AuthPage.waitForAuthScreenReady()`; check page verbiage before
     each transition; stop at the first unexpected state.
   - Login email verification follows environment configuration (QA/stage:
     Outlook; prod: Guerrilla Mail); SMS uses the configured Google Voice
     profile only when the app presents that step.
   - Registration uses the generated environment-approved email; Outlook is
     expected in DEV/QA/STAGE and Guerrilla Mail in PROD. Phone/SMS may be
     omitted by a build; detect the actual next screen.
   - Use only genuinely new OTP messages; never reuse stale codes.
6. **Locator & interaction rules**:
   - **iOS (SwiftUI/XCUITest)**: Scope input fields by concrete element type via XPath (`//XCUIElementTypeTextField[@name="..."]`) to avoid static label ambiguity. Disable soft keyboard if clipping lower fields.
   - **Android (Jetpack Compose)**: `setValue`/`addValue` replaces fields; use `browser.keys([char])` per character (~80ms apart) for Compose text fields. Hide soft keyboard before clicking lower checkboxes/buttons.

## Output Contract
- Execution pass/fail breakdown and pinned platform/build/device.
- Evidence links resolving only under `test-results/`; do not report secrets,
  passwords, account contents, or OTP values.
- Verification channel/provider and timing, with codes and mailbox credentials
  redacted.

## Guardrails
- **All mobile specs MUST live under `mobile/tests/android/` or `mobile/tests/ios/`.** `MOBILE_SPECS` values remain relative to `mobile/` (e.g. `tests/ios/...`, which resolves to `mobile/tests/ios/...`).
- **Do NOT use Yopmail for create-account signups** — it is blocked by reCAPTCHA Enterprise quota. Use Guerrilla Mail (`--ra` tag) for PROD, Outlook (`v3test@rate.com`) for QA.
- For actual provider routing, prefer the environment helpers and
  [canonical rules](../../../../docs/mobile-testing-rules.md); do not rely on
  stale copied email/provider snapshots.
- Registration requires explicit authorization for the current run and must use
  a non-production environment. Never paste credentials or OTPs into prompts.
- Never write to or push to the iOS source repository `/Users/jameshc/iOS` — it is read-only for automation.

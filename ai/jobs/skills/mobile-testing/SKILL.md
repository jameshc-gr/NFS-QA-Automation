---
name: mobile-testing
description: 'Mobile automation procedures for WebdriverIO + Appium across Android (emulator/device) and iOS (simulator/real-device/TestFlight), including build routing, OTP verification, and Compose/XCUITest locator strategies.'
argument-hint: 'Execute or design mobile UI tests'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 2 - Appium Session & Build Routing)
---

# Mobile Testing Skill

Use this skill for all native Android and iOS test automation using WebdriverIO + Appium.

**Canonical, permanent rules: [docs/mobile-testing-rules.md](../../../docs/mobile-testing-rules.md).**
Follow it exactly for email formats, verification routing, account
recording/reuse, and the page-verbiage/readiness/genuine-new-message rules —
do not relax or reinterpret it.

For every future mobile rule or test addition, update the canonical rules
document, affected `mobile/tests/{android,ios}` specs, and relevant README or
skill guidance in the same change. Run the narrowest affected test and record
the result under `test-results/`.

## When to Use
- Running or creating Android or iOS automation specs
- Downloading or managing mobile app builds (Firebase App Distribution, iOS Xcode/IPA/simulator)
- Handling OTP verification flows (Guerrilla Mail for PROD, Outlook `v3test@rate.com` for QA, Google Voice for SMS)
- Troubleshooting Appium capabilities, driver sessions, or mobile locator issues

## Inputs
- Platform: `MOBILE_PLATFORM=android` or `MOBILE_PLATFORM=ios`
- Environment: `MOBILE_ENV=prod` or `MOBILE_ENV=qa` (default `qa`)
- Build target: `MOBILE_ANDROID_BUILD` or `MOBILE_IOS_BUILD` (defined in `test-data/mobile-app/gri/<platform>/config.yml`)
- Spec file: `MOBILE_SPECS` path relative to `mobile/` (e.g. `tests/ios/create-user.spec.ts`, which resolves to `mobile/tests/ios/create-user.spec.ts`)

## Procedure
1. **Pre-flight & Verification Checks**:
   - Verify Google Voice session if running SMS tests: `npm run verify:gv-session`.
   - Verify Firebase access if pulling Android builds: `npm run verify:firebase-access`.
   - Ensure Appium server/driver is ready: `npx appium driver install xcuitest` (iOS).
2. **Build Selection**:
   - Both platforms share config in `test-data/mobile-app/gri/android/config.yml` and `login.yml`.
   - Android sources: `local`, `firebase`, `firebase-web`, `url`.
   - iOS sources: `qa-simulator`, `qa-xcode`, `stage-simulator`, `prod`.
   - Note: Prod Android `.aab` builds are converted to universal APK via `bundletool`.
3. **Execute Mobile Tests**:
   - iOS: `npm run test:mobile:ios:create-user` or `MOBILE_PLATFORM=ios MOBILE_SPECS="tests/ios/<spec>.spec.ts" npx wdio run mobile/wdio.conf.ts`
   - Android: `npm run test:mobile:android:create-user` or `MOBILE_SPECS="tests/android/<spec>.spec.ts" npx wdio run mobile/wdio.conf.ts`
4. **Locator & Interaction Rules**:
   - **iOS (SwiftUI/XCUITest)**: Scope input fields by concrete element type via XPath (`//XCUIElementTypeTextField[@name="..."]`) to avoid static label ambiguity. Disable soft keyboard if clipping lower fields.
   - **Android (Jetpack Compose)**: `setValue`/`addValue` replaces fields; use `browser.keys([char])` per character (~80ms apart) for Compose text fields. Hide soft keyboard before clicking lower checkboxes/buttons.

## Output Contract
- Execution pass/fail breakdown
- Screenshot location (saved to `mobile/.builds/*.png` or `test-results/`)
- Verification log (OTP channel, provider used, time to receive code)

## Guardrails
- **All mobile specs MUST live under `mobile/tests/android/` or `mobile/tests/ios/`.** `MOBILE_SPECS` values remain relative to `mobile/` (e.g. `tests/ios/...`, which resolves to `mobile/tests/ios/...`).
- **Do NOT use Yopmail for create-account signups** — it is blocked by reCAPTCHA Enterprise quota. Use Guerrilla Mail (`--ra` tag) for PROD, Outlook (`v3test@rate.com`) for QA.
- Never write to or push to the iOS source repository `/Users/jameshc/iOS` — it is read-only for automation.

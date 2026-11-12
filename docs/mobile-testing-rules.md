# Canonical Mobile Testing Rules

This document is the shared source of truth for mobile test setup, accounts,
registration, login, and verification. Agents must read it together with
[the mobile-testing skill](../ai/jobs/skills/mobile-testing/SKILL.md) before
launching an app or running a mobile flow. The rules below consolidate current
repository behavior; they do not authorize production activity or change app
business rules.

## What to establish before a run

Read repository config and the requested ticket/test plan first. Resolve these
items from the request and existing non-secret config; ask only for missing or
conflicting information:

- Goal: inspect/launch, login/logout, register a new QA account, reset password,
  or exercise a specific MFA branch.
- Platform and exact target: Android AVD/device or iOS simulator/device, using
  the device UDID/serial when more than one target is available.
- Explicit environment and named build. Never rely on an implicit environment:
  mobile runtime configuration may default to production.
- Focused spec/flow and locale, plus excluded actions and evidence requested.
- For login: whether to use the normal configured account or an existing
  created QA account; the account is selected by repository helpers.
- For registration: explicit authorization to create a new account, a
  non-production environment, and approval to use the configured synthetic
  test profile/phone.
- Verification readiness: whether required Outlook and/or Google Voice
  sessions are already configured. Never ask the user to paste a password,
  access token, session file, MFA secret, or one-time code into chat.

If the test account or provider session is unavailable, stop and request secure
configuration through the repository's existing setup flow. Do not substitute
personal credentials, real customer data, or a guessed mailbox.

## Safety and data handling

- Do not create accounts, submit applications, send external messages, or run
  production login/verification flows without explicit authorization for that
  run. Use QA by default only when the target/build is unambiguous and configured.
- Use `getAutomationAccount('login')` and
  `getAutomationAccount('createUser')`; do not hardcode or invent account
  values. The create-user helper generates a fresh address and enforces the
  environment's email policy. PROD registration requires the configured
  real-account tag; non-PROD registration must not use that tag.
- Never use Yopmail for mobile account creation or verification.
- Use `recordCreatedAccount()` after a successful registration so later login
  tests can reuse the created test account. Treat that local account registry
  and run results as secret-bearing; never copy credentials or OTPs into chat,
  README/history entries, screenshots, or defect descriptions.
- `MOBILE_VERIFICATION_MODE=mock` is only for local flow/dry-run validation.
  A mock pass does not prove email/SMS delivery or MFA behavior.
- Do not change verification providers, account policy, or business rules
  without explicit user approval.

## Start the emulator or simulator

Use the existing Android Studio AVD or Xcode Simulator. Prefer the direct
foreground commands below so emulator logs do not get written outside
`test-results/`.

### Android

1. In Android Studio, create or start an AVD from **Device Manager**. Or use:

   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export ANDROID_SDK_ROOT="$ANDROID_HOME"
   export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
   emulator -list-avds
   emulator -avd <exact-avd-name>
   ```

2. In another terminal, confirm it is ready and copy the device serial:

   ```bash
   adb wait-for-device
   adb devices -l
   adb shell getprop sys.boot_completed
   ```

   Continue only when the selected device is `device` and boot completion is
   `1`. Set `MOBILE_ANDROID_DEVICE_UDID` to that exact serial.

### iOS

1. List installed simulators, then boot a specific available UDID:

   ```bash
   xcrun simctl list devices available
   xcrun simctl boot <simulator-udid>
   open -a Simulator
   xcrun simctl bootstatus <simulator-udid> -b
   ```

2. Continue only when that UDID is booted. Set
   `MOBILE_IOS_DEVICE_UDID` to the same value. The iOS WDIO config refuses to
   select or create a simulator automatically.

The helper `scripts/start-ios-simulator.sh` can boot by device name, but its
default device name may not exist in the installed Xcode runtimes. Enumerate
devices first or use the explicit UDID commands above. Do not use the Android
background helper when its `/tmp` log destination would violate the
`test-results/` output rule.

## Select and open the app

1. Run `npm run mobile:preflight` and resolve failed infrastructure checks.
   For Firebase Android builds, also verify access with
   `npm run verify:firebase-access`.
2. Choose a named build from
   `test-data/mobile-app/gri/android/config.yml` or
   `test-data/mobile-app/gri/ios/config.yml`. Android accepts local,
   Firebase, Firebase-web, or URL builds; iOS simulator builds use a `.app`.
   TestFlight is real-device only.
3. Set `MOBILE_PLATFORM`, `MOBILE_ENV`, the platform build variable, and the
   required device UDID explicitly. `MOBILE_SPECS` is relative to `mobile/`.
4. Run the focused WDIO spec. The WDIO configuration starts its Appium service,
   pins the requested device, resolves the configured app build, and opens the
   app. Do not manually install or launch a different app/package in the same
   run. `npm run appium:start` is for standalone codegen/Inspector use, not
   needed alongside a WDIO run; it enables relaxed security and must not be
   exposed to an untrusted network.

Focused examples (replace the device placeholder with the serial/UDID reported
by the relevant tool):

```bash
MOBILE_PLATFORM=android MOBILE_ENV=qa MOBILE_ANDROID_BUILD=qa \
MOBILE_ANDROID_DEVICE_UDID=<adb-serial> \
MOBILE_SPECS=tests/android/login-logout.spec.ts \
npx wdio run mobile/wdio.conf.ts

MOBILE_PLATFORM=ios MOBILE_ENV=qa MOBILE_IOS_BUILD=qa-simulator \
MOBILE_IOS_MODE=simulator MOBILE_IOS_DEVICE_UDID=<simulator-udid> \
MOBILE_SPECS=tests/ios/login-logout.spec.ts \
npx wdio run mobile/wdio.conf.ts
```

For any run, keep the platform/environment/build/device consistent. Do not run
Android and iOS in parallel against the same Appium port/session.

## Login and logout

1. Call `AuthPage.waitForAuthScreenReady()` before the first interaction. It
   polls for the login/create-account controls after cold launch; do not replace
   it with a fixed sleep.
2. Use the existing login spec and `loginWithAccountRetry()`. The account helper
   prefers eligible recently created accounts and otherwise uses configured
   login data. Do not copy credentials into test code or logs.
3. `loginWithAccountRetry()` completes email/phone verification only when the
   app presents a verification prompt, then handles Face ID onboarding and the
   home-screen checkpoint.
4. For logout, use the app path **Profile > Settings > Log out**, then assert
   the login screen and password field are visible.

The login email-verification provider is environment-configured: current code
uses Outlook for QA/stage and Guerrilla Mail for PROD. Follow the selected
environment and runtime helper rather than the older agent-startup snapshot or
a manually chosen inbox.

## Register a new test account

Only proceed after explicit authorization to create a QA account.

1. Use the platform's existing `create-user.spec.ts`, a fresh generated account
   from `getAutomationAccount('createUser')`, and configured synthetic profile
   data. Never reuse the same address for a new registration.
2. Wait for the auth screen, open **Create account**, and submit through the
   existing `UserPage` helper.
3. Complete email verification using the environment's expected route: current
   code uses Outlook for DEV/QA/STAGE and Guerrilla Mail for PROD. Respect the
   generated email policy enforced by the helper.
4. After email verification, inspect the actual screen. Some builds require
   phone entry and SMS verification; others proceed directly to the
   post-signup flow. Never assume a phone step exists or skip one that appears.
5. Dismiss only the expected onboarding modal(s), wait for the home screen, and
   record the account through `recordCreatedAccount()`. Confirm the account was
   recorded without printing its password.

## MFA and one-time codes

- On login, use `completeLoginVerification()` only when a verification prompt
  is detected. Email provider follows the environment; phone verification uses
  the configured Google Voice profile.
- On registration, `completeAllVerifications()` validates screen verbiage
  before each step, verifies email, then detects whether phone verification is
  required. It must end at the verified home screen.
- For SMS, snapshot the latest Google Voice preview immediately before the
  action that sends the new message. Accept only a code from a genuinely new
  message; do not select a code by thread position or fuzzy timestamp.
- For email or SMS resend, use the existing retry helper and exclude codes
  already rejected by the app. Do not manually reuse an old code.
- Assert the expected page text/state before every transition. On mismatch,
  stop immediately, capture diagnostics only under
  `test-results/<YYYY-MM-DD>/<project>/<run>/`, and classify the failure before
  retrying.

## Related documentation

- [Root mobile setup and supported flows](../README.md#running-tests)
- [Mobile testing skill](../ai/jobs/skills/mobile-testing/SKILL.md)
- [Mobile recording guide](../mobile/docs/RECORDING.md)
- [Generator agent](../ai/jobs/agents/mobile-test-generator.agent.md)
- [Orchestrator agent](../ai/jobs/agents/mobile_agents/mobile-test-orchestrator.agent.md)

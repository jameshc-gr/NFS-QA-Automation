# Mobile App Testing Rules (Canonical — Permanent)

**These rules are permanent and must not be changed, relaxed, or reinterpreted
in future development or testing without explicit user approval.** They apply
to every mobile spec (create-user, login-logout, and any new mobile spec)
across every platform (Android, iOS) and every environment (dev, stage, qa,
prod). Implementations live in [mobile/src/pages/auth.page.ts](../mobile/src/pages/auth.page.ts),
[mobile/src/utils/mobile-auth.ts](../mobile/src/utils/mobile-auth.ts), and
[mobile/src/utils/verification-service.ts](../mobile/src/utils/verification-service.ts).

## 0. Create-account email verification: pass/fail handling

After submitting an email verification code, always check whether it passed or
failed before continuing:

1. Read any inline validation error on screen.
2. If the message says the code is **not valid** / invalid, re-check the
   inbox for a message matching the email shown in the verification screen's
   title before giving up — do not immediately resend.
3. Otherwise (generic rejection, e.g. "Code incorrect"), use the **Resend**
   button and wait for the new verification email to arrive.

Implemented via `AuthPage.readInlineCodeValidationMessage()`,
`AuthPage.resolveVerificationTitleEmailHint()`, and the `titleMustContain`
option threaded through `getVerificationCode()` → Outlook retrieval.

## 1. Email rules for account creation

- **Prod**: add `--ra` to the local part before `@`.
  Example: `my-rateapp-auto-jcXXXX--ra@pokemail.net`
- **Dev/Stage/QA**: any email is fine without `--ra`, because the
  verification code email is routed to the shared Outlook inbox
  `v3test@rate.com`.

## 2. Creating a new account

### Dev / Stage / QA

- **Email format**: `my-rateapp-auto-jcXXXXXX@pokemail.net`, where `XXXXXX`
  is an alphanumeric sequence value appended after `jc`.
- **Email verification**: use the Outlook inbox for `v3test@rate.com`. Sign
  in with AD credentials and navigate to
  `https://outlook.cloud.microsoft/mail/v3test@rate.com/` to find the
  verification code. Implemented in `create-user.spec.ts` for both platforms
  via the Outlook provider in `verification-service.ts` /
  `verification/outlook.ts`.
- **SMS verification**: use the phone number from config; retrieve the code
  from Google Voice. Implemented in `create-user.spec.ts` via
  `verification/google-voice.ts`.

### Prod

- **Email format**: `my-rateapp-auto-jcXXXXXX--ra@pokemail.net`, where
  `XXXXXX` is an alphanumeric sequence value appended after `jc`.
- **Email verification**: use Guerrilla Mail (`pokemail.net` /
  `sharklasers.com` / `guerrillamail.com`) to grab the latest email's
  verification code. Implemented in `create-user.spec.ts` for PROD via
  `verification/guerrilla-mail.ts`.
- **SMS verification**: use the phone number from config; retrieve the code
  from Google Voice — same implementation as non-prod.

## 3. Verification email requested after logging in

- Go to Guerrilla Mail and log into the inbox used for the login email.
- Look for the most recent verification code closest to the current time.

## 4. Recording and reusing created accounts

- Every newly created account must be recorded in
  `test-data/mobile-app/created-accounts.json`
  (`recordCreatedAccount()` in `mobile-auth.ts`).
- Reuse recorded accounts at random when a test simply needs to log into an
  existing account (`getRandomCreatedAccount()`, opt-in via
  `MOBILE_LOGIN_USE_CREATED_ACCOUNT=true`).

## 5. Guerrilla Mail search logic (PROD create-user, and any existing-email
   verification code lookup)

1. Find the most recent email in the inbox and open its content; look for the
   6-digit code.
2. If the code doesn't work, wait a few minutes to see if a new email arrives
   with a fresh code.
3. If no new email arrives within 3 minutes, press the app's **Resend**
   button.
4. Keep checking for a new email; when one arrives, grab the new code.

Dev/QA/Stage account **creation** email always goes to Outlook `v3test@rate.com`
only — Guerrilla Mail is not used for create-user in non-prod.

## 6. Dynamic email verification routing (smart routing, always required)

| Scenario | Env | Route to |
| --- | --- | --- |
| Create account | dev/qa/stage | Outlook `v3test@rate.com` inbox |
| Create account | prod | Guerrilla Mail |
| Log in (verification requested) | dev/qa/stage | Guerrilla Mail |
| Log in (verification requested) | prod | Guerrilla Mail |

- **Yopmail must never be used, for any reason.** All yopmail-based logic has
  been removed from the codebase (`mobile/src/utils/verification/yopmail.ts`
  deleted, `EmailVerificationProvider` type no longer includes `'yopmail'`).
  Do not reintroduce it.

## 7. Continuous validation requirement

Create-account, login, and logout must be tested across every supported
platform/environment combination. When a failure occurs, troubleshoot and
self-correct until the logic above is applied correctly and every test run
completes cleanly end-to-end (landing on the home screen for create-account/
login, and back on the login screen after logout).

**Permanently skip** combinations with no real build available — do not keep
retrying these expecting a different result:

- Android stage / dev (no apk artifact exists on disk).
- iOS dev (`dev-simulator` bundle id mismatch — it's a mislabeled copy of the
  QA build).

## 8. Reporting

Every full validation pass must produce a test report with pass/fail results
per platform/environment combination, saved under `test-results/`. If any
combination fails, troubleshoot and rerun until it passes (or is confirmed to
be a permanently-skipped combination per rule 7) before considering the
report final.

## 9. Permanent change-control for future additions

Before adding or changing any mobile test, provider, environment route,
locator strategy, account rule, retry behavior, or verification step:

1. Read this document first and identify the rule being affected.
2. Update this document before or in the same change as the implementation.
3. Update the affected spec(s) under `mobile/tests/android/` or
  `mobile/tests/ios/` and the shared page/provider code when applicable.
4. Update [readme.md](../readme.md),
  [AGENTS.md](../AGENTS.md), or the mobile testing skill when the workflow,
  command, location, or agent behavior changes.
5. Run the narrowest affected test, then the relevant platform/environment
  matrix. Record the result under `test-results/`.
6. Do not remove, weaken, or silently reinterpret an existing rule. Any
  exception requires explicit user approval and must be documented here.

This document remains the source of truth for all future mobile development,
test generation, test healing, and test execution.

## Additional standing rules (established during hardening, also permanent)

- **Page verbiage must be asserted before every step transition** in the
  shared `completeAllVerifications()` (auth screen → email verification →
  phone entry/code, when required → home screen) — applies identically to
  prod and non-prod since it is the same shared code path.
- **SMS/email retrieval must prove a genuinely new message arrived**, not
  rely on a fuzzy relative-time string. Google Voice conversation threads
  accumulate every past run's codes; a baseline preview snapshot
  (`peekLatestGoogleVoicePreview()` / `baselinePreviewText`) must differ
  before a code is accepted.
- **Always wait for genuine app readiness** (`AuthPage.waitForAuthScreenReady()`,
  up to 60s) before the first interaction in any mobile spec — a cold app
  start can sit on the splash screen well past a short fixed pause.

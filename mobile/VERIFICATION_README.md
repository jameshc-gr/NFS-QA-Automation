# Mobile App SMS & Email Verification Setup

This utility set provides automated SMS and email verification code retrieval for Google Voice, Work Outlook (OWA + Okta SSO / Graph API), and Yopmail.

---

## 1. Initial One-Time Session Setup

To prevent Google account bans/bot flags and pass Work Outlook Okta MFA, run the one-time interactive setup commands below.

### **Google Voice Session Setup**
```bash
npx ts-node scripts/setup-gv-session.ts
```
1. A browser window will open to `https://voice.google.com/messages`.
2. Complete your login manually in the browser.
3. Press **Enter** in your terminal when logged in.
4. Your authenticated session will be saved to `mobile/.auth/google-voice-session.json`.

### **Outlook / Okta Session Setup**
```bash
npx ts-node scripts/setup-outlook-session.ts
```
1. A browser window will open to `https://outlook.office.com/mail/`.
2. Complete your Okta MFA / SSO login manually in the browser.
3. Press **Enter** in your terminal when your inbox loads.
4. Your authenticated session will be saved to `mobile/.auth/outlook-session.json`.

---

## 2. Configuration Options (`config.yml`)

File path: `test-data/mobile-app/gri/android/config.yml`

```yaml
environment: dev        # dev | prod, override with MOBILE_ENV

verification:
  email: yopmail        # manual | yopmail | outlook
  phone: google-voice   # manual | google-voice
  phoneNumber: 616-320-0701
  provider: google-voice

verificationInbox:
  dev:
    provider: outlook
    address: v3test@rate.com
    mailbox: v3test@rate.com
    matchSubjectByAccountEmail: true
  prod:
    provider: yopmail
    address: ""
    mailbox: ""
    matchSubjectByAccountEmail: false

googleVoice:
  email: "ENC(...)"
  password: "ENC(...)"

outlook:
  email: "ENC(...)"
  password: "ENC(...)"
  tenantId: "common"
```

To encrypt sensitive secrets, use:
```bash
npx ts-node scripts/encrypt-config.ts encrypt 'your-secret'
```

### Environment-aware inbox routing

The app sends verification email to different places depending on environment,
so `resolveVerificationInbox(accountEmail)` picks the right one:

| Environment | Where the email lands | Inbox read | How the message is found |
| --- | --- | --- | --- |
| `dev` | Redirected to the shared work mailbox | `v3test@rate.com` via Outlook + Okta session | Subject contains the generated account address |
| `prod` | Delivered normally | The generated `my-auto-rateapp-jcXXXXXX@yopmail.com` mailbox | Newest message in that dedicated mailbox |

Select the environment per run:
```bash
npm run test:mobile:android:create-account                 # dev (default)
MOBILE_ENV=prod npm run test:mobile:android:create-account # prod
```

Because dev goes through Outlook, `npm run setup:outlook-session` must be
completed before dev runs. Prod runs only need Yopmail, which requires no login.
Set `MOBILE_VERIFICATION_MAILBOX` to override the mailbox for a single run.

---

## 3. How to Use in Mobile Tests

```typescript
import { getVerificationCode } from '../src/utils/verification-service';
import { resolveVerificationInbox } from '../src/utils/mobile-auth';

// SMS code from Google Voice (616-320-0701)
const smsCode = await getVerificationCode('phone', { provider: 'google-voice' });

// Email code from whichever inbox the current environment delivers to
const inbox = resolveVerificationInbox(account.email);
const emailCode = await getVerificationCode('email', {
  provider: inbox.provider,
  mailbox: inbox.mailbox,
  subjectContains: inbox.subjectContains,
});
```

---

## 4. Create-Account E2E Test

Spec: `mobile/tests/android/create-account-verification.spec.ts`

Flow:
1. Launches the app on the Android Studio emulator (Appium capabilities from `mobile/src/config/mobile.config.ts`).
2. Taps **Create account**.
3. Fills the form with a freshly generated account:
   - Email `my-auto-rateapp-jc<6-char alphanumeric>@yopmail.com`
   - Password `Test123!`
4. Reads the email verification code from the environment's inbox: the shared
   `v3test@rate.com` Outlook mailbox in dev (matched by the generated address in
   the subject), or the account's own Yopmail mailbox in prod.
5. Enters the Google Voice number `616-320-0701`.
6. Reads the SMS code from Google Voice and submits it, then asserts the home page loads.

### Run it
```bash
npm run test:mobile:android:create-account
```

### Preflight and unit checks
```bash
npm run verify:sessions
npm run test:mobile:unit
```

---

## 5. Account Logging

Every generated account is appended to `test-results/mobile-app-accounts.json`
(the same pattern used by `test-results/student-IDR-emails.json`):

```json
[
  {
    "email": "my-auto-rateapp-jcar0a2s@yopmail.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User",
    "phoneNumber": "616-320-0701",
    "runId": "m8q2xk-4b91cd",
    "testTitle": "creates a new account and completes email and SMS verification into the home page",
    "testFile": "mobile/tests/android/create-account-verification.spec.ts",
    "createdAt": "2026-07-28T18:22:10.114Z",
    "status": "registered"
  }
]
```

`status` transitions from `generated` to `registered` on success, or `failed` if the run aborts.
Emails are checked against the registry so no two runs reuse the same address.


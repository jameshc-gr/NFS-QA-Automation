import assert from 'node:assert/strict';

import { AuthPage } from '../../src/pages/auth.page';
import { UserPage } from '../../src/pages/user.page';
import { HomePage } from '../../src/pages/home.page';
import { createAccountRecord, updateAccountStatus } from '../../src/utils/account-registry';
import { getVerificationCode } from '../../src/utils/verification-service';
import { getVerificationConfig, resolveVerificationInbox } from '../../src/utils/mobile-auth';

// The dev environment redirects the registration email to v3test@rate.com, which
// can take a couple of minutes to land, so poll generously before failing.
const EMAIL_CODE_TIMEOUT_MS = Number(process.env.MOBILE_EMAIL_CODE_TIMEOUT_MS || 300000);
const SMS_CODE_TIMEOUT_MS = Number(process.env.MOBILE_SMS_CODE_TIMEOUT_MS || 180000);
const VERIFICATION_CODE_LENGTH = 6;

describe('Android create account with email + SMS verification', () => {
  it('creates a new account and completes email and SMS verification into the home page', async function () {
    this.timeout(600000);

    const auth = new AuthPage();
    const user = new UserPage();
    const home = new HomePage();
    const config = getVerificationConfig();

    // Step 1-3: generate a unique account, open Create account, fill the form.
    const account = createAccountRecord({
      testTitle: this.test?.title || 'create account with verification',
      testFile: __filename,
      phoneNumber: config.verification?.phoneNumber || '616-320-0701',
    });

    console.log(`[create-account] generated account: ${account.email} (runId ${account.runId})`);

    try {
      await auth.openCreateAccount();
      await user.createUser({
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        password: account.password,
      });

      // Step 4: pull the email verification code from whichever inbox this
      // environment delivers to (dev redirects to Outlook, prod uses Yopmail).
      const emailPrompt = await auth.waitForCodePrompt(60000);
      assert.ok(emailPrompt, 'Expected the app to prompt for an email verification code.');

      const inbox = resolveVerificationInbox(account.email);
      console.log(
        `[create-account] env=${inbox.environment} reading ${inbox.provider} inbox "${inbox.mailbox}"` +
          (inbox.subjectContains ? ` filtered by subject "${inbox.subjectContains}"` : '')
      );

      const emailCode = await getVerificationCode('email', {
        provider: inbox.provider,
        mailbox: inbox.mailbox,
        subjectContains: inbox.subjectContains,
        timeoutMs: EMAIL_CODE_TIMEOUT_MS,
        codeLength: VERIFICATION_CODE_LENGTH,
      });

      console.log(`[create-account] email verification code received: ${emailCode}`);
      await auth.submitVerificationCode(emailCode);

      // Step 5: some environments follow up with SMS verification. When the app
      // skips straight past it, carry on rather than failing the run.
      if (await auth.waitForPhonePrompt(20000)) {
        await auth.submitPhoneNumber(account.phoneNumber);

        const smsCode = await getVerificationCode('phone', {
          provider: 'google-voice',
          timeoutMs: SMS_CODE_TIMEOUT_MS,
          codeLength: VERIFICATION_CODE_LENGTH,
        });

        console.log(`[create-account] SMS verification code received: ${smsCode}`);
        await auth.submitVerificationCode(smsCode);
      } else {
        console.log('[create-account] no phone verification prompt, continuing to onboarding');
      }

      // Step 6: close the onboarding survey banner when it appears, then confirm
      // the home dashboard is reachable.
      const dismissed = await home.dismissWorkingWithRateModal(90000);
      console.log(
        dismissed
          ? '[create-account] closed the "working with someone from Rate" banner'
          : '[create-account] no "working with someone from Rate" banner appeared'
      );

      const landedOnHome = await home.waitForLoaded(90000);
      assert.equal(landedOnHome, true, 'Expected to land on the app home dashboard after verification.');

      updateAccountStatus(account.email, 'registered');
    } catch (error) {
      updateAccountStatus(account.email, 'failed');
      throw error;
    }
  });
});

import assert from 'node:assert/strict';
import { AuthPage } from '../../mobile/src/pages/auth.page';
import {
  getAutomationAccount,
  getMobileEnvironment
} from '../../mobile/src/utils/mobile-auth';

describe('iOS forgot password -> verification -> reset password -> login flow', function () {
  this.timeout(10 * 60 * 1000);

  it('completes forgot password via Email, logs in, logs out, then completes reset via SMS and logs in', async () => {
    const auth = new AuthPage();
    const environment = getMobileEnvironment();
    const account = getAutomationAccount('login');
    const email = process.env.MOBILE_TEST_EMAIL || account.email;
    const initialPassword = process.env.MOBILE_TEST_NEW_PASSWORD || 'TestNewP@ssw0rd!2026';
    const googleVoiceProfile = process.env.MOBILE_GV_PROFILE;

    console.log(`[Test] Starting complete iOS forgot-password flow for ${email} under MOBILE_ENV=${environment}`);
    process.env.MOBILE_TEST_EMAIL = email;

    console.log('[Test] ===== PART 1: Reset Password via EMAIL =====');
    await auth.waitForAuthScreenReady();
    await auth.openLogin();

    console.log('[Test] Clicking "Forgot password?" link...');
    await auth.openForgotPassword();

    console.log(`[Test] Submitting email ${email} and clicking "Reset via email"...`);
    await auth.submitForgotPasswordEmail(email);

    console.log('[Test] Awaiting email verification code from inbox...');
    await auth.completeResetEmailVerification(email);

    console.log('[Test] Setting new password and clicking "Update password"...');
    const activeEmailPassword = await auth.setNewPassword(initialPassword);

    console.log(`[Test] Logging in with the new password (${activeEmailPassword})...`);
    await auth.waitForAuthScreenReady();
    await auth.openLogin();
    await auth.login(email, activeEmailPassword);

    const onHomeScreen1 = await auth.waitForHomeScreen();
    assert.equal(onHomeScreen1, true, 'User should reach the home screen after resetting password via email');
    console.log('[Test] Successfully logged in after email reset!');

    console.log('[Test] Logging out...');
    await auth.logout();
    await auth.waitForAuthScreenReady();
    console.log('[Test] Logged out successfully.');

    console.log('[Test] ===== PART 2: Reset Password via SMS =====');
    await auth.openLogin();

    console.log('[Test] Clicking "Forgot password?" link...');
    await auth.openForgotPassword();

    console.log(`[Test] Submitting email ${email} and clicking "Reset via SMS"...`);
    await auth.submitForgotPasswordSms(email);

    console.log('[Test] Awaiting SMS OTP from Google Voice...');
    await auth.completeResetSmsVerification({ googleVoiceProfile });

    console.log('[Test] Setting new password for SMS reset and clicking "Update password"...');
    const activeSmsPassword = await auth.setNewPassword('AltP@ssw0rd#2026');

    console.log(`[Test] Logging in with the SMS-reset password (${activeSmsPassword})...`);
    await auth.waitForAuthScreenReady();
    await auth.openLogin();
    await auth.login(email, activeSmsPassword);

    const onHomeScreen2 = await auth.waitForHomeScreen();
    assert.equal(onHomeScreen2, true, 'User should reach the home screen after resetting password via SMS');

    console.log('[Test] Entire iOS forgot password flow (Email + SMS + Login verification) completed successfully!');
  });
});

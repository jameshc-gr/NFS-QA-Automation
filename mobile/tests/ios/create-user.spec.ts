import assert from 'node:assert/strict';

import { AuthPage } from '../../src/pages/auth.page';
import { UserPage } from '../../src/pages/user.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';
import { warmUpEmailInboxIfNeeded } from '../../src/utils/verification-service';

describe('iOS create user flow with Guerrilla Mail and Google Voice verification', () => {
  it('creates a new user with email and SMS verification', async () => {
    const auth = new AuthPage();
    const user = new UserPage();
    const { email, password } = getAutomationAccount('createUser');
    process.env.MOBILE_TEST_EMAIL = email;
    const googleVoiceProfile = process.env.MOBILE_GV_PROFILE;
    const phoneNumber = process.env.MOBILE_VERIFICATION_PHONE;

    console.log(`[Test] Starting account creation for ${email}`);
    
    await warmUpEmailInboxIfNeeded(email.split('@')[0]);

    await auth.openCreateAccount();
    await user.createUser({
      firstName: process.env.MOBILE_TEST_FIRST_NAME || 'John',
      lastName: process.env.MOBILE_TEST_LAST_NAME || 'Doe',
      email,
      password
    });

    console.log('[Test] Account form submitted, awaiting verifications...');

    // Complete all verification steps (email verification, phone number entry, SMS verification)
    try {
      await auth.completeAllVerifications({
        googleVoiceProfile,
        phoneNumber,
      });
      console.log('[Test] All verifications completed successfully');
    } catch (error) {
      console.error('[Test] Verification error:', error);
      throw error;
    }

    // Verify account creation was successful by checking that
    // the "Create account" tab and form elements are no longer visible
    const createAccountButton = $('~Create account');
    const emailField = $('//XCUIElementTypeTextField[contains(@name, "email")]');
    const phoneField = $('//XCUIElementTypeTextField[contains(@name, "phone")]');
    const phoneCodeField = $('//XCUIElementTypeTextField[contains(@name, ".field.code")]');

    console.log('[Test] Verifying post-signup state...');
    
    const createButtonVisible = await createAccountButton.isDisplayed().catch(() => false);
    const emailFieldVisible = await emailField.isDisplayed().catch(() => false);
    const phoneFieldVisible = await phoneField.isDisplayed().catch(() => false);
    const phoneCodeFieldVisible = await phoneCodeField.isDisplayed().catch(() => false);

    assert.equal(!createButtonVisible, true, 'Create account button should not be visible after signup');
    assert.equal(!emailFieldVisible, true, 'Email field should not be visible after email verification');
    assert.equal(!phoneFieldVisible, true, 'Phone field should not be visible after phone verification');
    assert.equal(!phoneCodeFieldVisible, true, 'Phone code field should not be visible after SMS verification');

    const onHomeScreen = await auth.waitForHomeScreen();
    assert.equal(onHomeScreen, true, 'App should land on the home screen after dismissing the Rate modal');

    console.log('[Test] Account creation test completed successfully');
  });
});

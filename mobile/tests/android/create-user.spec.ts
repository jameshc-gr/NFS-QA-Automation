import assert from 'node:assert/strict';

import { AuthPage } from '../../src/pages/auth.page';
import { UserPage } from '../../src/pages/user.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';
import { warmUpEmailInboxIfNeeded } from '../../src/utils/verification-service';

describe('Android create user flow with Guerrilla Mail and Google Voice verification', () => {
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

    await auth.completeAllVerifications({
      googleVoiceProfile,
      phoneNumber,
    });

    console.log('[Test] All verifications completed, verifying post-signup state...');

    const createAccountLabel = await $('//*[contains(@text, "Create account")]');
    const emailField = await $('//*[contains(@text, "Email")]');
    const phoneCodeField = await $('//android.widget.EditText');

    assert.equal(
      await createAccountLabel.isDisplayed().catch(() => false),
      false,
      'Create account form should be gone after signup'
    );
    assert.equal(
      await emailField.isDisplayed().catch(() => false),
      false,
      'Email field should be gone after email verification'
    );
    assert.equal(
      await phoneCodeField.isDisplayed().catch(() => false),
      false,
      'Verification code field should be gone after SMS verification'
    );

    const onHomeScreen = await auth.waitForHomeScreen();
    assert.equal(onHomeScreen, true, 'App should land on the home screen after dismissing the Rate modal');

    console.log('[Test] Account creation test completed successfully');
  });
});

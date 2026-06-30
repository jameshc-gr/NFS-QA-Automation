import assert from 'node:assert/strict';

import { AuthPage } from '../../src/pages/auth.page';
import { UserPage } from '../../src/pages/user.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Android create user flow', () => {
  it('creates a new user', async () => {
    const auth = new AuthPage();
    const user = new UserPage();
    const { email, password } = getAutomationAccount('createUser');

    await auth.openCreateAccount();
    await user.createUser({
      firstName: process.env.MOBILE_TEST_FIRST_NAME || 'Test',
      lastName: process.env.MOBILE_TEST_LAST_NAME || 'User',
      email,
      password
    });

    await auth.completeVerificationIfPresent();

    const createAccountLabel = await $('//*[contains(@text, "Create account")]');
    const emailField = await $('//*[contains(@text, "Email")]');

    assert.equal(await createAccountLabel.isDisplayed(), true);
    assert.equal(await emailField.isDisplayed(), true);
  });
});
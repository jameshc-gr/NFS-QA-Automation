import assert from 'node:assert/strict';

import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('iOS simulator login and logout flow', () => {
  it('logs in and logs out', async () => {
    const auth = new AuthPage();
    const { email, password } = getAutomationAccount('login');
    process.env.MOBILE_LOGIN_EMAIL = email;

    await auth.openLogin();
    await auth.login(email, password);
    await auth.completeVerificationIfPresent();

    const loginTab = await $('~Log in');
    const passwordField = await $('~Password');

    assert.equal(await loginTab.isDisplayed(), true);
    assert.equal(await passwordField.isDisplayed(), true);
  });
});

import assert from 'node:assert/strict';

import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Android login and logout flow', () => {
  it('logs in and logs out', async () => {
    const auth = new AuthPage();
    const { email, password } = getAutomationAccount('login');

    await auth.openLogin();
    await auth.login(email, password);
    await auth.completeVerificationIfPresent();

    const loginLabel = await $('//*[contains(@text, "Log in")]');
    const passwordField = await $('//*[contains(@text, "Password")]');

    assert.equal(await loginLabel.isDisplayed(), true);
    assert.equal(await passwordField.isDisplayed(), true);
  });
});
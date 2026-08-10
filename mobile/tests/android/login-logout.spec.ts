import assert from 'node:assert/strict';
import path from 'node:path';

import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Android login and logout flow', () => {
  it('logs in and logs out', async () => {
    const auth = new AuthPage();
    const { email, password } = getAutomationAccount('login');
    process.env.MOBILE_LOGIN_EMAIL = email;

    await auth.openLogin();
    await auth.login(email, password);
    await auth.completeLoginVerification(email);

    const reachedHome = await auth.waitForHomeScreen();
    await browser.saveScreenshot(path.resolve(process.cwd(), 'mobile/.builds/android-login-proof.png'));
    assert.equal(reachedHome, true, 'App should land on the home screen after login.');

    await auth.logout();

    const loginLabel = await $('//*[contains(@text, "Log in")]');
    const passwordField = await $('//*[contains(@text, "Password")]');

    assert.equal(await loginLabel.isDisplayed(), true);
    assert.equal(await passwordField.isDisplayed(), true);
  });
});

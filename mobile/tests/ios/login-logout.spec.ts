import assert from 'node:assert/strict';
import path from 'node:path';

import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount, getMobileEnvironment } from '../../src/utils/mobile-auth';

describe('iOS simulator login and logout flow', () => {
  it('logs in and logs out', async () => {
    const auth = new AuthPage();
    const fallback = getAutomationAccount('login');

    await auth.waitForAuthScreenReady();
    const { email } = await auth.loginWithAccountRetry(getMobileEnvironment(), fallback);

    const reachedHome = await auth.waitForHomeScreen();
    await browser.saveScreenshot(path.resolve(process.cwd(), 'mobile/.builds/ios-login-proof.png'));
    assert.equal(reachedHome, true, 'App should land on the home screen after login.');

    await auth.logout();

    const loginTab = await $('~Log in');
    const passwordField = await $('//XCUIElementTypeSecureTextField[@name="log_in.field.password"]|//XCUIElementTypeTextField[@name="log_in.field.password"]');

    assert.equal(await loginTab.isDisplayed(), true);
    assert.equal(await passwordField.isDisplayed(), true);
  });
});

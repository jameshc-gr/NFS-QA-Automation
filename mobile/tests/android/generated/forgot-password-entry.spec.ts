// spec: ai/tests/mobile/tc-auth-forgot-password-entry.md
import assert from 'node:assert/strict';

import { AuthPage } from '../../../src/pages/auth.page';

describe('Android forgot password entry point', () => {
  it('reaches the reset-password screen from the login tab without crashing', async () => {
    const auth = new AuthPage();

    // 1. App is on `Log in` tab.
    await auth.waitForAuthScreenReady();
    await auth.openLogin();

    // 1. Tap `Forgot password?`.
    await auth.openForgotPassword();

    // 2. Observe next screen or modal.
    // Expected: navigation to reset-password flow occurs; no crash and no
    // return to launcher (i.e. the app is still alive and on a recognizable
    // in-app screen).
    const resetEmailField = await $('//android.widget.EditText');
    assert.equal(
      await resetEmailField.isDisplayed().catch(() => false),
      true,
      'Reset password screen should show an email input field.'
    );

    const appPackage = (browser.capabilities as Record<string, string>)['appium:appPackage']
      || (browser.capabilities as Record<string, string>).appPackage;
    const currentPackage = await browser.getCurrentPackage?.().catch(() => undefined);
    if (appPackage && currentPackage) {
      assert.equal(currentPackage, appPackage, 'App should not have returned to the launcher.');
    }
  });
});

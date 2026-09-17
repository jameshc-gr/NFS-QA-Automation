import assert from 'node:assert/strict';

describe('Android PROD supplied account probe', () => {
  it('logs in with the supplied account', async () => {
    await browser.pause(3000);
    const fields = await $$('android.widget.EditText');
    if (fields.length >= 2) {
      await fields[0].setValue('my-rateapp-jc023--ra@yopmail.com');
      await fields[1].setValue('Test123!');
      const loginButtons = await $$('//*[@text="Log in"]');
      assert.equal(loginButtons.length >= 2, true, 'Expected login tab and submit button.');
      await loginButtons[loginButtons.length - 1].click();
      await browser.pause(8000);
    }
    const source = await browser.getPageSource();
    assert.equal(fields.length >= 2 || source.includes('Financial wellness'), true, 'Expected login form or an authenticated Home destination.');
    assert.equal(source.includes('Please enter a valid email address'), false, 'The supplied email should be accepted by the login form.');
    await browser.saveScreenshot('mobile/.builds/android-prod-account-post-submit.png');

    await browser.execute('mobile: deepLink', {
      url: 'https://mobileapp.rate.com/accounts',
      package: 'com.guaranteedrate.superapp'
    });
    await browser.pause(8000);
    const destination = await browser.getPageSource();
    assert.equal(destination.includes('Create account'), false, 'The authenticated deep link should not return to login.');
    assert.equal(destination.includes('Financial wellness'), false, 'The Accounts deep link should leave the authenticated Home destination.');
    assert.equal(destination.includes('Accounts'), true, 'The Accounts destination should be present after deep-link navigation.');
    await browser.saveScreenshot('mobile/.builds/android-accounts-deep-link.png');
  });
});

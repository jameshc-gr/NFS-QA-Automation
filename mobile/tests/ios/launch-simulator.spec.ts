import assert from 'node:assert/strict';

describe('iOS simulator launch smoke', () => {
  it('installs and activates the simulator build', async () => {
    const bundleId = process.env.MOBILE_IOS_BUNDLE_ID;

    if (!bundleId) {
      throw new Error('MOBILE_IOS_BUNDLE_ID is required for iOS simulator smoke tests.');
    }

    const isInstalled = await browser.isAppInstalled(bundleId);
    assert.equal(isInstalled, true, `Expected ${bundleId} to be installed on the simulator.`);

    await browser.activateApp(bundleId);
    await browser.pause(1500);
    assert.equal(await browser.isAppInstalled(bundleId), true);
  });
});
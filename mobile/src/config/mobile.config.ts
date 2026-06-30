import path from 'node:path';

type MobilePlatform = 'android' | 'ios';

export type MobileCapabilities = Record<string, unknown>;

function resolvePlatform(): MobilePlatform {
  const value = (process.env.MOBILE_PLATFORM || 'android').toLowerCase();
  return value === 'ios' ? 'ios' : 'android';
}

function resolveAndroidAppPath(): string {
  return path.resolve(
    process.cwd(),
    process.env.MOBILE_ANDROID_APP_PATH || 'test-data/mobile-app/gri/android/app.apk'
  );
}

function resolveIOSMode(): string {
  return process.env.MOBILE_IOS_MODE || 'testflight';
}

export function resolveMobileCapabilities(): MobileCapabilities {
  const platform = resolvePlatform();

  if (platform === 'ios') {
    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || 'iPhone 15',
      'appium:platformVersion': process.env.MOBILE_IOS_PLATFORM_VERSION || 'latest',
      'appium:bundleId': process.env.MOBILE_IOS_BUNDLE_ID || '',
      'appium:noReset': true,
      'mobile:mode': resolveIOSMode()
    };
  }

  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.MOBILE_ANDROID_DEVICE_NAME || 'Android Emulator',
    'appium:platformVersion': process.env.MOBILE_ANDROID_PLATFORM_VERSION || '16',
    'appium:app': resolveAndroidAppPath(),
    'appium:appPackage': process.env.MOBILE_APP_PACKAGE || 'com.guaranteedrate.superapp.qa',
    'appium:appActivity': process.env.MOBILE_APP_ACTIVITY || 'com.guaranteedrate.superapp.MainActivity',
    'appium:noReset': false,
    'appium:autoGrantPermissions': true
  };
}

export function resolveMobilePlatform(): MobilePlatform {
  return resolvePlatform();
}
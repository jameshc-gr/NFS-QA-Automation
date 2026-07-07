import path from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

type MobilePlatform = 'android' | 'ios';
type IOSMode = 'testflight' | 'real-device' | 'simulator';

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

function resolveIOSMode(): IOSMode {
  const value = (process.env.MOBILE_IOS_MODE || 'testflight').toLowerCase();
  if (value === 'simulator') {
    return 'simulator';
  }

  return value === 'real-device' ? 'real-device' : 'testflight';
}

function resolveIOSAppPath(): string {
  return path.resolve(
    process.cwd(),
    process.env.MOBILE_IOS_APP_PATH || 'test-data/mobile-app/gri/ios/app.app'
  );
}

function resolveIOSPlatformVersion(): string {
  if (process.env.MOBILE_IOS_PLATFORM_VERSION) {
    return process.env.MOBILE_IOS_PLATFORM_VERSION;
  }

  try {
    const runtimes = execSync('xcrun simctl list runtimes', { encoding: 'utf8' });
    const match = runtimes.match(/iOS\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Fall through to a known-good default below.
  }

  return '26.3';
}

export function resolveMobileCapabilities(): MobileCapabilities {
  const platform = resolvePlatform();

  if (platform === 'ios') {
    const iosMode = resolveIOSMode();
    const bundleId = process.env.MOBILE_IOS_BUNDLE_ID || '';

    if (!bundleId) {
      throw new Error('MOBILE_IOS_BUNDLE_ID is required when MOBILE_PLATFORM=ios.');
    }

    if (iosMode === 'simulator') {
      const appPath = resolveIOSAppPath();

      if (!existsSync(appPath)) {
        throw new Error(`MOBILE_IOS_APP_PATH does not exist: ${appPath}`);
      }

      return {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || 'iPhone 15',
        'appium:platformVersion': resolveIOSPlatformVersion(),
        'appium:app': appPath,
        'appium:bundleId': bundleId,
        'appium:noReset': false,
        'appium:autoAcceptAlerts': true,
        'mobile:mode': iosMode,
        'mobile:target': 'simulator'
      };
    }

    if (!process.env.MOBILE_IOS_DEVICE_UDID) {
      throw new Error('MOBILE_IOS_DEVICE_UDID is required when MOBILE_PLATFORM=ios.');
    }

    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || 'iPhone 15',
      'appium:platformVersion': resolveIOSPlatformVersion(),
      'appium:bundleId': bundleId,
      'appium:udid': process.env.MOBILE_IOS_DEVICE_UDID,
      'appium:noReset': true,
      'mobile:mode': iosMode,
      'mobile:target': 'real-device'
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
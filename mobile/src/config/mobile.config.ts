import path from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import YAML from 'yaml';

import { decryptObjectSecrets } from '../utils/crypto-utils';

type MobilePlatform = 'android' | 'ios';
type IOSMode = 'testflight' | 'real-device' | 'simulator';
type IOSSource = 'simulator' | 'ipa' | 'testflight';

interface IOSBuild {
  source?: IOSSource;
  bundleId?: string;
  appPath?: string;
  ipaPath?: string;
  ipaUrl?: string;
  ipaAuthHeader?: string;
  deviceName?: string;
  deviceUdid?: string;
}

interface IOSBuildConfig {
  defaultBuild?: string;
  builds?: Record<string, IOSBuild>;
}

const IOS_CONFIG_PATH = 'test-data/mobile-app/gri/ios/config.yml';
const IPA_CACHE_DIR = 'mobile/.builds';

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

/** Reads the named build (or the configured default) out of the iOS config. */
function resolveIOSBuild(): IOSBuild {
  const configPath = path.resolve(process.cwd(), IOS_CONFIG_PATH);
  if (!existsSync(configPath)) {
    return {};
  }

  const parsed = YAML.parse(readFileSync(configPath, 'utf8')) as { ios?: IOSBuildConfig } | undefined;
  const config = parsed?.ios;
  if (!config?.builds) {
    return {};
  }

  const name = process.env.MOBILE_IOS_BUILD || config.defaultBuild;
  if (!name) {
    return {};
  }

  const build = config.builds[name];
  if (!build) {
    throw new Error(
      `Unknown iOS build "${name}". Available builds in ${IOS_CONFIG_PATH}: ${Object.keys(config.builds).join(', ')}`
    );
  }

  console.log(`[mobile] using iOS build "${name}" (source: ${build.source || 'simulator'})`);
  return decryptObjectSecrets(build);
}

function resolveIOSMode(build: IOSBuild): IOSMode {
  const value = (process.env.MOBILE_IOS_MODE || build.source || 'simulator').toLowerCase();
  if (value === 'simulator') {
    return 'simulator';
  }

  return value === 'real-device' ? 'real-device' : 'testflight';
}

function resolveIOSAppPath(build: IOSBuild): string {
  return path.resolve(
    process.cwd(),
    process.env.MOBILE_IOS_APP_PATH || build.appPath || 'test-data/mobile-app/gri/ios/app.app'
  );
}

/**
 * Returns a local .ipa, downloading it first when the build only names a URL.
 * Cached under mobile/.builds so repeat runs reuse the same artifact.
 */
function resolveIpaPath(build: IOSBuild): string {
  const configured = process.env.MOBILE_IOS_IPA_PATH || build.ipaPath;
  if (configured) {
    const resolved = path.resolve(process.cwd(), configured);
    if (!existsSync(resolved)) {
      throw new Error(`The configured iOS ipaPath does not exist: ${resolved}`);
    }
    return resolved;
  }

  const url = process.env.MOBILE_IOS_IPA_URL || build.ipaUrl;
  if (!url) {
    throw new Error(
      `This iOS build needs either ipaPath or ipaUrl in ${IOS_CONFIG_PATH} (or MOBILE_IOS_IPA_PATH / MOBILE_IOS_IPA_URL).`
    );
  }

  const cacheDir = path.resolve(process.cwd(), IPA_CACHE_DIR);
  mkdirSync(cacheDir, { recursive: true });

  const fileName = path.basename(new URL(url).pathname) || 'build.ipa';
  const target = path.join(cacheDir, fileName);

  if (existsSync(target)) {
    return target;
  }

  const authHeader = process.env.MOBILE_IOS_IPA_AUTH_HEADER || build.ipaAuthHeader;
  const args = ['--fail', '--location', '--silent', '--show-error', '--output', target, url];
  if (authHeader) {
    // Passed as an argument rather than interpolated into a shell string so the
    // token never reaches a shell and is never logged.
    args.unshift('--header', authHeader);
  }

  console.log(`[mobile] downloading iOS build to ${target}`);
  execFileSync('curl', args, { stdio: ['ignore', 'ignore', 'inherit'] });

  return target;
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
    const build = resolveIOSBuild();
    const iosMode = resolveIOSMode(build);
    const bundleId = process.env.MOBILE_IOS_BUNDLE_ID || build.bundleId || '';

    if (!bundleId) {
      throw new Error('MOBILE_IOS_BUNDLE_ID is required when MOBILE_PLATFORM=ios.');
    }

    if (iosMode === 'simulator') {
      const appPath = resolveIOSAppPath(build);

      if (!existsSync(appPath)) {
        throw new Error(`MOBILE_IOS_APP_PATH does not exist: ${appPath}`);
      }

      return {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || build.deviceName || 'iPhone 17',
        'appium:platformVersion': resolveIOSPlatformVersion(),
        'appium:app': appPath,
        'appium:bundleId': bundleId,
        'appium:noReset': false,
        'appium:autoAcceptAlerts': true,
        // The software keyboard covers the lower half of the create-account form
        // and cannot be dismissed reliably, so type through the hardware keyboard.
        'appium:connectHardwareKeyboard': process.env.MOBILE_IOS_HW_KEYBOARD !== 'false',
        'appium:forceSimulatorSoftwareKeyboardPresence': false,
        // Verification specs pause for minutes while polling an inbox, and Appium
        // would otherwise drop the session after 60s without a command.
        'appium:newCommandTimeout': Number(process.env.MOBILE_NEW_COMMAND_TIMEOUT || 1800),
        'appium:wdaLaunchTimeout': 240000,
        'appium:wdaConnectionTimeout': 240000,
        'mobile:mode': iosMode,
        'mobile:target': 'simulator'
      };
    }

    const udid = process.env.MOBILE_IOS_DEVICE_UDID || build.deviceUdid;
    if (!udid) {
      throw new Error(
        'A real device UDID is required for ipa and testflight builds. Set deviceUdid in '
          + `${IOS_CONFIG_PATH} or MOBILE_IOS_DEVICE_UDID.`
      );
    }

    // TestFlight installs the build by hand on the device, so the session only
    // launches the existing bundle. An ipa build is installed by Appium instead.
    const isIpaBuild = (process.env.MOBILE_IOS_MODE || build.source) === 'ipa';

    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || build.deviceName || 'iPhone 17',
      'appium:platformVersion': resolveIOSPlatformVersion(),
      ...(isIpaBuild ? { 'appium:app': resolveIpaPath(build) } : {}),
      'appium:bundleId': bundleId,
      'appium:udid': udid,
      'appium:noReset': !isIpaBuild,
      'appium:autoAcceptAlerts': true,
      'appium:connectHardwareKeyboard': false,
      'appium:newCommandTimeout': Number(process.env.MOBILE_NEW_COMMAND_TIMEOUT || 1800),
      'appium:wdaLaunchTimeout': 240000,
      'appium:wdaConnectionTimeout': 240000,
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
    'appium:autoGrantPermissions': true,
    // Verification specs pause for minutes while polling an inbox, and Appium
    // would otherwise drop the session after 60s without a command.
    'appium:newCommandTimeout': Number(process.env.MOBILE_NEW_COMMAND_TIMEOUT || 1800)
  };
}

export function resolveMobilePlatform(): MobilePlatform {
  return resolvePlatform();
}
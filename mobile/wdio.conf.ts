import path from 'node:path';

import { resolveMobileCapabilities, resolveMobilePlatform } from './src/config/mobile.config';

const androidSdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.resolve(process.env.HOME || '', 'Library/Android/sdk');
process.env.ANDROID_HOME = androidSdkRoot;
process.env.ANDROID_SDK_ROOT = androidSdkRoot;
process.env.JAVA_HOME = process.env.JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

const platform = resolveMobilePlatform();
const iosMode = platform === 'ios' ? String(process.env.MOBILE_IOS_MODE || 'simulator').toLowerCase() : '';
const defaultSpecs = platform === 'ios'
  ? [path.join('tests', 'ios', iosMode === 'simulator' ? 'launch-simulator.spec.ts' : 'launch-testflight.spec.ts')]
  : [path.join('tests', 'android', '**', '*.spec.ts')];
const specs = process.env.MOBILE_SPECS
  ? process.env.MOBILE_SPECS.split(',').map((spec) => spec.trim()).filter(Boolean)
  : defaultSpecs;

const logLevel = process.env.MOBILE_LOG_LEVEL || 'info';

export const config = {
  runner: 'local',
  specs,
  maxInstances: 1,
  logLevel,
  bail: 0,
  baseUrl: '',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    // Verification emails can take several minutes to arrive, so specs that
    // poll an inbox need far more headroom than the usual UI test.
    timeout: 900000
  },
  reporters: ['spec'],
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          relaxedSecurity: true
        }
      }
    ]
  ],
  before: async () => {
    try {
      await browser.setTimeout({ implicit: 3000, pageLoad: 30000 });
    } catch (e) {
      console.log('  Note: setTimeout not fully supported by Appium');
    }
  },
  capabilities: [resolveMobileCapabilities()]
} as any;

export default config;
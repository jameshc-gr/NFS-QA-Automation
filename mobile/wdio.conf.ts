import path from 'node:path';

import { resolveMobileCapabilities } from './src/config/mobile.config';

const androidSdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.resolve(process.env.HOME || '', 'Library/Android/sdk');
process.env.ANDROID_HOME = androidSdkRoot;
process.env.ANDROID_SDK_ROOT = androidSdkRoot;
process.env.JAVA_HOME = process.env.JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

const specs = process.env.MOBILE_SPECS
  ? process.env.MOBILE_SPECS.split(',').map((spec) => spec.trim()).filter(Boolean)
  : [path.join('tests', '**', '*.spec.ts')];

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
    timeout: 180000
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
    await browser.setTimeout({ implicit: 3000, pageLoad: 30000, script: 30000 });
  },
  capabilities: [resolveMobileCapabilities()]
} as any;

export default config;
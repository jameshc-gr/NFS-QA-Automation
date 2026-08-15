import path from 'node:path';
import { existsSync, cpSync, writeFileSync, mkdirSync } from 'node:fs';

import { resolveMobileCapabilities, resolveMobilePlatform } from './src/config/mobile.config';

const androidSdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.resolve(process.env.HOME || '', 'Library/Android/sdk');
process.env.ANDROID_HOME = androidSdkRoot;
process.env.ANDROID_SDK_ROOT = androidSdkRoot;
process.env.JAVA_HOME = process.env.JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
process.env.PATH = `${path.join(androidSdkRoot, 'platform-tools')}:${path.join(androidSdkRoot, 'emulator')}:${process.env.PATH}`;

const platform = resolveMobilePlatform();
const iosMode = platform === 'ios' ? String(process.env.MOBILE_IOS_MODE || 'simulator').toLowerCase() : '';
const defaultSpecs = platform === 'ios'
  ? [path.join('tests', 'ios', iosMode === 'simulator' ? 'launch-simulator.spec.ts' : 'launch-testflight.spec.ts')]
  : [path.join('tests', 'android', '**', '*.spec.ts')];
const specs = process.env.MOBILE_SPECS
  ? process.env.MOBILE_SPECS.split(',').map((spec) => spec.trim()).filter(Boolean)
  : defaultSpecs;

// Android + iOS suites both drive the same shared Outlook/Google Voice
// Chromium profiles by default. Running them in parallel then races to open
// the same persistent profile directory ("Opening in existing browser
// session"). Give each platform its own copy, seeded from the shared
// session the first time it's needed, so parallel runs never collide.
function isolateSharedBrowserSession(envVar: string, defaultRelPath: string): void {
  if (process.env[envVar]) {
    return; // caller already chose an explicit path
  }

  const sharedPath = path.resolve(process.cwd(), defaultRelPath);
  const sharedUserDataDir = sharedPath.replace(/\.json$/, '-user-data');
  const platformPath = sharedPath.replace(/\.json$/, `-${platform}.json`);
  const platformUserDataDir = platformPath.replace(/\.json$/, '-user-data');

  if (!existsSync(platformPath) && existsSync(sharedPath)) {
    cpSync(sharedPath, platformPath);
  }
  if (!existsSync(platformUserDataDir) && existsSync(sharedUserDataDir)) {
    cpSync(sharedUserDataDir, platformUserDataDir, { recursive: true });
  }

  process.env[envVar] = path.relative(process.cwd(), platformPath);
}

isolateSharedBrowserSession('OUTLOOK_SESSION_PATH', 'mobile/.auth/outlook-session.json');
isolateSharedBrowserSession('GV_SESSION_PATH', 'mobile/.auth/gv-session.json');

const logLevel = process.env.MOBILE_LOG_LEVEL || 'info';
// Allows running Android + iOS suites in parallel: each needs its own Appium
// server, since the default service always binds to port 4723.
const appiumPort = Number(process.env.MOBILE_APPIUM_PORT || 4723);

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
  // Add Allure reporter and configure output per date/project/run (respect RUN_ID)
  reporters: [
    'spec',
    ['allure', {
      outputDir: path.join(process.cwd(), 'test-results', (new Date()).toISOString().slice(0,10), process.env.TEST_PROJECT || 'mobile', process.env.RUN_ID || 'run', 'allure-results')
    }]
  ],
  port: appiumPort,
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          relaxedSecurity: true,
          port: appiumPort
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
  afterTest: async (test: any, context: any, { error, result, duration, passed, retries }: any) => {
    try {
      const date = (new Date()).toISOString().slice(0,10);
      const project = process.env.TEST_PROJECT || 'mobile';
      const runStamp = process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g,'-');
      const destDir = path.join(process.cwd(), 'test-results', date, project, runStamp, 'screenshots');
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      if (!passed) {
        const png = await browser.takeScreenshot();
        const filename = `${test.title.replace(/[^a-z0-9]+/gi,'_')}.png`;
        writeFileSync(path.join(destDir, filename), Buffer.from(png, 'base64'));
        // attach to allure if available
        try { // eslint-disable-next-line @typescript-eslint/no-var-requires
          const allure = require('@wdio/allure-reporter').default;
          if (allure && allure.addAttachment) {
            allure.addAttachment('screenshot', Buffer.from(png, 'base64'), 'image/png');
          }
        } catch (e) {
          // ignore if allure reporter not present at runtime
        }
      }
    } catch (err) {
      console.warn('afterTest screenshot hook failed', err);
    }
  },
  capabilities: [resolveMobileCapabilities()]
} as any;

export default config;
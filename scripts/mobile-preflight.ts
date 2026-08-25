import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const defaultSdk = path.resolve(process.env.HOME || '', 'Library/Android/sdk');
const androidSdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || (existsSync(defaultSdk) ? defaultSdk : '');
if (androidSdkRoot) {
  process.env.ANDROID_HOME = androidSdkRoot;
  process.env.ANDROID_SDK_ROOT = androidSdkRoot;
  process.env.PATH = `${path.join(androidSdkRoot, 'platform-tools')}:${path.join(androidSdkRoot, 'emulator')}:${process.env.PATH}`;
}

import {
  resolveAndroidBuild,
  resolveMobileCapabilities,
  resolveMobilePlatform,
} from '../mobile/src/config/mobile.config';

interface PreflightResult {
  ok: boolean;
  checks: Array<{ name: string; status: 'PASS' | 'FAIL' | 'WARN'; message: string }>;
}

function resolveSessionPath(envVar: string, defaultRelPath: string): string {
  return path.resolve(process.cwd(), process.env[envVar] || defaultRelPath);
}

function sessionExists(envVar: string, defaultRelPath: string): boolean {
  const sessionPath = resolveSessionPath(envVar, defaultRelPath);
  const userDataDir = sessionPath.endsWith('.json')
    ? sessionPath.replace(/\.json$/, '-user-data')
    : `${sessionPath}-user-data`;
  return existsSync(sessionPath) || existsSync(userDataDir);
}

function tryCommand(command: string, args: string[], maxMs = 10000): { ok: boolean; output: string; error?: string } {
  try {
    const output = execFileSync(command, args, {
      encoding: 'utf8',
      timeout: maxMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return { ok: true, output };
  } catch (err: any) {
    const stdout = err?.stdout ? String(err.stdout).trim() : '';
    const stderr = err?.stderr ? String(err.stderr).trim() : '';
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      output: stdout || stderr,
      error: stderr || stdout || message,
    };
  }
}

function checkNodeDependencies(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  const result = tryCommand('npx', ['wdio', '--version'], 10000);
  if (!result.ok && !result.output) {
    return { status: 'FAIL', message: `WebdriverIO CLI not available: ${result.error}` };
  }
  return { status: 'PASS', message: `WebdriverIO ${result.output}` };
}

function checkAppium(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  const result = tryCommand('npx', ['appium', '--version'], 10000);
  if (!result.ok && !result.output) {
    return { status: 'FAIL', message: `Appium CLI not available: ${result.error}` };
  }
  return { status: 'PASS', message: `Appium ${result.output}` };
}

function checkAppiumDrivers(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  const platform = resolveMobilePlatform();
  const expectedDriver = platform === 'ios' ? 'xcuitest' : 'uiautomator2';
  const pkgDir = path.resolve(process.cwd(), `node_modules/appium-${expectedDriver}-driver`);
  if (existsSync(pkgDir)) {
    return { status: 'PASS', message: `${expectedDriver} driver installed` };
  }
  const result = tryCommand('npx', ['appium', 'driver', 'list', '--installed', '--json'], 10000);
  const combined = `${result.output} ${result.error || ''}`.toLowerCase();
  if (!combined.includes(expectedDriver)) {
    return {
      status: 'FAIL',
      message: `${expectedDriver} driver not installed. Run: npx appium driver install ${expectedDriver}`,
    };
  }
  return { status: 'PASS', message: `${expectedDriver} driver installed` };
}

function checkAndroidSdk(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!sdk) {
    return { status: 'FAIL', message: 'ANDROID_SDK_ROOT / ANDROID_HOME not set' };
  }
  if (!existsSync(sdk)) {
    return { status: 'FAIL', message: `Android SDK path does not exist: ${sdk}` };
  }
  const adb = path.join(sdk, 'platform-tools', 'adb');
  if (!existsSync(adb)) {
    return { status: 'FAIL', message: `adb not found at ${adb}` };
  }
  const devices = tryCommand(adb, ['devices'], 5000);
  if (!devices.ok) {
    return { status: 'WARN', message: `adb devices failed: ${devices.error}` };
  }
  const activeDevices = devices.output.split('\n').slice(1).filter((line) => line.trim() && line.includes('\tdevice'));
  if (activeDevices.length === 0) {
    return { status: 'WARN', message: 'No Android devices/emulators currently online. (Start emulator before running)' };
  }
  return { status: 'PASS', message: `${activeDevices.length} Android device(s) ready` };
}

function checkIosEnvironment(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  const xcodeSelect = tryCommand('xcode-select', ['-p'], 5000);
  if (!xcodeSelect.ok) {
    return { status: 'FAIL', message: `Xcode command line tools not found: ${xcodeSelect.error}` };
  }
  const simctl = tryCommand('xcrun', ['simctl', 'list', 'devices', 'available'], 8000);
  if (!simctl.ok) {
    return { status: 'WARN', message: `simctl unavailable: ${simctl.error}` };
  }
  return { status: 'PASS', message: 'Xcode & simctl available' };
}

function checkBuildArtifact(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  try {
    const capabilities = resolveMobileCapabilities();
    const appKey = 'appium:app';
    const appPath = capabilities[appKey] as string | undefined;
    if (!appPath) {
      return { status: 'FAIL', message: `No ${appKey} resolved in capabilities` };
    }
    if (!existsSync(appPath)) {
      return { status: 'FAIL', message: `Build artifact missing: ${appPath}` };
    }
    return { status: 'PASS', message: `Build artifact ready: ${appPath}` };
  } catch (err) {
    return {
      status: 'FAIL',
      message: `Failed to resolve build artifact: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkGoogleVoiceSession(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  if (!sessionExists('GV_SESSION_PATH', 'mobile/.auth/gv-session.json')) {
    return {
      status: 'WARN',
      message: 'Google Voice session not found (optional in mock verification mode). Run: npm run setup:gv-session',
    };
  }
  return { status: 'PASS', message: 'Google Voice session present' };
}

function checkOutlookSession(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  const env = process.env.MOBILE_ENV || 'prod';
  const isCreateUser = (process.env.MOBILE_SPECS || '').includes('create-user');
  if (env === 'prod' || !isCreateUser) {
    return { status: 'PASS', message: 'Outlook session not required for this run' };
  }
  if (!sessionExists('OUTLOOK_SESSION_PATH', 'mobile/.auth/outlook-session.json')) {
    return {
      status: 'WARN',
      message: 'Outlook session not found. Non-prod create-account may require manual sign-in on first run.',
    };
  }
  return { status: 'PASS', message: 'Outlook session present' };
}

function checkFirebaseAccess(): { status: 'PASS' | 'FAIL' | 'WARN'; message: string } {
  try {
    const android = resolveAndroidBuild();
    if (android.build.source !== 'firebase' && android.build.source !== 'firebase-web') {
      return { status: 'PASS', message: 'Firebase access not required for this build source' };
    }
  } catch {
    return { status: 'PASS', message: 'Skipping Firebase check (Android build not configured)' };
  }

  const hasToken = Boolean(
    process.env.FIREBASE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN
  );
  if (hasToken) {
    return { status: 'PASS', message: 'Firebase access token present' };
  }

  try {
    const configPath = path.resolve(process.cwd(), 'test-data/mobile-app/gri/android/config.yml');
    if (existsSync(configPath)) {
      const parsed = YAML.parse(readFileSync(configPath, 'utf8')) as { android?: { firebase?: { serviceAccountKeyFile?: string } } };
      if (parsed?.android?.firebase?.serviceAccountKeyFile) {
        return { status: 'PASS', message: 'Firebase service account key configured' };
      }
    }
  } catch {
    // fall through
  }

  return {
    status: 'WARN',
    message: 'Firebase credentials not detected. Firebase builds may fail. Run npm run verify:firebase-access.',
  };
}

export function runPreflight(): PreflightResult {
  const platform = resolveMobilePlatform();
  const checks: PreflightResult['checks'] = [
    { name: 'Node dependencies', ...checkNodeDependencies() },
    { name: 'Appium CLI', ...checkAppium() },
    { name: 'Appium driver', ...checkAppiumDrivers() },
    { name: `${platform} environment`, ...(platform === 'ios' ? checkIosEnvironment() : checkAndroidSdk()) },
    { name: 'Build artifact', ...checkBuildArtifact() },
    { name: 'Google Voice session', ...checkGoogleVoiceSession() },
    { name: 'Outlook session', ...checkOutlookSession() },
  ];

  if (platform === 'android') {
    checks.push({ name: 'Firebase access', ...checkFirebaseAccess() });
  }

  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const ok = failCount === 0;

  return {
    ok,
    checks,
  };
}

if (require.main === module) {
  const result = runPreflight();
  console.log(`\nMobile pre-flight: ${result.ok ? 'READY' : 'BLOCKED'} (${result.checks.length} checks)`);
  for (const check of result.checks) {
    console.log(`  [${check.status}] ${check.name}: ${check.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}

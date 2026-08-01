import path from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

import { resolveGoogleVoiceProfile } from '../mobile/src/utils/mobile-auth';

function parseProfileArg(): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--profile' && args[i + 1]) {
      return args[i + 1];
    }
  }
  return process.env.MOBILE_GV_PROFILE;
}

async function verifyGoogleVoiceSession(profileName?: string): Promise<void> {
  const profile = resolveGoogleVoiceProfile(profileName);
  const sessionPath = path.resolve(process.cwd(), profile.sessionPath);

  if (!existsSync(sessionPath)) {
    throw new Error(`Google Voice session file is missing: ${sessionPath}. Run \"npm run setup:gv-session\" first.`);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: sessionPath });
  const page = await context.newPage();

  try {
    await page.goto('https://voice.google.com/messages', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    if (page.url().includes('accounts.google.com')) {
      throw new Error(
        `Google Voice session for profile \"${profile.name}\" is expired. Run \"npm run setup:gv-session -- --profile ${profile.name}\".`
      );
    }

    await page.waitForSelector('body', { timeout: 10000 });
    console.log(`[verify-sessions] Google Voice session is valid for profile \"${profile.name}\".`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function shouldAutoSetup(): boolean {
  if (process.env.MOBILE_GV_AUTO_SETUP === 'true') {
    return true;
  }

  if (process.env.MOBILE_GV_AUTO_SETUP === 'false') {
    return false;
  }

  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function runSetup(profileName?: string): void {
  const args = ['run', 'setup:gv-session', '--'];
  if (profileName) {
    args.push('--profile', profileName);
  }

  execFileSync('npm', args, {
    stdio: 'inherit',
    env: process.env,
  });
}

async function main(): Promise<void> {
  const profile = parseProfileArg();
  try {
    await verifyGoogleVoiceSession(profile);
  } catch (error) {
    if (!shouldAutoSetup()) {
      throw error;
    }

    console.warn('[verify-sessions] Google Voice session is missing or expired. Launching setup flow...');
    runSetup(profile);
    await verifyGoogleVoiceSession(profile);
  }
}

main().catch((error) => {
  console.error('[verify-sessions] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

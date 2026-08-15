import path from 'node:path';
import readline from 'node:readline';
import { mkdirSync } from 'node:fs';
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

async function waitForEnter(): Promise<void> {
  if (!process.stdin.isTTY) return;
  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter once the Firebase App Distribution page is visible in the browser... ', () => {
      rl.close();
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const profileName = parseProfileArg();
  const profile = resolveGoogleVoiceProfile(profileName);

  const baseSessionRel = profile.sessionPath.replace(/gv-session/, 'firebase-session');
  const sessionPath = path.resolve(process.cwd(), process.env.FIREBASE_SESSION_PATH || baseSessionRel);
  const userDataDir = sessionPath.endsWith('.json') ? sessionPath.replace(/\.json$/, '-user-data') : `${sessionPath}-user-data`;

  mkdirSync(path.dirname(sessionPath), { recursive: true });
  mkdirSync(userDataDir, { recursive: true });

  console.log(`[firebase-session] profile: ${profile.name}`);
  console.log(`[firebase-session] target file: ${sessionPath}`);
  console.log(`[firebase-session] user data dir: ${userDataDir}`);
  console.log('[firebase-session] launching headed Chrome (persistent profile)...');

  const launchOptions = {
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-restore-session-state',
      '--disable-session-crashed-bubble',
      '--disable-infobars',
    ],
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  };

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...launchOptions,
    channel: 'chrome',
  }).catch(() => chromium.launchPersistentContext(userDataDir, launchOptions));

  const page = context.pages()[0] || await context.newPage();
  const pages = context.pages();
  for (let i = 1; i < pages.length; i += 1) await pages[i].close().catch(() => {});

  try {
    await page.goto('https://console.firebase.google.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });

    console.log('[firebase-session] sign in manually (including 2FA) in the opened browser.');
    console.log('[firebase-session] do not close the browser window until prompted.');
    await waitForEnter();

    if (page.url().includes('accounts.google.com')) {
      throw new Error('Google sign-in is not complete yet. Finish login and rerun setup if needed.');
    }

    await context.storageState({ path: sessionPath });
    console.log(`[firebase-session] session saved to ${sessionPath} and persistent profile saved to ${userDataDir}`);
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[firebase-session] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

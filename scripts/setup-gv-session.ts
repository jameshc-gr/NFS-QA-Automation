import { chromium } from '@playwright/test';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const AUTH_DIR = path.resolve(process.cwd(), 'mobile/.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'google-voice-session.json');

async function setupGoogleVoiceSession() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }

  console.log('Launching headed browser for Google Voice login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://voice.google.com/messages');
  console.log('\n*** Action Required ***');
  console.log('Please log into your Google Voice account in the opened browser window.');
  console.log('Press Enter in this terminal after you have logged in and see your Google Voice messages page.');

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`\nSuccessfully saved Google Voice session state to: ${STORAGE_STATE_PATH}`);
  await browser.close();
}

setupGoogleVoiceSession().catch(console.error);

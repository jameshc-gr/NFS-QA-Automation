import { chromium } from '@playwright/test';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { extractCodeFromText } from './code-parser';

export { extractCodeFromText };

export interface GoogleVoiceOptions {
  googleEmail?: string;
  googlePassword?: string;
  headless?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  /** Expected number of digits in the code. Defaults to 6. */
  codeLength?: number;
}

const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'mobile/.auth/google-voice-session.json');

const THREAD_SELECTORS = [
  'gv-thread-item',
  '.gvThreadItem',
  'div[gv-id="thread-item"]',
  'div[role="listitem"]',
];

async function readLatestThreadText(page: import('@playwright/test').Page): Promise<string> {
  for (const selector of THREAD_SELECTORS) {
    const locator = page.locator(selector).first();
    if (await locator.count().then((count) => count > 0).catch(() => false)) {
      const text = await locator.innerText().catch(() => '');
      if (text.trim()) return text;
    }
  }
  return '';
}

export async function fetchGoogleVoiceSmsCode(options: GoogleVoiceOptions = {}): Promise<string> {
  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 60000;
  const pollIntervalMs = options.pollIntervalMs ?? 3000;

  if (!existsSync(STORAGE_STATE_PATH)) {
    throw new Error(
      'Google Voice session file not found. Run "npx ts-node scripts/setup-gv-session.ts" once to save a signed-in session.'
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();
  const deadline = Date.now() + timeoutMs;

  try {
    await page.goto('https://voice.google.com/messages', {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(timeoutMs, 30000),
    });

    if (page.url().includes('accounts.google.com') || page.url().includes('signin')) {
      throw new Error(
        'Google Voice session expired. Re-run "npx ts-node scripts/setup-gv-session.ts" to refresh the saved session.'
      );
    }

    while (Date.now() < deadline) {
      const messageText = await readLatestThreadText(page);
      const code = extractCodeFromText(messageText, options.codeLength ?? 6);
      if (code) {
        return code;
      }

      await page.waitForTimeout(pollIntervalMs);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    throw new Error('Timed out waiting for an SMS verification code in Google Voice.');
  } finally {
    await browser.close();
  }
}

import path from 'node:path';
import readline from 'node:readline';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

async function waitForEnterKey(): Promise<void> {
  if (!process.stdin.isTTY) {
    return;
  }
  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press ENTER once Google sign-in is complete and the Voice inbox is visible... ', () => {
      rl.close();
      resolve();
    });
  });
}

export interface GoogleVoiceOptions {
  sessionPath?: string;
  headless?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  excludeCodes?: string[];
  maxAgeMs?: number;
  singleCheck?: boolean;
}

export function extractCodeFromText(text: string): string | null {
  const htmlBoldMatch = text.match(/<(?:b|strong)[^>]*>\s*(\d{6})\s*<\/(?:b|strong)>/i);
  if (htmlBoldMatch?.[1]) {
    return htmlBoldMatch[1];
  }

  const cleanText = text
    .replace(/#[0-9a-fA-F]{6}\b/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  const phraseMatch = cleanText.match(/(?:verification\s+code|code\s+below|code\s+is|code:?)[\s\S]{1,100}?\b(\d{6})\b/i);
  if (phraseMatch?.[1]) {
    return phraseMatch[1];
  }

  const match = cleanText.match(/\b\d{6}\b/);
  return match?.[0] || null;
}

export async function fetchGoogleVoiceSmsCode(options: GoogleVoiceOptions = {}): Promise<string> {
  const sessionPath = path.resolve(process.cwd(), options.sessionPath || process.env.GV_SESSION_PATH || 'mobile/.auth/gv-session.json');
  const userDataDir = sessionPath.endsWith('.json')
    ? sessionPath.replace(/\.json$/, '-user-data')
    : `${sessionPath}-user-data`;

  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 120000;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;

  if (!existsSync(sessionPath) && !existsSync(userDataDir)) {
    throw new Error(`Google Voice session not found at ${sessionPath}. Run "npm run setup:gv-session" first.`);
  }

  const launchOptions = {
    headless,
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

  let context = await chromium.launchPersistentContext(userDataDir, {
    ...launchOptions,
    channel: 'chrome',
  }).catch(() => chromium.launchPersistentContext(userDataDir, launchOptions));

  let page = context.pages()[0] || await context.newPage();
  let pages = context.pages();
  for (let i = 1; i < pages.length; i += 1) {
    await pages[i].close().catch(() => {});
  }

  try {
    await page.goto('https://voice.google.com/u/0/messages', { waitUntil: 'domcontentloaded', timeout: timeoutMs })
      .catch(() => page.goto('https://voice.google.com/messages', { waitUntil: 'domcontentloaded', timeout: timeoutMs }));

    if (page.url().includes('accounts.google.com')) {
      console.log('\n================================================================');
      console.log('[Google Voice] Sign-in required! Opening headed browser window...');
      console.log('Please sign in to Google Voice in the opened browser window.');
      console.log('================================================================\n');

      await context.close().catch(() => {});

      context = await chromium.launchPersistentContext(userDataDir, {
        ...launchOptions,
        headless: false,
        channel: 'chrome',
      }).catch(() => chromium.launchPersistentContext(userDataDir, { ...launchOptions, headless: false }));

      page = context.pages()[0] || await context.newPage();
      pages = context.pages();
      for (let i = 1; i < pages.length; i += 1) {
        await pages[i].close().catch(() => {});
      }

      await page.goto('https://voice.google.com/u/0/messages', { waitUntil: 'domcontentloaded' })
        .catch(() => page.goto('https://voice.google.com/messages', { waitUntil: 'domcontentloaded' }));
      await waitForEnterKey();

      if (!page.url().includes('accounts.google.com')) {
        await context.storageState({ path: sessionPath }).catch(() => {});
        console.log('[Google Voice] Sign-in verified & session saved! Continuing SMS code retrieval...');
      }
    }

    const excludeCodes = options.excludeCodes || [];
    const maxAgeMs = options.maxAgeMs || 180000; // 3 minutes max age

    if (options.singleCheck) {
      const latestCode = await getRecentSmsCodeFromPage(page, excludeCodes, maxAgeMs, false);
      if (latestCode) {
        return latestCode;
      }

      throw new Error('No eligible code found in the latest Google Voice message thread.');
    }

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const code = await getRecentSmsCodeFromPage(page, excludeCodes, maxAgeMs, true);
      if (code) {
        return code;
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {});
      await page.waitForTimeout(pollIntervalMs);
    }

    // Last resort: take the newest thread's code regardless of its rendered timestamp.
    const latestCode = await getRecentSmsCodeFromPage(page, excludeCodes, maxAgeMs, false);
    if (latestCode) {
      console.log(`[Google Voice] Freshness window elapsed; using latest message code ${latestCode}`);
      return latestCode;
    }

    throw new Error(
      `Could not locate a valid 6-digit verification code sent within 3 minutes in Google Voice messages before timeout.`
    );
  } finally {
    await context.close().catch(() => {});
  }
}

function extractLatestCodeFromText(text: string, excludeCodes: string[]): string | null {
  const cleanText = text
    .replace(/#[0-9a-fA-F]{6}\b/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  const matches = [...cleanText.matchAll(/\b\d{6}\b/g)].map((m) => m[0]);
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    if (!excludeCodes.includes(matches[i])) {
      return matches[i];
    }
  }

  const single = extractCodeFromText(cleanText);
  return single && !excludeCodes.includes(single) ? single : null;
}

async function getRecentSmsCodeFromPage(
  page: any,
  excludeCodes: string[],
  maxAgeMs: number,
  enforceFreshness: boolean
): Promise<string | null> {
  // Google Voice sorts the left conversation pane newest-first.
  const latestThread = page.locator('gv-message-thread-list-item').first();
  if (await latestThread.count().catch(() => 0)) {
    await latestThread.click();
    await page.waitForTimeout(500);

    const previewText = await latestThread.innerText().catch(() => '');
    const previewCode = extractLatestCodeFromText(previewText, excludeCodes);
    if (previewCode) {
      if (!enforceFreshness || isRecentMessageText(previewText, maxAgeMs)) {
        return previewCode;
      }
      console.log(
        `[Google Voice] Skipping code ${previewCode} — message timestamp outside the freshness window.`
      );
    }

    // Fallback to opened thread details if the list preview does not contain
    // an eligible code (for example, very long SMS previews).
    const threadDetails = page.locator('gv-thread-details').first();
    const detailsText = await threadDetails.innerText().catch(() => '');
    const detailCode = extractLatestCodeFromText(detailsText, excludeCodes);
    if (detailCode && (!enforceFreshness || isRecentMessageText(detailsText, maxAgeMs))) {
      return detailCode;
    }
  }

  return null;
}

function isRecentMessageText(text: string, maxAgeMs: number): boolean {
  if (!text) return true;
  const clean = text.toLowerCase().trim();

  // Freshness indicators: "just now", "now", "0m", "1m", "2m", "3m"
  if (
    clean.includes('just now') ||
    clean.includes('now') ||
    clean.includes('0m') ||
    clean.includes('1m') ||
    clean.includes('2m') ||
    clean.includes('3m')
  ) {
    return true;
  }

  const matchMin = clean.match(/(\d+)\s*(?:m|min|minute)/);
  if (matchMin?.[1]) {
    const minutes = parseInt(matchMin[1], 10);
    return minutes * 60 * 1000 <= maxAgeMs;
  }

  const matchSec = clean.match(/(\d+)\s*(?:s|sec|second)/);
  if (matchSec?.[1]) {
    return true;
  }

  // If time string is e.g. "10:45 AM"
  const matchTime = clean.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (matchTime) {
    const now = new Date();
    let hours = parseInt(matchTime[1], 10);
    const minutes = parseInt(matchTime[2], 10);
    const ampm = matchTime[3];

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    const msgDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    const diffMs = now.getTime() - msgDate.getTime();

    // Google Voice renders timestamps in the account's timezone (ET), which is not
    // necessarily the runner's timezone (PT). Cancel out any whole-hour offset so only
    // the minutes actually matter when judging freshness.
    const hourMs = 3600000;
    const tzNormalizedDiffMs = diffMs - Math.round(diffMs / hourMs) * hourMs;

    return Math.abs(tzNormalizedDiffMs) <= maxAgeMs;
  }

  return true;
}

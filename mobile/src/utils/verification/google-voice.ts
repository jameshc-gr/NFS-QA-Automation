import { chromium } from '@playwright/test';

export interface GoogleVoiceOptions {
  googleEmail?: string;
  googlePassword?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export function extractCodeFromText(text: string): string | null {
  const match = text.match(/\b\d{4,8}\b/);
  return match ? match[0] : null;
}

export async function fetchGoogleVoiceSmsCode(options: GoogleVoiceOptions = {}): Promise<string> {
  const email = options.googleEmail || process.env.GV_EMAIL;
  const password = options.googlePassword || process.env.GV_PASSWORD;
  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 30000;

  if (!email || !password) {
    throw new Error('Google Voice credentials not configured. Please set GV_EMAIL and GV_PASSWORD environment variables.');
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://voice.google.com/messages', { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    
    // Perform standard Google authentication if redirected
    if (page.url().includes('accounts.google.com')) {
      await page.fill('input[type="email"]', email);
      await page.click('#identifierNext');
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.fill('input[type="password"]', password);
      await page.click('#passwordNext');
      await page.waitForURL((url) => url.toString().includes('voice.google.com'), { timeout: timeoutMs });
    }

    await page.waitForSelector('.gvThreadItem', { timeout: timeoutMs });
    const messageText = await page.innerText('.gvThreadItem:first-child');
    const code = extractCodeFromText(messageText);

    if (!code) {
      throw new Error(`Could not locate verification code in Google Voice message: "${messageText}"`);
    }

    return code;
  } finally {
    await browser.close();
  }
}

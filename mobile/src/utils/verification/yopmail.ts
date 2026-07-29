import { chromium } from '@playwright/test';
import { extractCodeFromText } from './google-voice';

export interface YopmailOptions {
  mailbox: string;
  headless?: boolean;
  timeoutMs?: number;
}

export async function fetchYopmailCode(options: YopmailOptions): Promise<string> {
  const { mailbox, headless = true, timeoutMs = 30000 } = options;
  if (!mailbox) {
    throw new Error('Yopmail mailbox name is required.');
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`https://yopmail.com/en/wm?login=${encodeURIComponent(mailbox)}`, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    const mailFrame = page.frame({ name: 'ifmail' });
    if (!mailFrame) {
      await page.waitForSelector('iframe#ifmail', { timeout: timeoutMs });
    }

    const frame = page.frame({ name: 'ifmail' });
    if (!frame) {
      throw new Error('Could not access Yopmail mail content frame.');
    }

    await frame.waitForSelector('body', { timeout: timeoutMs });
    const bodyText = await frame.innerText('body');
    const code = extractCodeFromText(bodyText);

    if (!code) {
      throw new Error(`Could not find verification code in Yopmail inbox for mailbox: ${mailbox}`);
    }

    return code;
  } finally {
    await browser.close();
  }
}

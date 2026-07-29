/**
 * Diagnostic: open a (shared) Outlook mailbox with the saved session and dump
 * what the message list actually contains.
 *
 *   npx ts-node scripts/peek-outlook.ts v3test@rate.com
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'mobile/.auth/outlook-session.json');
const DEBUG_DIR = path.resolve(process.cwd(), 'test-results/outlook-login');

const MESSAGE_LIST_SELECTORS = ['div[role="option"]', 'div[data-convid]', 'div[role="listbox"] > div'];

async function peek(mailbox?: string): Promise<void> {
  if (!existsSync(STORAGE_STATE_PATH)) {
    throw new Error('No saved Outlook session. Run "npm run setup:outlook-session" first.');
  }
  mkdirSync(DEBUG_DIR, { recursive: true });

  const url = mailbox
    ? `https://outlook.cloud.microsoft/mail/${mailbox}/`
    : 'https://outlook.cloud.microsoft/mail/';
  const browser = await chromium.launch({ headless: process.env.PEEK_HEADED ? false : true });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();

  try {
    console.log(`[peek] navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(12000);
    console.log(`[peek] landed on ${page.url()}`);
    console.log(`[peek] title: ${await page.title()}`);

    await page.screenshot({ path: path.join(DEBUG_DIR, 'peek-inbox.png'), fullPage: false });

    for (const selector of MESSAGE_LIST_SELECTORS) {
      const rows = page.locator(selector);
      const count = await rows.count().catch(() => 0);
      console.log(`[peek] selector ${selector} -> ${count} rows`);
      if (count === 0) continue;

      const limit = Math.min(count, 15);
      for (let i = 0; i < limit; i += 1) {
        const text = (await rows.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        console.log(`  [${i}] ${text.slice(0, 220)}`);
      }
      break;
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  peek(process.argv[2]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

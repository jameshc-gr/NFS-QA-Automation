import { chromium, type Frame, type Page } from '@playwright/test';
import { extractCodeFromText } from './code-parser';

export interface YopmailOptions {
  mailbox: string;
  headless?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  /** Expected number of digits in the code. Defaults to 6. */
  codeLength?: number;
  /** Only accept a message whose subject/preview contains this text (case-insensitive). */
  subjectContains?: string;
}

const YOPMAIL_BASE = 'https://yopmail.com/en/wm?login=';

function normalizeMailbox(mailbox: string): string {
  return mailbox.includes('@') ? mailbox.split('@')[0] : mailbox;
}

function getFrame(page: Page, name: string): Frame | null {
  return page.frames().find((frame) => frame.name() === name) || null;
}

async function readInboxItems(page: Page): Promise<Array<{ index: number; text: string }>> {
  const inbox = getFrame(page, 'ifinbox');
  if (!inbox) return [];

  return await inbox
    .$$eval('div.m', (nodes) => nodes.map((node, index) => ({ index, text: (node.textContent || '').trim() })))
    .catch(() => []);
}

async function openInboxItem(page: Page, index: number): Promise<void> {
  const inbox = getFrame(page, 'ifinbox');
  if (!inbox) return;

  const items = await inbox.$$('div.m').catch(() => []);
  await items[index]?.click().catch(() => {});
}

async function readMailBody(page: Page): Promise<string> {
  const mail = getFrame(page, 'ifmail');
  if (!mail) return '';
  return await mail.innerText('body').catch(() => '');
}

export async function fetchYopmailCode(options: YopmailOptions): Promise<string> {
  const {
    mailbox,
    headless = true,
    timeoutMs = 60000,
    pollIntervalMs = 3000,
    subjectContains,
    codeLength = 6,
  } = options;

  if (!mailbox) {
    throw new Error('Yopmail mailbox name is required.');
  }

  const login = normalizeMailbox(mailbox);
  const needle = subjectContains?.toLowerCase();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  const deadline = Date.now() + timeoutMs;

  try {
    await page.goto(`${YOPMAIL_BASE}${encodeURIComponent(login)}`, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(timeoutMs, 30000),
    });

    while (Date.now() < deadline) {
      const items = await readInboxItems(page);
      const candidates = needle ? items.filter((item) => item.text.toLowerCase().includes(needle)) : items;

      for (const candidate of candidates) {
        await openInboxItem(page, candidate.index);
        await page.waitForTimeout(1000);
        const code = extractCodeFromText(await readMailBody(page), codeLength);
        if (code) {
          return code;
        }
      }

      if (items.length === 0 && !needle) {
        const code = extractCodeFromText(await readMailBody(page), codeLength);
        if (code) {
          return code;
        }
      }

      await page.waitForTimeout(pollIntervalMs);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    throw new Error(
      subjectContains
        ? `Timed out waiting for a Yopmail message in "${login}" with subject containing "${subjectContains}".`
        : `Timed out waiting for a verification code in Yopmail inbox "${login}".`
    );
  } finally {
    await browser.close();
  }
}

import path from 'node:path';
import readline from 'node:readline';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

import { getVerificationConfig } from '../mobile/src/utils/mobile-auth';

function waitForEnter(promptText: string): Promise<void> {
  if (!process.stdin.isTTY) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const verificationConfig = getVerificationConfig();
  const email = process.env.OUTLOOK_EMAIL || verificationConfig.outlook?.email;
  const password = process.env.OUTLOOK_PASSWORD || verificationConfig.outlook?.password;

  if (!email || !password) {
    throw new Error(
      'Outlook credentials are missing. Set OUTLOOK_EMAIL/OUTLOOK_PASSWORD or configure outlook.email/outlook.password in config.yml.'
    );
  }

  const sessionPath = path.resolve(
    process.cwd(),
    process.env.OUTLOOK_SESSION_PATH || 'mobile/.auth/outlook-session.json'
  );
  const userDataDir = sessionPath.endsWith('.json')
    ? sessionPath.replace(/\.json$/, '-user-data')
    : `${sessionPath}-user-data`;

  mkdirSync(path.dirname(sessionPath), { recursive: true });
  mkdirSync(userDataDir, { recursive: true });

  const outlookUrl = process.env.OUTLOOK_WEB_URL || `https://outlook.cloud.microsoft/mail/${email}/`;

  console.log(`[outlook-session] mailbox: ${email}`);
  console.log(`[outlook-session] target file: ${sessionPath}`);
  console.log(`[outlook-session] user data dir: ${userDataDir}`);
  console.log('[outlook-session] launching headed Chrome (persistent profile)...');

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
  for (let i = 1; i < pages.length; i += 1) {
    await pages[i].close().catch(() => {});
  }

  try {
    await page.goto(outlookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

    const autoLoginResult = await autoFillOutlookLogin(page, email, password);
    console.log(`[outlook-session] login assist: ${autoLoginResult}`);

    console.log('[outlook-session] if prompted, complete Okta/MFA confirmation in the opened browser.');
    console.log('[outlook-session] once the inbox is visible, return here and press Enter.');
    await waitForEnter('Press Enter once the Outlook inbox is visible... ');

    await context.storageState({ path: sessionPath });
    console.log(`[outlook-session] session saved to ${sessionPath} and persistent profile saved to ${userDataDir}`);
  } finally {
    await context.close().catch(() => {});
  }
}

async function autoFillOutlookLogin(page: any, email: string, password: string): Promise<string> {
  const deadline = Date.now() + 90000;

  while (Date.now() < deadline) {
    const inboxVisible = await page
      .locator('div[role="option"], [aria-label*="Inbox" i], [title*="Inbox" i]')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (inboxVisible) {
      return 'inbox already visible';
    }

    const useAnother = page.locator('text=/Use another account/i').first();
    if (await useAnother.isVisible({ timeout: 700 }).catch(() => false)) {
      await useAnother.click().catch(() => {});
      await page.waitForTimeout(600);
      continue;
    }

    const emailInput = page.locator('input[name="loginfmt"], input[type="email"], #okta-signin-username').first();
    if (await emailInput.isVisible({ timeout: 700 }).catch(() => false)) {
      await emailInput.fill(email).catch(() => {});
      await page.locator('#idSIButton9, input[type="submit"], button[type="submit"], #okta-signin-submit').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      continue;
    }

    const passwordInput = page.locator('input[name="passwd"], input[type="password"], #okta-signin-password').first();
    if (await passwordInput.isVisible({ timeout: 700 }).catch(() => false)) {
      await passwordInput.fill(password).catch(() => {});
      await page.locator('#idSIButton9, input[type="submit"], button[type="submit"], #okta-signin-submit').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      return 'credentials submitted; waiting for Okta/MFA confirmation';
    }

    await page.waitForTimeout(800);
  }

  return `did not find login fields; current URL ${page.url()}`;
}

main().catch((error) => {
  console.error('[outlook-session] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

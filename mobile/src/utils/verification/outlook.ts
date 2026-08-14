import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { extractCodeFromText } from './google-voice';

export interface OutlookOptions {
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  titleMustContain?: string;
  subjectMustContain?: string;
  folder?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  excludeCodes?: string[];
}

export async function fetchOutlookCodeGraph(options: OutlookOptions = {}): Promise<string> {
  const email = options.email || process.env.OUTLOOK_EMAIL;
  const password = options.password || process.env.OUTLOOK_PASSWORD;
  const clientId = options.clientId || process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.OUTLOOK_CLIENT_SECRET;
  const tenantId = options.tenantId || process.env.OUTLOOK_TENANT_ID || 'common';
  const folder = options.folder || process.env.OUTLOOK_FOLDER;
  const titleMustContain = options.titleMustContain;
  const subjectMustContain = options.subjectMustContain;
  const timeoutMs = options.timeoutMs ?? 120000;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const excludeCodes = options.excludeCodes || [];

  if (!email) {
    throw new Error('Outlook mailbox missing. Set outlook.email in config or OUTLOOK_EMAIL.');
  }

  if (!clientId || !clientSecret) {
    return await fetchOutlookCodeOWA({
      ...options,
      email,
      password,
      timeoutMs,
      pollIntervalMs,
      excludeCodes,
    });
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to retrieve Graph token: ${tokenRes.statusText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const mailboxPath = `users/${encodeURIComponent(email)}${folder ? `/mailFolders/${encodeURIComponent(folder)}` : ''}`;
  const graphUrl = `https://graph.microsoft.com/v1.0/${mailboxPath}/messages?$top=10&$orderby=receivedDateTime desc`;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mailRes = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!mailRes.ok) {
      throw new Error(`Failed to fetch Outlook emails via Graph API: ${mailRes.statusText}`);
    }

    const mailData = (await mailRes.json()) as {
      value?: Array<{ subject?: string; body?: { content?: string } }>;
    };

    for (const message of mailData.value || []) {
      const combinedText = `${message.subject || ''}\n${message.body?.content || ''}`;
      if (!matchesTitleHint(combinedText, titleMustContain)) {
        continue;
      }
      
      // If subjectMustContain is specified, check subject specifically
      if (subjectMustContain && !String(message.subject || '').toLowerCase().includes(subjectMustContain.toLowerCase())) {
        continue;
      }

      const code = extractCodeFromText(combinedText);
      if (code && !excludeCodes.includes(code)) {
        return code;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Could not find a new verification code in ${email}${folder ? `/${folder}` : ''} before timeout.`
  );
}

async function fetchOutlookCodeOWA(options: OutlookOptions = {}): Promise<string> {
  const email = options.email || process.env.OUTLOOK_EMAIL;
  const password = options.password || process.env.OUTLOOK_PASSWORD;
  const timeoutMs = options.timeoutMs ?? 180000;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const excludeCodes = options.excludeCodes || [];
  const titleMustContain = options.titleMustContain;

  if (!email || !password) {
    throw new Error(
      'Outlook web login requires mailbox + password. Set outlook.email/outlook.password in config or OUTLOOK_EMAIL/OUTLOOK_PASSWORD.'
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

  const mailboxPath = formatMailboxPath(email);
  const outlookUrl = process.env.OUTLOOK_WEB_URL || `https://outlook.cloud.microsoft/mail/${mailboxPath}/`;
  const headless = process.env.OUTLOOK_HEADLESS === 'true';

  const sessionAttempt = await tryFetchCodeWithSavedState({
    sessionPath,
    outlookUrl,
    email,
    timeoutMs,
    pollIntervalMs,
    excludeCodes,
    titleMustContain,
    subjectMustContain: options.subjectMustContain,
    headless,
  });
  if (sessionAttempt) {
    return sessionAttempt;
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
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  };

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...launchOptions,
    channel: 'chrome',
  }).catch(() => chromium.launchPersistentContext(userDataDir, launchOptions));

  const page = context.pages()[0] || await context.newPage();

  try {
    await page.goto(outlookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ensureOutlookSignedIn(page, email, password);
    await ensureOnSharedMailbox(page, email);
    await context.storageState({ path: sessionPath }).catch(() => {});

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const code = await extractCodeFromInboxPage(page, excludeCodes, titleMustContain);
      if (code) {
        return code;
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(pollIntervalMs);
    }

    throw new Error(`Could not find a new verification code in Outlook web inbox for ${email} before timeout.`);
  } finally {
    await context.close().catch(() => {});
  }
}

async function tryFetchCodeWithSavedState(options: {
  sessionPath: string;
  outlookUrl: string;
  email: string;
  timeoutMs: number;
  pollIntervalMs: number;
  excludeCodes: string[];
  titleMustContain?: string;
  subjectMustContain?: string;
  headless: boolean;
}): Promise<string | null> {
  if (!existsSync(options.sessionPath)) {
    return null;
  }

  const browser = await chromium.launch({
    headless: options.headless,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  }).catch(() => chromium.launch({
    headless: options.headless,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  }));

  const context = await browser.newContext({
    storageState: options.sessionPath,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  const page = await context.newPage();

  try {
    await page.goto(options.outlookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ensureOnSharedMailbox(page, options.email);

    if (isLikelyAuthRedirect(page.url())) {
      return null;
    }

    const inboxReady = await isInboxVisible(page, 10000);
    if (!inboxReady) {
      return null;
    }

    const deadline = Date.now() + options.timeoutMs;
    while (Date.now() < deadline) {
      const code = await extractCodeFromInboxPage(page, options.excludeCodes, options.titleMustContain, options.subjectMustContain);
      if (code) {
        return code;
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(options.pollIntervalMs);
    }

    return null;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function ensureOutlookSignedIn(page: any, email: string, password: string): Promise<void> {
  const deadline = Date.now() + 180000;
  let oktaNoticeShown = false;

  while (Date.now() < deadline) {
    if (await isInboxVisible(page, 3000)) {
      return;
    }

    const currentUrl = page.url();
    const isOktaFlow = /okta\.com|\/sso\//i.test(currentUrl);
    if (isOktaFlow) {
      const oktaUser = page.locator('#okta-signin-username').first();
      if (await oktaUser.isVisible({ timeout: 700 }).catch(() => false)) {
        await oktaUser.fill(email).catch(() => {});
      }

      const oktaPass = page.locator('#okta-signin-password').first();
      if (await oktaPass.isVisible({ timeout: 700 }).catch(() => false)) {
        await oktaPass.fill(password).catch(() => {});
      }

      const oktaSubmit = page.locator('#okta-signin-submit, input[type="submit"], button[type="submit"]').first();
      if (await oktaSubmit.isVisible({ timeout: 700 }).catch(() => false)) {
        await oktaSubmit.click().catch(() => {});
        await page.waitForTimeout(1200);
        continue;
      }

      if (!oktaNoticeShown) {
        console.log('[Outlook OTP] Waiting for Okta confirmation (push/challenge) in the opened browser...');
        oktaNoticeShown = true;
      }
      await page.waitForTimeout(2000);
      continue;
    }

    // Microsoft account picker can appear before inputs.
    const useAnotherAccount = page.locator('text=/Use another account/i').first();
    if (await useAnotherAccount.isVisible({ timeout: 1000 }).catch(() => false)) {
      await useAnotherAccount.click().catch(() => {});
      await page.waitForTimeout(700);
      continue;
    }

    const accountTile = page.getByText(email, { exact: false }).first();
    if (await accountTile.isVisible({ timeout: 1000 }).catch(() => false)) {
      await accountTile.click().catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }

    const emailInput = page.locator('input[name="loginfmt"], input[type="email"], #okta-signin-username').first();
    if (await emailInput.isVisible({ timeout: 1200 }).catch(() => false)) {
      await emailInput.fill(email).catch(() => {});
      await page.locator('#idSIButton9, input[type="submit"], button[type="submit"], #okta-signin-submit').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      continue;
    }

    const passwordInput = page.locator('input[name="passwd"], input[type="password"], #okta-signin-password').first();
    if (await passwordInput.isVisible({ timeout: 1200 }).catch(() => false)) {
      await passwordInput.fill(password).catch(() => {});
      await page.locator('#idSIButton9, input[type="submit"], button[type="submit"], #okta-signin-submit').first().click().catch(() => {});
      await page.waitForTimeout(1400);
      continue;
    }

    const staySignedInYes = page.locator('#idSIButton9, button:has-text("Yes")').first();
    if (await staySignedInYes.isVisible({ timeout: 1000 }).catch(() => false)) {
      await staySignedInYes.click().catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }

    const staySignedInNo = page.locator('#idBtn_Back, button:has-text("No")').first();
    if (await staySignedInNo.isVisible({ timeout: 1000 }).catch(() => false)) {
      await staySignedInNo.click().catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Outlook sign-in did not reach mailbox before timeout. Current URL: ${page.url()}`);
}

async function ensureOnSharedMailbox(page: any, email: string): Promise<void> {
  const mailboxPath = formatMailboxPath(email);
  const expectedPath = `/mail/${mailboxPath}`;
  if (!page.url().includes(expectedPath)) {
    await page.goto(`https://outlook.cloud.microsoft/mail/${mailboxPath}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    }).catch(() => {});
  }

  await page.waitForTimeout(1000);
}

async function isInboxVisible(page: any, timeout = 3000): Promise<boolean> {
  return await page
    .locator('div[role="option"], [aria-label*="Inbox" i], [title*="Inbox" i]')
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

function isLikelyAuthRedirect(url: string): boolean {
  return /okta\.com|login\.microsoftonline\.com|\/authorize\?|\/sso\//i.test(url);
}

function formatMailboxPath(email: string): string {
  return String(email || '').trim();
}

async function extractCodeFromInboxPage(
  page: any,
  excludeCodes: string[],
  titleMustContain?: string,
  subjectMustContain?: string
): Promise<string | null> {
  const rows = page.locator('div[role="option"]');
  const rowCount = await rows.count().catch(() => 0);
  const maxRows = Math.min(rowCount, 20);

  for (let index = 0; index < maxRows; index += 1) {
    const row = rows.nth(index);
    const previewText = await row.innerText().catch(() => '');
    await row.click().catch(() => {});
    await page.waitForTimeout(400);

    const mainText = await page.locator('div[role="main"]').innerText().catch(() => '');
    const combined = `${previewText}\n${mainText}`;
    if (!matchesTitleHint(combined, titleMustContain)) {
      continue;
    }
    
    // If subjectMustContain is specified, check the preview text (subject) specifically
    if (subjectMustContain && !String(previewText || '').toLowerCase().includes(subjectMustContain.toLowerCase())) {
      continue;
    }

    const code = extractCodeFromText(combined);
    if (code && !excludeCodes.includes(code)) {
      return code;
    }
  }

  return null;
}

function matchesTitleHint(content: string, titleMustContain?: string): boolean {
  const hint = String(titleMustContain || '').trim().toLowerCase();
  if (!hint) {
    return true;
  }

  return String(content || '').toLowerCase().includes(hint);
}

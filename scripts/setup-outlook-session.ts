import { chromium, type Page } from '@playwright/test';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

import { getVerificationConfig } from '../mobile/src/utils/mobile-auth';

const AUTH_DIR = path.resolve(process.cwd(), 'mobile/.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'outlook-session.json');
const DEBUG_DIR = path.resolve(process.cwd(), 'test-results/outlook-login');
const MAILBOX_URL = 'https://outlook.office.com/mail/';

/** Records where the sign-in flow currently is, without capturing any secrets. */
async function trace(page: Page, label: string): Promise<void> {
  if (!existsSync(DEBUG_DIR)) {
    mkdirSync(DEBUG_DIR, { recursive: true });
  }

  const heading = await page
    .locator('h1, h2, [role="heading"]')
    .first()
    .innerText()
    .catch(() => '');

  console.log(`[login:${label}] url=${page.url().split('?')[0]} heading=${heading.replace(/\s+/g, ' ').slice(0, 80)}`);
  await page.screenshot({ path: path.join(DEBUG_DIR, `${label}.png`) }).catch(() => {});
}

/**
 * Signs into Outlook with the AD credentials held in the encrypted config and
 * saves the browser session so later runs can read the inbox headlessly.
 *
 * Credentials are read straight from config.yml (or the OUTLOOK_* env vars) and
 * are never printed. Okta MFA still has to be approved by hand, so the browser
 * stays open and waits for the mailbox to appear.
 */
export async function setupOutlookSession(options: { headless?: boolean } = {}): Promise<string> {
  const config = getVerificationConfig();
  const email = process.env.OUTLOOK_EMAIL || config.outlook?.email;
  const password = process.env.OUTLOOK_PASSWORD || config.outlook?.password;
  const oktaUsername =
    process.env.OUTLOOK_OKTA_USERNAME || config.outlook?.oktaUsername || email?.split('@')[0];

  if (!email || !password) {
    throw new Error(
      'Outlook credentials are missing. Set outlook.email and outlook.password in '
        + 'test-data/mobile-app/gri/android/config.yml (encrypt them with "npx ts-node scripts/encrypt-config.ts encrypt <value>").'
    );
  }

  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: options.headless ?? false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Opening Outlook and signing in with the configured AD account...');
    await page.goto(MAILBOX_URL, { waitUntil: 'domcontentloaded' });

    await signIn(page, { email, password, oktaUsername });

    console.log('Waiting for the mailbox to load (approve the Okta prompt if one appears)...');
    await waitForMailbox(page);

    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`Saved Outlook session to ${STORAGE_STATE_PATH}`);
    return STORAGE_STATE_PATH;
  } finally {
    await browser.close();
  }
}

async function signIn(
  page: Page,
  credentials: { email: string; password: string; oktaUsername?: string }
): Promise<void> {
  const deadline = Date.now() + 120000;
  let iteration = 0;

  while (Date.now() < deadline) {
    if (await isMailboxVisible(page)) {
      return;
    }

    iteration += 1;
    await trace(page, `step-${String(iteration).padStart(2, '0')}`);

    // Microsoft account picker / email step.
    const msEmail = page.locator('input[type="email"][name="loginfmt"]');
    if (await msEmail.isVisible().catch(() => false)) {
      await msEmail.fill(credentials.email);
      await page.locator('#idSIButton9, input[type="submit"]').first().click().catch(() => {});
      await page.waitForTimeout(3000);
      continue;
    }

    // Okta sign-in uses the AD user id rather than the mailbox address.
    const oktaUser = page.locator('input#okta-signin-username, input[name="identifier"]');
    if (await oktaUser.isVisible().catch(() => false)) {
      await oktaUser.fill(credentials.oktaUsername || credentials.email);

      const oktaPassword = page.locator(
        'input#okta-signin-password, input[name="credentials.passcode"][type="password"]'
      );
      if (await oktaPassword.isVisible().catch(() => false)) {
        await oktaPassword.fill(credentials.password);
      }

      await page
        .locator('input#okta-signin-submit, input[type="submit"], button[type="submit"]')
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(4000);
      continue;
    }

    // Some policies put the password on its own page.
    const passwordOnly = page.locator('input[type="password"]').first();
    if (await passwordOnly.isVisible().catch(() => false)) {
      await passwordOnly.fill(credentials.password);
      await page
        .locator('input[type="submit"], button[type="submit"], #idSIButton9')
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(4000);
      continue;
    }

    // "Stay signed in?" keeps the saved session valid for longer.
    const staySignedIn = page.locator('#idSIButton9');
    if (await staySignedIn.isVisible().catch(() => false)) {
      await staySignedIn.click().catch(() => {});
      await page.waitForTimeout(3000);
      continue;
    }

    await page.waitForTimeout(2000);
  }
}

async function isMailboxVisible(page: Page): Promise<boolean> {
  if (!/outlook\.(office|live)\.com\/mail/i.test(page.url())) {
    return false;
  }

  return await page
    .locator('div[role="option"], div[data-convid], div[role="listbox"]')
    .first()
    .isVisible()
    .catch(() => false);
}

/** Polls until the message list renders, leaving time for an MFA approval. */
async function waitForMailbox(page: Page, timeoutMs = 300000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isMailboxVisible(page)) {
      return;
    }
    await page.waitForTimeout(3000);
  }

  await trace(page, 'mailbox-timeout');

  throw new Error(
    `Outlook mailbox did not load within ${Math.round(timeoutMs / 1000)}s. `
      + 'The Okta MFA prompt may not have been approved.'
  );
}

if (require.main === module) {
  setupOutlookSession().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

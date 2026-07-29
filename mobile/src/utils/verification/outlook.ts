import { chromium } from '@playwright/test';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { extractCodeFromText } from './code-parser';

export interface OutlookOptions {
  email?: string;
  password?: string;
  /** Shared mailbox to read, e.g. v3test@rate.com. Defaults to the signed-in account. */
  mailbox?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  headless?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  /** Only accept a message whose subject contains this text (case-insensitive). */
  subjectContains?: string;
  /** Expected number of digits in the code. */
  codeLength?: number;
}

const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'mobile/.auth/outlook-session.json');

const MESSAGE_LIST_SELECTORS = [
  'div[role="option"]',
  'div[data-convid]',
  'div[role="listbox"] > div',
];

/**
 * The dev environment redirects registration emails to a shared mailbox with a
 * subject like:
 *   Verify registration [Test redirect; original recipients): to: <account>@yopmail.com]
 * The message list truncates that subject, so rows are shortlisted on any known
 * token and the full subject is confirmed in the reading pane after opening.
 */
const SUBJECT_HINTS = ['verify registration', 'no-reply@guaranteedrate.com', 'no reply'];

function buildRowTokens(subjectContains?: string): string[] {
  const tokens = [...SUBJECT_HINTS];

  if (subjectContains) {
    const needle = subjectContains.toLowerCase();
    tokens.push(needle);
    // OWA truncates long subjects, so also accept the mailbox local part.
    const localPart = needle.split('@')[0];
    if (localPart && localPart !== needle) {
      tokens.push(localPart);
    }
  }

  return tokens;
}

/**
 * Shared mailboxes are reached through their own path; without it OWA opens the
 * signed-in user's own inbox instead, where the redirected email never appears.
 * Signing in always lands on the personal mailbox first, so the shared mailbox
 * URL has to be opened explicitly afterwards.
 */
function buildInboxUrl(mailbox?: string): string {
  return mailbox
    ? `https://outlook.cloud.microsoft/mail/${mailbox}/`
    : 'https://outlook.cloud.microsoft/mail/';
}

export async function fetchOutlookCodeOWA(options: OutlookOptions = {}): Promise<string> {
  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 90000;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const codeLength = options.codeLength ?? 6;
  const needle = options.subjectContains?.toLowerCase();
  const rowTokens = buildRowTokens(needle);
  const inboxUrl = buildInboxUrl(options.mailbox);

  if (!existsSync(STORAGE_STATE_PATH)) {
    throw new Error(
      'Outlook session file not found. Run "npx ts-node scripts/setup-outlook-session.ts" once to complete Okta login and save the session.'
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();
  const deadline = Date.now() + timeoutMs;

  try {
    await page.goto(inboxUrl, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(timeoutMs, 45000),
    });

    if (/login\.microsoftonline\.com|okta|\/auth\//i.test(page.url())) {
      throw new Error(
        'Outlook / Okta session expired. Re-run "npx ts-node scripts/setup-outlook-session.ts" to refresh the saved session.'
      );
    }

    // OWA sometimes bounces the first load back to the signed-in user's own
    // mailbox, so navigate to the shared mailbox once more when that happens.
    if (options.mailbox && !page.url().toLowerCase().includes(options.mailbox.toLowerCase())) {
      await page.goto(inboxUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    }

    console.log(`[outlook] polling ${inboxUrl} for up to ${Math.round(timeoutMs / 1000)}s`);

    // OWA needs roughly ten seconds to render the message list, so wait for it
    // once up front instead of reloading into a permanently empty list.
    await page
      .locator(MESSAGE_LIST_SELECTORS.join(', '))
      .first()
      .waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 60000) })
      .catch(() => {});

    let attempt = 0;
    let lastReload = Date.now();

    while (Date.now() < deadline) {
      attempt += 1;

      // A session that lapses mid-poll silently bounces to Okta and leaves an
      // empty list behind, so stop early instead of burning the whole timeout.
      if (/login\.microsoftonline\.com|okta|\/auth\//i.test(page.url())) {
        throw new Error(
          'Outlook / Okta session expired. Re-run "npx ts-node scripts/setup-outlook-session.ts" to refresh the saved session.'
        );
      }

      for (const selector of MESSAGE_LIST_SELECTORS) {
        const rows = page.locator(selector);
        const count = await rows.count().catch(() => 0);
        if (count === 0) continue;

        const limit = Math.min(count, 15);
        for (let i = 0; i < limit; i += 1) {
          const row = rows.nth(i);
          const preview = (await row.innerText().catch(() => '')).trim().toLowerCase();
          if (!preview) continue;
          if (!rowTokens.some((token) => preview.includes(token))) continue;
          if (needle && !preview.includes(needle)) continue;

          await row.click().catch(() => {});
          await page.waitForTimeout(1500);

          // The reading pane carries the full, untruncated subject plus body,
          // so the recipient can be confirmed here even when the row was cut off.
          const paneText = await page
            .locator('div[role="main"]')
            .first()
            .innerText()
            .catch(() => '');

          if (needle && !paneText.toLowerCase().includes(needle)) continue;

          const bodyText = await page
            .locator('div[aria-label="Message body"], div[role="document"]')
            .first()
            .innerText()
            .catch(() => '');

          const code = extractCodeFromText(bodyText || paneText, codeLength);
          if (code) {
            console.log(`[outlook] found the verification email after ${attempt} attempt(s)`);
            return code;
          }
        }
        break;
      }

      console.log(
        `[outlook] attempt ${attempt}: no matching email yet, ${Math.round((deadline - Date.now()) / 1000)}s left`
      );
      await page.waitForTimeout(pollIntervalMs);

      // OWA streams new mail into the open list, so only reload occasionally as
      // a safety net; reloading every poll never gives the list time to render.
      if (Date.now() - lastReload > 90000) {
        lastReload = Date.now();
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page
          .locator(MESSAGE_LIST_SELECTORS.join(', '))
          .first()
          .waitFor({ state: 'visible', timeout: 60000 })
          .catch(() => {});
      }
    }

    throw new Error(
      options.subjectContains
        ? `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for an Outlook message addressed to "${options.subjectContains}".`
        : 'Timed out waiting for a verification code in the Outlook inbox.'
    );
  } finally {
    await browser.close();
  }
}

export async function fetchOutlookCodeGraph(options: OutlookOptions = {}): Promise<string> {
  const email = options.email || process.env.OUTLOOK_EMAIL;
  const clientId = options.clientId || process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.OUTLOOK_CLIENT_SECRET;
  const tenantId = options.tenantId || process.env.OUTLOOK_TENANT_ID || 'common';

  if (!email || !clientId || !clientSecret) {
    // Fallback to the Playwright/Okta session flow when Graph credentials are absent.
    return await fetchOutlookCodeOWA(options);
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
  const filter = options.subjectContains
    ? `&$search=${encodeURIComponent(`"subject:${options.subjectContains}"`)}`
    : '';
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages?$top=10${filter}`;

  const mailRes = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!mailRes.ok) {
    throw new Error(`Failed to fetch Outlook emails via Graph API: ${mailRes.statusText}`);
  }

  const mailData = (await mailRes.json()) as {
    value?: Array<{ subject?: string; body?: { content?: string } }>;
  };

  const needle = options.subjectContains?.toLowerCase();
  for (const message of mailData.value || []) {
    if (needle && !(message.subject || '').toLowerCase().includes(needle)) continue;
    const code = extractCodeFromText(message.body?.content || '', options.codeLength ?? 6);
    if (code) return code;
  }

  throw new Error('Could not find a verification code in the Outlook messages returned by Graph.');
}

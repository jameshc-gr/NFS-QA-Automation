import path from 'node:path';
import os from 'node:os';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Verifies the saved Google Voice session renders a logged-in inbox rather than a sign-in page.
// Works on a throwaway copy of the persistent profile so a live test run keeps its lock.
async function main(): Promise<void> {
  const sessionPath = path.resolve(
    process.cwd(),
    process.env.GV_SESSION_PATH || 'mobile/.auth/gv-session.json'
  );
  const userDataDir = sessionPath.replace(/\.json$/, '-user-data');

  if (!existsSync(userDataDir)) {
    console.error(`[gv-verify] FAIL: no profile at ${userDataDir}. Run "npm run setup:gv-session".`);
    process.exit(1);
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gv-verify-'));
  const profileCopy = path.join(tempDir, 'profile');
  cpSync(userDataDir, profileCopy, { recursive: true, force: true });

  const headless = process.env.GV_VERIFY_HEADED !== '1';
  const context = await chromium.launchPersistentContext(profileCopy, {
    headless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--no-first-run'],
    viewport: { width: 1280, height: 900 },
  });

  let exitCode = 1;
  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto('https://voice.google.com/u/0/messages', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(6000);

    const url = page.url();
    const title = await page.title();
    console.log(`[gv-verify] url  : ${url}`);
    console.log(`[gv-verify] title: ${title}`);

    const onSignIn = /accounts\.google\.com|ServiceLogin|signin/i.test(url);

    // Inbox chrome that only renders for an authenticated Voice user.
    const inboxSignals = [
      'gv-thread-list',
      'gv-message-list',
      '[gv-test-id="thread-list"]',
      'nav[role="navigation"] a[href*="/messages"]',
      'text=Send new message',
    ];
    let matched = '';
    for (const selector of inboxSignals) {
      const found = await page
        .locator(selector)
        .first()
        .waitFor({ state: 'attached', timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (found) {
        matched = selector;
        break;
      }
    }

    const shot = path.resolve(process.cwd(), 'mobile/.builds/gv-session-check.png');
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    console.log(`[gv-verify] screenshot: ${shot}`);

    if (onSignIn) {
      console.error('[gv-verify] FAIL: redirected to Google sign-in — session is expired.');
    } else if (matched) {
      console.log(`[gv-verify] PASS: logged-in Voice inbox rendered (matched "${matched}").`);
      exitCode = 0;
    } else {
      console.error('[gv-verify] FAIL: no inbox UI detected. Inspect the screenshot above.');
    }
  } finally {
    await context.close().catch(() => {});
    rmSync(tempDir, { recursive: true, force: true });
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('[gv-verify] FAIL:', error);
  process.exit(1);
});

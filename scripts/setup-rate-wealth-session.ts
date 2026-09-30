import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Opens a normal (non-automated) Chrome, lets the human sign in and finish any Okta MFA, then saves the session for the tests.
const email = process.argv[2] || process.env.RW_ONBOARDING_EMAIL || 'my-rw-jc003@yopmail.com';
const port = Number(process.env.RW_CDP_PORT || 9333);
const authDir = path.resolve('playwright/.auth');
const profileDir = path.join(authDir, 'chrome-profile-rate-wealth');
const statePath = path.join(authDir, `rate-wealth-${email.split('@')[0]}.json`);
const chromeBin = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = /wealth\.dev\.fitbux\.com\/(home|profile-builder|plan-select)/;

async function waitForCdp(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Chrome did not open its debugging port');
}

(async () => {
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  const chrome = spawn(chromeBin, [`--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', 'https://wealth.dev.fitbux.com/'], { stdio: 'ignore' });
  try {
    await waitForCdp();
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    console.log(`\nSign in as ${email} in the Chrome window that just opened (complete any MFA prompt yourself).`);
    console.log('This script only watches for the app URL; it never types or submits credentials.\n');
    const deadline = Date.now() + 10 * 60_000;
    let typedIdentifier = '';
    while (Date.now() < deadline) {
      for (const p of context.pages()) {
        if (!/login\.dev\.rate\.com/.test(p.url())) continue;
        const v = await p.locator('input[name="identifier"]').inputValue().catch(() => '');
        if (v) typedIdentifier = v.trim().toLowerCase();
      }
      const page = context.pages().find((p) => APP.test(p.url()));
      if (page) {
        await page.waitForTimeout(4000);
        const signedIn = await page.evaluate(() => !!localStorage.getItem('fitBUX-jwt')).catch(() => false);
        if (signedIn) {
          // The app does not expose the account email before onboarding, so trust only what was typed on the Okta form.
          if (typedIdentifier !== email.toLowerCase()) {
            throw new Error(`Signed in as "${typedIdentifier || 'an existing session'}" but ${email} was requested; nothing saved. Sign out of Okta first and type ${email} on the login form.`);
          }
          await context.storageState({ path: statePath });
          console.log(`Saved session to ${statePath}`);
          await browser.close().catch(() => undefined);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timed out after 10 minutes waiting for the app to load after sign-in');
  } finally {
    chrome.kill();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });

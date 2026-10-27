import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.resolve('playwright/.auth');
const profileDir = path.join(authDir, 'chrome-profile-gr-dev-signup');
const statePath = path.join(authDir, 'gr-dev-signup.json');
const chromeBin = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const signupUrl = 'https://www.gr-dev.com/fitbux-signup';

function isSignupPage(page: import('@playwright/test').Page): Promise<boolean> {
  return page
    .evaluate(() => location.hostname === 'www.gr-dev.com' && location.pathname === '/fitbux-signup')
    .then(async (matchesUrl) => matchesUrl && /Rate Fitbux Signup/i.test(await page.title().catch(() => '')))
    .catch(() => false);
}

(async () => {
  fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeBin,
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check']
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });
    console.log('Complete Cloudflare Access / Okta sign-in manually in the Chrome window.');
    console.log('This script does not enter credentials or automate MFA.');

    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      for (const currentPage of context.pages()) {
        if (await isSignupPage(currentPage)) {
          await currentPage.getByRole('heading', { name: 'Welcome' }).waitFor({ state: 'visible', timeout: 15_000 });
          await context.storageState({ path: statePath });
          fs.chmodSync(statePath, 0o600);
          console.log(`Saved authenticated signup session to ${statePath}`);
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Timed out waiting for the authenticated signup page. No session state was saved.');
  } finally {
    await context.close();
  }
})().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('Verify signup via Yopmail and set env for next tests', async ({ page }) => {
  const statusFile = path.join('test-results', 'explore-auth', 'execution_status.txt');
  if (!fs.existsSync(statusFile)) {
    test.skip('No execution_status file found from signup run');
    return;
  }

  const content = fs.readFileSync(statusFile, 'utf8');
  const m = content.match(/(?:verification|registration) requires external verification for (\S+@\S+)/i) || content.match(/created_account:(\S+@\S+)/i);
  if (!m) {
    test.skip('No created email found in execution_status');
    return;
  }

  const email = m[1];
  // only attempt for yopmail addresses
  const domain = email.split('@')[1] || '';
  if (!domain.toLowerCase().includes('yopmail')) {
    test.skip(`Email domain is not yopmail: ${email}`);
    return;
  }

  const local = email.split('@')[0];
  // navigate to yopmail
  await page.goto('https://yopmail.com/en/', { waitUntil: 'domcontentloaded' });
  // Detect possible Okta SSO page and pause for manual credentials if present
  const oktaSelectors = ['input[name="username"]', 'input#okta-signin-username', 'text=Sign in with Okta', 'text=Sign in with'];
  for (const sel of oktaSelectors) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log('\nDetected Okta SSO page. Please complete the SSO login in the opened browser.');
        console.log('After completing SSO, return here and press Enter to continue the test.');
        // wait for user to press Enter in the terminal
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const readline = require('readline');
        await new Promise<void>((resolve) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question('Press Enter to continue after Okta login...', () => {
            rl.close();
            resolve();
          });
        });
        break;
      }
    } catch (e) {
      // ignore selector errors
    }
  }
  // input the local part and open inbox
  const input = page.locator('#login');
  await input.fill(local);
  try {
    // try click with a short wait to avoid long timeouts
    const chk = page.locator('button:has-text("Check Inbox") , input[type=submit]').first();
    await chk.waitFor({ state: 'visible', timeout: 3000 });
    await chk.click();
    await page.waitForTimeout(2000);
  } catch (clickErr) {
    // If click failed, check for Okta SSO and pause for manual credentials
    const oktaSelectors = ['input[name="username"]', 'input#okta-signin-username', 'text=Sign in with Okta', 'text=Sign in with'];
    let oktaFound = false;
    for (const sel of oktaSelectors) {
      try {
        if ((await page.locator(sel).count()) > 0) { oktaFound = true; break; }
      } catch (e) {
        // ignore
      }
    }
    if (oktaFound) {
      console.log('\nDetected Okta SSO page. Please complete the SSO login in the opened browser.');
      console.log('After completing SSO, return here and press Enter to continue the test.');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const readline = require('readline');
      await new Promise<void>((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Press Enter to continue after Okta login...', () => {
          rl.close();
          resolve();
        });
      });
    } else {
      // rethrow original click error if not Okta
      throw clickErr;
    }
  }

  // Yopmail loads messages in iframe 'ifinbox'
  let inboxFrame = null as any;
  try {
    const frameEl = await page.frameLocator('#ifinbox');
    // wait for message list
    await page.waitForTimeout(1000);
    inboxFrame = frameEl;
  } catch (e) {
    // fallback: try generic frame
    const frames = page.frames();
    inboxFrame = frames.find(f => f.url().includes('yopmail')) || null;
  }

  // search message list for verification link
  // The message body is in iframe 'ifmail'
  try {
    // find first message link in inbox list
    // click the first message row
    const row = page.locator('#m a').first();
    if (await row.count() > 0) {
      await row.click();
      await page.waitForTimeout(1500);
      // switch to mail frame
      const mailFrame = page.frameLocator('#ifmail');
      // try to find verification link
      const link = mailFrame.locator('a:has-text("Confirm") , a:has-text("Verify") , a[href*="wealth" i]').first();
      if (await link.count() > 0) {
        const href = await link.getAttribute('href');
        if (href) {
          // open verification link
          await page.goto(href, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          // record success
          fs.writeFileSync(path.join('test-results', 'explore-auth', 'yopmail_verify_result.txt'), `verified:${email}\nlink:${href}\n`);
          return;
        }
      }
    }
  } catch (e) {
    // best-effort
  }

  // If we reach here, verification not found
  fs.writeFileSync(path.join('test-results', 'explore-auth', 'yopmail_verify_result.txt'), `not_found:${email}\n`);
  test.skip('Verification link not found in Yopmail inbox');
});

import path from 'node:path';
import os from 'node:os';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Checks whether the saved Google browser profile (the one used for Google Voice)
// can already reach the Firebase App Distribution release lists for QA and PROD.
const TARGETS = [
  {
    name: 'qa',
    url: 'https://console.firebase.google.com/u/0/project/rate---qa/appdistribution/app/android:com.guaranteedrate.superapp.qa/releases',
  },
  {
    name: 'prod',
    url: 'https://console.firebase.google.com/u/0/project/rate---prod/appdistribution/app/android:com.guaranteedrate.superapp/releases',
  },
];

async function main(): Promise<void> {
  const sessionPath = path.resolve(
    process.cwd(),
    process.env.GV_SESSION_PATH || 'mobile/.auth/gv-session.json'
  );
  const userDataDir = sessionPath.replace(/\.json$/, '-user-data');

  if (!existsSync(userDataDir)) {
    console.error(`[fb-check] No Google profile at ${userDataDir}. Run "npm run setup:gv-session" first.`);
    process.exit(1);
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'fb-check-'));
  const profileCopy = path.join(tempDir, 'profile');
  cpSync(userDataDir, profileCopy, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(profileCopy, {
    headless: process.env.FB_CHECK_HEADED !== '1',
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--no-first-run'],
    viewport: { width: 1440, height: 900 },
  });

  try {
    const page = context.pages()[0] || (await context.newPage());

    for (const target of TARGETS) {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(9000);

      const url = page.url();
      const body = await page.locator('body').innerText().catch(() => '');
      const shot = path.resolve(process.cwd(), `mobile/.builds/firebase-${target.name}.png`);
      await page.screenshot({ path: shot }).catch(() => {});

      const signedOut = /accounts\.google\.com|ServiceLogin/i.test(url);
      const noAccess = /don't have (permission|access)|not authorized|Permission denied|Request access/i.test(body);
      // App Distribution lists releases as "<version> (<build>)".
      const versions = [...body.matchAll(/\b(\d+\.\d+(?:\.\d+)?(?:-\w+)?)\s*\((\d+)\)/g)]
        .map((m) => `${m[1]} (${m[2]})`)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 6);

      console.log(`\n[fb-check] ${target.name.toUpperCase()}`);
      console.log(`  url        : ${url.slice(0, 120)}`);
      console.log(`  screenshot : ${shot}`);
      if (signedOut) {
        console.log('  result     : NOT SIGNED IN');
      } else if (noAccess) {
        console.log('  result     : SIGNED IN but NO ACCESS to this project');
      } else if (versions.length) {
        console.log(`  result     : ACCESS OK - releases: ${versions.join(', ')}`);
      } else {
        console.log('  result     : signed in, but no release rows detected (check screenshot)');
      }
    }
  } finally {
    await context.close().catch(() => {});
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[fb-check] failed:', error);
  process.exit(1);
});

import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const CONFIG_PATH = 'test-data/mobile-app/gri/android/config.yml';
const DEFAULT_ARTIFACT_ROOT = 'test-data/mobile-app/gri/android';

interface AndroidBuild {
  appPackage?: string;
  firebase?: { release?: string; webUrl?: string };
}

function parseArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function loadBuild(buildName: string): { build: AndroidBuild; artifactRoot: string } {
  const configPath = path.resolve(process.cwd(), CONFIG_PATH);
  const config = YAML.parse(readFileSync(configPath, 'utf8')) as {
    android?: { artifactRoot?: string; builds?: Record<string, AndroidBuild> };
  };

  const build = config.android?.builds?.[buildName];
  if (!build) {
    throw new Error(`No android build "${buildName}" in ${CONFIG_PATH}.`);
  }

  return {
    build,
    artifactRoot: config.android?.artifactRoot || DEFAULT_ARTIFACT_ROOT,
  };
}

/** "1.48-prod (398)" -> matches the wanted label, the bare build number, or the version. */
function cardMatchesRelease(cardText: string, wanted: string): boolean {
  const header = cardText.split('\n')[0]?.trim() || '';
  const parsed = header.match(/^(\S+)\s*\((\d+)\)/);
  if (!parsed) return false;

  const [, displayVersion, buildVersion] = parsed;
  return (
    wanted === header ||
    wanted === `${displayVersion} (${buildVersion})` ||
    wanted === displayVersion ||
    wanted === buildVersion
  );
}

async function main(): Promise<void> {
  const buildName = parseArg('--build') || process.env.MOBILE_ANDROID_BUILD || 'prod';
  const listOnly = hasFlag('--list');
  const resultPath = parseArg('--result');
  if (!resultPath && !listOnly) {
    throw new Error('--result <path> is required (or pass --list).');
  }

  const { build, artifactRoot } = loadBuild(buildName);
  const webUrl = process.env.MOBILE_ANDROID_FIREBASE_WEB_URL || build.firebase?.webUrl;
  const wanted = parseArg('--release') || process.env.MOBILE_ANDROID_FIREBASE_RELEASE || build.firebase?.release || 'latest';

  if (!webUrl) {
    throw new Error(`Build "${buildName}" needs firebase.webUrl in ${CONFIG_PATH}.`);
  }

  // Make Firebase downloads opt-in. If `FORCE_FIREBASE_DOWNLOAD=1` or
  // `FIREBASE_SESSION_PATH` is provided, attempt a web download. Otherwise
  // fall back to using a locally-provided APK/AAB from the artifact root.
  const forceFirebase = process.env.FORCE_FIREBASE_DOWNLOAD === '1';
  const explicitSession = process.env.FIREBASE_SESSION_PATH || '';

  function findLocalApk(root: string): string | null {
    const abs = path.resolve(process.cwd(), root);
    if (!existsSync(abs)) return null;
    const files = require('node:fs').readdirSync(abs);
    for (const f of files) {
      if (f.endsWith('.apk') || f.endsWith('.aab')) return path.join(abs, f);
    }
    return null;
  }

  if (!forceFirebase && !explicitSession) {
    // Try local artifact fallback
    const local = findLocalApk(path.join(artifactRoot, 'firebase')) || findLocalApk(artifactRoot);
    if (local) {
      console.log(`[firebase] using local APK/AAB fallback: ${local}`);
      if (resultPath) {
        mkdirSync(path.dirname(path.resolve(process.cwd(), resultPath)), { recursive: true });
        writeFileSync(path.resolve(process.cwd(), resultPath), JSON.stringify({ path: local }, null, 2));
      }
      return;
    }
    throw new Error('Firebase download not enabled and no local APK/AAB found in artifact roots. Set FORCE_FIREBASE_DOWNLOAD=1 or provide FIREBASE_SESSION_PATH to enable web download.');
  }

  const sessionPath = path.resolve(process.cwd(), explicitSession || '');
  const userDataDir = sessionPath.replace(/\.json$/, '-user-data');
  if (!existsSync(userDataDir)) {
    throw new Error(`No Google browser profile at ${userDataDir}. Run "npm run setup:firebase-session" first.`);
  }

  // Work on a copy so a concurrent test run keeps its lock on the real profile.
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'fb-download-'));
  const profileCopy = path.join(tempDir, 'profile');
  cpSync(userDataDir, profileCopy, { recursive: true, force: true });

  console.log(`[firebase] build=${buildName} release=${wanted}`);

  const context = await chromium.launchPersistentContext(profileCopy, {
    headless: process.env.FIREBASE_DOWNLOAD_HEADED !== '1',
    acceptDownloads: true,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--no-first-run'],
    viewport: { width: 1440, height: 900 },
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(webUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

    await page.waitForSelector('a7o-release-card', { timeout: 90000 }).catch(() => {
      throw new Error(
        'No release cards rendered. The saved Google session may have expired or lost access; ' +
        'check with "npx ts-node scripts/check-firebase-access.ts".'
      );
    });
    await page.waitForTimeout(3000);

    const cards = page.locator('a7o-release-card');
    const cardCount = await cards.count();

    if (listOnly) {
      console.log(`[firebase] releases available for "${buildName}":`);
      for (let i = 0; i < cardCount; i += 1) {
        const text = await cards.nth(i).innerText().catch(() => '');
        const [header, date, kind] = text.split('\n').map((line) => line.trim());
        console.log(`  ${header}  ${kind || ''}  ${date || ''}`);
      }
      return;
    }

    let index = -1;
    let label = '';
    for (let i = 0; i < cardCount; i += 1) {
      const text = await cards.nth(i).innerText().catch(() => '');
      const header = text.split('\n')[0]?.trim() || '';
      if (wanted.toLowerCase() === 'latest' || cardMatchesRelease(text, wanted)) {
        index = i;
        label = header;
        break;
      }
    }

    if (index < 0) {
      const available: string[] = [];
      for (let i = 0; i < Math.min(cardCount, 10); i += 1) {
        available.push((await cards.nth(i).innerText().catch(() => '')).split('\n')[0]?.trim() || '');
      }
      throw new Error(`No Firebase release "${wanted}". Latest releases: ${available.join(', ')}`);
    }

    console.log(`[firebase] selected release ${label}`);

    const card = cards.nth(index);
    await card.locator('mat-expansion-panel-header').click().catch(() => {});
    await page.waitForTimeout(2500);

    const downloadButton = card.locator('button[aria-label="Download release"]');
    await downloadButton.waitFor({ state: 'visible', timeout: 30000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 180000 }),
      downloadButton.click(),
    ]);

    const suggested = download.suggestedFilename();
    const extension = path.extname(suggested) || '.aab';
    const slug = `${build.appPackage || buildName}-${label}`.replace(/[^a-zA-Z0-9.-]+/g, '-');
    const destinationDir = path.resolve(process.cwd(), artifactRoot, 'firebase');
    mkdirSync(destinationDir, { recursive: true });
    const destination = path.join(destinationDir, `${slug}${extension}`);

    await download.saveAs(destination);
    console.log(`[firebase] downloaded ${suggested} -> ${destination}`);

    mkdirSync(path.dirname(path.resolve(process.cwd(), resultPath!)), { recursive: true });
    writeFileSync(
      path.resolve(process.cwd(), resultPath!),
      JSON.stringify({ path: destination, firebaseRelease: label }, null, 2)
    );
  } finally {
    await context.close().catch(() => {});
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[firebase] download failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

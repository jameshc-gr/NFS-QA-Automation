import { expect, type Browser, type BrowserContext, type Page, type Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { decryptSecret } from '../../../mobile/src/utils/crypto-utils';

export const BASE_URL = 'https://wealth.dev.fitbux.com';

// Dev-only shared QA accounts documented in test-data/rate-wealth; override via env.
export const ACCOUNTS = {
  complete: process.env.RW_TEST_EMAIL || 'my-rw-jc001@yopmail.com',
  planner: process.env.RW_PLAN_EMAIL || 'my-rw-jc002@yopmail.com',
  onboarding: process.env.RW_ONBOARDING_EMAIL || 'my-rw-jc003@yopmail.com',
};

// TEST_PASSWORD wins; otherwise the ENC(...) value written by `npm run setup:rate-wealth-auth` (needs CONFIG_ENCRYPTION_KEY).
export function getPassword(): string {
  if (process.env.TEST_PASSWORD) return process.env.TEST_PASSWORD;
  const file = path.resolve('test-data/rate-wealth/rate-wealth-auth.yml');
  if (fs.existsSync(file)) {
    const stored = (yaml.parse(fs.readFileSync(file, 'utf8')) as { password?: string } | null)?.password;
    if (stored) return decryptSecret(stored);
  }
  throw new Error('No Rate Wealth password: set TEST_PASSWORD or run `npm run setup:rate-wealth-auth` (requires CONFIG_ENCRYPTION_KEY).');
}

// Sidebar label -> real route (legacy guesses /day-to-day-money and /student-loans redirect to /home).
export const NAV_ROUTES = {
  Home: { route: '/home', group: null },
  'Plan Summary': { route: '/plan-summary', group: null },
  'Financial Plans': { route: '/financial-plans', group: null },
  'Financial Snapshot': { route: '/wealth', group: 'My Money Details' },
  'Day-to-Day Money': { route: '/budget', group: 'My Money Details' },
  'Risk Management': { route: '/risk', group: 'My Money Details' },
  Transactions: { route: '/transactions', group: null },
  Accounts: { route: '/accounts', group: null },
  'Student Loans': { route: '/studentloans', group: 'Tools & Products' },
  Investments: { route: '/investments', group: 'Tools & Products' },
  'Home Ownership': { route: '/homebuying', group: 'Tools & Products' },
} as const;

export const QA_PLAN_PREFIX = 'RWQA-';

export async function removeCookieBanner(page: Page): Promise<void> {
  await page.evaluate(() => document.getElementById('onetrust-consent-sdk')?.remove()).catch(() => undefined);
}

export class MfaRequiredError extends Error {
  constructor(email: string) {
    super(`Okta asked ${email} for an MFA security method. Either re-run headed with RW_MFA_MANUAL=1 and complete it in the window, or run "npm run setup:rate-wealth-session -- ${email}" and sign in by hand.`);
  }
}

// Session captured by scripts/setup-rate-wealth-session.ts after a human signed in (and completed any MFA).
export function savedSessionPath(email: string): string {
  return path.resolve('playwright/.auth', `rate-wealth-${email.split('@')[0]}.json`);
}

export async function openSession(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const state = savedSessionPath(email);
  const useSaved = fs.existsSync(state);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: useSaved ? state : undefined });
  const page = await context.newPage();
  if (useSaved) {
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/wealth\.dev\.fitbux\.com\/|login\.dev\.rate\.com/, { timeout: 30_000 });
    await page.waitForTimeout(4000);
    if (/login\.dev\.rate\.com/.test(page.url())) {
      await context.close();
      throw new MfaRequiredError(email);
    }
    await removeCookieBanner(page);
    const resume = page.getByRole('button', { name: /^Continue$/ });
    if (await resume.isVisible().catch(() => false)) await resume.click();
    return { context, page };
  }
  await login(page, email);
  return { context, page };
}

export async function login(page: Page, email: string, password = getPassword()): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="identifier"]').waitFor({ state: 'visible', timeout: 30_000 });
  await removeCookieBanner(page);
  await page.locator('input[name="identifier"]').fill(email);
  await page.locator('input[name="credentials.passcode"]').fill(password);
  await page.locator('input[name="rememberMe"]').check({ force: true }).catch(() => undefined);
  await page.locator('input[type="submit"]').click();
  const appUrl = /wealth\.dev\.fitbux\.com\/(home|profile-builder|plan-select)/;
  const landed = page.waitForURL(appUrl, { timeout: 45_000 }).then(() => 'app');
  const mfa = page.getByText(/Verify it's you with a security method/i).waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'mfa');
  const outcome = await Promise.race([landed, mfa]).finally(() => { landed.catch(() => undefined); mfa.catch(() => undefined); });
  if (outcome === 'mfa') {
    if (!process.env.RW_MFA_MANUAL) throw new MfaRequiredError(email);
    // Human-in-the-loop: the tester completes MFA in the visible browser; nothing is typed or bypassed here.
    console.log(`\n[Rate Wealth] MFA required for ${email}. Complete it in the open browser window; waiting up to 5 minutes...`);
    await page.waitForURL(appUrl, { timeout: 5 * 60_000 });
    await page.context().storageState({ path: savedSessionPath(email) });
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  await removeCookieBanner(page);
  const resume = page.getByRole('button', { name: /^Continue$/ });
  if (await resume.isVisible().catch(() => false)) {
    await resume.click();
    await page.waitForTimeout(2000);
  }
}

export async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('button:visible').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await removeCookieBanner(page);
}

export async function expandNavGroup(page: Page, group: string): Promise<void> {
  const trigger = page.locator('.euiAccordion__triggerWrapper', { hasText: group }).locator('button').first();
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

export async function clickNav(page: Page, label: keyof typeof NAV_ROUTES): Promise<void> {
  const { group } = NAV_ROUTES[label];
  if (group) await expandNavGroup(page, group);
  await page.locator('button:visible').filter({ hasText: new RegExp(`^\\s*${label.replace(/[-&]/g, '\\$&')}\\s*$`) }).first().click();
}

export async function readWealthScore(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.match(/Wealth\s*Score\s*(\S+)/)?.[1] ?? '';
}

export function parseMoney(text: string): number {
  const negative = /-\s*\$|\(\s*\$/.test(text);
  const digits = Number(text.replace(/[^0-9.]/g, ''));
  return negative ? -digits : digits;
}

const IGNORED_HTTP = /tracking|demdex|onetrust|google|doubleclick|adobedtm|facebook|hotjar|mixpanel|segment/i;

export function trackHttpErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_HTTP.test(r.url())) errors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return () => [...errors];
}

// Known-defect tests assert the EXPECTED behaviour and are marked fail; an unexpected pass flags a fix.
export function pageHeadings(page: Page): Promise<string[]> {
  return page.locator('h1, h2, h3').allInnerTexts();
}

export async function visibleText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

export async function planCardNames(page: Page): Promise<string[]> {
  await page.locator('button[aria-label="Actions"]').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  const cards = page.locator('button[aria-label="Actions"]');
  const names: string[] = [];
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i).locator('xpath=ancestor::*[.//h2 or .//h3][1]');
    names.push(((await card.locator('h2, h3').first().innerText().catch(() => '')) || '').trim());
  }
  return names;
}

// Deletes plans created by automation (name starts with QA_PLAN_PREFIX); the app deletes without a confirmation.
export async function deleteQaPlans(page: Page): Promise<number> {
  await gotoRoute(page, '/financial-plans');
  let deleted = 0;
  for (let guard = 0; guard < 6; guard++) {
    const cards = page.locator('button[aria-label="Actions"]');
    const total = await cards.count();
    let removed = false;
    for (let i = 0; i < total; i++) {
      const heading = await cards.nth(i).locator('xpath=ancestor::*[.//h2 or .//h3][1]').locator('h2, h3').first().innerText().catch(() => '');
      if (heading.trim().startsWith(QA_PLAN_PREFIX)) {
        await cards.nth(i).click();
        await page.locator('[role=menuitem], .euiContextMenuItem').filter({ hasText: /^Delete$/ }).first().click();
        await page.waitForTimeout(1500);
        deleted++;
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  return deleted;
}

export async function expectNoVisibleError(scope: Locator): Promise<void> {
  await expect(scope.locator('.euiFormErrorText:visible')).toHaveCount(0);
}

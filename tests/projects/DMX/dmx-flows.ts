import { test, expect, Page, BrowserContext } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { register, runApplication, newEmail, routeOf, ENTRY_URL, PASSWORD } from './dmx-engine';
import { loadScenarios, loadTestCase, recordAccount } from './dmx-data';
import { assertDashboard, assertAccountsCard, assertLoanOfficer } from './dmx-dashboard';

test.afterEach(async ({ page, context }, testInfo) => {
  const dashboardRun = Boolean(process.env.RUN_ID);
  if (testInfo.status === 'passed' || (!dashboardRun && testInfo.status === testInfo.expectedStatus)) return;

  const runId = process.env.RUN_ID;
  let openPages: Page[] = [];
  try { openPages = context.pages().filter(candidate => !candidate.isClosed()); } catch { /* Context may already be closed after a runner failure. */ }
  const diagnosticPage = openPages[openPages.length - 1] || page;
  const outputDir = process.env.DMX_DASHBOARD_OUTPUT_DIR;
  const screenshotPath = testInfo.outputPath('dmx-failure.png');
  let screenshot = '';
  try {
    mkdirSync(join(screenshotPath, '..'), { recursive: true });
    await diagnosticPage.screenshot({ path: screenshotPath, fullPage: true, timeout: 15000 });
    screenshot = screenshotPath.replace(`${process.cwd()}/`, '');
  } catch (error) {
    await testInfo.attach('dmx-failure-screenshot-error', { body: (error as Error).message, contentType: 'text/plain' });
  }

  let pageUrl = '';
  try { pageUrl = diagnosticPage.url(); } catch { /* The browser page may already have closed. */ }
  const diagnostic = {
    testId: testInfo.title.match(/^[A-Z]+-\d+(?:-[^:]*)?/)?.[0] || testInfo.title,
    title: testInfo.title,
    page: pageUrl,
    route: (() => { try { return routeOf(diagnosticPage); } catch { return pageUrl; } })(),
    screenshot,
    error: testInfo.errors[0]?.message?.split('\n')[0]
      || testInfo.annotations.find(annotation => annotation.type === 'skip')?.description
      || `Expected ${testInfo.expectedStatus}, received ${testInfo.status}`,
  };
  if (runId && outputDir) {
    const diagnosticFile = join(process.cwd(), outputDir, 'dmx-dashboard-diagnostic.json');
    mkdirSync(join(diagnosticFile, '..'), { recursive: true });
    writeFileSync(diagnosticFile, JSON.stringify(diagnostic, null, 2), { mode: 0o600 });
  }
  if (runId) console.log(`DMX_DASHBOARD_DIAGNOSTIC:${JSON.stringify(diagnostic)}`);
  await testInfo.attach('dmx-failure-diagnostic', { body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json' });
});

const DMX_ORIGIN = 'https://apply-gri.dev.saas.rate.com';

function scenarioFor(ref: string) {
  const s = loadScenarios().find(x => x.id === ref);
  if (!s) throw new Error(`dmx-scenarios.yml has no scenario "${ref}"`);
  return s;
}

function dashboardRun(id: string) {
  const file = process.env.DMX_DASHBOARD_RUN_CONFIG;
  if (!file) return undefined;
  const run = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  return run.testId === id ? run : undefined;
}

function runScenario(id: string, ref: string) {
  return dashboardRun(id)?.scenario ?? scenarioFor(ref);
}

const tagOf = (id: string) => id.split('-').slice(0, 2).join('').toLowerCase();

// Complete application: register, fill every page, land on the MyAccount loan overview and the Accounts card.
export async function runCompleteLoan(id: string, page: Page, context: BrowserContext) {
  const tc = loadTestCase(id);
  const run = dashboardRun(id);
  const s = runScenario(id, tc.scenario_ref);
  test.setTimeout(8 * 60_000);
  const email = run?.email || newEmail(tagOf(id));
  const password = run?.password || PASSWORD;
  const log = (m: string) => console.log(`[${id}] ${m}`);
  let stage = 'register';
  try {
    await register(page, s, email, password);
    recordAccount({ email, password, scenarioId: id, product: s.product, status: 'registered' });
    await assertLoanOfficer(page);

    stage = 'application';
    await runApplication(page, s, { log });

    stage = 'dashboard';
    const info = await assertDashboard(page, s);
    recordAccount({ email, password, scenarioId: id, product: s.product, status: 'complete', loanGuid: info.loanGuid, loanNumber: info.loanNumber, dashboardUrl: info.url });

    stage = 'accounts';
    await assertAccountsCard(context, info);
    log(`complete: loan #${info.loanNumber}`);
  } catch (e) {
    recordAccount({ email, password, scenarioId: id, product: s.product, status: 'failed', stoppedAt: stage, dashboardUrl: page.url(), note: (e as Error).message.split('\n')[0] });
    throw e;
  }
}

async function abandon(page: Page) {
  const url = page.url();
  return { resumeUrl: url, guid: new URL(url).searchParams.get('gr-loan-guid')! };
}

// Incomplete loan: abandon at stop_at_route, come back in the same session and finish the SAME loan.
export async function runResumeLoan(id: string, page: Page, context: BrowserContext) {
  const tc = loadTestCase(id);
  const run = dashboardRun(id);
  const s = { ...runScenario(id, tc.scenario_ref), id };
  const stopAt = tc.stop_at_route;
  test.setTimeout(8 * 60_000);
  const email = run?.email || newEmail(tagOf(id));
  const password = run?.password || PASSWORD;
  const log = (m: string) => console.log(`[${id}] ${m}`);

  await register(page, s, email, password);
  await runApplication(page, s, { stopAt, log });
  expect(routeOf(page), 'stopped on the requested step').toBe(stopAt);
  const { resumeUrl, guid } = await abandon(page);
  expect(guid).toBeTruthy();
  recordAccount({ email, password, scenarioId: id, product: s.product, status: 'incomplete', stoppedAt: stopAt, loanGuid: guid, note: tc.title });
  log(`abandoned at ${stopAt} (${guid})`);

  // The DMX session cookie survives closing the tab; the loan is saved server-side.
  await page.close();
  const back = await context.newPage();
  await back.goto(resumeUrl, { waitUntil: 'domcontentloaded' });
  await expect(back, 'resumes on the saved step, same loan').toHaveURL(new RegExp(`/apply/${stopAt}\\?.*gr-loan-guid=${guid}`), { timeout: 45_000 });
  await assertLoanOfficer(back);

  await runApplication(back, s, { log });
  const info = await assertDashboard(back, s);
  expect(info.loanGuid.length).toBeGreaterThan(10);
  recordAccount({ email, password, scenarioId: id, product: s.product, status: 'resumed-complete', stoppedAt: stopAt, loanGuid: guid, loanNumber: info.loanNumber, dashboardUrl: info.url });
  await assertAccountsCard(context, info);
}

// Real log out / log in through the DMX login. A direct MyAccount login for a new account hits a phone-MFA enrollment
// screen; automating OTP delivery needs owner approval, so the test skips unless DMX_MFA_MANUAL=1 (headed, manual code).
export async function runRelogin(id: string, page: Page, context: BrowserContext) {
  const tc = loadTestCase(id);
  const run = dashboardRun(id);
  const s = { ...runScenario(id, tc.scenario_ref), id };
  const stopAt = tc.stop_at_route;
  test.setTimeout(12 * 60_000);
  const email = run?.email || newEmail(`${tagOf(id)}re`);
  const password = run?.password || PASSWORD;
  const log = (m: string) => console.log(`[${id}] ${m}`);

  await register(page, s, email, password);
  await runApplication(page, s, { stopAt, log });
  const { resumeUrl, guid } = await abandon(page);
  recordAccount({ email, password, scenarioId: id, product: s.product, status: 'incomplete', stoppedAt: stopAt, loanGuid: guid, note: 'logged out; awaiting login' });

  await page.goto(`${DMX_ORIGIN}/api/logout`, { waitUntil: 'domcontentloaded' });
  await page.goto(resumeUrl, { waitUntil: 'domcontentloaded' });
  await expect(page, 'protected loan URL requires login again').toHaveURL(/login\.dev\.rate\.com/, { timeout: 45_000 });

  await page.locator('input[name="identifier"]').fill(email);
  await page.locator('input[name="credentials.passcode"]').fill(password);
  await page.locator('input[type="submit"]').click();

  const mfa = page.getByRole('heading', { name: /Set up security methods/i });
  const outcome = await Promise.race([
    page.waitForURL(u => u.hostname === 'apply-gri.dev.saas.rate.com', { timeout: 45_000 }).then(() => 'landed' as const),
    mfa.waitFor({ timeout: 45_000 }).then(() => 'mfa' as const),
  ]).catch(() => 'unknown' as const);
  if (outcome === 'mfa') {
    test.skip(!process.env.DMX_MFA_MANUAL, 'Blocked by first-login MFA enrollment (phone SMS code). Re-run headed with DMX_MFA_MANUAL=1 and complete MFA by hand.');
    log('MFA enrollment required - waiting up to 5 minutes for manual completion');
    await page.waitForURL(u => ['apply-gri.dev.saas.rate.com', 'my.gr-dev.com'].includes(u.hostname), { timeout: 5 * 60_000 });
  } else if (outcome === 'unknown') {
    throw new Error(`Login did not reach DMX or MFA enrollment; at ${page.url()}`);
  }

  await page.goto(resumeUrl, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`gr-loan-guid=${guid}`));
  await runApplication(page, s, { log });
  const info = await assertDashboard(page, s);
  recordAccount({ email, password, scenarioId: id, product: s.product, status: 'resumed-complete', stoppedAt: stopAt, loanGuid: guid, loanNumber: info.loanNumber, dashboardUrl: info.url });
  await assertAccountsCard(context, info);
}

export async function runEntry(page: Page) {
  await page.goto(ENTRY_URL, { waitUntil: 'domcontentloaded' });
  await assertLoanOfficer(page);
}

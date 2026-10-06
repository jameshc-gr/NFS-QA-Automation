import { expect, BrowserContext, Page } from '@playwright/test';
import { isDashboard, Scenario, STATE_ABBR } from './dmx-engine';

export const MYACCOUNT_LOANS_URL = 'https://my.gr-dev.com/loans';

export interface DashboardInfo { loanGuid: string; loanNumber: string; url: string }

/** Dismiss in-house insurance agency modal if present on MyAccount loan overview. */
export async function dismissInsuranceModal(page: Page) {
  const insuranceModal = page.locator('dialog, [role="dialog"]').filter({ hasText: /insurance/i });
  if (await insuranceModal.isVisible({ timeout: 4000 }).catch(() => false)) {
    const cancelBtn = insuranceModal.locator('button').filter({ hasText: /^\s*(Cancel|Close)\s*$/i }).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click().catch(() => {});
      await insuranceModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }
}

/** Loan officer attribution for emp-id=4723 must survive the whole journey. */
export async function assertLoanOfficer(page: Page, expectedName = 'John Sample') {
  const text = await page.locator('body').innerText();
  expect(text, 'assigned loan officer name').toContain(expectedName);
  if (expectedName === 'John Sample') expect(text, 'assigned loan officer NMLS').toMatch(/NMLS( ID:)? 12345/);
}

/** Final milestone: MyAccount loan overview showing the newly created loan. */
export async function assertDashboard(page: Page, s: Scenario, expectedLoanOfficer = 'John Sample'): Promise<DashboardInfo> {
  await expect.poll(() => isDashboard(page), { message: 'DMX should hand off to the MyAccount loan overview', timeout: 60_000 }).toBe(true);
  await expect(page.getByText(/#\d{6,}\w*/).first(), 'loan number is displayed').toBeVisible({ timeout: 60_000 });
  await dismissInsuranceModal(page);

  const url = page.url();
  const loanGuid = /\/loan\/([^/]+)\/overview/.exec(url)![1];
  const body = await page.locator('body').innerText();
  const loanNumber = /#(\d{6,}\w*)/.exec(body)![1];

  expect(url).toMatch(/^https:\/\/my\.gr-dev\.com\/loan\/[0-9a-f-]{36}\/overview/);
  for (const tab of ['Overview', 'Tasks', 'Loan details', 'Documents']) expect(body, `tab ${tab}`).toContain(tab);
  expect(body, 'welcome banner uses the borrower first name').toContain(`Welcome, ${s.borrower.firstName}`);
  if (s.product === 'purchase') expect(body, 'product label').toMatch(/Purchase\s*#/);
  if (s.product === 'refinance') expect(body, 'product label').toMatch(/Refinance\s*#/);
  if (s.property.address || s.property.city) {
    const stateAbbr = STATE_ABBR[s.property.state] || s.property.state;
    const matchesProperty = (s.property.address && body.includes(s.property.address))
      || (s.property.city && (body.includes(`${s.property.city}, ${stateAbbr}`) || body.includes(s.property.city)));
    expect(matchesProperty, `subject property should display address "${s.property.address}" or city/state "${s.property.city}, ${stateAbbr}"`).toBe(true);
  }
  await assertLoanOfficer(page, expectedLoanOfficer);
  return { loanGuid, loanNumber, url };
}

/** Accounts page must list the loan as a card that links to the same loan overview. */
export async function assertAccountsCard(context: BrowserContext, info: DashboardInfo) {
  const page = await context.newPage();
  try {
    await page.goto(MYACCOUNT_LOANS_URL, { waitUntil: 'domcontentloaded' });
    const card = page.locator(`a[href*="/loan/${info.loanGuid}/overview"]`).first();
    await expect(card, 'loan card in Accounts').toBeVisible({ timeout: 60_000 });
    await expect(page.locator('body')).toContainText(info.loanNumber);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/loan/${info.loanGuid}/overview`), { timeout: 30_000 });
    await dismissInsuranceModal(page);
    await expect(page.locator('body')).toContainText(info.loanNumber);
  } finally {
    await page.close();
  }
}

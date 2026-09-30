import { expect, BrowserContext, Page } from '@playwright/test';
import { isDashboard, Scenario } from './dmx-engine';

export const MYACCOUNT_LOANS_URL = 'https://my.gr-dev.com/loans';

export interface DashboardInfo { loanGuid: string; loanNumber: string; url: string }

/** Loan officer attribution for emp-id=4723 must survive the whole journey. */
export async function assertLoanOfficer(page: Page, expectedName = 'John Sample') {
  const text = await page.locator('body').innerText();
  expect(text, 'assigned loan officer name').toContain(expectedName);
  if (expectedName === 'John Sample') expect(text, 'assigned loan officer NMLS').toMatch(/NMLS( ID:)? 12345/);
}

/** Final milestone: MyAccount loan overview showing the newly created loan. */
export async function assertDashboard(page: Page, s: Scenario): Promise<DashboardInfo> {
  await expect.poll(() => isDashboard(page), { message: 'DMX should hand off to the MyAccount loan overview', timeout: 60_000 }).toBe(true);
  await expect(page.getByText(/#\d{6,}\w*/).first(), 'loan number is displayed').toBeVisible({ timeout: 60_000 });

  const url = page.url();
  const loanGuid = /\/loan\/([^/]+)\/overview/.exec(url)![1];
  const body = await page.locator('body').innerText();
  const loanNumber = /#(\d{6,}\w*)/.exec(body)![1];

  expect(url).toMatch(/^https:\/\/my\.gr-dev\.com\/loan\/[0-9a-f-]{36}\/overview/);
  for (const tab of ['Overview', 'Tasks', 'Loan details', 'Documents']) expect(body, `tab ${tab}`).toContain(tab);
  expect(body, 'welcome banner uses the borrower first name').toContain(`Welcome, ${s.borrower.firstName}`);
  if (s.product === 'purchase') expect(body, 'product label').toMatch(/Purchase\s*#/);
  if (s.product === 'refinance') expect(body, 'product label').toMatch(/Refinance\s*#/);
  if (s.property.address) expect(body, 'subject property').toContain(s.property.address);
  await assertLoanOfficer(page);
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
    await expect(page.locator('body')).toContainText(info.loanNumber);
  } finally {
    await page.close();
  }
}

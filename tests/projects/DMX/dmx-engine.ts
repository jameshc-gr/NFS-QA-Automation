import { Locator, Page } from '@playwright/test';

export type Product = 'purchase' | 'preapproval' | 'refinance';

export interface Person {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  ssn: string;
  dob: string; // mm/dd/yyyy
  maritalStatus: 'Married' | 'Unmarried' | 'Separated';
}

export interface Employment {
  employer: string;
  title: string;
  city: string;
  state: string;
  phone: string;
  start: string; // mm/dd/yyyy
  annualSalary: number;
}

export interface Scenario {
  id: string;
  title: string;
  product: Product;
  tags: string[];
  borrower: Person;
  coBorrower?: Person & { employment?: Employment; sameAddress?: boolean };
  residence: { address: string; city: string; state: string; zip: string; moveIn: string; status: 'Rent' | 'Own'; monthlyRent?: number };
  employment: Employment;
  assets: { type: string; institution: string; balance: number }[];
  property: { address: string; city: string; state: string; zip: string; propertyType: string; usage: string };
  loan: { price?: number; down?: number; closeInDays?: number; refiGoal?: string; timeline?: string; currentValue?: number; balance?: number; moveIn?: string; annualTaxes?: number; annualInsurance?: number; monthlyPayment?: number; interestRate?: number; origPrice?: number; yearPurchased?: number; newLoan?: number; targetPayment?: number; maxPayment?: number };
  loanOptions?: { option2: string; option3: string };
  expect: { dti?: number; credit?: string };
}

export const STATE_ABBR: Record<string, string> = { Illinois: 'IL', California: 'CA', Texas: 'TX', Florida: 'FL', 'New York': 'NY', Arizona: 'AZ', Colorado: 'CO', Washington: 'WA', Georgia: 'GA' };

export const routeOf = (p: Page) => new URL(p.url()).pathname.replace('/apply/', '');export const isDashboard = (p: Page) => /\/loan\/[^/]+\/overview/.test(p.url());

export async function fillMasked(page: Page, sel: string, v: string) {
  const l = page.locator(sel);
  await l.fill(v, { force: true });
  await l.dispatchEvent('input');
  await l.dispatchEvent('change');
  await l.dispatchEvent('blur');
}

async function clickAction(page: Page, locator: Locator, label: string, timeout = 12000) {
  const started = Date.now();
  const route = routeOf(page);
  try {
    await locator.click({ timeout });
  } catch (error) {
    const state = await locator.evaluate(element => ({
      text: (element.textContent || '').trim(),
      disabled: 'disabled' in element ? Boolean((element as HTMLButtonElement).disabled) : element.getAttribute('aria-disabled'),
      visible: Boolean(element.getClientRects().length),
    })).catch(() => null);
    throw new Error(`Could not click "${label}" on /apply/${route} within ${timeout}ms; element=${JSON.stringify(state)}; ${(error as Error).message}`);
  }
  const elapsed = Date.now() - started;
  if (elapsed >= 1500) console.log(`[DMX] slow click ${elapsed}ms route=${route} button=${JSON.stringify(label)}`);
}

/** Some choice pages reuse id=button-next on several buttons; prefer the one labelled Continue. */
const clickNext = async (p: Page) => {
  const all = p.locator('#button-next');
  const labelled = all.filter({ hasText: /^\s*(Continue|Confirm|I agree and continue|Next)\s*$/ });
  const target = (await labelled.count()) ? labelled.first() : all.first();
  await clickAction(p, target, (await target.innerText().catch(() => 'Next')).trim() || 'Next');
};
const dateOut = (days: number) => {
  const d = new Date(Date.now() + days * 864e5);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
const digits = (s: string) => s.replace(/\D/g, '');

/** Wait for the rendered page, not network idleness from unrelated background requests. */
export async function settle(page: Page, prev: string, timeout = 15000) {
  const started = Date.now();
  await page.locator('main').waitFor({ state: 'visible', timeout });
  await page.locator("h1:has-text('…')").waitFor({ state: 'hidden', timeout }).catch(() => {});
  await page.locator("text=/saving your loan details/i").waitFor({ state: 'hidden', timeout }).catch(() => {});
  if (routeOf(page) === prev && !isDashboard(page)) {
    await page.waitForFunction(
      p => !window.location.pathname.endsWith('/' + p),
      prev,
      { timeout: 2500 }
    ).catch(() => {});
  }
  if (routeOf(page) === prev && !isDashboard(page)) {
    const controls = page.locator('main button:visible, main input:visible, main select:visible, main textarea:visible');
    await controls.first().waitFor({ state: 'visible', timeout }).catch(() => {});
  }
  const elapsed = Date.now() - started;
  if (elapsed >= 1500) console.log(`[DMX] slow route settle ${elapsed}ms from=${prev} to=${routeOf(page)}`);
}

/** Detect common Okta/login pages by hostname or page contents. */
function looksLikeLoginUrl(u: string) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.includes('login') || h.includes('okta') || h.includes('auth') || h.includes('authorize');
  } catch (e) {
    return /login|okta|auth|authorize/i.test(u);
  }
}

/** Handle an on-the-fly login redirect. Supports manual MFA wait when DMX_MFA_MANUAL is set. */
export async function handleLoginRedirect(page: Page, email: string, password: string) {
  const url = page.url();
  if (!looksLikeLoginUrl(url)) return false;
  console.log('[DMX] detected login page:', url);
  // If the page doesn't render any input fields (widget not present), bail back to ENTRY_URL.
  const anyInputCount = await page.locator('input').count().catch(() => 0);
  if (!anyInputCount) {
    console.log('[DMX] no login form inputs detected on authorize page; navigating to ENTRY_URL as fallback');
    await page.goto(ENTRY_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    return false;
  }

  // Try a few common Okta/login field selectors
  const usernameSelectors = ['#okta-signin-username', 'input[name=username]', 'input[name=identifier]', 'input[type=email]'];
  const passwordSelectors = ['#okta-signin-password', 'input[name=password]', 'input[name=credentials.passcode]'];
  let filled = false;
  for (const us of usernameSelectors) {
    const u = page.locator(us);
    if (await u.count().catch(() => 0)) {
      try {
        await u.fill(email, { timeout: 5000 });
        filled = true;
        break;
      } catch { }
    }
  }
  for (const ps of passwordSelectors) {
    const p = page.locator(ps);
    if (await p.count().catch(() => 0)) {
      try {
        await p.fill(password, { timeout: 5000 });
        filled = true;
        break;
      } catch { }
    }
  }
  // submit
  const submit = page.locator('button[type=submit], input[type=submit], button:has-text("Sign In"), button:has-text("Sign in")').first();
  if (await submit.count().catch(() => 0)) {
    await clickAction(page, submit, 'Sign In');
  } else if (filled) {
    // fallback: press Enter
    await page.keyboard.press('Enter').catch(() => {});
  }

  // After submit, detect MFA flows. If manual MFA configured, wait long for user to finish.
  const manual = Boolean(process.env.DMX_MFA_MANUAL);
  const mfaTimeout = Number(process.env.DMX_MFA_MANUAL_TIMEOUT ?? 600000); // default 10 minutes
  try {
    // Wait until URL no longer looks like a login page or we reach dashboard
    await page.waitForFunction((looksFn) => !looksFn(location.href) || /\/loan\/[^/]+\/overview/.test(location.pathname), [looksLikeLoginUrl], { timeout: manual ? mfaTimeout : 30000 });
  } catch (e) {
    // If manual MFA requested, allow long wait by polling for change
    if (manual) {
      console.log('[DMX] waiting for manual MFA completion (operator intervention expected)');
      await page.waitForFunction((looksFn) => !looksFn(location.href) || /\/loan\/[^/]+\/overview/.test(location.pathname), [looksLikeLoginUrl], { timeout: mfaTimeout }).catch(() => {});
    } else {
      throw new Error('Login did not complete within timeout; MFA may be required. Set DMX_MFA_MANUAL to allow manual completion.');
    }
  }
  console.log('[DMX] login handler completed; current url=', page.url());
  // If login handed us to MyAccount (existing loan), try to start a new application so the DMX flow can continue.
  if (isDashboard(page)) {
    console.log('[DMX] detected existing loan dashboard after login — attempting to start a new application');
    const startBtn = page.locator('button, a').filter({ hasText: /start (a )?new (application|loan)/i }).first();
    if (await startBtn.count().catch(() => 0)) {
      try {
        await clickAction(page, startBtn, 'Start new application');
        // allow navigation back into apply flow
        await page.waitForURL(u => /apply\//.test(u.pathname), { timeout: 20000 }).catch(() => {});
      } catch (e) {
        // fallback to direct entry URL navigation
        await page.goto(ENTRY_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    } else {
      await page.goto(ENTRY_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
  }
  return true;
}


async function radioGroups(page: Page) {
  return page.locator('main div[id$="-radio"]:visible').evaluateAll(gs =>
    gs.map(g => ({ id: g.id, opts: Array.from(g.querySelectorAll('button')).map(b => (b.textContent || '').trim()) })));
}

async function pressExact(page: Page, scope: string, text: string) {
  const re = new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  const button = page.locator(`${scope} button:visible`).filter({ hasText: re }).first();
  await clickAction(page, button, text);
}


/** Employment entry has three states on one route: income-type choice, form, and review. */
async function employmentStep(p: Page, e: Employment, pre: string) {
  const choice = p.locator('main button:visible').filter({ hasText: /^\s*(I am|They are) employed\s*$/ });
  const form = p.locator(`#${pre}source-of-employment-select`);
  const review = p.locator('main button:visible').filter({ hasText: /^\s*No\s*$/ });
  // The route renders one of three states asynchronously; wait until one is present before deciding.
  await Promise.race([
    choice.first().waitFor({ state: 'visible', timeout: 15000 }),
    form.waitFor({ state: 'visible', timeout: 15000 }),
    review.first().waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => { throw new Error(`Employment state did not render on /apply/${routeOf(p)}`); });
  if (await choice.first().isVisible().catch(() => false)) { await clickAction(p, choice.first(), 'employed'); await form.waitFor({ state: 'visible', timeout: 15000 }); }
  if (!(await form.isVisible().catch(() => false))) {
    await clickAction(p, review.first(), 'No additional income'); // this answer advances the page itself
    return;
  }
  await p.locator(`#${pre}source-of-employment-select`).selectOption({ label: 'W-2 Employee' });
  await p.locator(`#${pre}employer-name-input`).fill(e.employer);
  await p.locator(`#${pre}job-title-input`).fill(e.title);
  await p.locator(`#${pre}employment-city-input`).fill(e.city);
  await fillMasked(p, `#${pre}employment-phone-number-input`, digits(e.phone));
  await p.locator(`#${pre}employment-state-select`).selectOption({ label: e.state });
  if (!(await p.locator(`#${pre}is-current-employer-checkbox`).isChecked())) await clickAction(p, p.locator(`label[for="${pre}is-current-employer-checkbox"]`), 'current employer');
  await fillMasked(p, `#${pre}employment-start-date-input`, digits(e.start));
  await pressExact(p, `#${pre}has-annual-base-salary-radio`, 'Yes');
  await fillMasked(p, `#${pre}salary-input`, String(e.annualSalary));
  await pressExact(p, `#${pre}extra-income-radio`, 'No');
  await clickNext(p);
}

async function hmdaStep(p: Page, pre: string) {
  if ((await p.locator(`#${pre}government-gender-male-checkbox`).count()) === 0) { await clickNext(p); return; }
  for (const id of ['government-gender-male-checkbox', 'government-ethnicity-not-hispanic-checkbox', 'government-race-white-checkbox']) {
    await clickAction(p, p.locator(`label[for="${pre}${id}"]`), id);
  }
  await clickNext(p);
}

/** Declarations: "occupy as primary residence" (borrower only) is Yes, everything else No. */
async function declarationsStep(p: Page, pre: string) {
  const yes = p.locator('main button:visible').filter({ hasText: /^\s*Yes\s*$/ });
  const no = p.locator('main button:visible').filter({ hasText: /^\s*No\s*$/ });
  const n = await yes.count();
  const occupy = /occupy/i.test(await yes.first().evaluate(b => b.parentElement?.parentElement?.innerText || ''));
  for (let i = 0; i < n; i++) {
    const useYes = i === 0 && occupy;
    await clickAction(p, useYes ? yes.nth(i) : no.nth(i), useYes ? 'Yes' : 'No');
  }
  const cit = p.locator(`#${pre}government-citizenship-select`);
  if (await cit.count()) await cit.selectOption({ label: 'US Citizen' });
  await clickNext(p);
}

type Handler = (p: Page, s: Scenario) => Promise<void>;

/** Route -> handler. Keyed by /apply/<route>; states inside a route are detected by DOM. */
export const handlers: Record<string, Handler> = {
  // ---------- purchase: property ----------
  'purchase-needs': async (p, s) => pressExact(p, 'main', s.product === 'preapproval' ? 'I’m researching what I can afford' : s.property.address ? 'I signed a purchase agreement' : 'I found a house I’d like to buy'),
  'property-buy-timeline': async (p, s) => pressExact(p, 'main', s.loan.timeline ?? 'As soon as possible'),
  'property-preferred-terms': async (p, s) => pressExact(p, 'main', s.loan.refiGoal ?? 'Lower my rate and monthly payment'),
  'borrower-referral': async p => {
    if (routeOf(p) !== 'borrower-referral') return;
    await p.locator("text=/saving your loan details/i").waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await p.waitForFunction(() => !window.location.search.includes('icid='), { timeout: 15000 }).catch(() => {});
    const sel = p.locator('#referral-source-select');
    if (await sel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sel.selectOption({ label: 'Google' });
      await sel.dispatchEvent('change').catch(() => {});
      await clickNext(p);
      await p.waitForURL(url => !url.pathname.includes('/borrower-referral'), { timeout: 15000 }).catch(() => {});
    }
  },
  'contract-property-address': async (p, s) => {
    await p.locator('#property-address-input').fill(s.property.address);
    await p.locator('#property-city-input').fill(s.property.city);
    await p.locator('#property-potential-state-select').selectOption({ label: s.property.state });
    await p.locator('#property-zip-input').fill(s.property.zip);
    await clickNext(p);
  },
  'property-details-refi2': async (p, s) => {
    const l = s.loan;
    await fillMasked(p, '#refi-year-purchased-input', String(l.yearPurchased ?? 2018));
    await fillMasked(p, '#refi-purchase-price-input', String(l.origPrice ?? 400000));
    await p.locator('#property-type-select').selectOption({ label: s.property.propertyType });
    if (l.currentValue) await fillMasked(p, '#refi-estimated-value-input', String(l.currentValue));
    await clickNext(p);
  },
  'interest-rate-refi2': async (p, s) => {
    await fillMasked(p, '#refi-interest-rate-input', String(s.loan.interestRate ?? 6.75));
    await clickNext(p);
  },
  'refi-loan-amount-user-estimate': async (p, s) => {
    await fillMasked(p, '#refi-loan-amount-user-estimate-input', String(s.loan.newLoan ?? s.loan.balance ?? 400000));
    await clickNext(p);
  },
  'loan-details-payment-range': async (p, s) => {
    await fillMasked(p, '#loan-details-payment-target-amount-input', String(s.loan.targetPayment ?? 3000));
    await fillMasked(p, '#loan-details-payment-max-amount-input', String(s.loan.maxPayment ?? 3500));
    await clickNext(p);
  },
  'co-borrower-personal': async (p, s) => {
    const c = s.coBorrower!;
    const answer = async (group: string, text: string) => { if (await p.locator(`#${group}`).count()) await pressExact(p, `#${group}`, text); };
    await p.locator('#co-borrower-email-input').fill(c.email ?? newEmail('co'));
    await fillMasked(p, '#co-borrower-home-phone-input', digits(c.phone));
    await answer('co-government-ownership-interest-radio', 'No'); // not shown on refinance
    await answer('co-borrower-marital-status-radio', c.maritalStatus);
    await answer('co-borrower-address-same-radio', c.sameAddress === false ? 'No' : 'Yes');
    if (await p.locator('#co-borrower-residence-started-input').count()) await fillMasked(p, '#co-borrower-residence-started-input', digits(s.residence.moveIn));
    await answer('co-borrower-dependents-radio', 'No');
    await clickNext(p);
  },
  'cash-out-details-refi2': async (p, s) => {
    await p.locator('#refi-cash-out-purpose-select').selectOption({ label: 'Home Improvement' });
    await fillMasked(p, '#refi-cashout-total-input', String(Math.max(0, (s.loan.newLoan ?? 0) - (s.loan.balance ?? 0)) || 60000));
    await clickNext(p);
  },
  'looking-property-type': async (p, s) => pressExact(p, 'main', s.property.propertyType),
  'property-search-location': async (p, s) => {
    const abbr = STATE_ABBR[s.property.state] ?? s.property.state;
    const city = p.locator('#property-city-input');
    await city.fill('');
    await city.focus();
    await p.keyboard.type(`${s.property.city}, ${abbr}`);
    const option = p.locator('main li').filter({ hasText: new RegExp(`${s.property.city}.*, ${abbr}$`) }).first();
    await option.waitFor({ timeout: 15000 });
    await clickAction(p, option, `${s.property.city}, ${abbr}`);
    await clickNext(p);
  },
  'property-address-refi2': async (p, s) => {
    const l = s.loan;
    await p.locator('#property-address-input').fill(s.property.address);
    await p.locator('#property-city-input').fill(s.property.city);
    await p.locator('#property-potential-state-select').selectOption({ label: s.property.state });
    await p.locator('#property-zip-input').fill(s.property.zip);
    await pressExact(p, '#refi-property-current-residence-radio', 'Yes');
    const county = p.locator('#property-potential-county-select');
    if ((await county.count()) && (await county.inputValue()) === '' && (await county.locator('option').count()) > 1) await county.selectOption({ index: 1 });
    await fillMasked(p, '#user-residence-started-input', digits(l.moveIn ?? '012018'));
    const no = p.locator('main button:visible').filter({ hasText: /^\s*No\s*$/ });
    await clickAction(p, no.nth(1), 'No taxes and insurance included'); // enters annual amounts
    await fillMasked(p, '#property-estimated-taxes-input', String(l.annualTaxes ?? 6000));
    await fillMasked(p, '#property-estimated-insurance-input', String(l.annualInsurance ?? 1500));
    await clickAction(p, no.last(), 'No HOA dues');
    await clickNext(p);
  },
  'property-usage': async (p, s) => pressExact(p, 'main', s.property.usage),
  'loan-details-price-range': async (p, s) => {
    await fillMasked(p, '#loan-details-target-purchase-price-input', String(s.loan.price));
    await fillMasked(p, '#loan-details-down-payment-input', String(s.loan.down));
    if (await p.locator('#estimated-closing-date-input').count()) await fillMasked(p, '#estimated-closing-date-input', dateOut(s.loan.closeInDays ?? 60));
    await clickNext(p);
  },

  // ---------- personal ----------
  'personal-info-borrower-marital-status': async (p, s) => {
    await pressExact(p, '#borrower-marital-status-radio', s.borrower.maritalStatus);
    const groups = await radioGroups(p);
    const co = groups.find(g => g.id.includes('co-borrower'));
    if (co) await pressExact(p, `#${co.id}`, s.coBorrower ? 'Yes' : 'No');
    if (s.coBorrower) {
      await p.locator('#co-borrower-first-name-input').fill(s.coBorrower.firstName);
      await p.locator('#co-borrower-last-name-input').fill(s.coBorrower.lastName);
    }
    if (groups.some(g => g.id.includes('prior-home'))) await pressExact(p, '#borrower-marital-status-prior-home-radio', 'No');
    if (groups.some(g => g.id.includes('dependents'))) await pressExact(p, '#borrower-marital-status-dependents-radio', 'No');
    if (await p.locator('#button-next:visible').count()) await clickNext(p);
  },
  'user-residence-ef': async (p, s) => {
    const r = s.residence;
    await p.locator('#user-address-1-input').fill(r.address);
    await p.locator('#user-city-input').fill(r.city);
    await p.locator('#user-state-select').selectOption({ label: r.state });
    await p.locator('#user-zip-code-input').fill(r.zip);
    const county = p.locator('#residence-county-select');
    if (await county.count()) {
      await county.locator('option').nth(1).waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
      if ((await county.inputValue()) === '' && (await county.locator('option').count()) > 1) await county.selectOption({ index: 1 });
    }
    await fillMasked(p, '#user-residence-started-input', digits(r.moveIn));
    await pressExact(p, '#user-residence-status-radio', r.status);
    if (r.status === 'Rent') await fillMasked(p, '#estimated-monthly-expenses-rent-input', String(r.monthlyRent ?? 2000));
    else {
      await clickAction(p, p.locator('main button:visible').filter({ hasText: /^\s*Yes\s*$/ }).nth(0), 'Yes taxes and insurance included');
      await clickAction(p, p.locator('main button:visible').filter({ hasText: /^\s*No\s*$/ }).nth(1), 'No HOA');
    }
    await clickNext(p);
  },
  'borrower-us-military': async p => pressExact(p, '#user-us-military-auto-radio', 'No'),

  // ---------- credit ----------
  'credit-check-consent-borrower-ef': async (p, s) => {
    await fillMasked(p, '#social-security-number-input', digits(s.borrower.ssn));
    await fillMasked(p, '#birth-date-input', digits(s.borrower.dob));
    for (const id of ['soft-credit-credit-indicator-checkbox', 'borrower-credit-pull-consent-checkbox', 'credit-monitoring-consent-checkbox']) {
      const box = p.locator(`#${id}`);
      if (!(await box.isChecked())) await clickAction(p, p.locator(`label[for="${id}"]`), id);
    }
    await clickNext(p);
  },

  'credit-check-consent-co-borrower-ef': async (p, s) => {
    const c = s.coBorrower!;
    await fillMasked(p, '#co-social-security-number-input', digits(c.ssn));
    await fillMasked(p, '#co-birth-date-input', digits(c.dob));
    for (const id of ['co-soft-credit-credit-indicator-checkbox', 'co-borrower-credit-pull-consent-checkbox', 'co-credit-monitoring-consent-checkbox']) {
      if (!(await p.locator(`#${id}`).isChecked())) await clickAction(p, p.locator(`label[for="${id}"]`), id);
    }
    await clickNext(p);
  },

  // ---------- financial ----------
  'add-income-information': async (p, s) => employmentStep(p, s.employment, ''),
  'co-add-income-information': async (p, s) => employmentStep(p, s.coBorrower?.employment ?? s.employment, 'co-'),
  'add-asset-information': async (p, s) => {
    if ((await p.locator('#asset-type-select').count()) === 0) return;
    const [a1, a2] = s.assets;
    await p.locator('#asset-type-select').selectOption({ label: a1.type });
    await p.locator('#financial-institution-input').fill(a1.institution);
    await fillMasked(p, '#balance-input', String(a1.balance));
    if (await p.locator('#asset-owner-select').count()) await p.locator('#asset-owner-select').selectOption({ label: 'Both' });
    if (a2) {
      await p.locator('#asset-type-1-select').selectOption({ label: a2.type });
      await p.locator('#financial-institution-1-input').fill(a2.institution);
      await fillMasked(p, '#balance-1-input', String(a2.balance));
      if (await p.locator('#asset-owner-1-select').count()) await p.locator('#asset-owner-1-select').selectOption({ label: 'Both' });
    }
    await clickNext(p);
  },

  // ---------- government ----------
  'government-questions-hmda': async p => hmdaStep(p, ''),
  'co-government-questions-hmda': async p => hmdaStep(p, 'co-'),
  'government-questions-additional': async p => declarationsStep(p, ''),
  'co-government-questions-additional': async p => declarationsStep(p, 'co-'),
  'borrower-language-preference': async p => {
    await pressExact(p, '#borrower-language-preference-radio', 'English');
    const next = p.locator('#button-next:visible');
    if (routeOf(p) === 'borrower-language-preference' && await next.count()) await clickNext(p);
  },

  // ---------- submit ----------
  'loan-options': async (p, s) => {
    if ((await p.locator('#loan-option-2-select').count()) === 0) {
      for (const g of await radioGroups(p)) await pressExact(p, `#${g.id}`, 'No');
      await clickNext(p);
      return;
    }
    const o = s.loanOptions ?? { option2: '15 year Fixed Rate', option3: '20 year Fixed Rate' };
    const down = String(s.loan.down ?? 0);
    await p.locator('#loan-option-2-select').selectOption({ label: o.option2 });
    await fillMasked(p, '#loan-down-payment-2-input', down);
    await p.locator('#loan-option-3-select').selectOption({ label: o.option3 });
    await fillMasked(p, '#loan-down-payment-3-input', down);
    await clickNext(p);
  },
};

export class UnhandledPageError extends Error {}

/** Default behaviour for pages with only yes/no groups or continue buttons. */
async function fallback(page: Page, route: string) {
  const inputs = await page.locator('main input:visible:not([type=checkbox]), main select:visible, main textarea:visible').count();
  if (inputs) {
    const ids = await page.locator('main input:visible, main select:visible').evaluateAll(es => es.map(e => e.id));
    throw new UnhandledPageError(`No handler for /apply/${route}; visible fields: ${ids.join(', ')}`);
  }
  const groups = await radioGroups(page);
  for (const g of groups) await pressExact(page, `#${g.id}`, g.opts.includes('No') ? 'No' : g.opts[0]);
  if (groups.length) { if (await page.locator('#button-next:visible').count()) await clickNext(page); return; }
  const opts = (await page.locator('main button:visible').evaluateAll(bs => bs.filter(b => !['language-preference', 'button-back'].includes(b.id)).map(b => (b.textContent || '').trim()))).filter(t => t && !t.includes('Sketch'));
  if (!opts.length) {
    await page.locator('main button:visible, main input:visible, main select:visible').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const readyOptions = (await page.locator('main button:visible').allTextContents()).map(text => text.trim()).filter(Boolean);
    if (!readyOptions.length) throw new UnhandledPageError(`No actionable controls rendered on /apply/${route}`);
    const pick = ['No', 'Continue'].find(o => readyOptions.includes(o)) || readyOptions[0];
    await pressExact(page, 'main', pick);
    return;
  }
  const pick = ['No', 'Continue'].find(o => opts.includes(o)) || opts[0];
  await pressExact(page, 'main', pick);
}

export interface RunOptions {
  /** Stop (without acting) when this route is reached, for incomplete-loan scenarios. */
  stopAt?: string;
  maxSteps?: number;
  log?: (msg: string) => void;
}

/**
 * Drives the DMX application from the current page to the MyAccount overview (or to `stopAt`).
 * Returns the routes visited in order.
 */
export async function runApplication(page: Page, s: Scenario, opts: RunOptions = {}): Promise<string[]> {
  const visited: string[] = [];
  const log = opts.log ?? (() => {});
  let same = 0;
  let last = '';
  for (let i = 0; i < (opts.maxSteps ?? 80); i++) {
    // If redirected to a login/Okta page, attempt on-the-fly login using environment or scenario creds.
    if (looksLikeLoginUrl(page.url())) {
      const runEmail = String(process.env.DMX_RUN_EMAIL ?? s.borrower.email ?? '');
      const runPass = String(process.env.DMX_RUN_PASSWORD ?? PASSWORD);
      await handleLoginRedirect(page, runEmail, runPass).catch(e => { throw e; });
    }
    if (isDashboard(page)) return visited;
    const route = routeOf(page);
    if (opts.stopAt && route === opts.stopAt) return visited;
    same = route === last ? same + 1 : 0;
    last = route;
    if (same >= 4) throw new UnhandledPageError(`Stuck on /apply/${route} after ${same} attempts`);
    if (same === 0) visited.push(route);
    log(`step ${i}: ${route}`);
    const h = handlers[route];
    if (h) await h(page, s);
    else await fallback(page, route);
    await settle(page, route);
    // after settling, re-check for login redirects that may have occurred during route transitions
    if (looksLikeLoginUrl(page.url())) {
      const runEmail = String(process.env.DMX_RUN_EMAIL ?? s.borrower.email ?? '');
      const runPass = String(process.env.DMX_RUN_PASSWORD ?? PASSWORD);
      await handleLoginRedirect(page, runEmail, runPass).catch(e => { throw e; });
    }
  }
  throw new UnhandledPageError(`Exceeded max steps; last route /apply/${routeOf(page)}`);
}

export const ENTRY_URLS: Record<string, string> = {
  'lo-a': 'https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=12657',
  'lo-b': 'https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=4723',
  'lo-c': 'https://apply-gri.dev.saas.rate.com/apply/lo-selection?emp-id=6068',
};
export const ENTRY_URL = ENTRY_URLS['lo-b'];
export const PASSWORD = 'Test123!';

export function newEmail(tag: string) {
  return `my-dmx-${tag}${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}--ra@yopmail.com`;
}

/** Loan purpose -> contact info -> password; returns once the referral page is reached. */
export async function register(page: Page, s: Scenario, email: string, password = PASSWORD, entryUrl = ENTRY_URL) {
  if (!Object.values(ENTRY_URLS).includes(entryUrl)) throw new Error(`Unapproved DMX DEV entry URL: ${entryUrl}`);
  await page.goto(entryUrl, { waitUntil: 'domcontentloaded' });
  // If the entry URL redirected to Okta/login, attempt to sign in on-the-fly.
  if (looksLikeLoginUrl(page.url())) {
    await handleLoginRedirect(page, String(process.env.DMX_RUN_EMAIL ?? email), String(process.env.DMX_RUN_PASSWORD ?? password)).catch(e => { throw e; });
  }
  await page.locator('main').waitFor({ state: 'visible', timeout: 20000 });
  const cookie = page.locator('#onetrust-accept-btn-handler');
  if (await cookie.isVisible().catch(() => false)) await clickAction(page, cookie, 'Accept cookies');
  if (new URL(entryUrl).pathname.endsWith('/lo-selection')) {
    const choices = page.locator('main button:visible, main a:visible');
    const matchingOfficer = choices.filter({ hasText: /Indu|6068/i }).first();
    if (await matchingOfficer.count()) await clickAction(page, matchingOfficer, 'Select Indu loan officer');
    else await choices.first().waitFor({ state: 'visible', timeout: 15000 });
  } else {
    const purpose = s.product === 'refinance' ? "I'm Refinancing" : "I'm Purchasing";
    await clickAction(page, page.locator(`button:has-text("${purpose}")`).first(), purpose);
  }
  await page.waitForURL('**/user-info-ef**');
  await page.locator('#user-first-name-input').fill(s.borrower.firstName);
  await page.locator('#user-last-name-input').fill(s.borrower.lastName);
  await fillMasked(page, '#user-home-phone-input', digits(s.borrower.phone));
  await page.locator('#user-email-input').fill(email);
  await page.locator('#user-communication-method-select').selectOption('Email');
  await clickNext(page);
  // After submitting the email, the app may redirect to an Okta login page when the
  // email already exists. Detect that and attempt on-the-fly login so the flow can continue.
  // After clickNext, either the personal-info-create-account page appears, or the app may
  // redirect to an Okta authorize URL and then back to the apply flow with `icid=auth|login`.
  // Wait briefly for either outcome and handle login if observed.
  try {
    const outcome = await Promise.race([
      page.waitForURL('**/personal-info-create-account**', { timeout: 5000 }).then(() => 'create' as const).catch(() => 'timeout' as const),
      page.waitForURL(u => looksLikeLoginUrl(u) || (u.search && u.includes('icid=auth')), { timeout: 5000 }).then(() => 'login' as const).catch(() => 'timeout' as const),
    ]);
    if (outcome === 'login') {
      console.log('[DMX] register flow detected login redirect after email submit; attempting on-the-fly login');
      await handleLoginRedirect(page, String(process.env.DMX_RUN_EMAIL ?? email), String(process.env.DMX_RUN_PASSWORD ?? password)).catch(err => { console.log('[DMX] on-the-fly login failed:', err.message); });
      // Ensure we're back to a visible DMX page before continuing
      await page.locator('main').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      // If after login we land on an apply route with icid=auth|login, try navigating to ENTRY_URL to start fresh
      if (page.url().includes('icid=auth|login') || page.url().includes('icid=auth%7Clogin')) {
        await page.goto(ENTRY_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    } else {
      // fall through to wait for the create-account page (longer timeout)
      await page.waitForURL('**/personal-info-create-account**', { timeout: 45000 });
    }
  } catch (e) {
    console.log('[DMX] error while detecting existing-account during register:', (e as Error).message);
    await page.waitForURL('**/personal-info-create-account**', { timeout: 45000 });
  }
  await page.locator('#user-password-input').fill(password);
  await page.locator('#user-confirm-password-input').fill(password);
  await clickNext(page);
  await page.waitForURL(url => !url.pathname.includes('/personal-info-create-account') && !url.pathname.includes('/user-info') && !url.pathname.includes('/loan-purpose'), { timeout: 45000 });
  // If Okta presented an authentication step during register, allow handler to complete before continuing.
  if (looksLikeLoginUrl(page.url())) {
    await handleLoginRedirect(page, String(process.env.DMX_RUN_EMAIL ?? email), String(process.env.DMX_RUN_PASSWORD ?? password)).catch(e => { throw e; });
  }
  await page.locator("text=/saving your loan details/i").waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => !window.location.search.includes('icid='), { timeout: 20000 }).catch(() => {});
  await page.locator('main').waitFor({ state: 'visible', timeout: 15000 });
}

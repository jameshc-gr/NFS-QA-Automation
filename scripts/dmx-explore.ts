import { chromium, Page } from 'playwright';

const BASE = 'https://apply-gri.dev.saas.rate.com';

export async function dumpPage(page: Page, label = '') {
  const info = await page.evaluate(() => {
    const vis = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest('#onetrust-consent-sdk');
    };
    const main = document.querySelector('main') as HTMLElement | null;
    const fields = Array.from(document.querySelectorAll('input, select, textarea, [role="radiogroup"], div[aria-label]'))
      .filter(vis)
      .filter(el => !el.closest('nav') && !el.closest('menu'))
      .map(el => {
        const label = (document.querySelector(`label[for="${el.id}"]`)?.textContent || '').trim();
        const opts = el.tagName === 'SELECT' ? Array.from((el as HTMLSelectElement).options).map(o => o.text).slice(0, 6).join('|') : '';
        return `${el.tagName.toLowerCase()}#${el.id} [${el.getAttribute('type') || ''}] label="${label}" aria="${el.getAttribute('aria-label') || ''}" ph="${el.getAttribute('placeholder') || ''}" val="${(el as HTMLInputElement).value || ''}"${(el as HTMLInputElement).disabled ? ' DISABLED' : ''}${(el as HTMLInputElement).type === 'checkbox' ? ' CHECKED=' + (el as HTMLInputElement).checked : ''}${opts ? ' opts=' + opts : ''}`;
      });
    const buttons = Array.from(document.querySelectorAll('main button'))
      .filter(vis).map(b => `${(b.textContent || '').trim().replace(/\s+/g, ' ')}#${b.id}`).filter(b => b.length > 1);
    const txt = (main?.innerText || document.body.innerText);
    return {
      url: location.pathname,
      h: Array.from(document.querySelectorAll('h1,h2')).filter(vis).map(h => (h.textContent || '').trim().split('\n')[0]),
      fields, buttons,
      errors: Array.from(document.querySelectorAll('main [class*="error" i], main [role="alert"], main [class*="invalid" i]')).filter(vis).map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 8),
    };
  });
  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(info, null, 1).replace(/\\n/g, ' '));
}

export async function startPurchase(page: Page, email: string, opts: { stage?: string } = {}) {
  await page.goto(`${BASE}/apply/loan-purpose?emp-id=4723`, { waitUntil: 'networkidle' });
  const c = page.locator('#onetrust-accept-btn-handler');
  if (await c.isVisible().catch(() => false)) await c.click();
  await page.locator("button:has-text(\"I'm Purchasing\")").first().click();
  await page.waitForURL('**/user-info-ef**');
  await page.locator('#user-first-name-input').fill('John');
  await page.locator('#user-last-name-input').fill('Sample');
  const p = page.locator('#user-home-phone-input');
  await p.fill('(312) 658-4000', { force: true });
  await p.dispatchEvent('input'); await p.dispatchEvent('change'); await p.dispatchEvent('blur');
  await page.locator('#user-email-input').fill(email);
  await page.locator('#user-communication-method-select').selectOption('Email');
  await page.locator('#button-next').click();
  await page.waitForURL('**/personal-info-create-account**');
  await page.locator('#user-password-input').fill('Test123!');
  await page.locator('#user-confirm-password-input').fill('Test123!');
  await page.locator('#button-next').click();
  await page.waitForURL('**/borrower-referral**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.locator('#referral-source-select').selectOption('Google');
  await page.locator('#button-next').click();
  await page.waitForURL('**/purchase-needs**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.locator(`button:has-text("${opts.stage || 'I signed a purchase agreement'}")`).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const email = `my-dmx-explore${Math.floor(Math.random() * 90000 + 10000)}--ra@yopmail.com`;
    console.log('EMAIL', email);
    await startPurchase(page, email);
    await dumpPage(page, 'after purchase-needs');

    // try the contract address with validation output
    await page.locator('#property-address-input').fill('3940 N Ravenswood Ave');
    await page.locator('#property-city-input').fill('Chicago');
    await page.locator('#property-potential-state-select').selectOption({ label: 'Illinois' });
    await page.locator('#property-zip-input').fill('60613');
    await page.locator('#button-next').click();
    await page.waitForTimeout(4000);
    await dumpPage(page, 'after address submit');
    await browser.close();
  })();
}

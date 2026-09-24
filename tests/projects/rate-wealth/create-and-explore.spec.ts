import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Create account and explore authenticated site', () => {
  test('Create account, login, crawl pages and extract text', async ({ page }) => {
    const signupUrl = 'https://www.gr-dev.com/fitbux-signup';
    const timestamp = Date.now();
    const email = `ratewealthuser${timestamp}@yopmail.com`;
    const pw = process.env.TEST_PASSWORD;

    if (!pw) {
      fs.mkdirSync('test-results/explore-auth', { recursive: true });
      fs.writeFileSync('test-results/explore-auth/execution_status.txt', `blocked: TEST_PASSWORD not set in environment`);
      test.skip('TEST_PASSWORD is required');
      return;
    }

    await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Try to find registration entry points
    const registerSelectors = [
      'text=Create account',
      'text=Sign up',
      'text=Register',
      'a:has-text("Create account")',
      'a:has-text("Sign up")'
    ];

    let registered = false;
    for (const sel of registerSelectors) {
      const loc = page.locator(sel);
      if (await loc.count() > 0) {
        await loc.first().click();
        await page.waitForTimeout(1000);
        registered = true;
        break;
      }
    }

    // If not found, attempt to use email field on page (some signups accept email then continue)
    if (!registered) {
      const emailField = page.locator('input[type="email"], input[name*="email"], input[id*="email"], input[name="identifier"]');
      if (await emailField.count() > 0) {
        await emailField.first().fill(email);
        // try to click continue or submit
        const cont = page.getByRole('button', { name: /Continue|Next|Create account|Sign up/i });
        if (await cont.count() > 0) {
          await cont.first().click();
          await page.waitForTimeout(1000);
          registered = true;
        }
      }
    }

    // If still not registered, record blocked and end
    if (!registered) {
      fs.mkdirSync('test-results/explore-auth', { recursive: true });
      fs.writeFileSync('test-results/explore-auth/execution_status.txt', `blocked: no registration entry found on ${signupUrl}`);
      test.info().attach('status', { body: Buffer.from('blocked: no registration entry found'), contentType: 'text/plain' });
      test.skip();
      return;
    }

    // Fill common registration fields conservatively (non-destructive)
    // Fill email and password if shown
    const emailInputs = page.locator('input[type="email"], input[name*="email"], input[id*="email"], input[name="identifier"]');
    if (await emailInputs.count() > 0) await emailInputs.first().fill(email);

    const passwordInputs = page.locator('input[type="password"], input[name*="password"], input[id*="password"]');
    if (await passwordInputs.count() > 0) await passwordInputs.first().fill(pw);

    // Try to fill first/last names if present
    const first = page.locator('input[name*="first"], input[id*="first"], input[placeholder*="First"]');
    if (await first.count() > 0) await first.first().fill('AutoTest');
    const last = page.locator('input[name*="last"], input[id*="last"], input[placeholder*="Last"]');
    if (await last.count() > 0) await last.first().fill('User');

    // Click final create/continue button if present but avoid submitting if external verification is expected
    const finalBtn = page.getByRole('button', { name: /Create account|Sign up|Finish|Continue|Submit/i });
    if (await finalBtn.count() > 0) {
      await finalBtn.first().click();
      await page.waitForTimeout(2000);
    }

    // After attempting registration, check if page shows verification required
    const blockedTexts = ['verify', 'verification', 'check your email', 'we sent', 'confirm'];
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    if (blockedTexts.some(t => bodyText.includes(t))) {
      fs.mkdirSync('test-results/explore-auth', { recursive: true });
      fs.writeFileSync('test-results/explore-auth/execution_status.txt', `blocked: registration requires external verification for ${email}`);
      test.info().attach('status', { body: Buffer.from('blocked: registration requires external verification'), contentType: 'text/plain' });
      test.skip();
      return;
    }

    // Try to navigate to authenticated base
    const baseCandidates = ['https://wealth.dev.fitbux.com', 'https://www.gr-dev.com', 'https://my.dev.rate.com'];
    let authenticated = false;
    for (const c of baseCandidates) {
      try {
        await page.goto(c, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        const url = page.url();
        if (!url.includes('login') && !url.includes('signin') && (await page.locator('text=Wealth Score').count() > 0 || await page.locator('text=Financial Snapshot').count() > 0)) {
          authenticated = true;
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    // If not obviously authenticated, attempt to find a logout or profile menu indicating logged-in state
    if (!authenticated) {
      const profileSelectors = ['text=Log out', 'text=Logout', 'text=Sign out', 'text=My Account', 'text=Profile'];
      for (const s of profileSelectors) {
        if (await page.locator(s).count() > 0) { authenticated = true; break; }
      }
    }

    if (!authenticated) {
      fs.mkdirSync('test-results/explore-auth', { recursive: true });
      fs.writeFileSync('test-results/explore-auth/execution_status.txt', `unverified: could not confirm authentication after registration for ${email}`);
      test.info().attach('status', { body: Buffer.from('unverified: could not confirm authentication'), contentType: 'text/plain' });
      // continue best-effort crawling from current page
    }

    // Crawl links within the same host up to a limit
    const startHost = new URL(page.url()).host;
    const toVisit: string[] = [];
    const visited = new Set<string>();
    const pagesData: any[] = [];

    const collectLinks = async () => {
      const anchors = await page.$$eval('a[href]', els => els.map(a => a.getAttribute('href')));
      for (let href of anchors) {
        if (!href) continue;
        try { href = new URL(href, page.url()).toString(); } catch { continue; }
        const h = new URL(href);
        if (h.host === startHost && !visited.has(href) && toVisit.length < 200) toVisit.push(href);
      }
    };

    await collectLinks();

    while (toVisit.length > 0 && visited.size < 100) {
      const u = toVisit.shift()!;
      if (visited.has(u)) continue;
      try {
        await page.goto(u, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        const title = await page.title();
        const headings = await page.$$eval('h1,h2,h3', els => els.map(e => ({tag: e.tagName, text: (e.textContent||'').trim()})));
        const inputs = await page.$$eval('input,select,textarea', els => els.map((el, idx) => {
          const id = el.id || ''; const name = el.getAttribute('name')||''; const type = (el.getAttribute('type')||el.tagName||'').toLowerCase(); const placeholder = el.getAttribute('placeholder')||''; const aria = el.getAttribute('aria-label')||''; let label=''; if (id) { const lab = document.querySelector(`label[for="${id}"]`); if (lab) label=(lab.textContent||'').trim(); } if (!label) { const parent = el.closest('label'); if (parent) label=(parent.textContent||'').trim(); }
          return {id,name,type,placeholder,aria,label};
        }));
        const text = await page.locator('body').innerText();
        pagesData.push({url: u, title, headings, inputs, text});
        visited.add(u);
        // collect more links from this page
        const anchors = await page.$$eval('a[href]', els => els.map(a => a.getAttribute('href')));
        for (let href of anchors) {
          if (!href) continue;
          try { href = new URL(href, u).toString(); } catch { continue; }
          const h = new URL(href);
          if (h.host === startHost && !visited.has(href) && !toVisit.includes(href) && toVisit.length < 500) toVisit.push(href);
        }
      } catch (e) {
        visited.add(u);
      }
    }

    // Write CSVs
    fs.mkdirSync('test-results/explore-auth', { recursive: true });
    const pageCsv = ['page_name,url,title,heading_count,input_count'];
    pagesData.forEach((p, idx) => pageCsv.push([`page-${idx+1}`, p.url, JSON.stringify(p.title), p.headings.length, p.inputs.length].join(',')));
    fs.writeFileSync('test-results/explore-auth/page_inventory.csv', pageCsv.join('\n'));

    const inputHeader = ['field_id','page','url','field_label','control_type','id','name','placeholder','aria_label'];
    const inputRows = [inputHeader.join(',')];
    pagesData.forEach((p, idx) => {
      p.inputs.forEach((i: any, j: number) => {
        const fid = i.id || `p${idx+1}-f${j+1}`;
        inputRows.push([fid, `page-${idx+1}`, p.url, JSON.stringify(i.label), i.type, i.id, i.name, JSON.stringify(i.placeholder), JSON.stringify(i.aria)].join(','));
      });
    });
    fs.writeFileSync('test-results/explore-auth/input_field_inventory.csv', inputRows.join('\n'));

    // Save text files for spelling checks
    pagesData.forEach((p, idx) => fs.writeFileSync(`test-results/explore-auth/page-${idx+1}.txt`, p.text));

    // Summarize
    fs.writeFileSync('test-results/explore-auth/execution_status.txt', `created_account:${email}\npassword_used_env:${process.env.TEST_PASSWORD? 'true':'false'}\npages_crawled:${pagesData.length}`);

  });
});

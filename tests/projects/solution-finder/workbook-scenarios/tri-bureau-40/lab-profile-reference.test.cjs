const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { chromium, expect } = require('@playwright/test');
const { createLabServer } = require('../../../../../scripts/solution-finder/lab/server');
const root = path.resolve(__dirname, '../../../../..');
const fixture = () => JSON.parse(fs.readFileSync(path.join(root,
  'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profile-reference.json'), 'utf8'));

test('all40 IR choices display chart SSN/source scores, returned credit and prior offer details without submitting', async () => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const evidence = path.join(root, 'test-results', date, 'solution-finder/lab-verification/ir-chart-reference');
  fs.mkdirSync(evidence, { recursive: true });
  const templates = fs.mkdtempSync(path.join(evidence, 'templates-'));
  let launches = 0;
  const lab = createLabServer({
    templateDirectory: templates,
    launch() { launches++; throw new Error('Chart-reference validation must not launch an inquiry.'); }
  });
  let browser;
  try {
    await new Promise(resolve => lab.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${lab.server.address().port}`;
    const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
    const chart = fixture();
    assert.equal(bootstrap.cases.filter(item => item.profileReference).length, 40);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(base);
    let releaseLoad;
    const loading = new Promise(resolve => { releaseLoad = resolve; });
    await page.route('**/api/cases/TB-001', async route => { await loading; await route.continue(); });
    await page.locator('#scenario').selectOption('TB-001');
    await page.locator('#load').click();
    await expect(page.locator('#scenario')).toBeDisabled();
    await expect(page.locator('#load')).toBeDisabled();
    await expect(page.locator('#launch')).toBeDisabled();
    releaseLoad();
    await expect(page.locator('#scenario')).toBeEnabled();
    await page.unroute('**/api/cases/TB-001');
    for (const reference of chart.profiles) {
      const option = bootstrap.cases.find(item => item.id === reference.profileId);
      assert.ok(isDeepStrictEqual(option.profileReference.expectedFico, reference.expectedFico), `${reference.profileId}: source scores`);
      assert.ok(isDeepStrictEqual(option.profileReference.returnedFico, reference.returnedFico), `${reference.profileId}: actual scores`);
      assert.ok(isDeepStrictEqual(option.profileReference.offers, reference.offers), `${reference.profileId}: prior offers`);
      const label = await page.locator(`#scenario option[value="${reference.profileId}"]`).textContent();
      assert.ok(label.includes(reference.lastFourSSN), `${reference.profileId}: label suffix`);
      for (const bureau of ['TU', 'XPN', 'EFX']) {
        assert.ok(label.includes(`${bureau} ${reference.expectedFico[bureau] ?? 'N/A'}`), `${reference.profileId}: label bureau`);
      }
      const suiteLabel = await page.locator(`#suite-cases input[value="${reference.profileId}"]`).locator('..').textContent();
      assert.ok(suiteLabel === label, `${reference.profileId}: single/suite label differs`);
      await page.locator('#scenario').selectOption(reference.profileId);
      await expect(page.locator('#profile-reference')).toBeVisible();
      const loaded = page.waitForResponse(response => response.url().endsWith(`/api/cases/${reference.profileId}`));
      await page.locator('#load').click();
      assert.equal((await loaded).status(), 200);
      await expect(page.locator('#scenario')).toBeEnabled();
      await expect(page.locator('#profile-reference-offers tbody tr')).toHaveCount(reference.offers.length);
      const values = await page.locator('#profile-reference-values dd').allTextContents();
      assert.ok(values[0] === reference.lastFourSSN, `${reference.profileId}: displayed suffix`);
      for (const bureau of ['TU', 'XPN', 'EFX']) {
        assert.ok(values[1].includes(`${bureau}: ${reference.expectedFico[bureau] ?? 'N/A'}`), `${reference.profileId}: source score display`);
        assert.ok(values[2].includes(`${bureau}: ${reference.returnedFico[bureau] ?? 'Not returned'}`), `${reference.profileId}: returned score display`);
      }
      assert.equal(values[3], reference.creditReturned ? 'Y' : 'N');
      assert.ok(values[4] === (reference.eligibleProducts.join(', ') || 'None'), `${reference.profileId}: eligible products`);
      for (const [index, offer] of reference.offers.entries()) {
        const cells = await page.locator('#profile-reference-offers tbody tr').nth(index).locator('td').allTextContents();
        assert.ok(cells[0].includes(`${offer.product} / ${offer.status}`), `${reference.profileId}: product/status`);
        if (offer.applicationType) assert.ok(cells[0].includes(offer.applicationType), `${reference.profileId}: application type`);
        if (offer.loanAmount != null) assert.ok(cells[1].includes(`Amount: ${offer.loanAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`), `${reference.profileId}: amount`);
        if (offer.rate != null) assert.ok(cells[1].includes(`Rate: ${offer.rate}%`), `${reference.profileId}: rate`);
        if (offer.apr != null) assert.ok(cells[1].includes(`APR: ${offer.apr}%`), `${reference.profileId}: APR`);
        if (offer.term != null) assert.ok(cells[1].includes(`Term: ${offer.term} years`), `${reference.profileId}: term`);
        if (offer.monthlyPayment != null) assert.ok(cells[1].includes(`Monthly: ${offer.monthlyPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}`), `${reference.profileId}: payment`);
        assert.ok(offer.reasons.every(reason => cells[2].includes(reason)), `${reference.profileId}: reasons`);
      }
      assert.ok((await page.locator('#profile-reference-context').textContent()).includes('not current-run results or guaranteed offers'));
    }
    await page.locator('#scenario').selectOption('TB-026');
    await page.locator('#load').click();
    await expect(page.locator('#profile-reference')).toContainText('WAITING_FOR_INITIAL_OFFERS');
    await expect(page.locator('#profile-reference-offers tbody')).toContainText('Pending');
    await page.locator('#template-name').fill('IR reference copy - offline test');
    const savedResponse = page.waitForResponse(response => response.url().endsWith('/api/templates') && response.request().method() === 'POST');
    await page.locator('#save-template').click();
    const saved = await (await savedResponse).json();
    assert.equal(saved.template.profileReference.profileId, 'TB-026');
    const reloaded = await (await fetch(`${base}/api/cases/${saved.template.id}`)).json();
    assert.equal(reloaded.profileReference.profileId, 'TB-026');
    await page.screenshot({ path: path.join(evidence, 'prior-pending-products.png'), fullPage: true });
    await page.locator('#scenario').selectOption('NSF-001');
    await expect(page.locator('#profile-reference')).toBeHidden();
    await page.locator('#scenario').selectOption('TB-007');
    await page.locator('#load').click();
    assert.equal((await page.locator('#profile-reference-values dd').allTextContents())[3], 'N');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(evidence, 'no-credit-mobile.png'), fullPage: true });
    await page.locator('#reset').click();
    await expect(page.locator('#profile-reference')).toBeHidden();
    assert.equal(launches, 0);
  } finally {
    if (browser) await browser.close();
    if (lab.server.listening) await lab.close();
    fs.rmSync(templates, { recursive: true, force: true });
  }
});

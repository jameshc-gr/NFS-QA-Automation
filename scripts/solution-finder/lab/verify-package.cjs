'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync, fork } = require('node:child_process');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { checkRepositoryRoot } = require('../../check-repository-root');

function command(program, args, cwd, env = process.env) {
  const result = spawnSync(program, args, { cwd, env, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${program} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
async function verifyPackage(file) {
  checkRepositoryRoot();
  if (!file || !process.env.npm_execpath) throw new Error('Use npm run verify:solution-finder:lab -- <ZIP path>.');
  const archive = fs.realpathSync(file);
  const directory = fs.mkdtempSync(path.join(path.dirname(archive), 'verify with spaces-'));
  const extracted = path.join(directory, 'solution-finder-lab');
  let browser; let server; let launcher; let launcherClosed;
  try {
    command('unzip', ['-q', archive, '-d', directory], directory);
    const manifest = JSON.parse(fs.readFileSync(path.join(extracted, 'package.json')));
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['@playwright/test', 'zod']);
    assert.equal(manifest.scripts.start, 'node launcher/start.cjs');
    for (const forbidden of ['.env', '.git', 'node_modules',
      'test-results', 'test-data/solution-finder/workbook-scenarios/scenarios.json',
      'test-data/solution-finder/workbook-scenarios/original-scenarios.json',
      'test-data/solution-finder/workbook-scenarios/lab-templates']) {
      assert.equal(fs.existsSync(path.join(extracted, forbidden)), false, forbidden);
    }
    command(process.execPath, [process.env.npm_execpath, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], extracted);
    const localRequire = createRequire(path.join(extracted, 'package.json'));
    for (const dependency of Object.keys(manifest.dependencies)) {
      assert.ok(fs.realpathSync(localRequire.resolve(dependency)).startsWith(path.join(extracted, 'node_modules') + path.sep));
    }
    for (const name of ['verify-isolation.cjs', 'verify-server.cjs']) {
      fs.copyFileSync(path.join(__dirname, 'portable', name), path.join(extracted, 'launcher', name));
    }
    const env = {
      ...process.env, SF_LAB_PORTABLE: '1',
      NODE_OPTIONS: `--require="${path.join(extracted, 'launcher/verify-isolation.cjs')}"`
    };
    const { chromium, expect } = localRequire('@playwright/test');
    const reserve = net.createServer();
    reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
    const port = reserve.address().port;
    await new Promise(resolve => reserve.close(resolve));
    launcher = spawn(process.execPath, ['launcher/start.cjs'], {
      cwd: extracted, env: { ...env, SF_LAB_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    launcherClosed = once(launcher, 'close');
    let output = '';
    launcher.stdout.on('data', data => { output += data; });
    launcher.stderr.on('data', data => { output += data; });
    await expect.poll(() => {
      if (launcher.exitCode !== null) throw new Error(`Packaged launcher exited:\n${output}`);
      return output;
    }).toContain(`http://127.0.0.1:${port}`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#tenant option')).toHaveCount(5);
    await expect(page.locator('#scenario option')).toHaveCount(1);
    await expect(page.locator('#server-notice')).toContainText('Standalone privacy-safe copy');
    await expect(page.locator('#reset')).toBeEnabled();
    const address = { street: ['123 Example Street'], city: 'Exampletown', region: 'CA', postalCode: '90210', country: 'US' };
    const request = { type: 'SALES_INQUIRY', applicationInquiryInput: {
      propertyInputHeloc: { address, type: 'PRIMARY', requestedLoanAmount: 100000 },
      basicInfoInput: { name: { first: 'Synthetic', middle: '', last: 'Example', suffix: '' },
        emailId: 'qa.example@example.invalid', phoneNumber: '2025550100',
        residenceAddress: address, residenceStartDate: '2000-01-01', isAgreed: true },
      basicInfoUpdateInput: { dateOfBirth: '1980-01-01', lastFourSSN: '0000' },
      incomeInput: [{ annualIncome: 100000, incomeSource: 'EMPLOYED_FULL_TIME', incomeType: null }],
      existingMortgageAmount: 0
    }};
    const ids = [];
    for (const [index, amount] of [100000, 90000].entries()) {
      request.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = amount;
      await page.locator('#request').fill(JSON.stringify(request));
      const validated = page.waitForResponse(response => response.url().endsWith('/api/preview') && response.request().method() === 'POST');
      await page.locator('#validate').click();
      assert.equal((await validated).status(), 200);
      await expect(page.locator('#preview')).toContainText('Synthetic Example');
      const name = `Offline portability example ${index + 1}`;
      await page.locator('#template-name').fill(name);
      const saved = page.waitForResponse(response => response.url().endsWith('/api/templates') && response.request().method() === 'POST');
      await page.locator('#save-template').click();
      const { template } = await (await saved).json();
      await expect(page.locator('#save-status')).toContainText(`Saved "${name}"`);
      await expect(page.locator('#scenario')).toHaveValue(template.id);
      ids.push(template.id);
    }
    assert.equal(new Set(ids).size, 2);
    launcher.kill('SIGINT'); await launcherClosed; launcher = null;
    server = fork(path.join(extracted, 'launcher/verify-server.cjs'), [], {
      cwd: extracted, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    let serverOutput = '';
    server.stderr.on('data', data => { serverOutput += data; });
    const ready = await Promise.race([
      once(server, 'message'),
      once(server, 'exit').then(() => { throw new Error(`Offline verification server exited:\n${serverOutput}`); })
    ]);
    await page.goto(`http://127.0.0.1:${ready[0].port}`);
    await expect(page.locator('#scenario option')).toHaveCount(3);
    for (const id of ids) await page.locator(`#suite-cases input[value="${id}"]`).check();
    await page.locator('#suite-confirm').check();
    await page.locator('#suite-launch').click();
    await expect(page.locator('#suite-summary')).toContainText('2 passed', { timeout: 15000 });
    const popup = page.waitForEvent('popup');
    await page.locator('#suite-report-link').click();
    const report = await popup;
    await expect(report.locator('.suite-report-case')).toHaveCount(2);
    await expect(report.locator('.suite-report-case .offer')).toHaveCount(6);
    await expect(report.locator('.suite-report-screenshot')).toHaveCount(2);
    await report.close();
    await page.locator('#reset').click();
    await expect(page.locator('#request')).toHaveValue('');
    await expect(page.locator('#suite-history option')).toHaveCount(2);
    assert.deepEqual(errors, []);
    const closed = once(server, 'exit'); server.send('close'); await closed; server = null;
    await browser.close(); browser = null;
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const runId = `sf-lab-${now.toISOString().replace(/[-:.]/g, '')}-1234abcd`;
    const runDirectory = path.join(extracted, 'test-results', date, 'solution-finder/lab', runId);
    const discovery = command(process.execPath, [
      localRequire.resolve('@playwright/test/cli'), 'test', '--config',
      path.join(extracted, 'scripts/solution-finder/lab/playwright.config.js'), '--list'
    ], extracted, { ...env, SF_TENANT: 'gri', SF_LAB_RUN_DIR: runDirectory });
    assert.match(discovery, /Total: 1 test/);
    const result = { archive, sha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
      dependencyRestore: 'passed', moduleIsolation: 'passed', launcherAndUi: 'passed',
      templatePersistence: 'passed', twoCaseOfflineSuiteAndReport: 'passed',
      compiledWorkerDiscovery: '1 test', liveInquiriesCreated: 0, platform: process.platform };
    fs.writeFileSync(`${archive}.verification.json`, JSON.stringify(result, null, 2) + '\n');
    checkRepositoryRoot();
    return result;
  } finally {
    if (browser) await browser.close();
    if (server) { const closed = once(server, 'exit'); server.kill('SIGTERM'); await closed; }
    if (launcher) { launcher.kill('SIGINT'); await launcherClosed; }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (require.main === module) verifyPackage(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error); process.exitCode = 1; });

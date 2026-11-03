'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync, fork } = require('node:child_process');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
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
    const entries = command('unzip', ['-Z1', archive], directory).trim().split('\n');
    assert.ok(entries.every(name => name.startsWith('solution-finder-lab/') &&
      !name.split('/').includes('..') && !name.includes('\\')), 'Unsafe archive paths');
    assert.ok(!/^[bclps][rwxstST-]{9}\s/m.test(command('unzip', ['-Z', '-l', archive], directory)),
      'Archive symlinks/special files forbidden');
    command('unzip', ['-q', archive, '-d', directory], directory);
    const manifest = JSON.parse(fs.readFileSync(path.join(extracted, 'package.json')));
    assert.ok(['internal165', 'original125', 'synthetic5'].includes(manifest.sfLabCatalog), 'Unknown archive catalog');
    const includeScenarios = manifest.sfLabCatalog !== 'synthetic5';
    const includeProfiles = manifest.sfLabCatalog === 'internal165';
    const includeReferences = manifest.sfLabReferenceSource === 'ir-profile-offer-chart';
    assert.ok(!includeReferences || includeProfiles, 'References belong only to internal165');
    if (includeProfiles && ['1.4.0', '1.4.1'].includes(manifest.version)) assert.ok(includeReferences, 'Internal1.4 requires chart references');
    if (!includeReferences) assert.equal(manifest.sfLabReferenceSource, undefined);
    const irProfiles = new Map();
    assert.equal(manifest.sfLabProfileSource, includeScenarios ? 'tri-bureau-ir' : 'synthetic');
    const allScenarioFiles = require('./package.cjs').scenarioFiles;
    const scenarioFiles = !includeScenarios ? [] : allScenarioFiles.slice(0, includeReferences ? 4 : includeProfiles ? 3 : 2);
    const namedProfiles = includeProfiles
      ? JSON.parse(fs.readFileSync(path.join(extracted, allScenarioFiles[2]))).profiles : [];
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['@playwright/test', 'zod']);
    assert.equal(manifest.scripts.start, 'node launcher/start.cjs');
    for (const forbidden of ['.env', '.git', 'node_modules',
      'test-results', ...(!includeScenarios ? allScenarioFiles : []),
      ...(!includeProfiles ? [allScenarioFiles[2]] : []), ...(!includeReferences ? [allScenarioFiles[3]] : []),
      'test-data/solution-finder/IR_profile-offer-table.xlsx',
      'test-data/solution-finder/Tri_Bureau_40_Test_Profiles.xlsx',
      'test-data/solution-finder/workbook-scenarios/lab-templates']) {
      assert.equal(fs.existsSync(path.join(extracted, forbidden)), false, forbidden);
    }
    const { runtimeFiles, publicFiles } = require('./package.cjs');
    const allowed = [...runtimeFiles, ...scenarioFiles,
      ...publicFiles.map(name => `scripts/solution-finder/lab/public/${name}`),
      'launcher/start.cjs', 'README.md', 'package.json', 'package-lock.json'].sort();
    function filesIn(dir, base = dir) {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        assert.equal(entry.isSymbolicLink(), false, 'Archive symlinks forbidden');
        return entry.isDirectory() ? filesIn(file, base) : [path.relative(base, file).split(path.sep).join('/')];
      }).sort();
    }
    assert.deepEqual(filesIn(extracted), allowed, 'Archive must match explicit sanitized-input/runtime allowlist');
    if (includeScenarios) {
      for (const file of scenarioFiles) {
        assert.ok(fs.readFileSync(path.join(extracted, file)).equals(
          fs.readFileSync(path.join(__dirname, '../../..', file))), `Packaged scenario source differs: ${file}`);
      }
      assert.match(fs.readFileSync(path.join(extracted, 'README.md'), 'utf8'), /RESTRICTED INTERNAL QA/);
      const dataset = JSON.parse(fs.readFileSync(path.join(extracted, scenarioFiles[1])));
      const replacements = dataset.scenarios.filter(scenario => scenario.comparisonMode === 'actual-ui-api');
      assert.deepEqual(replacements.map(scenario => scenario.id),
        Array.from({ length: 52 }, (_, index) => `NSF-${String(index + 51).padStart(3, '0')}`),
        'Internal archive must contain all 52 explicit IR replacement slots');
      for (const scenario of replacements) {
        const number = Number(scenario.id.slice(4));
        const profileId = `TB-${String(number >= 63 ? number - 62 : number - 50).padStart(3, '0')}`;
        assert.equal(scenario.provenance.profileId, profileId, 'IR profile mapping differs');
        assert.equal(scenario.expectedResponse, undefined, 'Old response baseline must not be copied');
        assert.equal(scenario.expectedUi, undefined, 'Old UI baseline must not be copied');
        irProfiles.set(scenario.id, profileId);
      }
      assert.equal(new Set(irProfiles.values()).size, 40);
      for (const profile of namedProfiles) {
        irProfiles.set(profile.id, profile.id);
        assert.equal(profile.expectedResponse, undefined);
        assert.equal(profile.expectedUi, undefined);
        assert.match(profile.request.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN, /^\d{4}$/);
      }
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
      ...process.env, SF_LAB_PORTABLE: includeScenarios ? '0' : '1',
      SF_LAB_CATALOG: manifest.sfLabCatalog,
      SF_LAB_DISTRIBUTION: includeProfiles ? 'internal-165' : includeScenarios ? 'internal-125' : 'synthetic-5',
      NODE_OPTIONS: `--require="${path.join(extracted, 'launcher/verify-isolation.cjs')}"`
    };
    const expectedCases = JSON.parse(command(process.execPath, ['-e',
      "console.log(JSON.stringify(require('./scripts/solution-finder/lab/catalog.js').getLabCases()))"
    ], extracted, env));
    const references = includeReferences
      ? JSON.parse(fs.readFileSync(path.join(extracted, allScenarioFiles[3]), 'utf8')) : null;
    if (references) {
      const schemaCheck = command(process.execPath, ['-e',
        "const c=require('./scripts/solution-finder/lab/catalog.js'); if(!c.profileReferenceDatasetSchema.safeParse(c.profileReferenceDataset).success)process.exit(1); console.log('validated');"
      ], extracted, env);
      assert.match(schemaCheck, /validated/);
      assert.equal(references.profiles.length, 40);
      assert.deepEqual([...references.profiles.map(p => p.profileId)].sort(), namedProfiles.map(p => p.id).sort());
      for (const item of expectedCases) {
        const reference = references.profiles.find(p => p.profileId === item.id);
        if (!reference) assert.equal(Object.hasOwn(item, 'profileReference'), false, `${item.id}: unexpected reference`);
        else assert.deepEqual(item.profileReference, {
          ...reference, observedOn: references.observedOn, context: references.context,
          sourceWorkbook: references.sourceWorkbook, sourceSha256: references.sourceSha256
        });
      }
    }
    const expectedIds = includeScenarios
      ? [...Array.from({ length: 23 }, (_, index) => `SF-${index + 1}-Original`),
        ...Array.from({ length: 102 }, (_, index) => `NSF-${String(index + 1).padStart(3, '0')}`),
        ...namedProfiles.map(profile => profile.id)]
      : Array.from({ length: 5 }, (_, index) => `SF-DEMO-0${index + 1}`);
    assert.deepEqual(expectedCases.map(item => item.id), expectedIds);
    const { chromium, expect } = localRequire('@playwright/test');
    const reserve = net.createServer();
    reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
    const port = reserve.address().port;
    await new Promise(resolve => reserve.close(resolve));
    launcher = spawn(process.execPath, ['launcher/start.cjs'], {
      cwd: extracted, env: { ...env, SF_LAB_PORT: String(port),
        SF_LAB_PORTABLE: includeScenarios ? '1' : '0' }, stdio: ['ignore', 'pipe', 'pipe']
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
    await expect(page.locator('#scenario option')).toHaveCount(expectedCases.length + 1);
    await expect(page.locator('#server-notice')).toContainText(
      includeScenarios ? 'Restricted internal QA copy' : 'Standalone privacy-safe copy');
    if (includeScenarios) {
      await expect(page.locator('#scenario optgroup[label="Original 23 scenarios"] option')).toHaveCount(23);
      await expect(page.locator('#scenario optgroup[label="Additional 102 scenarios"] option')).toHaveCount(102);
      await expect(page.locator('#scenario optgroup[label="Synthetic starter scenarios"]')).toHaveCount(0);
      await expect(page.locator('#scenario optgroup[label="Tri-Bureau IR 40 profiles"] option')).toHaveCount(namedProfiles.length);
    } else {
      await expect(page.locator('#scenario optgroup[label="Synthetic starter scenarios"] option')).toHaveCount(5);
    }
    await expect(page.locator('#reset')).toBeEnabled();
    for (const { id, request: expectedRequest, notes: expectedNotes, profileReference } of expectedCases) {
      const profile = namedProfiles.find(profile => profile.id === id);
      if (profile) {
        const fullName = ['first', 'middle', 'last', 'suffix']
          .map(key => profile.request.applicationInquiryInput.basicInfoInput.name[key]).filter(Boolean).join(' ');
        assert.ok(isDeepStrictEqual(expectedRequest, profile.request), `${id}: normalized input differs`);
        assert.ok((await page.locator(`#scenario option[value="${id}"]`).innerText()).includes(fullName), `${id}: choice name missing`);
        assert.ok((await page.locator(`#suite-cases label`).filter({ has: page.locator(`input[value="${id}"]`) }).innerText()).includes(fullName), `${id}: suite name missing`);
        if (includeReferences) {
          const scores = ['TU', 'XPN', 'EFX'].map(b => `${b} ${profileReference.expectedFico[b] ?? 'N/A'}`).join(' / ');
          const pending = profileReference.offers.filter(o => o.status === 'Pending').length;
          const summary = `Chart SSN last 4 ${profileReference.lastFourSSN} | Source ${scores} | Prior offers: ${profileReference.eligibleProducts.join(', ') || 'None'}${pending ? `; ${pending} pending` : ''}`;
          assert.ok((await page.locator(`#scenario option[value="${id}"]`).innerText()).includes(summary), `${id}: dropdown reference summary missing`);
          assert.ok((await page.locator('#suite-cases label').filter({ has: page.locator(`input[value="${id}"]`) }).innerText()).includes(summary), `${id}: suite reference summary missing`);
        }
      }
      await page.locator('#scenario').selectOption(id);
      const loaded = page.waitForResponse(response => response.url().endsWith(`/api/cases/${id}`));
      await page.locator('#load').click();
      const response = await loaded;
      assert.equal(response.status(), 200, `${id}: Load failed`);
      const data = await response.json();
      assert.ok(isDeepStrictEqual(data.request, expectedRequest), `${id}: loaded input differs from catalog`);
      assert.ok(isDeepStrictEqual(data.notes, expectedNotes), `${id}: loaded notes differ from catalog`);
      if (includeReferences) {
        assert.ok(isDeepStrictEqual(data.profileReference, profileReference ?? null), `${id}: loaded reference differs`);
        if (!profileReference) await expect(page.locator('#profile-reference')).toBeHidden();
        else {
          await expect(page.locator('#profile-reference')).toBeVisible();
          await expect(page.locator('#profile-reference-title')).toHaveText(`${id} - IR chart reference`);
          await expect(page.locator('#profile-reference-context')).toContainText(references.context);
          await expect(page.locator('#profile-reference-context')).toContainText(`${path.basename(references.sourceWorkbook)} (${references.observedOn})`);
          const scoreLine = (values, missing = 'N/A') => ['TU', 'XPN', 'EFX'].map(b => `${b}: ${values[b] ?? missing}`).join(' / ');
          await expect(page.locator('#profile-reference-values dt')).toHaveText([
            'Chart SSN scenario (last four only)', 'Source workbook TU / XPN / EFX',
            'Previously returned TU / XPN / EFX', 'Previously returned usable credit score', 'Previously eligible offers'
          ]);
          await expect(page.locator('#profile-reference-values dd')).toHaveText([
            profileReference.lastFourSSN, scoreLine(profileReference.expectedFico), scoreLine(profileReference.returnedFico, 'Not returned'),
            profileReference.creditReturned ? 'Y' : 'N', profileReference.eligibleProducts.join(', ') || 'None'
          ]);
          await expect(page.locator('#profile-reference-offers tbody tr')).toHaveCount(profileReference.offers.length);
          const dollars = (value, decimals) => value.toLocaleString('en-US', {
            style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals
          });
          // Compare by product, never card/row order.
          for (const offer of profileReference.offers) {
            const row = page.locator('#profile-reference-offers tbody tr').filter({
              has: page.locator('td:first-child', { hasText: `${offer.product} /` })
            });
            await expect(row).toHaveCount(1);
            await expect(row.locator('td').nth(0)).toHaveText(`${offer.product} / ${offer.status}${offer.applicationType ? ` / ${offer.applicationType}` : ''}`);
            await expect(row.locator('td').nth(1)).toHaveText([
              offer.loanAmount == null ? null : `Amount: ${dollars(offer.loanAmount, 0)}`,
              offer.rate == null ? null : `Rate: ${offer.rate}%`,
              offer.apr == null ? null : `APR: ${offer.apr}%`,
              offer.term == null ? null : `Term: ${offer.term} years`,
              offer.monthlyPayment == null ? null : `Monthly: ${dollars(offer.monthlyPayment, 2)}`
            ].filter(v => v !== null).join('\n') || 'No priced offer returned');
            await expect(row.locator('td').nth(2)).toHaveText(offer.reasons.join('\n') || 'None returned');
          }
        }
      }
      await expect.poll(async () => (await page.locator('#request').inputValue()) ===
        JSON.stringify(data.request, null, 2), { message: `${id}: editor did not show loaded input` }).toBe(true);
      if (!includeScenarios) await expect(page.locator('#template-notice')).toContainText('Synthetic demo only');
      if (irProfiles.has(id)) await expect(page.locator('#template-notice')).toContainText(irProfiles.get(id));
      if (profile) {
        await expect(page.locator('#template-notice')).toContainText('not IR-certified');
        await page.locator(`#suite-cases input[value="${id}"]`).check();
        await expect(page.locator(`#suite-cases input[value="${id}"]`)).toBeChecked();
        await page.locator(`#suite-cases input[value="${id}"]`).uncheck();
      }
      const preview = page.waitForResponse(response => response.url().endsWith('/api/preview') && response.request().method() === 'POST');
      await page.locator('#validate').click();
      const previewResponse = await preview;
      assert.equal(previewResponse.status(), 200, `${id}: preview validation failed`);
      const name = ['first', 'middle', 'last', 'suffix']
        .map(key => data.request.applicationInquiryInput.basicInfoInput.name[key]).filter(Boolean).join(' ');
      try {
        await expect.poll(async () => (await page.locator('#preview').innerText()).includes(name),
          { message: `${id}: borrower preview missing` }).toBe(true);
      } catch {
        const previewData = await previewResponse.json();
        const checks = {
          apiNameMatches: previewData.parsed?.borrower === name,
          domTextMatches: (await page.locator('#preview').textContent()).includes(name),
          domNormalizedMatches: (await page.locator('#preview').innerText()).replace(/\s+/g, ' ').includes(name.replace(/\s+/g, ' ')),
          editorMatches: (await page.locator('#request').inputValue()) === JSON.stringify(previewData.request, null, 2),
          errorVisible: await page.locator('#error').isVisible()
        };
        throw new Error(`${id}: borrower preview missing (private values suppressed); ${JSON.stringify(checks)}`);
      }
      await expect(page.locator(`#suite-cases input[value="${id}"]`)).toBeEnabled();
    }
    if (includeProfiles) {
      await page.locator('#suite-group').selectOption('Tri-Bureau IR 40 profiles');
      await page.locator('#suite-select-group').click();
      await expect(page.locator('#suite-cases input:checked')).toHaveCount(40);
      await expect(page.locator('#suite-selection')).toContainText('40 scenario(s)');
      await page.locator('#suite-clear').click();
      await expect(page.locator('#suite-cases input:checked')).toHaveCount(0);
    }
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
    await expect(page.locator('#scenario option')).toHaveCount(expectedCases.length + 3);
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
      catalog: manifest.sfLabCatalog, catalogCount: expectedCases.length,
      profileSource: manifest.sfLabProfileSource,
      irReplacementSlots: includeScenarios ? 52 : 0,
      catalogInputs: 'all loaded and previewed; suite checkboxes enabled',
      namedIrProfiles: namedProfiles.length,
      chartReferences: references?.profiles.length ?? 0,
      chartReferenceOffers: references?.profiles.reduce((n, p) => n + p.offers.length, 0) ?? 0,
      scenarioSourceIntegrity: includeScenarios ? `${scenarioFiles.length} dataset files byte-identical to repository sources` : 'customer datasets excluded',
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

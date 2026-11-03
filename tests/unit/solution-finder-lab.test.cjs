const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const { chromium, expect } = require('@playwright/test');
const { createLabServer } = require('../../scripts/solution-finder/lab/server');
const { selectInquiryIncomeSource } = require('../projects/solution-finder/helpers/inquiry-form');
const { parseLabRequest, labDirectory, validateLabDirectory, parsedInput, parsedResponse, borrowerAge, root } = require('../../scripts/solution-finder/lab/contracts');
const { scenarios } = require('../projects/solution-finder/workbook-scenarios/helpers/contracts');
// Offline report fixture from an unchanged, approved workbook case; never an IR baseline.
const noOfferBaseline = scenarios.find(scenario => scenario.id === 'NSF-042').expectedResponse;
const { labCases, getLabCases } = require('../../scripts/solution-finder/lab/catalog');
const originalData = require('../../test-data/solution-finder/workbook-scenarios/original-scenarios.json');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { tmpdir } = require('node:os');
const fixture = () => structuredClone(scenarios[0].request);
const templateDirectories = [];
function templateDirectory() {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'sf-lab-templates-'));
  templateDirectories.push(directory);
  return directory;
}
test.after(() => {
  for (const directory of templateDirectories) fs.rmSync(directory, { recursive: true, force: true });
});

test('portable mode does not read or preload customer/workbook datasets', () => {
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', `
    const fs = require('node:fs');
    const read = fs.readFileSync;
    fs.readFileSync = function(file, ...args) {
      if (['original-scenarios.json','scenarios.json','profiles.json','profile-reference.json'].includes(require('node:path').basename(String(file)))) throw new Error('Forbidden dataset read');
      return read.call(this, file, ...args);
    };
    const { getLabCases } = require('./scripts/solution-finder/lab/catalog');
    const { scenarios } = require('./tests/projects/solution-finder/workbook-scenarios/helpers/contracts');
    const cases = getLabCases();
    if (cases.length !== 5 || cases.some(c => !c.id.startsWith('SF-DEMO-')) || scenarios.length) throw new Error('Only synthetic starters should be preloaded');
    const { parseLabRequest, borrowerAge } = require('./scripts/solution-finder/lab/contracts');
    for (const c of cases) {
      parseLabRequest(c.request);
      if (c.sourceRequest !== null || !c.notes[0].includes('Synthetic demo only')) throw new Error('Starter provenance missing');
      const basic = c.request.applicationInquiryInput.basicInfoInput;
      if (basic.emailId !== 'qa.demo@example.invalid' || basic.name.first !== 'Demo') throw new Error('Unexpected starter identity');
    }
    for (const today of [new Date(2026,11,31), new Date(2027,0,1)]) {
      const underage = getLabCases(today).find(c => c.id === 'SF-DEMO-05');
      if (borrowerAge(underage.request.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth,today) !== 17) throw new Error('Underage starter aged out');
    }
    console.log('Portable mode loaded without reading customer inputs.');
  `], { cwd: root, env: { ...process.env, SF_LAB_PORTABLE: '1' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /without reading customer inputs/);
});

test('legacy original125 catalog marker does not add profiles or reinterpret an older archive', () => {
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', `
    const fs = require('node:fs'), read = fs.readFileSync;
    fs.readFileSync = function(file, ...args) {
      if (['profiles.json','profile-reference.json'].includes(require('node:path').basename(String(file)))) throw new Error('Legacy catalog read added private dataset');
      return read.call(this, file, ...args);
    };
    const cases = require('./scripts/solution-finder/lab/catalog').getLabCases();
    if (cases.length !== 125 || cases.some(c => c.id.startsWith('TB-'))) throw new Error('Legacy catalog changed');
  `], { cwd: root, env: { ...process.env, SF_LAB_PORTABLE: '0', SF_LAB_CATALOG: 'original125' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('internal inquiry data packaging is explicit and restricted to four sanitized catalog files', () => {
  const { buildPortableLab, scenarioFiles } = require('../../scripts/solution-finder/lab/package.cjs');
  assert.deepEqual(scenarioFiles, [
    'test-data/solution-finder/workbook-scenarios/original-scenarios.json',
    'test-data/solution-finder/workbook-scenarios/scenarios.json',
    'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profiles.json',
    'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profile-reference.json'
  ]);
  assert.throws(() => buildPortableLab({ includeScenarios: 'true' }), /must be a boolean/);
  for (const args of [['--include-scenraios'], ['--include-scenarios', 'extra']]) {
    const result = spawnSync(process.execPath, ['scripts/solution-finder/lab/package.cjs', ...args],
      { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Use npm run package:solution-finder:lab/);
  }
});

test('lab catalog preserves original23 and all102 inputs with visible IR migration context', () => {
  assert.equal(labCases.length, 165);
  assert.equal(new Set(labCases.map(item => item.id)).size, 165);
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, originalData.sourceWorkbook))).digest('hex'),
    originalData.sourceSha256);
  assert.equal(originalData.scenarios.filter(item => item.sourceRequest).length, 22);
  for (const [index, original] of originalData.scenarios.entries()) {
    const item = labCases[index];
    assert.equal(item.id, `SF-${index + 1}-Original`);
    assert.equal(item.name, original.name);
    assert.equal(item.group, 'Original 23 scenarios');
    if (item.id === 'SF-22-Original') {
      assert.equal(original.sourceRequest, null);
      assert.equal(original.request, null);
      assert.equal(item.sourceRequest, null);
      const request = structuredClone(labCases[0].request);
      const dob = `${new Date().getFullYear() - 17}-01-01`;
      request.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = dob;
      if (request.applicationInquiryInput.basicInfoInput.residenceStartDate < dob) {
        request.applicationInquiryInput.basicInfoInput.residenceStartDate = dob;
      }
      assert.deepEqual(item.request, request);
      assert.doesNotThrow(() => parseLabRequest(item.request));
      assert.ok(item.notes.some(note => note.includes('User authorized a generated under-18')));
      continue;
    }
    if (!item.request) continue;
    const source = item.sourceRequest.applicationInquiryInput;
    const mapped = item.request.applicationInquiryInput;
    assert.deepEqual(mapped.basicInfoInput.name, source.basicInfoInput.name);
    assert.deepEqual(mapped.basicInfoUpdateInput, item.id === 'SF-12-Original'
      ? { ...source.basicInfoUpdateInput, dateOfBirth: '1950-01-01' } : source.basicInfoUpdateInput);
    assert.deepEqual(mapped.incomeInput, source.incomeInput);
    assert.equal(mapped.propertyInputHeloc.requestedLoanAmount, source.propertyInputHeloc.requestedLoanAmount);
    assert.equal(mapped.propertyInputHeloc.type, source.propertyInputHeloc.type);
    assert.equal(mapped.existingMortgageAmount, source.existingMortgageAmount);
    for (const [actual, expected] of [
      [mapped.propertyInputHeloc.address, source.propertyInputHeloc.address],
      [mapped.basicInfoInput.residenceAddress, source.basicInfoInput.residenceAddress]
    ]) for (const field of ['street', 'city', 'region', 'postalCode', 'country']) assert.deepEqual(actual[field], expected[field]);
    if (item.id === 'SF-12-Original') {
      assert.equal(mapped.incomeInput[0].incomeSource, 'RETIRED_SSI');
      assert.equal(mapped.incomeInput[0].incomeType, 'SOCIAL_SECURITY');
      assert.doesNotThrow(() => parseLabRequest(item.request));
      assert.equal(source.basicInfoUpdateInput.dateOfBirth, '1962-01-02');
      assert.ok(item.notes.some(note => note.includes('User-authorized DOB correction')));
    } else assert.doesNotThrow(() => parseLabRequest(item.request), item.id);
  }
  assert.notEqual(labCases[21].request, null);
  assert.ok(labCases[21].notes.some(note => note.includes('N/A')));
  for (const [index, existing] of scenarios.entries()) {
    assert.equal(labCases[index + 23].id, existing.id);
    assert.equal(labCases[index + 23].name, existing.name);
    assert.deepEqual(labCases[index + 23].request, existing.request);
    const notes = labCases[index + 23].notes;
    if (index < 50) assert.deepEqual(notes, []);
    else {
      assert.ok(notes.some(note => note.includes(existing.provenance.profileId)));
      assert.ok(notes.some(note => note.includes('DOB') && note.includes('not IR-certified')));
      assert.ok(notes.some(note => note.includes('pending approved variant baseline')));
      assert.ok(notes.includes(existing.notes.find(note => note.includes('PRIMARY requires') || note.includes('Subject property and financial inputs retained'))));
    }
  }
});

test('lab input validates supported browser fields without discarding unknown or unrepresentable data', () => {
  for (const scenario of scenarios) assert.deepEqual(parseLabRequest(scenario.request), scenario.request, scenario.id);
  const parsed = parseLabRequest(fixture());
  assert.deepEqual(parsed, fixture());
  const changes = [
    input => { input.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = '2026-02-30'; },
    input => { input.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = '2099-01-01'; },
    input => { input.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN = '123'; },
    input => { input.applicationInquiryInput.incomeInput[0].annualIncome = 50.25; },
    input => { input.applicationInquiryInput.incomeInput[0].incomeSource = 'RETIRED'; },
    input => { input.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = -1; },
    input => { input.applicationInquiryInput.propertyInputHeloc.address.country = 'CA'; },
    input => { input.applicationInquiryInput.basicInfoInput.name.first = ''; },
    input => { input.applicationInquiryInput.unknownField = true; },
    input => { input.applicationInquiryInput.basicInfoInput.extraBorrower = {}; }
  ];
  for (const change of changes) {
    const request = fixture(); change(request);
    assert.throws(() => parseLabRequest(request));
  }
});

test('shared automation selects the exact native/custom income source and never substitutes an available option', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const sources = [
      ['EMPLOYED_FULL_TIME', 'Employed full-time'], ['EMPLOYED_PART_TIME', 'Employed part-time'],
      ['SELF_EMPLOYED', 'Self-employed'], ['RETIRED_SSI', 'Retired SSI']
    ];
    await page.setContent('<div id="native"><select></select></div><div id="primary"><button>Choose</button></div><div id="additional"><button>Choose</button></div>');
    await page.evaluate(sources => {
      for (const [source, label] of sources) document.querySelector('#native select').append(new Option(label, source));
      for (const id of ['primary', 'additional']) {
        const trigger = document.querySelector(`#${id} button`);
        trigger.setAttribute('aria-haspopup', 'listbox');
        const menu = document.createElement('div'); menu.setAttribute('role', 'listbox'); menu.hidden = true;
        trigger.addEventListener('click', () => { menu.hidden = false; });
        for (const [, label] of sources) {
          const option = document.createElement('button'); option.setAttribute('role', 'option'); option.textContent = label;
          option.addEventListener('click', () => { trigger.textContent = label; menu.hidden = true; });
          menu.append(option);
        }
        document.body.append(menu);
      }
    }, sources);
    for (const [source, label] of sources) {
      await selectInquiryIncomeSource(page, page.locator('#native'), source);
      await expect(page.locator('#native select')).toHaveValue(source);
      await selectInquiryIncomeSource(page, page.locator('#primary'), source);
      await expect(page.locator('#primary button')).toHaveText(label);
    }
    await selectInquiryIncomeSource(page, page.locator('#additional'), 'RETIRED_SSI');
    await expect(page.locator('#additional button')).toHaveText('Retired SSI');
    await assert.rejects(selectInquiryIncomeSource(page, page.locator('#primary'), 'UNKNOWN'), /Unsupported inquiry income source/);
    await page.setContent('<div id="missing"><button aria-haspopup="listbox" onclick="document.querySelector(\'[role=listbox]\').hidden=false">Choose</button></div><div role="listbox" hidden><button role="option" onclick="document.querySelector(\'#missing button\').textContent=this.textContent">Employed full-time</button></div>');
    await assert.rejects(selectInquiryIncomeSource(page, page.locator('#missing'), 'RETIRED_SSI'), /Retired SSI/);
    await expect(page.locator('#missing button')).toHaveText('Choose');
  } finally { await browser.close(); }
});

test('calendar age changes on birthdays, including year/leap boundaries, not approximate elapsed days', () => {
  for (const [dob, today, expected] of [
    ['1964-07-01', '2026-06-30', 61], ['1964-07-01', '2026-07-01', 62], ['1964-07-01', '2026-07-02', 62],
    ['1964-02-29', '2026-02-28', 61], ['1964-02-29', '2026-03-01', 62],
    ['1964-01-01', '2025-12-31', 61], ['1964-01-01', '2026-01-01', 62],
    ['2009-11-03', '2027-11-02', 17], ['2009-11-03', '2027-11-03', 18],
    ['1950-01-01', '2026-11-02', 76], ['1950-01-01', '2027-01-01', 77]
  ]) {
    const [year, month, day] = today.split('-').map(Number);
    for (const hour of [0, 23]) assert.equal(borrowerAge(dob, new Date(year, month - 1, day, hour)), expected);
  }
  for (const today of [new Date(2026, 11, 31, 23), new Date(2027, 0, 1, 0), new Date(2028, 1, 29, 0)]) {
    const request = getLabCases(today).find(item => item.id === 'SF-22-Original').request;
    assert.equal(borrowerAge(request.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth, today), 17);
  }
});

test('Retired SSI validation requires current-calendar age 62+ and Social Security without changing employment inputs', () => {
  const retired = structuredClone(labCases[11].request);
  assert.deepEqual(parseLabRequest(retired), retired);
  for (const type of [null, undefined, 'PENSION']) {
    const input = structuredClone(retired);
    input.applicationInquiryInput.incomeInput[0].incomeType = type;
    assert.throws(() => parseLabRequest(input), /incomeType|SOCIAL_SECURITY/);
  }
  const young = structuredClone(retired);
  young.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = `${new Date().getFullYear() - 61}-01-01`;
  assert.throws(() => parseLabRequest(young), /62nd birthday/);
  const employment = fixture();
  employment.applicationInquiryInput.incomeInput[0].incomeType = 'SOCIAL_SECURITY';
  assert.throws(() => parseLabRequest(employment), /must be null or omitted/);
  const multiple = fixture();
  multiple.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth = '1950-01-01';
  multiple.applicationInquiryInput.incomeInput.push(retired.applicationInquiryInput.incomeInput[0]);
  assert.deepEqual(parseLabRequest(multiple), multiple);
});

test('lab directories cannot escape dated Solution Finder evidence and parsed offers retain real identifiers', () => {
  const id = 'sf-lab-20261031T030000000Z-1234abcd';
  const directory = labDirectory(id, '2026-10-30');
  assert.equal(validateLabDirectory(directory), directory);
  for (const file of [root, path.join(root, 'test-results'), '/tmp/result', path.join(root, 'test-data/solution-finder/lab')]) {
    assert.throws(() => validateLabDirectory(file));
  }
  assert.throws(() => labDirectory('../elsewhere', '2026-10-30'));
  const parsed = parsedResponse(scenarios[0].expectedResponse);
  assert.equal(parsed.eligibleOfferCount, 3);
  assert.equal(parsed.inquiryId, scenarios[0].expectedResponse.inquiryId);
  assert.ok(parsed.offers.find(offer => offer.product === 'HELOAN').internalAppId);
  assert.equal(parsedResponse(noOfferBaseline).eligibleOfferCount, 0);
});

test('parsed input uses explicit first/middle/last name order and preserves SSN last-four strings', () => {
  const request = structuredClone(labCases[0].request);
  const parsed = parsedInput(parseLabRequest(request));
  assert.equal(parsed.borrower, ['first', 'middle', 'last', 'suffix']
    .map(key => request.applicationInquiryInput.basicInfoInput.name[key]).filter(Boolean).join(' '));
  assert.equal(parsed.lastFourSSN, '2955');
  assert.equal(parsed.existingMortgage, 70000);
  assert.equal(parsed.requestedAmount, 200000);
  assert.equal(parsed.annualIncome, 444444);
  request.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN = '0042';
  assert.equal(parsedInput(parseLabRequest(request)).lastFourSSN, '0042');
});

async function fixtureLab(work, settings = {}) {
  const directories = [];
  const suiteDirectories = [];
  const templates = templateDirectory();
  let launches = 0;
  let running = 0;
  let maxRunning = 0;
  const lab = createLabServer({
    templateDirectory: templates,
    launch(directory) {
      directories.push(directory); launches++;
      if (settings.launchErrorAt === launches) throw new Error('Simulated launch failure');
      const artifacts = path.join(directory, 'artifacts/local-fixture');
      fs.mkdirSync(artifacts, { recursive: true });
      const input = JSON.parse(fs.readFileSync(path.join(directory, 'input.json')));
      const actualRequest = structuredClone(input.request);
      if (settings.submittedEmail) actualRequest.applicationInquiryInput.basicInfoInput.emailId = settings.submittedEmail;
      const response = settings.responseFor ? settings.responseFor(input.request) : settings.response || scenarios[0].expectedResponse;
      const write = (name, value) => fs.writeFileSync(path.join(artifacts, name), JSON.stringify(value));
      const fail = settings.fail || settings.failAt === launches;
      write('run-result.json', { status: fail ? 'FAIL' : 'PASS', error: fail ? 'Simulated UI/API mismatch' : undefined,
        comparisonMode: 'actual-ui-api', inquiryId: response.inquiryId,
        email: actualRequest.applicationInquiryInput.basicInfoInput.emailId, navigatorUrl: `https://falcon.qa.fsp.rate.com/inquiry/prequalify?id=${response.inquiryId}` });
      write('actual-inquiry-request.json', actualRequest);
      write('actual-inquiry-response.json', response);
      write('actual-ui-offers.json', { cards: [], ui: 'Offline server fixture, not a live run' });
      write('comparison.json', { uiApi: [], apiBaseline: [], uiBaseline: [] });
      fs.writeFileSync(path.join(artifacts, 'offers.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64'));
      running++; maxRunning = Math.max(maxRunning, running);
      const child = spawn(process.execPath, ['-e', `console.log("Offline test worker"); setTimeout(() => process.exit(${fail ? 1 : 0}), ${settings.delay ?? 400})`], { stdio: ['ignore', 'pipe', 'pipe'] });
      child.once('close', () => { running--; });
      return child;
    }
  });
  await new Promise(resolve => lab.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${lab.server.address().port}`;
  const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
  const post = async (url, body, headers = {}) => {
    const response = await fetch(base + url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SF-Lab-Token': bootstrap.token, ...headers },
      body: JSON.stringify(body)
    });
    if (url === '/api/suites' && response.status === 202) {
      const { suite } = await response.clone().json();
      const state = JSON.parse(fs.readFileSync(path.join(directories.at(-1), 'lab-run.json')));
      suiteDirectories.push(path.join(root, 'test-results', state.date, 'solution-finder/lab', suite.id));
    }
    return response;
  };
  try { await work({ lab, base, bootstrap, post, launches: () => launches, maxRunning: () => maxRunning, directories, suiteDirectories, templates }); }
  finally {
    if (lab.server.listening) await lab.close();
    for (const directory of directories) {
      assert.equal(validateLabDirectory(directory), directory);
      fs.rmSync(directory, { recursive: true });
    }
    for (const directory of suiteDirectories) {
      assert.match(path.basename(directory), /^sf-suite-\d{8}T\d{9}Z-[a-f0-9]{8}$/);
      assert.equal(path.basename(path.dirname(directory)), 'lab');
      fs.rmSync(directory, { recursive: true });
    }
  }
}

test('all40 normalized IR profiles are separate named single/suite choices with exact source inputs and no baselines', async () => {
  const file = path.join(root, 'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profiles.json');
  const before = fs.readFileSync(file);
  const profiles = JSON.parse(before).profiles;
  await fixtureLab(async ({ base, bootstrap, post, launches }) => {
    const cases = labCases.slice(125);
    assert.equal(cases.length, 40);
    assert.equal(bootstrap.cases.filter(item => item.group === 'Tri-Bureau IR 40 profiles').length, 40);
    for (const [index, profile] of profiles.entries()) {
      const item = cases[index];
      assert.equal(item.id, `TB-${String(index + 1).padStart(3, '0')}`);
      const fullName = ['first', 'middle', 'last', 'suffix']
        .map(key => profile.request.applicationInquiryInput.basicInfoInput.name[key]).filter(Boolean).join(' ');
      // Boolean assertions deliberately keep private identity/input values out of console failures.
      assert.ok(item.name === fullName, `${item.id}: full name differs`);
      assert.ok(isDeepStrictEqual(item.request, profile.request), `${item.id}: normalized setup differs`);
      assert.equal(item.sourceRequest, null);
      for (const key of ['expectedResponse', 'expectedUi']) assert.equal(item[key], undefined);
      assert.match(item.request.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN, /^\d{4}$/);
      const response = await fetch(`${base}/api/cases/${item.id}`);
      assert.equal(response.status, 200);
      const loaded = await response.json();
      assert.ok(isDeepStrictEqual(loaded.request, profile.request), `${item.id}: HTTP input differs`);
      const preview = await post('/api/preview', { request: loaded.request });
      assert.equal(preview.status, 200);
      const data = await preview.json();
      assert.ok(data.parsed.borrower === fullName, `${item.id}: preview name differs`);
      assert.ok(data.parsed.lastFourSSN === profile.request.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN,
        `${item.id}: last-four differs`);
      assert.ok(item.notes.some(note => note.includes('not IR-certified')));
      assert.ok(item.notes.some(note => note.includes('irrespective of screening outcome')));
    }
    assert.equal(launches(), 0);
  });
  assert.ok(fs.readFileSync(file).equals(before), 'Normalized source was rewritten');
});

test('custom PRIMARY subject edits map preview/JSON/residence without mutation; other occupancies retain residence', async () => {
  const sourceFiles = [
    'original-scenarios.json', 'scenarios.json', 'tri-bureau-40/profiles.json'
  ].map(file => path.join(root, 'test-data/solution-finder/workbook-scenarios', file));
  const sourceBytes = sourceFiles.map(file => fs.readFileSync(file));
  const custom = structuredClone(require('../../test-data/solution-finder/portable-scenarios.json').baseRequest);
  const subject = { street: ['876 Custom Subject Way', 'Unit 7'], city: 'Testville', region: 'AZ', postalCode: '85001', country: 'US' };
  const residence = { street: ['321 Separate Residence Rd'], city: 'Demoville', region: 'CA', postalCode: '90210', country: 'US' };
  custom.applicationInquiryInput.propertyInputHeloc.address = subject;
  custom.applicationInquiryInput.basicInfoInput.residenceAddress = residence;
  await fixtureLab(async ({ base, post, launches, directories }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(base);
      for (const occupancy of ['SECONDARY', 'INVESTMENT', 'PRIMARY']) {
        custom.applicationInquiryInput.propertyInputHeloc.type = occupancy;
        const before = structuredClone(custom);
        const parsed = parseLabRequest(custom);
        const expected = occupancy === 'PRIMARY' ? subject : residence;
        assert.deepEqual(parsed.applicationInquiryInput.basicInfoInput.residenceAddress, expected);
        assert.notEqual(parsed.applicationInquiryInput.basicInfoInput.residenceAddress,
          parsed.applicationInquiryInput.propertyInputHeloc.address);
        assert.deepEqual(custom, before);
        const response = await post('/api/preview', { request: custom });
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.deepEqual(data.request, parsed);
        assert.deepEqual(data.parsed.subjectProperty, subject);
        assert.deepEqual(data.parsed.primaryResidence, expected);
        assert.equal(data.notes.some(note => note.startsWith('PRIMARY occupancy:')), occupancy === 'PRIMARY');
        await page.locator('#request').fill(JSON.stringify(custom));
        await expect(page.getByLabel('Occupancy Type', { exact: true })).toHaveValue(occupancy);
        await page.locator('#validate').click();
        await expect(page.getByRole('alert')).toBeHidden();
        await expect(page.locator('#preview')).toContainText(`Borrower Address = ${expected.street.join(', ')}`);
        await expect.poll(async () => isDeepStrictEqual(JSON.parse(await page.locator('#request').inputValue()), parsed)).toBe(true);
      }
      await page.getByLabel('Occupancy Type', { exact: true }).selectOption('SECONDARY');
      await expect(page.locator('#editor-notice')).not.toContainText('For PRIMARY');
      await page.getByLabel('Occupancy Type', { exact: true }).selectOption('PRIMARY');
      await expect(page.locator('#editor-notice')).toContainText('validation updates');
      await page.getByLabel('Subject street line 1', { exact: true }).fill('999 Newly Edited Subject Ave');
      // Reproduce the custom-edit state: residence still holds the previous address until validation.
      await expect(page.getByLabel('Borrower street line 1', { exact: true })).toHaveValue(subject.street[0]);
      const beforeValidation = JSON.parse(await page.locator('#request').inputValue()).applicationInquiryInput;
      assert.equal(beforeValidation.basicInfoInput.residenceAddress.street[0], subject.street[0]);
      assert.equal(beforeValidation.propertyInputHeloc.address.street[0], '999 Newly Edited Subject Ave');
      const evidence = path.join(root, 'test-results/2026-11-02/solution-finder/lab/custom-primary');
      fs.mkdirSync(evidence, { recursive: true });
      await page.locator('#request-fields').screenshot({ path: path.join(evidence, 'before-validation.png') });
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toBeHidden();
      await expect(page.locator('#preview')).toContainText('Borrower Address = 999 Newly Edited Subject Ave');
      await expect(page.getByLabel('Borrower street line 1', { exact: true })).toHaveValue('999 Newly Edited Subject Ave');
      await expect(page.locator('#notes')).toContainText('PRIMARY occupancy:');
      const edited = JSON.parse(await page.locator('#request').inputValue()).applicationInquiryInput;
      assert.deepEqual(edited.basicInfoInput.residenceAddress, edited.propertyInputHeloc.address);
      assert.equal(edited.propertyInputHeloc.address.street[0], '999 Newly Edited Subject Ave');
      assert.equal(launches(), 0);
      await page.locator('#template-name').fill('Synthetic custom PRIMARY mapping');
      await page.locator('#save-template').click();
      await expect(page.locator('#save-status')).toContainText('Saved');
      const savedId = await page.locator('#scenario').inputValue();
      await page.reload();
      await page.locator('#scenario').selectOption(savedId);
      await page.locator('#load').click();
      await expect(page.getByLabel('Borrower street line 1', { exact: true })).toHaveValue('999 Newly Edited Subject Ave');
      assert.deepEqual(JSON.parse(await page.locator('#request').inputValue()).applicationInquiryInput, edited);
      await page.locator('#validate').click();
      await expect(page.locator('#notes')).toContainText('PRIMARY occupancy:');
      await page.locator('#fresh-email').uncheck();
      await page.locator('#confirm').check();
      await page.locator('#launch').click();
      await expect(page.locator('#status')).toHaveText('PASSED', { timeout: 15000 });
      assert.equal(launches(), 1);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directories[0], 'input.json'))).request.applicationInquiryInput, edited);
    } finally { await browser.close(); }
  });
  for (const [index, file] of sourceFiles.entries()) assert.ok(fs.readFileSync(file).equals(sourceBytes[index]), 'Original input rewritten');
});

test('lab HTTP routes enforce tenant allowlist, same-origin token, confirmation and strict input validation', async () => {
  await fixtureLab(async ({ base, bootstrap, post, launches }) => {
    assert.equal(bootstrap.tenants.length, 5);
    assert.equal(bootstrap.cases.length, 165);
    assert.equal(bootstrap.cases[0].id, 'SF-1-Original');
    assert.equal(bootstrap.cases[22].id, 'SF-23-Original');
    for (const item of labCases.slice(0, 23)) {
      const response = await fetch(`${base}/api/cases/${item.id}`);
      assert.equal(response.status, 200);
      const loaded = await response.json();
      assert.deepEqual(loaded.request, item.request);
      assert.deepEqual(loaded.sourceRequest, item.sourceRequest);
      assert.deepEqual(loaded.notes, item.notes);
    }
    assert.equal((await fetch(base + '/api/cases/SF-24-Original')).status, 404);
    const valid = { tenant: 'gri', request: fixture(), confirmed: true };
    assert.equal((await post('/api/runs', { ...valid, tenant: 'prod' })).status, 400);
    assert.equal((await post('/api/runs', { ...valid, confirmed: false })).status, 400);
    assert.equal((await post('/api/runs', valid, { 'X-SF-Lab-Token': 'wrong' })).status, 403);
    assert.equal((await post('/api/runs', valid, { Origin: 'https://other.example' })).status, 403);
    const wrongHostStatus = await new Promise((resolve, reject) => {
      http.get(base + '/api/bootstrap', { headers: { Host: 'attacker.example' } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    assert.equal(wrongHostStatus, 403);
    assert.equal((await post('/api/preview', { request: { unsupported: true } })).status, 400);
    const preview = await post('/api/preview', { request: fixture() });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).parsed.requestedAmount, 75000);
    assert.equal(launches(), 0);
  });
});

test('suite and inquiry tenant selectors synchronize all five choices, routing and authorization in both directions', async () => {
  await fixtureLab(async ({ base, bootstrap, launches }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(base);
      await expect(page.locator('#suite-tenant option')).toHaveCount(5);
      await expect(page.locator('#suite-tenant')).toHaveValue('gri');
      await page.locator('#suite-cases input[value="NSF-001"]').check();
      for (const selector of ['suite-tenant', 'tenant']) {
        for (const tenant of bootstrap.tenants) {
          await page.locator('#confirm').check();
          await page.locator('#suite-confirm').check();
          await page.locator(`#${selector}`).selectOption(tenant.tenant);
          await expect(page.locator('#tenant')).toHaveValue(tenant.tenant);
          await expect(page.locator('#suite-tenant')).toHaveValue(tenant.tenant);
          await expect(page.locator('#entry')).toHaveAttribute('href', tenant.intakeUrl);
          await expect(page.locator('#suite-selection')).toContainText(`Tenant: ${tenant.tenant.toUpperCase()}`);
          await expect(page.locator('#confirm')).not.toBeChecked();
          await expect(page.locator('#suite-confirm')).not.toBeChecked();
          await expect(page.locator('#suite-cases input[value="NSF-001"]')).toBeChecked();
          await expect(page.locator('#suite-launch')).toBeDisabled();
        }
      }
      assert.equal(launches(), 0);
    } finally { await browser.close(); }
  });
});

test('suite prevalidation rejects invalid, unknown or unauthorized selections before any inquiry', async () => {
  await fixtureLab(async ({ post, bootstrap, launches, suiteDirectories }) => {
    const valid = { tenant: 'gri', caseIds: ['NSF-001', 'NSF-002'], confirmed: true };
    for (const [body, headers, status] of [
      [valid, { 'X-SF-Lab-Token': 'wrong' }, 403],
      [valid, { Origin: 'https://other.example' }, 403],
      [{ ...valid, confirmed: false }, {}, 400],
      [{ ...valid, tenant: 'prod' }, {}, 400],
      [{ ...valid, caseIds: [] }, {}, 400],
      [{ ...valid, caseIds: ['NSF-001', 'NSF-001'] }, {}, 400],
      [{ ...valid, caseIds: ['NSF-001', 'missing'] }, {}, 400]
    ]) assert.equal((await post('/api/suites', body, headers)).status, status);
    assert.equal(bootstrap.cases.filter(item => item.runnable).length, 165);
    assert.equal(bootstrap.cases.find(item => item.id === 'SF-12-Original').runnable, true);
    assert.equal(bootstrap.cases.find(item => item.id === 'SF-22-Original').runnable, true);
    assert.equal(launches(), 0);
    assert.equal(suiteDirectories.length, 0);
  });
});

test('SF-12 editor, templates and suites preserve corrected DOB and actual Social Security mapping', async () => {
  await fixtureLab(async ({ base, post, directories }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(base);
      await expect(page.locator('#load')).toBeEnabled();
      await page.locator('#scenario').selectOption('SF-12-Original');
      await page.locator('#load').click();
      await expect(page.getByLabel('Borrower date of birth', { exact: true })).toHaveValue('1950-01-01');
      await expect(page.locator('#source-request')).toContainText('1962-01-02');
      await expect(page.getByLabel('Income 1 type', { exact: true })).toHaveValue('SOCIAL_SECURITY');
      await expect(page.getByLabel('Income 1 type', { exact: true }).locator('option:checked')).toHaveText('Social Security');
      await page.getByLabel('Income 1 source', { exact: true }).selectOption('EMPLOYED_FULL_TIME');
      await expect(page.getByLabel('Income 1 type', { exact: true })).toHaveValue('');
      await page.getByLabel('Income 1 source', { exact: true }).selectOption('RETIRED_SSI');
      await expect(page.getByLabel('Income 1 type', { exact: true })).toHaveValue('SOCIAL_SECURITY');
      await page.locator('#validate').click();
      await expect(page.locator('#error')).toBeHidden();
      await page.locator('#template-name').fill('Retired SSI reviewed variation');
      await page.locator('#save-template').click();
      await expect(page.locator('#save-status')).toContainText('Saved');
      const savedId = await page.locator('#scenario').inputValue();
      const { suite } = await (await post('/api/suites', {
        tenant: 'gri', caseIds: ['SF-12-Original', savedId], confirmed: true
      })).json();
      await expect.poll(async () => (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status).toBe('passed');
      for (const directory of directories) {
        const input = JSON.parse(fs.readFileSync(path.join(directory, 'input.json'))).request.applicationInquiryInput;
        assert.equal(input.basicInfoUpdateInput.dateOfBirth, '1950-01-01');
        assert.equal(input.incomeInput[0].incomeSource, 'RETIRED_SSI');
        assert.equal(input.incomeInput[0].incomeType, 'SOCIAL_SECURITY');
      }
      assert.equal(directories.length, 2);
      await page.getByLabel('Borrower date of birth', { exact: true }).fill('2000-01-01');
      await page.locator('#validate').click();
      await expect(page.locator('#error')).toContainText('62nd birthday');
    } finally { await browser.close(); }
  });
});

test('SF-22 generated underage input can run singly and in a suite without changing missing workbook source', async () => {
  await fixtureLab(async ({ base, post, directories }) => {
    const loaded = await (await fetch(`${base}/api/cases/SF-22-Original`)).json();
    const dob = loaded.request.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth;
    const birthday = new Date(`${dob}T00:00:00Z`);
    const now = new Date();
    const age = now.getUTCFullYear() - birthday.getUTCFullYear() -
      (now.toISOString().slice(5, 10) < dob.slice(5, 10) ? 1 : 0);
    assert.equal(age, 17);
    assert.equal(loaded.sourceRequest, null);
    assert.equal((await post('/api/preview', { request: loaded.request })).status, 200);
    const { run } = await (await post('/api/runs', { tenant: 'gri', request: loaded.request, confirmed: true })).json();
    await expect.poll(async () => (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run.status).toBe('passed');
    const { suite } = await (await post('/api/suites', {
      tenant: 'gri', caseIds: ['SF-22-Original'], confirmed: true
    })).json();
    await expect.poll(async () => (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status).toBe('passed');
    assert.equal(directories.length, 2);
    for (const directory of directories) {
      const saved = JSON.parse(fs.readFileSync(path.join(directory, 'input.json')));
      assert.equal(saved.request.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth, dob);
    }
    assert.equal(originalData.scenarios[21].request, null);
    assert.equal(originalData.scenarios[21].sourceRequest, null);
  });
});

test('suite executes immutable saved inputs sequentially and persists combined results, evidence and restart history', async () => {
  await fixtureLab(async ({ base, post, launches, maxRunning, directories, suiteDirectories, templates }) => {
    const customRequest = fixture();
    customRequest.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = 123456;
    const { template } = await (await post('/api/templates', { name: 'Suite custom scenario', request: customRequest })).json();
    const { suite } = await (await post('/api/suites', {
      tenant: 'owning', caseIds: ['SF-1-Original', template.id, 'NSF-002'], confirmed: true, preserveEmail: true
    })).json();
    assert.equal(suite.status, 'running');
    assert.equal(suite.counts.running, 1);
    assert.equal(suite.counts.pending, 2);
    assert.throws(() => createLabServer({ templateDirectory: templates }), /still owned by process/);
    assert.equal((await post('/api/runs', { tenant: 'gri', request: fixture(), confirmed: true })).status, 409);
    assert.equal((await post('/api/suites', { tenant: 'gri', caseIds: ['NSF-003'], confirmed: true })).status, 409);
    const file = path.join(templates, `${template.id}.json`);
    const stored = JSON.parse(fs.readFileSync(file));
    stored.request.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = 654321;
    fs.writeFileSync(file, JSON.stringify(stored));
    await expect.poll(async () => (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status).toBe('passed');
    const saved = (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite;
    assert.equal(launches(), 3); assert.equal(maxRunning(), 1);
    assert.equal(saved.counts.passed, 3);
    assert.deepEqual(saved.items.map(item => item.caseId), ['SF-1-Original', template.id, 'NSF-002']);
    assert.deepEqual(directories.map(directory => JSON.parse(fs.readFileSync(path.join(directory, 'input.json'))).request
      .applicationInquiryInput.propertyInputHeloc.requestedLoanAmount), [200000, 123456, 99999]);
    assert.ok(directories.every(directory => JSON.parse(fs.readFileSync(path.join(directory, 'input.json'))).preserveEmail));
    for (const item of saved.items) {
      assert.equal(item.status, 'passed');
      assert.equal(item.offers.eligibleOfferCount, 3);
      assert.ok(item.profile.email);
      assert.ok(item.profile.inquiryId);
      assert.ok(item.artifacts.some(artifact => artifact.name === 'offers.png'));
      assert.ok(item.artifacts.some(artifact => artifact.name === 'actual-inquiry-response.json'));
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(suiteDirectories[0], 'suite-summary.json'))).counts.passed, 3);
    assert.equal((await post(`/api/suites/${suite.id}/stop`, {})).status, 409);
    const reopened = createLabServer({ templateDirectory: templates });
    await new Promise(resolve => reopened.server.listen(0, '127.0.0.1', resolve));
    try {
      const restored = await (await fetch(`http://127.0.0.1:${reopened.server.address().port}/api/bootstrap`)).json();
      assert.deepEqual(restored.suites.find(item => item.id === suite.id), saved);
      assert.equal(restored.activeSuite, null);
    } finally { await reopened.close(); }
  });
});

test('suite fails fast with remaining cases skipped and preserves failure evidence; launch errors cannot stall a queue', async () => {
  for (const settings of [{ failAt: 2 }, { launchErrorAt: 1 }]) {
    await fixtureLab(async ({ base, post, launches, maxRunning }) => {
      const { suite } = await (await post('/api/suites', {
        tenant: 'gri', caseIds: ['NSF-001', 'NSF-002', 'NSF-003'], confirmed: true
      })).json();
      await expect.poll(async () => (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status).toBe('failed');
      const saved = (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite;
      assert.equal(launches(), settings.failAt ?? 1);
      assert.ok(maxRunning() <= 1);
      assert.equal(saved.counts.failed, 1);
      assert.equal(saved.counts.skipped, settings.failAt ? 1 : 2);
      assert.match(saved.items.at(-1).error, /first failure/);
      const failed = saved.items.find(item => item.status === 'failed');
      assert.match(failed.error, settings.failAt ? /UI\/API mismatch/ : /launch failure/);
      if (settings.failAt) assert.ok(failed.artifacts.some(artifact => artifact.name === 'offers.png'));
    }, settings);
  }
});

test('stop-after-current finishes the active inquiry and skips the queue without retries', async () => {
  await fixtureLab(async ({ base, post, launches }) => {
    const { suite } = await (await post('/api/suites', {
      tenant: 'gri', caseIds: ['NSF-001', 'NSF-002', 'NSF-003'], confirmed: true
    })).json();
    assert.equal((await post(`/api/suites/${suite.id}/stop`, {}, { 'X-SF-Lab-Token': 'wrong' })).status, 403);
    const stopped = await post(`/api/suites/${suite.id}/stop`, {});
    assert.equal(stopped.status, 200);
    assert.equal((await stopped.json()).suite.stopRequested, true);
    await expect.poll(async () => (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status).toBe('stopped');
    const saved = (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite;
    assert.equal(saved.counts.passed, 1);
    assert.equal(saved.counts.skipped, 2);
    assert.equal(saved.counts.failed, 0);
    assert.equal(launches(), 1);
  }, { delay: 600 });
});

test('shutdown never launches pending suite cases, and interrupted suite state is never automatically resumed', async () => {
  await fixtureLab(async ({ lab, base, post, launches, suiteDirectories, templates }) => {
    const { suite } = await (await post('/api/suites', {
      tenant: 'gri', caseIds: ['NSF-001', 'NSF-002', 'NSF-003'], confirmed: true
    })).json();
    await lab.close();
    assert.equal(launches(), 1);
    const file = path.join(suiteDirectories[0], 'suite.json');
    const stopped = JSON.parse(fs.readFileSync(file));
    assert.equal(stopped.items.filter(item => item.status === 'skipped').length, 2);
    assert.notEqual(stopped.status, 'running');
    // Simulate persisted state left by a dead owner, not a live process.
    const deadOwner = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
    await new Promise(resolve => deadOwner.once('close', resolve));
    stopped.status = 'running'; stopped.ownerPid = deadOwner.pid; stopped.stopRequested = false;
    delete stopped.finishedAt;
    stopped.items[0].status = 'running';
    for (const item of stopped.items.slice(1)) item.status = 'pending';
    fs.writeFileSync(file, JSON.stringify(stopped));
    let restoredLaunches = 0;
    const reopened = createLabServer({ templateDirectory: templates,
      launch() { restoredLaunches++; throw new Error('Restart must never resume pending inquiries'); } });
    await new Promise(resolve => reopened.server.listen(0, '127.0.0.1', resolve));
    try {
      const restored = await (await fetch(`http://127.0.0.1:${reopened.server.address().port}/api/bootstrap`)).json();
      const summary = restored.suites.find(item => item.id === suite.id);
      assert.equal(summary.status, 'failed');
      assert.equal(summary.counts.failed, 1);
      assert.equal(summary.counts.skipped, 2);
      assert.match(summary.error, /No pending scenarios were resumed/);
      assert.equal(restoredLaunches, 0);
      assert.equal(restored.activeSuite, null);
    } finally { await reopened.close(); }
  }, { delay: 1500 });
});

test('lab suite UI selects runnable groups, authorizes a batch and reopens per-case evidence and saved summary', async () => {
  await fixtureLab(async ({ base, launches, directories, suiteDirectories }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await expect(page.locator('#suite-select-group')).toBeEnabled();
      await page.locator('#suite-group').selectOption('Original 23 scenarios');
      await page.locator('#suite-select-group').click();
      assert.equal(await page.locator('#suite-cases input:checked').count(), 23);
      await expect(page.locator('#suite-unavailable')).not.toContainText('SF-12-Original');
      await expect(page.locator('#suite-unavailable')).not.toContainText('SF-22-Original');
      await page.locator('#suite-confirm').check();
      await page.locator('#suite-tenant').selectOption('owning');
      await expect(page.locator('#tenant')).toHaveValue('owning');
      await expect(page.locator('#suite-tenant')).toHaveValue('owning');
      await expect(page.locator('#suite-confirm')).not.toBeChecked();
      await page.locator('#suite-confirm').check();
      await page.locator('#suite-clear').click();
      await expect(page.locator('#suite-confirm')).not.toBeChecked();
      await page.locator('#suite-cases input[value="NSF-001"]').check();
      await page.locator('#suite-cases input[value="NSF-002"]').check();
      await expect(page.locator('#suite-cases input[value="NSF-001"]')).toBeChecked();
      await expect(page.locator('#suite-cases input[value="NSF-002"]')).toBeChecked();
      await expect(page.locator('#suite-cases input[value="SF-12-Original"]')).toBeEnabled();
      await expect(page.locator('#suite-cases input[value="SF-22-Original"]')).toBeEnabled();
      await expect(page.locator('#suite-selection')).toContainText('2 scenario(s)');
      await expect(page.locator('#suite-launch')).toBeDisabled();
      await page.locator('#suite-confirm').check();
      const launched = page.waitForResponse(response => response.url() === `${base}/api/suites` && response.request().method() === 'POST');
      await page.locator('#suite-launch').click();
      const { suite } = await (await launched).json();
      assert.equal(suite.tenant, 'owning');
      suiteDirectories.push(path.join(path.dirname(directories[0]), suite.id));
      await expect(page.locator('#suite-launch')).toBeDisabled();
      await expect(page.locator('#launch')).toBeDisabled();
      await expect(page.locator('#tenant')).toBeDisabled();
      await expect(page.locator('#suite-tenant')).toBeDisabled();
      await expect(page.locator('#suite-summary')).toContainText('2 passed', { timeout: 15000 });
      await expect(page.locator('#suite-summary')).toContainText('PASSED');
      await expect(page.locator('#suite-results tbody tr')).toHaveCount(2);
      await expect(page.locator('#suite-results')).toContainText('3 eligible offer(s)');
      await expect(page.locator('#suite-results a').filter({ hasText: 'offers.png' })).toHaveCount(2);
      await page.locator('#suite-results button').first().click();
      await expect(page.locator('#status')).toHaveText('PASSED');
      await expect(page.locator('#screenshot')).toBeVisible();
      await page.reload();
      await expect(page.locator(`#suite-history option[value="${suite.id}"]`)).toHaveCount(1);
      await page.locator('#suite-history').selectOption(suite.id);
      await expect(page.locator('#suite-summary')).toContainText('2 passed');
      await expect(page.locator('#suite-report-link')).toHaveAttribute('target', '_blank');
      const popup = page.waitForEvent('popup');
      await page.locator('#suite-report-link').click();
      const report = await popup;
      try {
        await expect(report.locator('.suite-report-case')).toHaveCount(2);
        await expect(report.locator('.suite-report-case .offer')).toHaveCount(6);
        await expect(report.locator('.suite-report-screenshot')).toHaveCount(2);
        await expect(report.locator('#suite-report-summary')).toContainText('2 passed');
        await report.locator('.suite-report-case details').filter({ hasText: 'Actual inquiry response JSON' }).first().locator('summary').click();
        await expect(report.locator('.suite-report-case').first()).toContainText(scenarios[0].expectedResponse.inquiryId);
      } finally { await report.close(); }
      const evidence = path.join(root, 'test-results/2026-11-02/solution-finder/lab-verification/suite-runner');
      fs.mkdirSync(evidence, { recursive: true });
      await page.locator('#suite-panel').screenshot({ path: path.join(evidence, 'offline-suite-ui-desktop.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#suite-panel').screenshot({ path: path.join(evidence, 'offline-suite-ui-mobile.png') });
      assert.equal(launches(), 2);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }, { delay: 600 });
});

test('all-suite report updates every case with distinct offers/no-offer reasons, preserves open JSON and stays read-only', async () => {
  await fixtureLab(async ({ base, post, launches }) => {
    const { suite } = await (await post('/api/suites', {
      tenant: 'gri', caseIds: ['NSF-001', 'NSF-002'], confirmed: true
    })).json();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = []; const writes = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
      await page.goto(`${base}/suite-results.html?suite=${suite.id}`);
      await expect(page.locator('.suite-report-case')).toHaveCount(2);
      await expect(page.locator('#suite-report-summary')).toContainText('RUNNING');
      const first = page.locator('.suite-report-case[data-case-id="NSF-001"]');
      const second = page.locator('.suite-report-case[data-case-id="NSF-002"]');
      await expect(first.locator('.offer')).toHaveCount(3, { timeout: 15000 });
      const raw = first.locator('details').filter({ has: page.locator('summary', { hasText: 'Actual inquiry response JSON' }) });
      await raw.locator('summary').click();
      await expect(page.locator('#suite-report-summary')).toContainText('2 passed', { timeout: 15000 });
      await expect(first.locator('.offer')).toHaveCount(3);
      await expect(second.locator('.offer')).toHaveCount(3);
      await expect(second.locator('.case-offer-count')).toHaveText('0 eligible offer(s)');
      await expect(second.locator('.offer.declined')).toHaveCount(3);
      await expect(second).toContainText('NO OFFER');
      await expect(raw).toHaveAttribute('open', '');
      await expect(page.locator('.suite-report-screenshot')).toHaveCount(2);
      await expect(second).toContainText(noOfferBaseline.inquiryId);
      assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.equal(launches(), 2);
      await page.reload();
      await expect(first.locator('.offer')).toHaveCount(3);
      await expect(second.locator('.offer.declined')).toHaveCount(3);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const evidence = path.join(root, 'test-results/2026-11-02/solution-finder/lab-verification/suite-runner');
      fs.mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: path.join(evidence, 'offline-all-suite-results-mobile.png'), fullPage: true });
    } finally { await browser.close(); }
  }, { delay: 1500, responseFor: request => request.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount === 75000
    ? scenarios[0].expectedResponse : noOfferBaseline });
});

test('all-suite report clearly displays failed/skipped scenarios and missing-suite errors', async () => {
  await fixtureLab(async ({ base, post, launches }) => {
    const { suite } = await (await post('/api/suites', {
      tenant: 'gri', caseIds: ['NSF-001', 'NSF-002', 'NSF-003'], confirmed: true
    })).json();
    await expect.poll(async () => (await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status).toBe('failed');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${base}/suite-results.html?suite=${suite.id}`);
      await expect(page.locator('.suite-report-case')).toHaveCount(3);
      await expect(page.locator('#suite-report-summary')).toContainText('1 failed, 1 skipped');
      const failed = page.locator('.suite-report-case[data-case-id="NSF-002"]');
      const skipped = page.locator('.suite-report-case[data-case-id="NSF-003"]');
      await expect(failed).toContainText('Simulated UI/API mismatch');
      await expect(failed.locator('.suite-report-screenshot')).toHaveCount(1);
      await expect(skipped).toContainText('Not executed');
      await expect(skipped.locator('.offer')).toHaveCount(0);
      await expect(skipped.locator('.suite-report-screenshot')).toHaveCount(0);
      await page.goto(base + '/suite-results.html');
      await expect(page.getByRole('alert')).toContainText('valid suite ID is required');
      await page.goto(base + '/suite-results.html?suite=sf-suite-20261102T000000000Z-00000000');
      await expect(page.getByRole('alert')).toContainText('Unknown suite');
      assert.equal(launches(), 2);
    } finally { await browser.close(); }
  }, { failAt: 2 });
});

test('suite stop UI persists skipped cases and releases launch controls only after the current inquiry ends', async () => {
  await fixtureLab(async ({ base, launches, directories, suiteDirectories }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(base);
      await expect(page.locator('#suite-cases')).toHaveJSProperty('disabled', false);
      for (const id of ['NSF-001', 'NSF-002', 'NSF-003']) await page.locator(`#suite-cases input[value="${id}"]`).check();
      await page.locator('#suite-confirm').check();
      const launched = page.waitForResponse(response => response.url() === `${base}/api/suites` && response.request().method() === 'POST');
      await page.locator('#suite-launch').click();
      const { suite } = await (await launched).json();
      suiteDirectories.push(path.join(path.dirname(directories[0]), suite.id));
      await expect(page.locator('#suite-stop')).toBeEnabled();
      await page.locator('#suite-stop').click();
      await expect(page.locator('#suite-summary')).toContainText('Stop requested');
      await expect(page.locator('#launch')).toBeDisabled();
      await expect(page.locator('#suite-summary')).toContainText('STOPPED', { timeout: 15000 });
      await expect(page.locator('#suite-summary')).toContainText('2 skipped');
      await expect(page.locator('#suite-stop')).toBeDisabled();
      await expect(page.locator('#suite-cases')).toHaveJSProperty('disabled', false);
      assert.equal(launches(), 1);
    } finally { await browser.close(); }
  }, { delay: 1500 });
});

test('legacy lab bootstrap never renders undefined groups and keeps JSON copy/paste visible before Load', async () => {
  await fixtureLab(async ({ base, launches }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route('**/api/bootstrap', async route => {
        const response = await route.fetch();
        const data = await response.json();
        delete data.protocolVersion;
        data.cases = data.cases.slice(23, 125).map(({ id, name }) => ({ id, name }));
        await route.fulfill({ response, json: data });
      });
      await page.goto(base);
      await expect(page.locator('#request')).toBeVisible();
      await expect(page.locator('#request')).toHaveValue('');
      await expect(page.locator('#scenario option')).toHaveCount(103);
      await expect(page.locator('#scenario optgroup')).toHaveAttribute('label', 'Additional 102 scenarios');
      assert.equal(await page.locator('#scenario').evaluate(select => select.innerHTML.includes('undefined')), false);
      await expect(page.locator('#server-notice')).toContainText('Restart npm run solution-finder:lab');
      await page.locator('#request').fill(JSON.stringify(fixture()));
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('75000');
      await page.getByLabel('Requested Loan Amount', { exact: true }).fill('90000');
      assert.equal(JSON.parse(await page.locator('#request').inputValue())
        .applicationInquiryInput.propertyInputHeloc.requestedLoanAmount, 90000);
      assert.equal(launches(), 0);
    } finally { await browser.close(); }
  });
});

test('malformed scenario labels surface a restart error rather than displaying undefined names', async () => {
  await fixtureLab(async ({ base }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route('**/api/bootstrap', async route => {
        const response = await route.fetch();
        const data = await response.json();
        delete data.cases[0].name;
        await route.fulfill({ response, json: data });
      });
      await page.goto(base);
      await expect(page.getByRole('alert')).toContainText('without an ID or name');
      await expect(page.locator('#request')).toBeVisible();
      assert.equal(await page.locator('#scenario').evaluate(select => select.innerHTML.includes('undefined')), false);
    } finally { await browser.close(); }
  });
});

test('named template copies validate, persist across servers, preserve originals and never launch inquiries', async () => {
  await fixtureLab(async ({ base, post, launches, templates, bootstrap }) => {
    const original = JSON.stringify(labCases);
    const request = fixture();
    request.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = 75001;
    const input = { name: '  Edited boundary case  ', request, sourceCaseId: 'NSF-001' };
    const unsupported = structuredClone(labCases[11].request);
    unsupported.applicationInquiryInput.incomeInput[0].incomeType = 'PENSION';
    for (const [body, headers, status] of [
      [input, { 'X-SF-Lab-Token': 'wrong' }, 403],
      [input, { Origin: 'https://other.example' }, 403],
      [{ ...input, name: ' ' }, {}, 400],
      [{ ...input, name: 'x'.repeat(121) }, {}, 400],
      [{ ...input, name: 'Invalid\nname' }, {}, 400],
      [{ ...input, request: { unsupported: true } }, {}, 400],
      [{ ...input, request: unsupported }, {}, 400],
      [{ ...input, sourceCaseId: '../outside' }, {}, 400],
      [{ ...input, id: 'SF-1-Original' }, {}, 400]
    ]) assert.equal((await post('/api/templates', body, headers)).status, status);
    assert.deepEqual(fs.readdirSync(templates), []);
    const created = await post('/api/templates', input);
    assert.equal(created.status, 201);
    const { template } = await created.json();
    assert.match(template.id, /^SF-CUSTOM-/);
    assert.equal(template.name, 'Edited boundary case');
    assert.deepEqual(template.request, request);
    const savedFile = path.join(templates, `${template.id}.json`);
    const saved = JSON.parse(fs.readFileSync(savedFile));
    assert.equal(saved.sourceCaseId, 'NSF-001');
    assert.deepEqual(saved.request, request);
    assert.equal(fs.statSync(savedFile).mode & 0o777, 0o600);
    const loaded = await (await fetch(`${base}/api/cases/${template.id}`)).json();
    assert.deepEqual(loaded.request, request);
    assert.match(loaded.notes[0], /copied from NSF-001/);
    assert.equal((await post('/api/templates', { ...input, name: 'EDITED BOUNDARY CASE' })).status, 409);
    assert.equal(fs.readdirSync(templates).length, 1);
    const forkRequest = structuredClone(request);
    forkRequest.applicationInquiryInput.incomeInput[0].annualIncome = 12000;
    const fork = await post('/api/templates', { name: 'Forked template', request: forkRequest, sourceCaseId: template.id });
    assert.equal(fork.status, 201);
    assert.deepEqual(JSON.parse(fs.readFileSync(savedFile)), saved);
    const concurrent = await Promise.all([1, 2].map(() => post('/api/templates', { name: 'Concurrent copy', request })));
    assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 409]);
    assert.equal(fs.readdirSync(templates).length, 3);
    const reopened = createLabServer({ templateDirectory: templates });
    await new Promise(resolve => reopened.server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${reopened.server.address().port}`;
      const restored = await (await fetch(origin + '/api/bootstrap')).json();
      assert.equal(restored.cases.length, 168);
      assert.deepEqual(restored.cases.slice(0, 165), bootstrap.cases);
      assert.ok(restored.cases.some(item => item.id === template.id && item.group === 'Saved templates'));
      assert.deepEqual((await (await fetch(`${origin}/api/cases/${template.id}`)).json()).request, request);
      assert.deepEqual(restored.history, bootstrap.history);
    } finally { await reopened.close(); }
    assert.equal(launches(), 0);
    assert.equal(JSON.stringify(labCases), original);
  });
});

test('template storage corruption and write failures surface errors rather than claiming success', async () => {
  await fixtureLab(async ({ base, post, templates, launches }) => {
    fs.writeFileSync(path.join(templates, 'broken.json'), '{invalid');
    const broken = await fetch(base + '/api/bootstrap');
    assert.equal(broken.status, 500);
    assert.match((await broken.json()).error, /Cannot load saved template broken.json/);
    assert.equal((await post('/api/templates', { name: 'Must not save', request: fixture() })).status, 500);
    fs.unlinkSync(path.join(templates, 'broken.json'));
    fs.rmdirSync(templates);
    fs.writeFileSync(templates, 'not a directory');
    const failed = await post('/api/templates', { name: 'Must not save', request: fixture() });
    assert.equal(failed.status, 500);
    assert.match((await failed.json()).error, /ENOTDIR/);
    fs.unlinkSync(templates);
    assert.equal(launches(), 0);
  });
});

test('lab launches one fixed runner, preserves exact request, returns evidence and reloadable history', async () => {
  await fixtureLab(async ({ base, post, launches, directories, templates }) => {
    const first = await post('/api/runs', { tenant: 'gri', request: fixture(), confirmed: true, preserveEmail: true });
    assert.equal(first.status, 202);
    const run = (await first.json()).run;
    assert.equal((await post('/api/runs', { tenant: 'owning', request: fixture(), confirmed: true })).status, 409);
    assert.throws(() => createLabServer(), /still owned by process/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directories[0], 'lab-run.json'))).status, 'running');
    await expect.poll(async () => (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run.status).toBe('passed');
    const saved = (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run;
    assert.deepEqual(saved.result.actualRequest, fixture());
    assert.equal(saved.result.parsed.eligibleOfferCount, 3);
    assert.equal(saved.result.execution.comparisonMode, 'actual-ui-api');
    const image = saved.artifacts.find(artifact => artifact.name === 'offers.png');
    assert.equal((await fetch(base + image.url)).headers.get('content-type'), 'image/png');
    assert.equal((await fetch(`${base}/api/runs/${run.id}/artifacts/input.json`)).status, 404);
    assert.equal(launches(), 1);
    const reopened = createLabServer({ templateDirectory: templates });
    await new Promise(resolve => reopened.server.listen(0, '127.0.0.1', resolve));
    try {
      const history = await (await fetch(`http://127.0.0.1:${reopened.server.address().port}/api/bootstrap`)).json();
      assert.ok(history.history.some(item => item.id === run.id && item.status === 'passed'));
      assert.ok(directories[0].includes(`${path.sep}solution-finder${path.sep}lab${path.sep}`));
    } finally { await reopened.close(); }
  });
});

test('lab UI loads cases and tenants, previews JSON, shows errors, and renders actual-response results with image links', async () => {
  await fixtureLab(async ({ base }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await expect(page.locator('#tenant option')).toHaveCount(5);
      await expect(page.locator('#scenario option')).toHaveCount(166);
      await expect(page.locator('#scenario optgroup')).toHaveCount(3);
      await expect(page.locator('#scenario option').nth(1)).toHaveText('SF-1-Original: Happy Path - secondary Residence');
      for (const tenant of ['gri', 'owning', 'citywide', 'certainty', 'onq']) {
        await page.locator('#tenant').selectOption(tenant);
        assert.ok((await page.locator('#entry').getAttribute('href')).includes(tenant === 'gri' ? 'rate.com' : tenant === 'certainty' ? 'certaintyhomelending' : tenant));
      }
      await page.locator('#tenant').selectOption('gri');
      await page.locator('#scenario').selectOption('SF-1-Original');
      await page.locator('#load').click();
      await expect(page.locator('#request')).toHaveValue(/200000/);
      await expect(page.locator('#template-notice')).toContainText('Legacy LO/application routing');
      await expect(page.locator('#source-section')).toBeVisible();
      await page.locator('#validate').click();
      await expect(page.locator('#preview')).toContainText('Requested Loan Amount = $200,000');
      await page.locator('#scenario').selectOption('SF-22-Original');
      await page.locator('#load').click();
      await expect(page.locator('#template-notice')).toContainText('N/A');
      await expect(page.locator('#template-notice')).toContainText('age 17');
      await expect(page.locator('#request')).toHaveValue(/applicationInquiryInput/);
      await page.locator('#scenario').selectOption('SF-12-Original');
      await page.locator('#load').click();
      await expect(page.locator('#template-notice')).toContainText('RETIRED_SSI');
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toBeHidden();
      await expect(page.getByLabel('Borrower date of birth', { exact: true })).toHaveValue('1950-01-01');
      await page.locator('#scenario').selectOption('NSF-001');
      await page.locator('#load').click();
      await expect(page.locator('#request')).toHaveValue(/applicationInquiryInput/);
      await page.locator('#validate').click();
      await expect(page.locator('#preview')).toContainText('Requested Loan Amount = $75,000');
      await page.locator('#request').fill('{broken');
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toContainText('not valid JSON');
      await page.locator('#request').fill(JSON.stringify(fixture()));
      await page.locator('#confirm').check();
      await page.locator('#launch').click();
      await expect(page.locator('#status')).toHaveText('PASSED', { timeout: 15000 });
      await expect(page.locator('#response-json')).toContainText(scenarios[0].expectedResponse.inquiryId);
      await expect(page.locator('.offer')).toHaveCount(3);
      await expect(page.locator('#history option:checked')).toContainText(fixture().applicationInquiryInput.basicInfoInput.emailId);
      await expect(page.locator('#history option:checked')).toContainText('App ID:');
      await expect(page.locator('#history-profile')).toContainText('Not returned by API');
      await expect(page.locator('#screenshot')).toBeVisible();
      assert.ok(await page.locator('#screenshot').evaluate(image => image.complete && image.naturalWidth > 0));
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
});

test('reset clears the entire idle workspace without deleting history/templates or submitting, and locks during work', async () => {
  await fixtureLab(async ({ base, post, launches }) => {
    const { template } = await (await post('/api/templates', { name: 'Reset retained template', request: fixture() })).json();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await expect(page.locator('#reset')).toBeEnabled();
      await page.locator('#suite-tenant').selectOption('owning');
      await page.locator('#suite-cases input[value="NSF-001"]').check();
      await page.locator('#suite-confirm').check();
      const suiteResponse = page.waitForResponse(response => response.url() === `${base}/api/suites` && response.request().method() === 'POST');
      await page.locator('#suite-launch').click();
      const { suite } = await (await suiteResponse).json();
      const active = await page.evaluate(() => ({
        resetDisabled: document.getElementById('reset').disabled,
        status: document.getElementById('suite-summary').textContent
      }));
      assert.equal(active.resetDisabled, true);
      assert.match(active.status, /RUNNING/);
      await expect(page.locator('#suite-summary')).toContainText('1 passed', { timeout: 15000 });
      await expect(page.locator('#reset')).toBeEnabled();
      await expect(page.locator('#results')).toBeVisible();
      await page.locator('#scenario').selectOption('SF-1-Original');
      await page.locator('#load').click();
      await expect(page.locator('#source-section')).toBeVisible();
      await page.locator('#validate').click();
      await expect(page.locator('#preview')).toContainText('Requested Loan Amount = $200,000');
      await page.locator('#fresh-email').uncheck();
      await page.locator('#confirm').check();
      await page.locator('#suite-confirm').check();
      const before = launches();
      const historyCount = await page.locator('#history option').count();
      const suiteCount = await page.locator('#suite-history option').count();
      await page.locator('#reset').click();
      for (const id of ['request', 'template-name', 'scenario', 'suite-group', 'history', 'suite-history']) {
        await expect(page.locator(`#${id}`)).toHaveValue('');
      }
      for (const id of ['tenant', 'suite-tenant']) await expect(page.locator(`#${id}`)).toHaveValue('gri');
      await expect(page.locator('#suite-cases input:checked')).toHaveCount(0);
      for (const id of ['confirm', 'suite-confirm']) await expect(page.locator(`#${id}`)).not.toBeChecked();
      await expect(page.locator('#fresh-email')).toBeChecked();
      await expect(page.locator('#request-fields')).toHaveJSProperty('disabled', true);
      for (const id of ['property-fields', 'borrower-fields', 'income-fields', 'history-profile', 'source-request',
        'response-json', 'parsed-json', 'actual-request', 'ui-json', 'offers', 'artifacts', 'identifiers']) {
        await expect(page.locator(`#${id}`)).toBeEmpty();
      }
      for (const id of ['results', 'source-section', 'template-notice', 'save-status', 'suite-report-link', 'error']) {
        await expect(page.locator(`#${id}`)).toBeHidden();
      }
      await expect(page.locator('#screenshot')).not.toHaveAttribute('src');
      await expect(page.locator('#suite-report-link')).not.toHaveAttribute('href');
      await expect(page.locator('#suite-results tbody tr')).toHaveCount(0);
      await expect(page.locator('#status')).toHaveText('READY');
      await expect(page.locator('#preview')).toContainText('Validate a request');
      await expect(page.locator('#suite-summary')).toHaveText('No suite selected.');
      await expect(page.locator('#launch')).toBeDisabled();
      await expect(page.locator('#suite-launch')).toBeDisabled();
      await expect(page.locator('#history option')).toHaveCount(historyCount);
      await expect(page.locator('#suite-history option')).toHaveCount(suiteCount);
      await expect(page.locator(`#scenario option[value="${template.id}"]`)).toHaveCount(1);
      assert.equal(launches(), before);
      assert.equal((await (await fetch(`${base}/api/suites/${suite.id}`)).json()).suite.status, 'passed');
      await page.locator('#suite-history').selectOption(suite.id);
      await expect(page.locator('#suite-report-link')).toBeVisible();
      await page.locator('#reset').click();
      await page.locator('#history').selectOption(suite.items[0].runId || await page.locator('#history option').nth(1).getAttribute('value'));
      await expect(page.locator('#results')).toBeVisible();
      await page.locator('#reset').click();
      await page.locator('#request').fill('{broken');
      await page.locator('#validate').click();
      await expect(page.locator('#error')).toBeVisible();
      await page.locator('#reset').click();
      await expect(page.locator('#error')).toBeHidden();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#reset').scrollIntoViewIfNeeded();
      await expect(page.locator('#reset')).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      assert.equal(launches(), before);
    } finally { await browser.close(); }
  }, { delay: 1500 });
});

test('structured request tables synchronize JSON, format the exact readable preview and save edits without submitting', async () => {
  await fixtureLab(async ({ base, launches }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await expect(page.locator('#load')).toBeEnabled();
      await page.locator('#scenario').selectOption('SF-1-Original');
      await page.locator('#load').click();
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('200000');
      await expect(page.getByLabel('Borrower SSN (last 4)', { exact: true })).toHaveValue('2955');
      await expect(page.locator('#request')).toBeVisible();
      await page.locator('#validate').click();
      await expect(page.locator('#preview p')).toHaveText([
        'Subject Property = 49 Longview Ln, Newtown Square, PA, 19073',
        'Occupancy Type = Secondary',
        'Existing Mortgage Amount = $70,000',
        'Requested Loan Amount = $200,000',
        'Borrower Name = Erica Lambert',
        'Borrower Address = 409 Glenwood Ave, Menlo Park, CA, 94025',
        'Borrower SSN (last 4) = 2955',
        'Annual Income = $444,444'
      ]);
      await page.locator('#confirm').check();
      await page.getByLabel('Requested Loan Amount', { exact: true }).fill('250001');
      await expect(page.locator('#confirm')).not.toBeChecked();
      await expect(page.locator('#preview')).toContainText('Input changed');
      await page.getByLabel('Borrower First Name', { exact: true }).fill('Casey');
      await page.getByLabel('Borrower SSN (last 4)', { exact: true }).fill('0042');
      await page.getByLabel('Income 1 annual amount', { exact: true }).fill('100000');
      await page.locator('#add-income').click();
      await page.getByLabel('Income 2 source', { exact: true }).selectOption('SELF_EMPLOYED');
      await page.getByLabel('Income 2 annual amount', { exact: true }).fill('20000');
      await page.locator('#validate').click();
      await expect(page.locator('#preview')).toContainText('Annual Income = $120,000');
      await expect(page.locator('#preview')).toContainText('Borrower Name = Casey Lambert');
      await expect(page.locator('#preview')).toContainText('Borrower SSN (last 4) = 0042');
      let raw = JSON.parse(await page.locator('#request').inputValue());
      assert.equal(raw.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount, 250001);
      assert.equal(raw.applicationInquiryInput.incomeInput.length, 2);
      await page.getByLabel('Occupancy Type', { exact: true }).selectOption('PRIMARY');
      await expect(page.locator('#editor-notice')).toContainText('validation updates');
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toBeHidden();
      await expect(page.locator('#preview')).toContainText('Borrower Address = 49 Longview Ln, Newtown Square, PA, 19073');
      await page.getByRole('button', { name: 'Remove income 2', exact: true }).click();
      await expect(page.getByLabel('Income 2 source', { exact: true })).toHaveCount(0);
      await page.locator('#validate').click();
      await expect(page.locator('#preview')).toContainText('Annual Income = $100,000');
      await page.locator('#template-name').fill('Structured table edited copy');
      await page.locator('#save-template').click();
      await expect(page.locator('#save-status')).toContainText('Structured table edited copy');
      const savedId = await page.locator('#scenario').inputValue();
      await page.reload();
      await expect(page.locator(`#scenario option[value="${savedId}"]`)).toHaveCount(1);
      await page.locator('#scenario').selectOption(savedId);
      await page.locator('#load').click();
      await expect(page.getByLabel('Borrower First Name', { exact: true })).toHaveValue('Casey');
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('250001');
      raw = JSON.parse(await page.locator('#request').inputValue());
      raw.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = 100001;
      raw.applicationInquiryInput.unrepresentableField = 'must remain visible to validation';
      await page.locator('#request').fill(JSON.stringify(raw));
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('100001');
      await page.getByLabel('Borrower First Name', { exact: true }).fill('Edited again');
      assert.equal(JSON.parse(await page.locator('#request').inputValue()).applicationInquiryInput.unrepresentableField,
        'must remain visible to validation');
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toContainText('unrepresentableField');
      await page.locator('#request').fill('{broken');
      await expect(page.locator('#request-fields')).toHaveJSProperty('disabled', true);
      await expect(page.locator('#editor-notice')).toContainText('not valid JSON');
      delete raw.applicationInquiryInput.unrepresentableField;
      await page.locator('#request').fill(JSON.stringify(raw));
      await expect(page.locator('#request-fields')).toHaveJSProperty('disabled', false);
      await page.getByLabel('Requested Loan Amount', { exact: true }).fill('');
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toContainText('Expected number, received null');
      await page.locator('#scenario').selectOption('SF-12-Original');
      await page.locator('#load').click();
      await expect(page.getByLabel('Income 1 source', { exact: true })).toHaveValue('RETIRED_SSI');
      await expect(page.getByLabel('Income 1 type', { exact: true })).toHaveValue('SOCIAL_SECURITY');
      await page.locator('#validate').click();
      await expect(page.getByRole('alert')).toBeHidden();
      await page.locator('#scenario').selectOption('SF-22-Original');
      await page.locator('#load').click();
      await expect(page.locator('#template-notice')).toContainText('N/A');
      await expect(page.locator('#request-fields')).toHaveJSProperty('disabled', false);
      await expect(page.getByLabel('Borrower date of birth', { exact: true })).toHaveValue(`${new Date().getFullYear() - 17}-01-01`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#scenario').selectOption(savedId);
      await page.locator('#load').click();
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('250001');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      assert.equal(launches(), 0);
    } finally { await browser.close(); }
  });
});

test('a late preview response cannot overwrite newer request-table edits', async () => {
  await fixtureLab(async ({ base, launches }) => {
    const browser = await chromium.launch({ headless: true });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    try {
      const page = await browser.newPage();
      await page.goto(base);
      await expect(page.locator('#load')).toBeEnabled();
      await page.locator('#scenario').selectOption('SF-1-Original');
      await page.locator('#load').click();
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('200000');
      let ready;
      const responseReady = new Promise(resolve => { ready = resolve; });
      await page.route('**/api/preview', async route => {
        const response = await route.fetch(); ready(); await gate; await route.fulfill({ response });
      });
      await page.locator('#validate').click(); await responseReady;
      await expect(page.locator('#reset')).toBeDisabled();
      await page.getByLabel('Requested Loan Amount', { exact: true }).fill('250001');
      release();
      await expect(page.getByRole('alert')).toContainText('Input changed during validation');
      await expect(page.locator('#reset')).toBeEnabled();
      await expect(page.getByLabel('Requested Loan Amount', { exact: true })).toHaveValue('250001');
      assert.equal(JSON.parse(await page.locator('#request').inputValue())
        .applicationInquiryInput.propertyInputHeloc.requestedLoanAmount, 250001);
      await expect(page.locator('#preview')).toContainText('Input changed');
      assert.equal(launches(), 0);
    } finally { release(); await browser.close(); }
  });
});

test('saved-run profiles use submitted email and true loan IDs, retaining labeled application/inquiry fallbacks after restart', async () => {
  const response = structuredClone(scenarios[0].expectedResponse);
  response.loanId = 'qa-loan-1001';
  response.offers[0].loanId = 'qa-loan-1001';
  response.offers[1].loanId = 1002;
  const submittedEmail = 'sf-profile-submitted@example.test';
  await fixtureLab(async ({ base, post, templates }) => {
    const { run } = await (await post('/api/runs', { tenant: 'gri', request: fixture(), confirmed: true })).json();
    assert.equal(run.profile.emailSource, 'input');
    assert.deepEqual(run.profile.loanIds, []);
    await expect.poll(async () => (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run.status).toBe('passed');
    const saved = (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run;
    assert.equal(saved.profile.email, submittedEmail);
    assert.equal(saved.profile.emailSource, 'submitted');
    assert.deepEqual(saved.profile.loanIds, ['qa-loan-1001', '1002']);
    assert.equal(saved.profile.inquiryId, response.inquiryId);
    assert.ok(saved.profile.internalAppIds.includes(response.offers[0].internalAppId));
    assert.equal(saved.profile.requestedAmount, 75000);
    assert.equal('lastFourSSN' in saved.profile, false);
    const reopened = createLabServer({ templateDirectory: templates });
    await new Promise(resolve => reopened.server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    try {
      const origin = `http://127.0.0.1:${reopened.server.address().port}`;
      const restored = await (await fetch(origin + '/api/bootstrap')).json();
      assert.deepEqual(restored.history.find(item => item.id === run.id).profile, saved.profile);
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(origin);
      const option = page.locator(`#history option[value="${run.id}"]`);
      await expect(option).toContainText(submittedEmail);
      await expect(option).toContainText(saved.profile.borrower);
      await expect(option).toContainText('Loan ID: qa-loan-1001, 1002');
      await page.locator('#history').selectOption(run.id);
      await expect(page.locator('#history-profile')).toContainText(submittedEmail);
      await expect(page.locator('#history-profile')).toContainText('qa-loan-1001, 1002');
      await expect(page.locator('#history-profile')).toContainText('Requested Loan Amount');
      await expect(page.locator('#history-profile')).toContainText('$75,000');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await browser.close(); await reopened.close(); }
  }, { response, submittedEmail });
});

test('lab UI edits, saves and reloads separate reusable copies without changing original inputs or submitting', async () => {
  await fixtureLab(async ({ base, launches, templates }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await expect(page.locator('#save-template')).toBeEnabled();
      await page.locator('#scenario').selectOption('NSF-001');
      await page.locator('#load').click();
      await expect(page.locator('#template-name')).toHaveValue(`${scenarios[0].name.slice(0, 115)} copy`);
      const edited = fixture();
      edited.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = 75001;
      await page.locator('#request').fill(JSON.stringify(edited));
      await page.locator('#template-name').fill('');
      await page.locator('#save-template').click();
      await expect(page.getByRole('alert')).toContainText('Enter a template name');
      await page.locator('#request').fill('{broken');
      await page.locator('#template-name').fill('Edited boundary <b>copy</b>');
      await page.locator('#save-template').click();
      await expect(page.getByRole('alert')).toContainText('not valid JSON');
      assert.equal(fs.readdirSync(templates).length, 0);
      await page.locator('#request').fill(JSON.stringify(edited));
      await page.locator('#confirm').check();
      await page.locator('#save-template').click();
      await expect(page.locator('#save-status')).toContainText('Saved "Edited boundary <b>copy</b>"');
      await expect(page.locator('#save-status b')).toHaveCount(0);
      await expect(page.locator('#scenario option')).toHaveCount(167);
      await expect(page.locator('#scenario optgroup')).toHaveCount(4);
      await expect(page.locator('#confirm')).not.toBeChecked();
      await expect(page.locator('#launch')).toBeDisabled();
      const firstId = await page.locator('#scenario').inputValue();
      assert.match(firstId, /^SF-CUSTOM-/);
      await page.locator('#template-name').fill('Edited boundary <b>copy</b>');
      await page.locator('#save-template').click();
      await expect(page.getByRole('alert')).toContainText('already has this name');
      await expect(page.locator('#save-status')).toBeHidden();
      edited.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount = 77000;
      await page.locator('#request').fill(JSON.stringify(edited));
      await page.locator('#template-name').fill('Second edited copy');
      await page.locator('#save-template').click();
      await expect(page.locator('#save-status')).toContainText('Second edited copy');
      const secondId = await page.locator('#scenario').inputValue();
      assert.notEqual(firstId, secondId);
      await page.reload();
      await expect(page.locator('#scenario option')).toHaveCount(168);
      await page.locator('#tenant').selectOption('owning');
      for (const [id, amount] of [[firstId, 75001], [secondId, 77000], ['NSF-001', 75000]]) {
        await page.locator('#scenario').selectOption(id);
        const response = page.waitForResponse(`${base}/api/cases/${id}`);
        await page.locator('#load').click(); await response;
        await expect.poll(async () => JSON.parse(await page.locator('#request').inputValue())
          .applicationInquiryInput.propertyInputHeloc.requestedLoanAmount).toBe(amount);
        await expect(page.locator('#tenant')).toHaveValue('owning');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      assert.equal(launches(), 0);
      assert.equal(fs.readdirSync(templates).length, 2);
    } finally { await browser.close(); }
  });
});

test('missing worker result is a failed run, never a success-shaped empty response', async () => {
  const directories = [];
  const lab = createLabServer({ templateDirectory: templateDirectory(), launch(directory) {
    directories.push(directory);
    return spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } });
  await new Promise(resolve => lab.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${lab.server.address().port}`;
  try {
    const { token } = await (await fetch(base + '/api/bootstrap')).json();
    const response = await fetch(base + '/api/runs', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SF-Lab-Token': token },
      body: JSON.stringify({ tenant: 'onq', request: fixture(), confirmed: true }) });
    const { run } = await response.json();
    await expect.poll(async () => (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run.status).toBe('failed');
    const saved = (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run;
    assert.match(saved.error, /complete, validated UI\/API result was not produced/);
  } finally {
    await lab.close();
    for (const directory of directories) fs.rmSync(validateLabDirectory(directory), { recursive: true });
  }
});

test('no-credit-match decisions stay visible and a UI/API failure retains raw response and screenshot', async () => {
  for (const fail of [false, true]) {
    await fixtureLab(async ({ base, post }) => {
      const response = await post('/api/runs', { tenant: 'certainty', request: fixture(), confirmed: true });
      const { run } = await response.json();
      await expect.poll(async () => (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run.status).toBe(fail ? 'failed' : 'passed');
      const saved = (await (await fetch(`${base}/api/runs/${run.id}`)).json()).run;
      assert.equal(saved.result.parsed.eligibleOfferCount, 0);
      assert.ok(saved.result.parsed.offers.every(offer => offer.reasons.length > 0));
      assert.ok(saved.artifacts.find(artifact => artifact.name === 'offers.png'));
      assert.ok(saved.artifacts.find(artifact => artifact.name === 'actual-inquiry-response.json'));
      if (fail) assert.equal(saved.error, 'Simulated UI/API mismatch');
    }, { response: noOfferBaseline, fail });
  }
});

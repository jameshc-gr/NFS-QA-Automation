const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { handleLoginRedirect, register, runApplication, ENTRY_URL, ENTRY_URLS } = require('../projects/DMX/dmx-engine.ts');
const { loadScenarios } = require('../projects/DMX/dmx-data.ts');
const { canLaunchLoan, publicRun } = require('../../scripts/dmx-local-dashboard.js');
const { DMX_ENTRY_TARGETS } = require('../projects/DMX/dmx-environments.ts');

let browser;
let context;
let page;
let environment;
const loginUrl = 'https://login.dmx.test/signin';
const applicationUrl = 'https://apply.dmx.test/apply/purchase-needs';
const credentials = { email: 'borrower@example.test', password: 'Local-fixture-only' };
const form = `<input name="identifier"><input name="credentials.passcode" type="password"><button type="submit">Sign In</button>`;

before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
beforeEach(async () => {
  environment = { manual: process.env.DMX_MFA_MANUAL, timeout: process.env.DMX_MFA_MANUAL_TIMEOUT };
  delete process.env.DMX_MFA_MANUAL;
  delete process.env.DMX_MFA_MANUAL_TIMEOUT;
  context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultTimeout(3000);
});
afterEach(async () => {
  await context?.close();
  for (const [name, value] of Object.entries({ DMX_MFA_MANUAL: environment.manual, DMX_MFA_MANUAL_TIMEOUT: environment.timeout })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function loginFixture(body, destination = applicationUrl) {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body:
    route.request().url() === loginUrl ? `<main><form onsubmit="event.preventDefault(); location.href='${destination}'">${body}</form></main>` : '<main>Application ready</main>' }));
  await page.goto(loginUrl);
}

test('waits for a delayed login widget and submits both credential fields', async () => {
  const request = [];
  await page.exposeFunction('recordCredentials', value => request.push(value));
  await loginFixture(`<div id="widget"></div><script>setTimeout(() => {
    document.querySelector('#widget').innerHTML = ${JSON.stringify(form)};
    document.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      await window.recordCredentials(Array.from(document.querySelectorAll('input')).map(input => input.value));
      location.href = ${JSON.stringify(applicationUrl)};
    };
  }, 150);</script>`);
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password), true);
  assert.equal(page.url(), applicationUrl);
  assert.deepEqual(request, [[credentials.email, credentials.password]]);
});

test('supports separate username and password screens', async () => {
  await loginFixture(`<input name="identifier"><button type="submit">Next</button><script>
    document.querySelector('form').onsubmit = event => {
      event.preventDefault();
      document.querySelector('form').innerHTML = '<input name="credentials.passcode" type="password"><button type="submit">Verify</button>';
      document.querySelector('form').onsubmit = nextEvent => { nextEvent.preventDefault(); location.href = ${JSON.stringify(applicationUrl)}; };
    };
  </script>`);
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password), true);
  assert.equal(page.url(), applicationUrl);
});

test('allows an authorize redirect with no login widget to finish', async () => {
  await loginFixture(`<script>setTimeout(() => location.href = ${JSON.stringify(applicationUrl)}, 100);</script>`);
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password), true);
  assert.equal(page.url(), applicationUrl);
});

test('manual MFA waits for the simulated operator redirect', async () => {
  process.env.DMX_MFA_MANUAL = '1';
  process.env.DMX_MFA_MANUAL_TIMEOUT = '2000';
  await loginFixture(`<input name="otp"><script>setTimeout(() => location.href = ${JSON.stringify(applicationUrl)}, 200);</script>`);
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password), true);
  assert.equal(await page.locator('input').count(), 0);
});

test('manual MFA expiry fails instead of reporting login success', async () => {
  process.env.DMX_MFA_MANUAL = '1';
  process.env.DMX_MFA_MANUAL_TIMEOUT = '100';
  await loginFixture('<input name="otp">');
  await assert.rejects(handleLoginRedirect(page, credentials.email, credentials.password), /Manual MFA\/sign-in did not complete/);
  assert.equal(page.url(), loginUrl);
  assert.equal(await page.locator('input').inputValue(), '');
});

test('direct MyAccount login returns to Loans without automatically starting an application', async () => {
  const myAccountLogin = 'https://my.gr-dev.com/login';
  const myLoans = 'https://my.gr-dev.com/loans';
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.href === myAccountLogin
      ? `<form onsubmit="event.preventDefault(); location.href='${myLoans}'">${form}</form>`
      : url.href === myLoans
        ? `<main><a href="${applicationUrl}">Start a new application</a></main>`
        : '<main>Unexpected destination</main>';
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  await page.goto(myAccountLogin);
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password, myLoans, { startNewApplication: false }), true);
  assert.equal(page.url(), myLoans);
});

test('consumer-direct application selects No and stops before continuing', async () => {
  const selected = [];
  const continued = [];
  await page.exposeFunction('recordDirectChoice', value => selected.push(value));
  await page.exposeFunction('recordContinue', () => continued.push(true));
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<main>
    <div id="loan-officer-choice-radio"><button onclick="window.recordDirectChoice('Yes')">Yes</button><button onclick="window.recordDirectChoice('No')">No</button></div>
    <button id="button-next" onclick="window.recordContinue()">Continue</button>
  </main>` }));
  await page.goto('https://apply.dmx.test/apply/lo-selection?gr-loan-guid=fixture-only');

  const visited = await runApplication(page, loadScenarios()[0], {
    loanOfficerMode: 'none',
    stopAfter: 'lo-selection',
  });
  assert.deepEqual(selected, ['No']);
  assert.deepEqual(continued, []);
  assert.deepEqual(visited, ['lo-selection']);
  assert.equal(new URL(page.url()).pathname, '/apply/lo-selection');
});

test('consumer-direct fills only initial purchase basics before selecting No', async () => {
  const scenario = loadScenarios()[0];
  const captured = [];
  const choices = [];
  await page.exposeFunction('captureDirectBasics', value => captured.push(value));
  await page.exposeFunction('captureDirectChoice', value => choices.push(value));
  await page.route('**/*', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/apply/lo-selection'
      ? `<main><button onclick="window.captureDirectChoice('No')">No</button><button id="button-next">Continue</button></main>`
      : `<main>
        <select id="loan-purpose-select"><option>I'm Purchasing</option></select>
        <select id="property-potential-state-select"><option>${scenario.property.state}</option></select>
        <select id="self-credit-score-select"><option>Good (700 – 739)</option></select>
        <input id="property-estimated-price-input"><input id="property-down-payment-input">
        <button id="button-next" onclick="window.captureDirectBasics({
          price: document.querySelector('#property-estimated-price-input').value,
          down: document.querySelector('#property-down-payment-input').value
        }).then(() => location.href='/apply/lo-selection?gr-loan-guid=fixture-only')">Continue</button>
      </main>`;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  await page.goto('https://apply.dmx.test/apply/express-loan?gr-loan-guid=fixture-only');

  const visited = await runApplication(page, scenario, {
    loanOfficerMode: 'none',
    stopAfter: 'lo-selection',
  });
  assert.deepEqual(captured, [{ price: String(scenario.loan.price), down: String(scenario.loan.down) }]);
  assert.deepEqual(choices, ['No']);
  assert.deepEqual(visited, ['express-loan', 'lo-selection']);
  assert.match(new URL(page.url()).pathname, /\/apply\/lo-selection$/);
});

test('consumer-direct Lab policy is limited to GRI DEV without LO-B', () => {
  const dev = DMX_ENTRY_TARGETS.find(target => target.id === 'dev-gri-enhanced');
  const prod = DMX_ENTRY_TARGETS.find(target => target.id === 'prod-gri-enhanced');
  assert.equal(canLaunchLoan(dev, { category: 'incomplete-consumer-direct' }, 'none'), true);
  assert.equal(canLaunchLoan(dev, { category: 'incomplete-consumer-direct' }, 'lo-b'), false);
  assert.equal(canLaunchLoan(dev, { category: 'incomplete-resume' }, 'none'), false);
  assert.equal(canLaunchLoan(dev, { category: 'complete-application' }, 'lo-b'), true);
  assert.equal(canLaunchLoan(prod, { category: 'incomplete-consumer-direct' }, 'none'), false);
});

test('public consumer-direct run omits runtime account credentials', () => {
  const result = publicRun({
    id: 'fixture',
    category: 'incomplete-consumer-direct',
    email: credentials.email,
    password: credentials.password,
    status: 'running',
    startedAt: Date.now(),
    progress: 0,
  });
  assert.equal(result.email, '');
  assert.equal(Object.hasOwn(result, 'password'), false);
  assert.equal(JSON.stringify(result).includes(credentials.email), false);
  assert.equal(JSON.stringify(result).includes(credentials.password), false);
});

test('existing loan list uses the selected entry when no new-application action exists', async () => {
  await loginFixture(form, 'https://my.dmx.test/loans');
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password, ENTRY_URLS['lo-a']), true);
  assert.equal(page.url(), ENTRY_URLS['lo-a']);
});

test('existing loan overview starts a new application via the visible action', async () => {
  await page.route('**/*', route => {
    const url = route.request().url();
    const body = url === loginUrl
      ? `<form onsubmit="event.preventDefault(); location.href='https://my.dmx.test/loan/fixture/overview'">${form}</form>`
      : url.includes('/overview') ? `<a href="${applicationUrl}">Start a new application</a>` : '<main>New application</main>';
    return route.fulfill({ contentType: 'text/html', body });
  });
  await page.goto(loginUrl);
  assert.equal(await handleLoginRedirect(page, credentials.email, credentials.password), true);
  assert.equal(page.url(), applicationUrl);
});

for (const outcome of ['new-account', 'login', 'authenticated']) {
  test(`registration handles ${outcome} without waiting for the wrong route`, async () => {
    let passwordPageVisits = 0;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      let body = '<main>Application ready</main>';
      if (url.pathname === '/apply/loan-purpose') {
        body = `<main><button onclick="location.href='/apply/user-info-ef'">I'm Purchasing</button></main>`;
      } else if (url.pathname === '/apply/user-info-ef') {
        const destination = outcome === 'new-account' ? '/apply/personal-info-create-account'
          : outcome === 'login' ? loginUrl : '/apply/purchase-needs?icid=auth%7Clogin';
        body = `<main><input id="user-first-name-input"><input id="user-last-name-input"><input id="user-home-phone-input"><input id="user-email-input"><select id="user-communication-method-select"><option>Email</option></select><button id="button-next" onclick="location.href='${destination}'">Continue</button></main>`;
      } else if (url.pathname === '/apply/personal-info-create-account') {
        passwordPageVisits++;
        body = `<main><input id="user-password-input"><input id="user-confirm-password-input"><button id="button-next" onclick="location.href='/apply/borrower-referral'">Continue</button></main>`;
      } else if (url.hostname === 'login.dmx.test') {
        body = `<form onsubmit="event.preventDefault(); location.href='${applicationUrl}'">${form}</form>`;
      }
      return route.fulfill({ contentType: 'text/html', body });
    });
    await register(page, loadScenarios()[0], credentials.email, credentials.password);
    assert.equal(passwordPageVisits, outcome === 'new-account' ? 1 : 0);
    assert.match(new URL(page.url()).pathname, /\/apply\/(borrower-referral|purchase-needs)$/);
    if (outcome === 'authenticated') assert.equal(new URL(page.url()).searchParams.get('icid'), 'auth|login');
    if (outcome === 'new-account') assert.equal(new URL(page.url()).origin, new URL(ENTRY_URL).origin);
  });
}

for (const variant of ['duration', 'date']) {
  test(`residence handler supports the ${variant} form contract`, async () => {
    const scenario = loadScenarios()[0];
    const submitted = [];
    await page.exposeFunction('recordResidence', value => submitted.push(value));
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body:
      new URL(route.request().url()).pathname === '/apply/done' ? '<main>Done</main>' : `<main>
        <input id="user-address-1-input"><input id="user-city-input">
        <select id="user-state-select"><option>${scenario.residence.state}</option></select><input id="user-zip-code-input">
        ${variant === 'date' ? '<input id="user-residence-started-input">' : '<label>Years*<input id="years"></label><label>Months*<input id="months"></label>'}
        <div id="user-residence-status-radio"><button>Rent</button></div><input id="estimated-monthly-expenses-rent-input">
        <button id="button-next" onclick="window.recordResidence(Array.from(document.querySelectorAll('input')).map(input => ({id: input.id, value: input.value}))).then(() => location.href='/apply/done')">Continue</button>
      </main>` }));
    await page.goto('https://apply.dmx.test/apply/user-residence-ef');
    await runApplication(page, scenario, { stopAt: 'done' });
    const values = Object.fromEntries(submitted[0].map(input => [input.id, input.value]));
    assert.equal(values['user-address-1-input'], scenario.residence.address);
    if (variant === 'date') assert.equal(values['user-residence-started-input'], scenario.residence.moveIn.replace('/', ''));
    else {
      const [month, year] = scenario.residence.moveIn.split('/').map(Number);
      const today = new Date();
      const months = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month;
      assert.equal(values.years, String(Math.floor(months / 12)));
      assert.equal(values.months, String(months % 12));
    }
  });
}

for (const variant of ['duration', 'date']) {
  test(`co-borrower residence handler supports the ${variant} form contract`, async () => {
    const scenario = loadScenarios().find(item => item.id === 'PUR-09-coborrower-good-credit-mid-loan');
    const submitted = [];
    await page.exposeFunction('recordCoResidence', value => submitted.push(value));
    await page.route('**/*', route => fulfillCoBorrowerResidence(route, variant));
    await page.goto('https://apply.dmx.test/apply/co-borrower-personal');
    await runApplication(page, scenario, { stopAt: 'done' });
    const values = Object.fromEntries(submitted[0].map(input => [input.id, input.value]));
    if (variant === 'date') assert.equal(values['co-borrower-residence-started-input'], scenario.residence.moveIn.replace('/', ''));
    else {
      const [month, year] = scenario.residence.moveIn.split('/').map(Number);
      const today = new Date();
      const months = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month;
      assert.equal(values.years, String(Math.floor(months / 12)));
      assert.equal(values.months, String(months % 12));
    }
  });
}

function fulfillCoBorrowerResidence(route, variant) {
  const fields = variant === 'date'
    ? '<input id="co-borrower-residence-started-input">'
    : '<label>Years*<input id="years"></label><label>Months*<input id="months"></label>';
  const body = `<main>
    <input id="co-borrower-email-input"><input id="co-borrower-home-phone-input">
    <div id="co-government-ownership-interest-radio"><button>No</button></div>
    <div id="co-borrower-marital-status-radio"><button>Married</button></div>
    <div id="co-borrower-address-same-radio"><button>Yes</button><button>No</button></div>
    ${fields}
    <div id="co-borrower-dependents-radio"><button>No</button></div>
    <button id="button-next" onclick="window.recordCoResidence(Array.from(document.querySelectorAll('input')).map(input => ({id: input.id, value: input.value}))).then(() => location.href='/apply/done')">Continue</button>
  </main>`;
  return route.fulfill({ contentType: 'text/html', body });
}

test('purchase-needs selects signed-contract path for the Alice purchase scenario', async () => {
    const scenario = loadScenarios().find(item => item.id === 'PUR-10-single-alice-signed-contract');
    const selected = [];
    await page.exposeFunction('recordIntent', value => selected.push(value.trim()));
    await page.route('**/*', route => {
      const body = new URL(route.request().url()).pathname === '/apply/done'
        ? '<main>Done</main>'
        : `<main>
          <button onclick="window.recordIntent(this.textContent).then(() => location.href='/apply/done')">I’m researching what I can afford</button>
          <button onclick="window.recordIntent(this.textContent).then(() => location.href='/apply/done')">I’m looking at homes and listings</button>
          <button onclick="window.recordIntent(this.textContent).then(() => location.href='/apply/done')">I found a house I’d like to buy</button>
          <button onclick="window.recordIntent(this.textContent).then(() => location.href='/apply/done')">I signed a purchase agreement</button>
        </main>`;
      return route.fulfill({ contentType: 'text/html', body });
    });
    await page.goto('https://apply.dmx.test/apply/purchase-needs');
    await runApplication(page, scenario, { stopAt: 'done' });
    assert.deepEqual(selected, ['I signed a purchase agreement']);
});

test('refinance property route fills the confirmation form when it replaces address entry', async () => {
  const scenario = loadScenarios().find(item => item.id === 'REF-04-single-andy-america-rate-term');
  const submitted = [];
  await page.exposeFunction('recordRefiDetails', values => submitted.push(values));
  await page.route('**/*', route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === '/apply/property-address-refi2'
      ? `<main>
          <input id="refi-year-purchased-input"><input id="refi-purchase-price-input">
          <select id="property-type-select"><option>Single Family</option></select>
          <input id="refi-estimated-value-input">
          <button id="button-next" onclick="window.recordRefiDetails(Array.from(document.querySelectorAll('input, select')).map(input => ({id: input.id, value: input.value}))).then(() => location.href='/apply/interest-rate-refi2')">Confirm</button>
        </main>`
      : '<main>Interest rate</main>';
    return route.fulfill({ contentType: 'text/html', body });
  });
  await page.goto('https://apply.dmx.test/apply/property-address-refi2');
  await runApplication(page, scenario, { stopAt: 'interest-rate-refi2' });
  assert.deepEqual(Object.fromEntries(submitted[0].map(field => [field.id, field.value])), {
    'refi-year-purchased-input': String(scenario.loan.yearPurchased),
    'refi-purchase-price-input': String(scenario.loan.origPrice),
    'property-type-select': scenario.property.propertyType,
    'refi-estimated-value-input': String(scenario.loan.currentValue),
  });
});
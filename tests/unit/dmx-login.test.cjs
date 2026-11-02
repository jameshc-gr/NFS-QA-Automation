const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { handleLoginRedirect, register, runApplication, ENTRY_URL, ENTRY_URLS } = require('../projects/DMX/dmx-engine.ts');
const { loadScenarios } = require('../projects/DMX/dmx-data.ts');

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
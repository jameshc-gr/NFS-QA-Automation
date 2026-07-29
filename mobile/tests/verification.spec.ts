import assert from 'node:assert/strict';

import { extractCodeFromText } from '../src/utils/verification/code-parser';
import { generateAccountEmail, mailboxFromEmail } from '../src/utils/account-registry';
import { resolveEnvironment, resolveVerificationInbox } from '../src/utils/mobile-auth';

describe('Verification utilities', () => {
  it('extracts verification codes from message text', () => {
    assert.equal(extractCodeFromText('Your security verification code is 849201. Do not share it.'), '849201');
    assert.equal(extractCodeFromText('Your rate app code: 1234'), '1234');
    assert.equal(extractCodeFromText('483920 is your verification code'), '483920');
    assert.equal(extractCodeFromText('no digits here'), null);
  });

  it('extracts the 6-digit code from the redirected registration email', () => {
    const email = [
      'Verify registration [Test redirect; original recipients): to: my-auto-rateapp-jc8aq05d@yopmail.com]',
      'No Reply <no-reply@guaranteedrate.com>',
      "Let's complete your registration!",
      'Hi Jordan,',
      'Thank you for creating an account with Rate.',
      'Before you get started, we need to confirm your email address. Copy your verification',
      'code below and paste it into the Rate app to complete the process.',
      '923905',
      'Thank you,',
    ].join('\n');

    assert.equal(extractCodeFromText(email, 6), '923905');
  });

  it('generates unique alphanumeric account emails in the required format', () => {
    const pattern = /^my-auto-rateapp-jc[a-z0-9]{6}@yopmail\.com$/;
    const emails = new Set<string>();

    for (let i = 0; i < 20; i += 1) {
      const email = generateAccountEmail();
      assert.match(email, pattern);
      emails.add(email);
    }

    assert.equal(emails.size, 20, 'Generated emails should be unique per call');
  });

  it('derives the yopmail mailbox from an address', () => {
    assert.equal(mailboxFromEmail('v3test@yopmail.com'), 'v3test');
  });
});

describe('Verification inbox routing', () => {
  const account = 'my-auto-rateapp-jcab12cd@yopmail.com';
  const original = process.env.MOBILE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.MOBILE_ENV;
    else process.env.MOBILE_ENV = original;
  });

  it('routes dev runs to the shared Outlook redirect inbox, matched by subject', () => {
    process.env.MOBILE_ENV = 'dev';
    const inbox = resolveVerificationInbox(account);

    assert.equal(inbox.environment, 'dev');
    assert.equal(inbox.provider, 'outlook');
    assert.equal(inbox.mailbox, 'v3test@rate.com');
    assert.equal(inbox.subjectContains, account);
  });

  it('routes prod runs to the generated account yopmail mailbox', () => {
    process.env.MOBILE_ENV = 'prod';
    const inbox = resolveVerificationInbox(account);

    assert.equal(inbox.environment, 'prod');
    assert.equal(inbox.provider, 'yopmail');
    assert.equal(inbox.mailbox, account);
    assert.equal(inbox.subjectContains, undefined);
  });

  it('treats "production" as prod and defaults to dev', () => {
    process.env.MOBILE_ENV = 'production';
    assert.equal(resolveEnvironment(), 'prod');

    delete process.env.MOBILE_ENV;
    assert.equal(resolveEnvironment(), 'dev');
  });
});

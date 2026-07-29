import path from 'node:path';
import { existsSync } from 'node:fs';

import { getVerificationConfig, resolveEnvironment, resolveVerificationInbox } from '../mobile/src/utils/mobile-auth';
import { generateAccountEmail } from '../mobile/src/utils/account-registry';
import { extractCodeFromText } from '../mobile/src/utils/verification/code-parser';

const GV_STATE = path.resolve(process.cwd(), 'mobile/.auth/google-voice-session.json');
const OUTLOOK_STATE = path.resolve(process.cwd(), 'mobile/.auth/outlook-session.json');

function report(label: string, ok: boolean, detail: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} - ${detail}`);
}

function describeInbox(accountEmail: string, env: 'dev' | 'prod'): string {
  const previous = process.env.MOBILE_ENV;
  process.env.MOBILE_ENV = env;
  const inbox = resolveVerificationInbox(accountEmail);
  if (previous === undefined) delete process.env.MOBILE_ENV;
  else process.env.MOBILE_ENV = previous;

  return `${inbox.provider} :: ${inbox.mailbox}${inbox.subjectContains ? ` (subject ~ ${inbox.subjectContains})` : ''}`;
}

function main(): void {
  console.log('Mobile verification preflight\n');

  const config = getVerificationConfig();

  const sample = generateAccountEmail();
  report('email generator', /^my-auto-rateapp-jc[a-z0-9]{6}@yopmail\.com$/.test(sample), sample);

  const parsed = extractCodeFromText('Your verification code is 483920. It expires in 10 minutes.');
  report('code parser', parsed === '483920', `parsed ${parsed}`);

  report('active environment', true, resolveEnvironment());

  const devInbox = describeInbox(sample, 'dev');
  const prodInbox = describeInbox(sample, 'prod');
  report('dev inbox routing', devInbox.startsWith('outlook'), devInbox);
  report('prod inbox routing', prodInbox.startsWith('yopmail') && prodInbox.includes(sample), prodInbox);

  report('sms phone number', Boolean(config.verification?.phoneNumber), config.verification?.phoneNumber || 'unset');

  report(
    'google voice session',
    existsSync(GV_STATE),
    existsSync(GV_STATE) ? GV_STATE : 'missing - run npm run setup:gv-session'
  );

  report(
    'outlook session',
    existsSync(OUTLOOK_STATE),
    existsSync(OUTLOOK_STATE) ? OUTLOOK_STATE : 'missing - run npm run setup:outlook-session'
  );
}

main();

import { extractCodeFromText } from './google-voice';

// Guerrilla Mail's JSON API is officially built for automated inbox reads and,
// unlike Yopmail, does not gate requests behind a reCAPTCHA challenge.
const GUERRILLA_API = 'https://api.guerrillamail.com/ajax.php';

export interface GuerrillaMailOptions {
  mailbox: string;
  domain?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  // Codes already tried and rejected by the app; keep waiting for a code
  // that isn't one of these instead of re-returning a stale/wrong one.
  excludeCodes?: string[];
}

interface GuerrillaMessage {
  mail_id?: string | number;
  mail_subject?: string;
  mail_excerpt?: string;
  mail_body?: string;
  mail_timestamp?: string | number;
}

async function guerrillaRequest(params: Record<string, string>): Promise<any> {
  const url = `${GUERRILLA_API}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Guerrilla Mail request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// No-op kept for parity with the other providers' warm-up hook; the inbox is
// created on demand by fetchGuerrillaMailCode itself.
export async function warmUpGuerrillaMailInbox(_mailbox: string): Promise<void> {
  return;
}

export async function fetchGuerrillaMailCode(options: GuerrillaMailOptions): Promise<string> {
  const { mailbox, domain = 'sharklasers.com', timeoutMs = 60000, pollIntervalMs = 5000, excludeCodes = [] } = options;
  if (!mailbox) {
    throw new Error('Guerrilla Mail mailbox name is required.');
  }

  const session = await guerrillaRequest({ f: 'get_email_address' });
  const sidToken = session.sid_token;

  // Pins the session to our fixed mailbox name/domain instead of the random
  // address get_email_address generates, and starts the inbox out empty.
  await guerrillaRequest({ f: 'set_email_user', email_user: mailbox, domain, sid_token: sidToken });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inbox = await guerrillaRequest({ f: 'check_email', seq: '0', sid_token: sidToken });
    const messages: GuerrillaMessage[] = inbox?.list ?? [];
    // Multiple verification emails can pile up after a resend; only look at
    // genuine verification mail, latest first, so a stale/older message never
    // wins over a fresher resend.
    const verificationMessages = messages
      .filter((message) => typeof message.mail_id !== 'undefined' && /verify/i.test(message.mail_subject ?? ''))
      .sort((a, b) => Number(b.mail_timestamp ?? 0) - Number(a.mail_timestamp ?? 0));

    for (const message of verificationMessages) {
      // check_email only returns a blank excerpt for HTML mail; the code lives
      // in the full body, which requires a separate fetch_email call.
      const full = await guerrillaRequest({ f: 'fetch_email', email_id: String(message.mail_id), sid_token: sidToken });
      const combinedText = `${full.mail_subject ?? ''} ${full.mail_excerpt ?? ''} ${full.mail_body ?? ''}`;
      const code = extractCodeFromText(combinedText);
      if (code && !excludeCodes.includes(code)) {
        return code;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Could not find a new verification code in Guerrilla Mail inbox for mailbox: ${mailbox}@${domain}`);
}

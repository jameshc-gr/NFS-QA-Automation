import { extractCodeFromText } from './google-voice';

// easy-yopmail has no type declarations; it talks to Yopmail's internal HTML
// endpoints directly instead of loading the full site, which avoids the
// reCAPTCHA wall that blocks a real browser from viewing the inbox.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const easyYopmail = require('easy-yopmail');

export interface YopmailOptions {
  mailbox: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  // Codes already tried and rejected by the app; keep waiting for a code
  // that isn't one of these instead of re-returning a stale/wrong one.
  excludeCodes?: string[];
}

// No-op kept for backwards compatibility with existing call sites; the
// easy-yopmail HTTP-based reader does not need a browser warm-up visit.
export async function warmUpYopmailInbox(_mailbox: string): Promise<void> {
  return;
}

export async function fetchYopmailCode(options: YopmailOptions): Promise<string> {
  const { mailbox, timeoutMs = 60000, pollIntervalMs = 5000, excludeCodes = [] } = options;
  if (!mailbox) {
    throw new Error('Yopmail mailbox name is required.');
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Yopmail lists newest mail first, so scanning in order already checks
    // the latest message before any older, possibly-stale one.
    const inbox = await easyYopmail.getInbox(mailbox, {}, { LIMIT: 5 });
    const messages = inbox?.inbox ?? [];

    for (const message of messages) {
      const combinedText = `${message.subject ?? ''} ${message.from ?? ''}`;
      const subjectCode = extractCodeFromText(combinedText);
      if (subjectCode && !excludeCodes.includes(subjectCode)) {
        return subjectCode;
      }

      const details = await easyYopmail.readMessage(mailbox, message.id, 'TXT').catch(() => null);
      const bodyCode = details?.data ? extractCodeFromText(details.data) : null;
      if (bodyCode && !excludeCodes.includes(bodyCode)) {
        return bodyCode;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Could not find a new verification code in Yopmail inbox for mailbox: ${mailbox}`);
}

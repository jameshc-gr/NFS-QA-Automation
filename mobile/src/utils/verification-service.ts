import { fetchGoogleVoiceSmsCode } from './verification/google-voice';
import { fetchYopmailCode } from './verification/yopmail';
import { fetchOutlookCodeGraph, fetchOutlookCodeOWA } from './verification/outlook';
import { getVerificationConfig } from './mobile-auth';

export type VerificationProvider = 'google-voice' | 'yopmail' | 'outlook' | 'manual';

export interface GetVerificationCodeOptions {
  provider?: VerificationProvider;
  /** Yopmail mailbox (local part or full address). */
  mailbox?: string;
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  headless?: boolean;
  /** Restrict the search to a message whose subject contains this text. */
  subjectContains?: string;
  /** Expected number of digits in the code. Defaults to 6. */
  codeLength?: number;
}

export async function getVerificationCode(
  channel: 'email' | 'phone',
  options: GetVerificationCodeOptions = {}
): Promise<string> {
  const config = getVerificationConfig();
  const configured =
    channel === 'phone' ? config.verification?.phone : config.verification?.email;
  const provider =
    options.provider ||
    (configured && configured !== 'manual'
      ? (configured as VerificationProvider)
      : channel === 'phone'
        ? 'google-voice'
        : 'yopmail');

  switch (provider) {
    case 'google-voice':
      return await fetchGoogleVoiceSmsCode({
        headless: options.headless,
        timeoutMs: options.timeoutMs,
        pollIntervalMs: options.pollIntervalMs,
      });

    case 'yopmail': {
      const mailbox = options.mailbox;
      if (!mailbox) {
        throw new Error(
          'Yopmail verification requires a mailbox. Pass options.mailbox, or use resolveVerificationInbox(accountEmail) to derive it.'
        );
      }
      return await fetchYopmailCode({
        mailbox,
        headless: options.headless,
        timeoutMs: options.timeoutMs,
        pollIntervalMs: options.pollIntervalMs,
        subjectContains: options.subjectContains,
      });
    }

    case 'outlook': {
      const outlookOptions = {
        email: options.email || config.outlook?.email,
        // Read the shared redirect mailbox rather than the signed-in account.
        mailbox: options.mailbox,
        password: options.password || config.outlook?.password,
        tenantId: options.tenantId || config.outlook?.tenantId,
        clientId: options.clientId || config.outlook?.clientId,
        clientSecret: options.clientSecret || config.outlook?.clientSecret,
        headless: options.headless,
        timeoutMs: options.timeoutMs,
        pollIntervalMs: options.pollIntervalMs,
        subjectContains: options.subjectContains,
        codeLength: options.codeLength,
      };

      return outlookOptions.clientId && outlookOptions.clientSecret
        ? await fetchOutlookCodeGraph(outlookOptions)
        : await fetchOutlookCodeOWA(outlookOptions);
    }

    default:
      throw new Error(`Unsupported verification provider: ${provider}`);
  }
}

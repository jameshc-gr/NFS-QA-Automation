import { fetchGoogleVoiceSmsCode } from './verification/google-voice';
import { fetchYopmailCode } from './verification/yopmail';
import { fetchOutlookCodeGraph } from './verification/outlook';
import { getVerificationConfig } from './mobile-auth';

export type VerificationProvider = 'google-voice' | 'yopmail' | 'outlook' | 'manual';

export interface GetVerificationCodeOptions {
  provider?: VerificationProvider;
  mailbox?: string;
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  timeoutMs?: number;
}

export async function getVerificationCode(
  channel: 'email' | 'phone',
  options: GetVerificationCodeOptions = {}
): Promise<string> {
  const config = getVerificationConfig();
  const provider = options.provider || (channel === 'phone' ? 'google-voice' : 'yopmail');

  switch (provider) {
    case 'google-voice':
      return await fetchGoogleVoiceSmsCode({
        googleEmail: options.email || config.googleVoice?.email,
        googlePassword: options.password || config.googleVoice?.password,
        timeoutMs: options.timeoutMs,
      });

    case 'yopmail':
      if (!options.mailbox) {
        throw new Error('Yopmail verification requires a mailbox name option.');
      }
      return await fetchYopmailCode({
        mailbox: options.mailbox,
        timeoutMs: options.timeoutMs,
      });

    case 'outlook':
      return await fetchOutlookCodeGraph({
        email: options.email || config.outlook?.email,
        password: options.password || config.outlook?.password,
        tenantId: options.tenantId || config.outlook?.tenantId,
        clientId: options.clientId || config.outlook?.clientId,
        clientSecret: options.clientSecret || config.outlook?.clientSecret,
        timeoutMs: options.timeoutMs,
      });

    default:
      throw new Error(`Unsupported verification provider: ${provider}`);
  }
}

import { fetchGoogleVoiceSmsCode } from './verification/google-voice';
import { fetchYopmailCode, warmUpYopmailInbox } from './verification/yopmail';
import { fetchGuerrillaMailCode } from './verification/guerrilla-mail';
import { fetchOutlookCodeGraph } from './verification/outlook';
import { getVerificationConfig, getMobileEnvironment, resolveGoogleVoiceProfile } from './mobile-auth';

export type VerificationProvider = 'google-voice' | 'yopmail' | 'guerrillamail' | 'outlook' | 'manual';

export interface GetVerificationCodeOptions {
  provider?: VerificationProvider;
  googleVoiceProfile?: string;
  mailbox?: string;
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  timeoutMs?: number;
  // Codes already tried and rejected by the app; the provider should keep
  // waiting for a code that isn't one of these.
  excludeCodes?: string[];
  // For Google Voice, read once from the latest thread without waiting/polling.
  singleCheck?: boolean;
}

export async function getVerificationCode(
  channel: 'email' | 'phone',
  options: GetVerificationCodeOptions = {}
): Promise<string> {
  const config = getVerificationConfig();
  const provider = options.provider
    || (channel === 'phone' ? config.verification.phone : config.verification.email)
    || (channel === 'phone' ? 'google-voice' : 'yopmail');

  const source = describeVerificationSource(channel, provider, config, options);
  console.log(`[Verification] env=${getMobileEnvironment()} channel=${channel} source=${source}`);

  const startedAt = Date.now();
  try {
    const code = await retrieveCode(channel, provider, config, options);
    console.log(
      `[Verification] SUCCESS via ${source} \u2014 code ${code} in ${Math.round((Date.now() - startedAt) / 1000)}s`
    );
    return code;
  } catch (error) {
    console.error(
      `[Verification] FAILED via ${source} after ${Math.round((Date.now() - startedAt) / 1000)}s:`,
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

function describeVerificationSource(
  channel: 'email' | 'phone',
  provider: VerificationProvider,
  config: ReturnType<typeof getVerificationConfig>,
  options: GetVerificationCodeOptions
): string {
  if (provider === 'outlook') {
    const mailbox = options.email || config.outlook?.email || '(unset)';
    return `outlook:${mailbox}${config.outlook?.folder ? `/${config.outlook.folder}` : ''}`;
  }
  if (provider === 'guerrillamail' || provider === 'yopmail') {
    return `${provider}:${options.mailbox || '(unset)'}`;
  }
  if (provider === 'google-voice') {
    return `google-voice:${config.verification.phoneNumber}`;
  }
  return `${provider}:${channel}`;
}

async function retrieveCode(
  channel: 'email' | 'phone',
  provider: VerificationProvider,
  config: ReturnType<typeof getVerificationConfig>,
  options: GetVerificationCodeOptions
): Promise<string> {
  switch (provider) {
    case 'google-voice':
      {
      const profile = resolveGoogleVoiceProfile(options.googleVoiceProfile);
      return await fetchGoogleVoiceSmsCode({
        sessionPath: profile.sessionPath,
        headless: profile.headless,
        timeoutMs: options.timeoutMs || profile.timeoutMs,
        pollIntervalMs: profile.pollIntervalMs,
        excludeCodes: options.excludeCodes,
        singleCheck: options.singleCheck,
      });
      }

    case 'yopmail':
      if (!options.mailbox) {
        throw new Error('Yopmail verification requires a mailbox name option.');
      }
      return await fetchYopmailCode({
        mailbox: options.mailbox,
        timeoutMs: options.timeoutMs,
        excludeCodes: options.excludeCodes,
      });

    case 'guerrillamail':
      if (!options.mailbox) {
        throw new Error('Guerrilla Mail verification requires a mailbox name option.');
      }
      return await fetchGuerrillaMailCode({
        mailbox: options.mailbox,
        timeoutMs: options.timeoutMs,
        excludeCodes: options.excludeCodes,
      });

    case 'outlook':
      return await fetchOutlookCodeGraph({
        email: options.email || config.outlook?.email,
        password: options.password || config.outlook?.password,
        tenantId: options.tenantId || config.outlook?.tenantId,
        clientId: options.clientId || config.outlook?.clientId,
        clientSecret: options.clientSecret || config.outlook?.clientSecret,
        folder: config.outlook?.folder,
        timeoutMs: options.timeoutMs,
        excludeCodes: options.excludeCodes,
      });

    default:
      throw new Error(`Unsupported verification provider: ${provider}`);
  }
}

// Kept for backwards compatibility; easy-yopmail reads mail via HTTP and
// does not need the inbox opened in a browser first.
export async function warmUpEmailInboxIfNeeded(mailbox: string): Promise<void> {
  const config = getVerificationConfig();
  if (config.verification.email === 'yopmail') {
    await warmUpYopmailInbox(mailbox);
  }
}

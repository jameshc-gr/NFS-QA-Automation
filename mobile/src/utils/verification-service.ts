import { fetchGoogleVoiceSmsCode } from './verification/google-voice';
import { fetchGuerrillaMailCode } from './verification/guerrilla-mail';
import { fetchOutlookCodeGraph } from './verification/outlook';
import { getVerificationConfig, getMobileEnvironment, resolveGoogleVoiceProfile } from './mobile-auth';

export type VerificationProvider = 'google-voice' | 'guerrillamail' | 'outlook' | 'manual' | 'mock';

export interface GetVerificationCodeOptions {
  provider?: VerificationProvider;
  googleVoiceProfile?: string;
  mailbox?: string;
  domain?: string;
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  titleMustContain?: string;
  subjectMustContain?: string;
  timeoutMs?: number;
  // Codes already tried and rejected by the app; the provider should keep
  // waiting for a code that isn't one of these.
  excludeCodes?: string[];
  // For Google Voice, read once from the latest thread without waiting/polling.
  singleCheck?: boolean;
  // For Google Voice, only accept a code whose message preview differs from
  // this baseline, proving a genuinely new message arrived.
  baselinePreviewText?: string;
}

function isVerificationMockEnabled(): boolean {
  return (process.env.MOBILE_VERIFICATION_MODE || '').toLowerCase() === 'mock';
}

function resolveMockCode(channel: 'email' | 'phone', options: GetVerificationCodeOptions): string {
  const envCode = channel === 'email'
    ? process.env.MOBILE_MOCK_EMAIL_CODE
    : process.env.MOBILE_MOCK_SMS_CODE;
  if (envCode) {
    return envCode;
  }
  // Exclude any codes the caller has already tried so remediation/retry loops can
  // simulate a fresh code arriving.
  const base = channel === 'email' ? '123456' : '654321';
  if (options.excludeCodes?.includes(base)) {
    const alternative = channel === 'email' ? '111111' : '999999';
    return alternative;
  }
  return base;
}

export async function getVerificationCode(
  channel: 'email' | 'phone',
  options: GetVerificationCodeOptions = {}
): Promise<string> {
  const config = getVerificationConfig();
  const requestedProvider = options.provider
    || (channel === 'phone' ? config.verification.phone : config.verification.email)
    || (channel === 'phone' ? 'google-voice' : 'guerrillamail');

  const provider: VerificationProvider = isVerificationMockEnabled() ? 'mock' : requestedProvider;

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
  if (provider === 'mock') {
    return `mock:${channel}`;
  }
  if (provider === 'outlook') {
    const mailbox = options.email || config.outlook?.email || '(unset)';
    return `outlook:${mailbox}${config.outlook?.folder ? `/${config.outlook.folder}` : ''}`;
  }
  if (provider === 'guerrillamail') {
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
    case 'mock':
      return resolveMockCode(channel, options);

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
        baselinePreviewText: options.baselinePreviewText,
      });
      }

    case 'guerrillamail':
      if (!options.mailbox) {
        throw new Error('Guerrilla Mail verification requires a mailbox name option.');
      }
      return await fetchGuerrillaMailCode({
        mailbox: options.mailbox,
        domain: options.domain,
        timeoutMs: options.timeoutMs,
        excludeCodes: options.excludeCodes,
        subjectMustContain: options.subjectMustContain,
      });

    case 'outlook':
      return await fetchOutlookCodeGraph({
        email: options.email || config.outlook?.email,
        password: options.password || config.outlook?.password,
        tenantId: options.tenantId || config.outlook?.tenantId,
        clientId: options.clientId || config.outlook?.clientId,
        clientSecret: options.clientSecret || config.outlook?.clientSecret,
        titleMustContain: options.titleMustContain,
        subjectMustContain: options.subjectMustContain,
        folder: config.outlook?.folder,
        timeoutMs: options.timeoutMs,
        excludeCodes: options.excludeCodes,
      });

    default:
      throw new Error(`Unsupported verification provider: ${provider}`);
  }
}

// Kept for backwards compatibility with older spec call sites.
export async function warmUpEmailInboxIfNeeded(mailbox: string): Promise<void> {
  void mailbox;
}

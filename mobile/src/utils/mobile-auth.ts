import readline from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { decryptObjectSecrets } from './crypto-utils';

type LoginAccountKey = 'createUser' | 'login';

export type TestEnvironment = 'dev' | 'prod';

export interface VerificationInboxConfig {
  provider?: 'yopmail' | 'outlook';
  /**
   * Shared inbox that receives redirected verification email.
   * Leave empty to read the generated account's own mailbox instead.
   */
  address?: string;
  mailbox?: string;
  /** Match the message by the generated account address in the subject. */
  matchSubjectByAccountEmail?: boolean;
}

interface LoginConfig {
  emailPrefix: string;
  emailDomain: string;
  password: string;
  loginEmail?: string;
  createEmailPrefix?: string;
  createEmailStart?: number;
  accounts: Partial<Record<LoginAccountKey, number>>;
}

interface RuntimeConfig {
  environment?: TestEnvironment;
  verification: {
    email: 'manual' | 'yopmail' | 'outlook';
    phone: 'manual' | 'google-voice';
    phoneNumber: string;
    provider: string;
  };
  verificationInbox?: Partial<Record<TestEnvironment, VerificationInboxConfig>>;
  googleVoice?: {
    email?: string;
    password?: string;
  };
  outlook?: {
    email?: string;
    password?: string;
    /** Okta sign-in id, which differs from the mailbox address. */
    oktaUsername?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  /** Real-device only: the simulator cannot install TestFlight or App Store builds. */
  testflight?: {
    appleId?: string;
    applePassword?: string;
    deviceUdid?: string;
  };
}

const DEFAULT_LOGIN_CONFIG: LoginConfig = {
  emailPrefix: 'my-rateapp-automation-jc',
  emailDomain: 'yopmail.com',
  password: 'Test123!',
  loginEmail: 'my-rateapp-automation-jc030@yopmail.com',
  createEmailPrefix: 'my-rateapp-auto',
  createEmailStart: 1,
  accounts: {
    createUser: 1,
  },
};

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  environment: 'dev',
  verification: {
    email: 'manual',
    phone: 'manual',
    phoneNumber: '616-320-0701',
    provider: 'google-voice',
  },
  verificationInbox: {
    // Dev redirects every verification email to the shared Outlook mailbox.
    dev: {
      provider: 'outlook',
      address: 'v3test@rate.com',
      mailbox: 'v3test@rate.com',
      matchSubjectByAccountEmail: true,
    },
    // Prod delivers to the generated account's own Yopmail mailbox.
    prod: {
      provider: 'yopmail',
      matchSubjectByAccountEmail: false,
    },
  },
};

function loadYamlFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) {
    return fallback;
  }

  const parsed = YAML.parse(readFileSync(filePath, 'utf8')) as T | undefined;
  if (!parsed) return fallback;

  return decryptObjectSecrets(parsed);
}

/**
 * Config lives per platform so each lane can point at its own app, but the
 * Android files stay the fallback so shared credentials are only stored once.
 */
function resolveConfigFile(fileName: string): string {
  const platform = (process.env.MOBILE_PLATFORM || 'android').toLowerCase() === 'ios' ? 'ios' : 'android';
  const platformFile = path.resolve(process.cwd(), `test-data/mobile-app/gri/${platform}`, fileName);

  return existsSync(platformFile)
    ? platformFile
    : path.resolve(process.cwd(), 'test-data/mobile-app/gri/android', fileName);
}

const loginConfig = loadYamlFile<LoginConfig>(resolveConfigFile('login.yml'), DEFAULT_LOGIN_CONFIG);
const runtimeConfig = loadYamlFile<RuntimeConfig>(resolveConfigFile('config.yml'), DEFAULT_RUNTIME_CONFIG);

export function formatAutomationEmail(index: number): string {
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 1;
  return `${loginConfig.emailPrefix}${String(safeIndex).padStart(8, '0')}@${loginConfig.emailDomain}`;
}

export function formatCreateUserEmail(index: number): string {
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 1;
  const prefix = loginConfig.createEmailPrefix || 'my-rateapp-auto';
  return `${prefix}${String(safeIndex).padStart(6, '0')}@${loginConfig.emailDomain}`;
}

export function getAutomationAccount(accountKey: LoginAccountKey): { email: string; password: string } {
  if (accountKey === 'login') {
    return {
      email: loginConfig.loginEmail || formatAutomationEmail(loginConfig.createEmailStart || 1),
      password: loginConfig.password,
    };
  }

  const accountIndex = loginConfig.accounts[accountKey];
  if (typeof accountIndex !== 'number') {
    throw new Error(`Missing mobile login account configuration for ${accountKey}.`);
  }

  return {
    email: formatCreateUserEmail(accountIndex),
    password: loginConfig.password,
  };
}

export function getAutomationPassword(): string {
  return process.env.MOBILE_TEST_PASSWORD || loginConfig.password;
}

export function getVerificationConfig(): RuntimeConfig {
  return runtimeConfig;
}

/** Active test environment. Override with MOBILE_ENV=dev|prod. */
export function resolveEnvironment(): TestEnvironment {
  const raw = (process.env.MOBILE_ENV || runtimeConfig.environment || 'dev').toLowerCase();
  return raw === 'prod' || raw === 'production' ? 'prod' : 'dev';
}

export interface ResolvedVerificationInbox {
  environment: TestEnvironment;
  provider: 'yopmail' | 'outlook';
  /** Mailbox to read: shared redirect inbox in dev, the account's own box in prod. */
  mailbox: string;
  /** Subject filter, used when several accounts share one inbox. */
  subjectContains?: string;
}

/**
 * Resolves which inbox holds the verification email for a generated account.
 *
 * dev  -> all app email is redirected to the shared Outlook mailbox, so the
 *         message is located by the account address in the subject line.
 * prod -> email is delivered normally, so the account's own Yopmail box is read.
 */
export function resolveVerificationInbox(accountEmail: string): ResolvedVerificationInbox {
  const environment = resolveEnvironment();
  const inbox = runtimeConfig.verificationInbox?.[environment] || DEFAULT_RUNTIME_CONFIG.verificationInbox?.[environment] || {};

  const provider = inbox.provider || (environment === 'dev' ? 'outlook' : 'yopmail');
  const sharedMailbox = process.env.MOBILE_VERIFICATION_MAILBOX || inbox.mailbox || inbox.address;
  const mailbox = sharedMailbox || accountEmail;
  const usesSharedInbox = Boolean(sharedMailbox) && sharedMailbox !== accountEmail;
  const matchBySubject = inbox.matchSubjectByAccountEmail ?? usesSharedInbox;

  return {
    environment,
    provider,
    mailbox,
    subjectContains: matchBySubject ? accountEmail : undefined,
  };
}

export async function promptForVerificationCode(channel: 'email' | 'phone'): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(`Manual ${channel} verification required, but the terminal is not interactive.`);
  }

  return await new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const verificationHint =
      channel === 'phone'
        ? `phone ${runtimeConfig.verification.phoneNumber} via ${runtimeConfig.verification.provider}`
        : 'email inbox';
    rl.question(`Enter the ${channel} verification code from ${verificationHint} and press Enter: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
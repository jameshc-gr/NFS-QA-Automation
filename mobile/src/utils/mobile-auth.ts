import readline from 'node:readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { decryptObjectSecrets } from './crypto-utils';

type LoginAccountKey = 'createUser' | 'login';

interface LoginConfig {
  emailPrefix: string;
  emailDomain: string;
  password: string;
  loginEmail?: string;
  createEmailPrefix?: string;
  createEmailDomain?: string;
  createEmailStart?: number;
  accounts: Partial<Record<LoginAccountKey, number>>;
}

interface CreateEmailConfig {
  prefix?: string;
  domain?: string;
  // Local-part suffix required by the target backend's signup allowlist (PROD needs "--ra").
  tag?: string;
}

interface EnvironmentConfig {
  verification?: Partial<RuntimeConfig['verification']>;
  createEmail?: CreateEmailConfig;
  outlook?: RuntimeConfig['outlook'];
}

interface RuntimeConfig {
  defaultEnvironment?: string;
  environments?: Record<string, EnvironmentConfig>;
  verification: {
    email: 'manual' | 'guerrillamail' | 'outlook';
    phone: 'manual' | 'google-voice';
    phoneNumber: string;
    provider?: string;
    googleVoiceProfile?: string;
  };
  googleVoice?: {
    sessionPath?: string;
    phoneNumber?: string;
    headless?: boolean;
    timeoutMs?: number;
    pollIntervalMs?: number;
    resendAttempts?: number;
    profiles?: Record<string, {
      sessionPath?: string;
      phoneNumber?: string;
      headless?: boolean;
      timeoutMs?: number;
      pollIntervalMs?: number;
      resendAttempts?: number;
    }>;
  };
  outlook?: {
    email?: string;
    password?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    folder?: string;
  };
}

export type EmailVerificationProvider = 'guerrillamail' | 'outlook';

interface CreatedAccountRecord {
  email: string;
  password: string;
  environment: string;
  createdAt: string;
}

const DEFAULT_LOGIN_CONFIG: LoginConfig = {
  emailPrefix: 'my-rateapp-automation-jc',
  emailDomain: 'pokemail.net',
  password: 'Test123!',
  loginEmail: 'my-rateapp-jc000001--ra@pokemail.net',
  createEmailPrefix: 'my-rateapp-auto-jc',
  createEmailStart: 1,
  accounts: {
    createUser: 1,
  },
};

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  verification: {
    email: 'manual',
    phone: 'manual',
    phoneNumber: '616-320-0701',
    provider: 'google-voice',
    googleVoiceProfile: 'default',
  },
  googleVoice: {
    sessionPath: 'mobile/.auth/gv-session.json',
    headless: false,
    timeoutMs: 120000,
    pollIntervalMs: 5000,
    resendAttempts: 2,
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

const authRoot = path.resolve(process.cwd(), 'test-data/mobile-app/gri/android');
const createdAccountsPath = path.resolve(process.cwd(), 'test-data/mobile-app/created-accounts.json');
const testResultsAccountsPath = path.resolve(process.cwd(), 'test-results/mobile-app-accounts.json');
const testResultsRecentPath = path.resolve(process.cwd(), 'test-results/recent-created-accounts.json');
const loginConfig = loadYamlFile<LoginConfig>(path.join(authRoot, 'login.yml'), DEFAULT_LOGIN_CONFIG);
const runtimeConfig = loadYamlFile<RuntimeConfig>(path.join(authRoot, 'config.yml'), DEFAULT_RUNTIME_CONFIG);

function loadCreatedAccounts(): CreatedAccountRecord[] {
  if (!existsSync(createdAccountsPath)) {
    return [];
  }

  try {
    const raw = readFileSync(createdAccountsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item.email === 'string' && typeof item.password === 'string')
      .map((item) => ({
        email: String(item.email).trim(),
        password: String(item.password),
        environment: String(item.environment || ''),
        createdAt: String(item.createdAt || ''),
      }));
  } catch {
    return [];
  }
}

function writeCreatedAccounts(records: CreatedAccountRecord[]): void {
  mkdirSync(path.dirname(createdAccountsPath), { recursive: true });
  writeFileSync(createdAccountsPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function appendToTestResults(entry: CreatedAccountRecord): void {
  try {
    mkdirSync(path.dirname(testResultsAccountsPath), { recursive: true });
    let all: CreatedAccountRecord[] = [];
    if (existsSync(testResultsAccountsPath)) {
      try {
        all = JSON.parse(readFileSync(testResultsAccountsPath, 'utf8')) || [];
        if (!Array.isArray(all)) all = [];
      } catch {
        all = [];
      }
    }

    all.push(entry);
    writeFileSync(testResultsAccountsPath, `${JSON.stringify(all, null, 2)}\n`, 'utf8');

    // Also write a recent-N file for quick access (keep last 20)
    const recent = all.slice(-20).reverse();
    writeFileSync(testResultsRecentPath, `${JSON.stringify(recent, null, 2)}\n`, 'utf8');
  } catch (err) {
    // Do not throw from a recording helper — just log
    // eslint-disable-next-line no-console
    console.error('[recordCreatedAccount] Failed to append to test-results:', err);
  }
}

export function recordCreatedAccount(account: { email: string; password: string }, environment = getMobileEnvironment()): void {
  const email = String(account.email || '').trim().toLowerCase();
  const password = String(account.password || '');
  if (!email || !password) {
    return;
  }

  const existing = loadCreatedAccounts().filter((entry) => entry.email !== email);
  existing.push({
    email,
    password,
    environment,
    createdAt: new Date().toISOString(),
  });

  writeCreatedAccounts(existing);
  // Also append to test-results so each run gets a consolidated file
  try {
    const last = existing[existing.length - 1];
    appendToTestResults(last);
  } catch (err) {
    // swallow
  }
}

export function getRandomCreatedAccount(environment = getMobileEnvironment()): { email: string; password: string } | null {
  const all = loadCreatedAccounts();
  if (!all.length) {
    return null;
  }

  const normalized = String(environment || '').toLowerCase();
  const envPool = all.filter((entry) => entry.environment && entry.environment.toLowerCase() === normalized);
  const source = envPool.length ? envPool : all;
  // Prefer the most recently created account — older test accounts are more
  // likely to have been purged/expired by the backend and would otherwise
  // fail with "we don't recognize this email" on password-reset flows.
  const newest = [...source].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];

  return {
    email: newest.email,
    password: newest.password,
  };
}

export function getMobileEnvironment(): string {
  return process.env.MOBILE_ENV || runtimeConfig.defaultEnvironment || 'prod';
}

export function expectedEmailVerificationProvider(environment = getMobileEnvironment()): EmailVerificationProvider {
  const env = String(environment).toLowerCase();
  if (env === 'prod') {
    return 'guerrillamail';
  }
  // Dev/qa/stage create-user verification is redirected to Outlook v3test.
  return 'outlook';
}

function getEnvironmentConfig(): EnvironmentConfig {
  return runtimeConfig.environments?.[getMobileEnvironment()] || {};
}

function resolveCreateEmailConfig(): Required<CreateEmailConfig> {
  const envCreateEmail = getEnvironmentConfig().createEmail || {};
  return {
    prefix: envCreateEmail.prefix || loginConfig.createEmailPrefix || 'my-rateapp-auto',
    domain: envCreateEmail.domain || loginConfig.createEmailDomain || loginConfig.emailDomain,
    tag: envCreateEmail.tag ?? '',
  };
}

export function formatAutomationEmail(index: number): string {
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 1;
  return `${loginConfig.emailPrefix}${String(safeIndex).padStart(8, '0')}@${loginConfig.emailDomain}`;
}

export function formatCreateUserEmail(index: number): string {
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 1;
  const { prefix, domain, tag } = resolveCreateEmailConfig();
  return `${prefix}${String(safeIndex).padStart(6, '0')}${tag}@${domain}`;
}

function assertCreateUserEmailPolicy(environment: string, email: string): void {
  const normalizedEnv = (environment || '').toLowerCase();
  const normalizedEmail = String(email || '').toLowerCase();
  const domain = normalizedEmail.split('@')[1] || '';
  const hasRateTag = normalizedEmail.includes('--ra@');
  const expectedDomain = 'pokemail.net';

  if (normalizedEnv === 'prod') {
    if (!hasRateTag) {
      throw new Error(
        `Create-user email policy violation: production runs require the --ra-tagged local part. Received "${email}".`
      );
    }

    if (domain !== expectedDomain) {
      throw new Error(
        `Create-user email policy violation: production runs must use ${expectedDomain}. `
          + `Received "${email}" under MOBILE_ENV=${environment}.`
      );
    }
  }

  if (normalizedEnv !== 'prod' && hasRateTag) {
    throw new Error(
      `Create-user email policy violation: --ra tagging is reserved for production builds. `
        + `Received "${email}" under MOBILE_ENV=${environment}.`
    );
  }

  if (normalizedEnv === 'dev' || normalizedEnv === 'stage' || normalizedEnv === 'qa') {
    if (domain !== expectedDomain) {
      throw new Error(
        `Create-user email policy violation: non-prod create-user runs must use ${expectedDomain}. `
          + `Received "${email}" under MOBILE_ENV=${environment}.`
      );
    }
  }
}

export function getAutomationAccount(accountKey: LoginAccountKey): { email: string; password: string } {
  if (accountKey === 'login') {
    const environment = getMobileEnvironment();
    const isProd = String(environment).toLowerCase() === 'prod';

    // Fixed fixture accounts (prod and non-prod) periodically stop working
    // (rotated/expired/never registered), so prefer a real account previously
    // created by create-user (rule: record every created account and reuse
    // them for login-only testing) unless the caller explicitly opts out.
    if (process.env.MOBILE_LOGIN_USE_CREATED_ACCOUNT !== 'false') {
      const reusable = getRandomCreatedAccount(environment);
      if (reusable) {
        return reusable;
      }
    }

    const nonProdLoginEmail = process.env.MOBILE_NON_PROD_LOGIN_EMAIL || 'my-rateapp-jc0015@pokemail.net';
    const nonProdPassword = process.env.MOBILE_NON_PROD_LOGIN_PASSWORD || 'Test123!';

    return {
      email: isProd
        ? (loginConfig.loginEmail || formatAutomationEmail(loginConfig.createEmailStart || 1))
        : nonProdLoginEmail,
      password: isProd ? loginConfig.password : nonProdPassword,
    };
  }

  // Every create-user run needs a brand new mailbox; a static index from
  // login.yml gets reused across runs and collides with "account already
  // exists". Derive a fresh index from the current time instead, so each
  // run gets a different email without hand-editing the YAML.
  const accountIndex = process.env.MOBILE_CREATE_USER_INDEX
    ? Number(process.env.MOBILE_CREATE_USER_INDEX)
    : Math.floor(Date.now() / 1000) % 1000000;

  const environment = getMobileEnvironment();
  const email = formatCreateUserEmail(accountIndex);
  assertCreateUserEmailPolicy(environment, email);

  return {
    email,
    password: loginConfig.password,
  };
}

export function getAutomationPassword(): string {
  return process.env.MOBILE_TEST_PASSWORD || loginConfig.password;
}

export function getVerificationConfig(): RuntimeConfig {
  const environmentConfig = getEnvironmentConfig();
  const environment = getMobileEnvironment();
  const expectedEmailProvider = expectedEmailVerificationProvider(environment);
  const mergedVerification = { ...runtimeConfig.verification, ...environmentConfig.verification };
  const mergedOutlook = { ...runtimeConfig.outlook, ...environmentConfig.outlook };

  if (mergedVerification.email !== expectedEmailProvider) {
    console.warn(
      `[Verification] Overriding email provider to ${expectedEmailProvider} for MOBILE_ENV=${environment} ` +
      `(configured: ${mergedVerification.email || 'unset'}).`
    );
  }

  return {
    ...runtimeConfig,
    verification: {
      ...mergedVerification,
      email: expectedEmailProvider,
    },
    outlook: mergedOutlook,
  };
}

export interface ResolvedGoogleVoiceProfile {
  name: string;
  sessionPath: string;
  phoneNumber: string;
  headless: boolean;
  timeoutMs: number;
  pollIntervalMs: number;
  resendAttempts: number;
}

export function resolveGoogleVoiceProfile(profileName?: string): ResolvedGoogleVoiceProfile {
  const explicitName = profileName || process.env.MOBILE_GV_PROFILE || runtimeConfig.verification.googleVoiceProfile || 'default';
  const rootConfig = runtimeConfig.googleVoice || {};
  const profileConfig = rootConfig.profiles?.[explicitName];

  if (rootConfig.profiles && !profileConfig) {
    const available = Object.keys(rootConfig.profiles);
    throw new Error(
      `Unknown Google Voice profile "${explicitName}". Available profiles: ${available.join(', ') || '(none configured)'}`
    );
  }

  const selected = profileConfig || rootConfig;
  const defaultSession = explicitName === 'default'
    ? 'mobile/.auth/gv-session.json'
    : `mobile/.auth/gv-${explicitName}-session.json`;

  return {
    name: explicitName,
    sessionPath: selected.sessionPath || defaultSession,
    phoneNumber: selected.phoneNumber || runtimeConfig.verification.phoneNumber,
    headless: selected.headless ?? (process.env.MOBILE_GV_HEADLESS ? process.env.MOBILE_GV_HEADLESS === 'true' : true),
    timeoutMs: Number(selected.timeoutMs || 120000),
    pollIntervalMs: Number(selected.pollIntervalMs || 5000),
    resendAttempts: Number(selected.resendAttempts || 2),
  };
}

export async function promptForVerificationCode(channel: 'email' | 'phone'): Promise<string> {
  // Create readline interface that works in both TTY and non-TTY environments
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY
  });

  const config = getVerificationConfig();
  const outlookMailbox = config.outlook?.email || 'v3test@rate.com';
  const outlookWebUrl = process.env.OUTLOOK_WEB_URL || `https://outlook.cloud.microsoft/mail/${outlookMailbox}/`;

  const verificationHint =
    channel === 'phone'
      ? `phone ${runtimeConfig.verification.phoneNumber} via ${runtimeConfig.verification.provider}`
      : `Outlook inbox (${outlookMailbox})`;

  console.log(`\n[VERIFICATION REQUIRED] Enter the ${channel} verification code from ${verificationHint}:`);
  if (channel === 'email') {
    console.log(`[VERIFICATION REQUIRED] Open Outlook web: ${outlookWebUrl}`);
  }
  console.log('Waiting for input from stdin...\n');

  return await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      rl.close();
      reject(new Error(`${channel} verification code input timeout (no input received within 5 minutes)`));
    }, 300000); // 5 minute timeout for manual entry

    rl.on('line', (answer) => {
      clearTimeout(timeout);
      rl.close();
      const code = answer.trim();
      if (!code) {
        reject(new Error(`${channel} verification code cannot be empty`));
      } else {
        console.log(`[VERIFICATION] ${channel.toUpperCase()} code received: ${code}`);
        resolve(code);
      }
    });

    rl.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    rl.on('close', () => {
      clearTimeout(timeout);
    });

    // In TTY mode, show the prompt
    if (process.stdin.isTTY) {
      rl.prompt();
    }
  });
}

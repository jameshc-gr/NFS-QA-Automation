import readline from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

type LoginAccountKey = 'createUser' | 'login';

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
  verification: {
    email: 'manual';
    phone: 'manual';
    phoneNumber: string;
    provider: string;
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
  verification: {
    email: 'manual',
    phone: 'manual',
    phoneNumber: '616-320-0701',
    provider: 'google-voice',
  },
};

function loadYamlFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) {
    return fallback;
  }

  const parsed = YAML.parse(readFileSync(filePath, 'utf8')) as T | undefined;
  return parsed || fallback;
}

const authRoot = path.resolve(process.cwd(), 'test-data/mobile-app/gri/android');
const loginConfig = loadYamlFile<LoginConfig>(path.join(authRoot, 'login.yml'), DEFAULT_LOGIN_CONFIG);
const runtimeConfig = loadYamlFile<RuntimeConfig>(path.join(authRoot, 'config.yml'), DEFAULT_RUNTIME_CONFIG);

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
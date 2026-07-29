import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REGISTRY_DIR = path.resolve(process.cwd(), 'test-results');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'mobile-app-accounts.json');

const EMAIL_PREFIX = 'my-auto-rateapp-jc';
const EMAIL_DOMAIN = 'yopmail.com';
const SUFFIX_LENGTH = 6;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const RUN_ID = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

export interface MobileAccountEntry {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  runId: string;
  testTitle: string;
  testFile: string;
  createdAt: string;
  status: 'generated' | 'registered' | 'failed';
}

function ensureRegistryDir(): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

export function loadAccountRegistry(): MobileAccountEntry[] {
  ensureRegistryDir();
  if (!existsSync(REGISTRY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')) as MobileAccountEntry[];
  } catch {
    return [];
  }
}

function saveAccountRegistry(entries: MobileAccountEntry[]): void {
  ensureRegistryDir();
  writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function randomSuffix(length = SUFFIX_LENGTH): string {
  const bytes = randomBytes(length);
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return suffix;
}

export function generateAccountEmail(): string {
  const used = new Set(loadAccountRegistry().map((entry) => entry.email));

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `${EMAIL_PREFIX}${randomSuffix()}@${EMAIL_DOMAIN}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique mobile automation email after 25 attempts.');
}

export function mailboxFromEmail(email: string): string {
  return email.split('@')[0];
}

export interface RegisterAccountInput {
  testTitle: string;
  testFile: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  phoneNumber?: string;
}

export function createAccountRecord(input: RegisterAccountInput): MobileAccountEntry {
  const entry: MobileAccountEntry = {
    email: generateAccountEmail(),
    password: input.password || process.env.MOBILE_TEST_PASSWORD || 'Test123!',
    // The app rejects passwords that contain part of the first or last name, so
    // these defaults must not appear inside MOBILE_TEST_PASSWORD.
    firstName: input.firstName || process.env.MOBILE_TEST_FIRST_NAME || 'Jordan',
    lastName: input.lastName || process.env.MOBILE_TEST_LAST_NAME || 'Rivera',
    phoneNumber: input.phoneNumber || process.env.MOBILE_TEST_PHONE || '616-320-0701',
    runId: RUN_ID,
    testTitle: input.testTitle,
    testFile: input.testFile,
    createdAt: new Date().toISOString(),
    status: 'generated',
  };

  const registry = loadAccountRegistry();
  registry.push(entry);
  saveAccountRegistry(registry);

  return entry;
}

export function updateAccountStatus(email: string, status: MobileAccountEntry['status']): void {
  const registry = loadAccountRegistry();
  const entry = registry.find((item) => item.email === email && item.runId === RUN_ID);
  if (!entry) return;
  entry.status = status;
  saveAccountRegistry(registry);
}

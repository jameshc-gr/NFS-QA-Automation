import fs from 'node:fs';
import path from 'node:path';

export interface CreatedAccount {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  runId?: string;
  testTitle?: string;
  testFile?: string;
  createdAt?: string;
  status?: string;
}

const ACCOUNTS_PATH = path.resolve(process.cwd(), 'test-results/mobile-app-accounts.json');
const RECENT_PATH = path.resolve(process.cwd(), 'test-results/recent-created-accounts.json');

function readAccounts(): CreatedAccount[] {
  try {
    const raw = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
    return JSON.parse(raw) as CreatedAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: CreatedAccount[]): void {
  fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
}

function writeRecent(accounts: CreatedAccount[], count: number): void {
  fs.mkdirSync(path.dirname(RECENT_PATH), { recursive: true });
  const recent = accounts.slice(-count).reverse();
  fs.writeFileSync(RECENT_PATH, JSON.stringify(recent, null, 2));
}

export function addCreatedAccount(entry: CreatedAccount, recentCount = Number(process.env.RECENT_ACCOUNTS_COUNT) || 10): void {
  const accounts = readAccounts();
  const now = new Date().toISOString();
  const record: CreatedAccount = { createdAt: now, ...entry };
  accounts.push(record);
  writeAccounts(accounts);
  writeRecent(accounts, recentCount);
}

export function getRecentCreatedAccounts(count = Number(process.env.RECENT_ACCOUNTS_COUNT) || 10): CreatedAccount[] {
  try {
    const raw = fs.readFileSync(RECENT_PATH, 'utf8');
    const arr = JSON.parse(raw) as CreatedAccount[];
    return arr.slice(0, count);
  } catch {
    const accounts = readAccounts();
    return accounts.slice(-count).reverse();
  }
}

export default { addCreatedAccount, getRecentCreatedAccounts };

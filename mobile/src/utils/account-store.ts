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

// Use dated paths under test-results/ to match the new folder convention
function _getDatedAccountPaths(): { accountsPath: string; recentPath: string } {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateDir = path.resolve(process.cwd(), `test-results/${yyyy}-${mm}-${dd}`);
  return {
    accountsPath: path.join(dateDir, 'mobile-app-accounts.json'),
    recentPath: path.join(dateDir, 'recent-created-accounts.json'),
  };
}

function readAccounts(): CreatedAccount[] {
  try {
    const paths = _getDatedAccountPaths();
    const raw = fs.readFileSync(paths.accountsPath, 'utf8');
    return JSON.parse(raw) as CreatedAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: CreatedAccount[]): void {
  const paths = _getDatedAccountPaths();
  fs.mkdirSync(path.dirname(paths.accountsPath), { recursive: true });
  fs.writeFileSync(paths.accountsPath, JSON.stringify(accounts, null, 2));
}

function writeRecent(accounts: CreatedAccount[], count: number): void {
  const paths = _getDatedAccountPaths();
  fs.mkdirSync(path.dirname(paths.recentPath), { recursive: true });
  const recent = accounts.slice(-count).reverse();
  fs.writeFileSync(paths.recentPath, JSON.stringify(recent, null, 2));
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
    const paths = _getDatedAccountPaths();
    const raw = fs.readFileSync(paths.recentPath, 'utf8');
    const arr = JSON.parse(raw) as CreatedAccount[];
    return arr.slice(0, count);
  } catch {
    const accounts = readAccounts();
    return accounts.slice(-count).reverse();
  }
}

export default { addCreatedAccount, getRecentCreatedAccounts };

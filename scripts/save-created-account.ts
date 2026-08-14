import fs from 'node:fs';
import path from 'node:path';
import { addCreatedAccount } from '../mobile/src/utils/account-store';

// CLI wrapper: pass JSON via env ACCOUNT_JSON or as first arg
const raw = process.env.ACCOUNT_JSON || process.argv[2];
if (!raw) {
  console.error('Usage: ACCOUNT_JSON=\'JSON\' node scripts/save-created-account.ts');
  process.exit(2);
}

let obj;
try {
  obj = JSON.parse(raw);
} catch (err) {
  console.error('ACCOUNT_JSON must be valid JSON:', err);
  process.exit(2);
}

addCreatedAccount(obj);
console.log('Saved created account:', obj.email || '(unknown)');

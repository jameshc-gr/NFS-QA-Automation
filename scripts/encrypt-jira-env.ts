import fs from 'fs';
import path from 'path';
import { encryptSecret } from '../mobile/src/utils/crypto-utils';

const jiraEnvPath = path.resolve(process.cwd(), 'jira.env');
const keysToEncrypt = new Set(['JIRA_USER', 'JIRA_TOKEN', 'ATLAS_CLIENT_SECRET']);

if (!fs.existsSync(jiraEnvPath)) {
  console.error(`Missing file: ${jiraEnvPath}`);
  process.exit(1);
}

const original = fs.readFileSync(jiraEnvPath, 'utf8');
const lines = original.split(/\r?\n/);

const encryptedKeys: string[] = [];
const skippedKeys: string[] = [];

const updated = lines.map((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !line.includes('=')) {
    return line;
  }

  const idx = line.indexOf('=');
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1);

  if (!keysToEncrypt.has(key)) {
    return line;
  }

  if (!value) {
    skippedKeys.push(`${key} (empty)`);
    return line;
  }

  if (/^ENC\(/.test(value)) {
    skippedKeys.push(`${key} (already encrypted)`);
    return line;
  }

  encryptedKeys.push(key);
  return `${key}=${encryptSecret(value)}`;
});

fs.writeFileSync(jiraEnvPath, updated.join('\n'));

if (encryptedKeys.length > 0) {
  console.log(`Encrypted keys in jira.env: ${encryptedKeys.join(', ')}`);
} else {
  console.log('No jira.env keys were encrypted.');
}

if (skippedKeys.length > 0) {
  console.log(`Skipped keys: ${skippedKeys.join(', ')}`);
}

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { encryptSecret } from '../mobile/src/utils/crypto-utils';

dotenv.config();

const outputPath = resolve('test-data/rate-wealth/rate-wealth-auth.yml');

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Password setup requires an interactive terminal.');
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolveInput) => {
    let value = '';
    const onData = (chunk: Buffer): void => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') process.exit(130);
        if (character === '\r' || character === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolveInput(value);
          return;
        }
        if (character === '\u007f') value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  if (!process.env.CONFIG_ENCRYPTION_KEY) {
    throw new Error('CONFIG_ENCRYPTION_KEY is required. Set a strong local secret (for example in .env) before running this command.');
  }
  const password = (await readHidden('Rate Wealth QA password (shared by my-rw-jc00x accounts): ')).trim();
  if (!password) throw new Error('A password is required.');

  mkdirSync(resolve('test-data/rate-wealth'), { recursive: true });
  writeFileSync(outputPath, ['# Written by `npm run setup:rate-wealth-auth`; decrypted in memory only with CONFIG_ENCRYPTION_KEY.', `password: "${encryptSecret(password)}"`, ''].join('\n'), { mode: 0o600 });
  console.log(`Encrypted password written to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

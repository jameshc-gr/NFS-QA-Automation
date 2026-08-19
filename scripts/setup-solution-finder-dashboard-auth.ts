import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { encryptSecret } from '../mobile/src/utils/crypto-utils';

const outputPath = resolve('test-data/one-loan-rtl/dashboard-auth.yml');

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
        if (character === '\u007f') {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  if (!process.env.CONFIG_ENCRYPTION_KEY) {
    throw new Error(
      'CONFIG_ENCRYPTION_KEY is required. Set a strong local secret before running this command.',
    );
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const login = (await prompt.question('OneLoan dashboard login: ')).trim();
  prompt.close();
  const password = (await readHidden('OneLoan dashboard password: ')).trim();

  if (!login || !password) {
    throw new Error('Login and password are required.');
  }

  mkdirSync(resolve('test-data/one-loan-rtl'), { recursive: true });
  writeFileSync(
    outputPath,
    [
      'baseUrl: "https://one-loan-dashboard.dev.saas.rate.com"',
      `login: "${encryptSecret(login)}"`,
      `password: "${encryptSecret(password)}"`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  console.log(`Encrypted dashboard credentials written to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
#!/usr/bin/env node

/**
 * Playwright Pre-Flight Health Check
 * Purpose: Validate environment setup before running tests
 * Usage: npm run preflight:playwright
 */

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const CHECKS: Array<{
  name: string;
  check: () => boolean | string;
  level: 'error' | 'warn';
}> = [
  {
    name: 'Node.js version (14+)',
    check: () => {
      const version = process.versions.node;
      const major = parseInt(version.split('.')[0], 10);
      return major >= 14 ? true : `Node ${version} < 14`;
    },
    level: 'error',
  },
  {
    name: 'npm dependencies installed',
    check: () => {
      return existsSync(resolve(process.cwd(), 'node_modules/playwright')) ||
        existsSync(resolve(process.cwd(), 'node_modules/@playwright'))
        ? true
        : 'playwright not installed; run npm install';
    },
    level: 'error',
  },
  {
    name: 'Playwright browsers installed',
    check: () => {
      const result = spawnSync('npx', ['playwright', 'install', '--list'], {
        encoding: 'utf8',
      });
      return result.status === 0 ? true : 'Browser installation incomplete; run npx playwright install';
    },
    level: 'warn',
  },
  {
    name: 'Test configuration exists',
    check: () => {
      return existsSync(resolve(process.cwd(), 'playwright.config.ts')) ||
        existsSync(resolve(process.cwd(), 'playwright.config.js'))
        ? true
        : 'playwright.config.ts missing';
    },
    level: 'error',
  },
  {
    name: 'Test directory exists',
    check: () => {
      return existsSync(resolve(process.cwd(), 'tests'))
        ? true
        : 'tests/ directory missing';
    },
    level: 'error',
  },
  {
    name: 'Environment variables configured',
    check: () => {
      const requiredEnvs = ['BASE_URL'];
      const missing = requiredEnvs.filter((e) => !process.env[e]);
      return missing.length === 0
        ? true
        : `Missing env vars: ${missing.join(', ')}`;
    },
    level: 'warn',
  },
  {
    name: 'Page objects exist',
    check: () => {
      return existsSync(
        resolve(process.cwd(), 'web/student-loan-refi/pages')
      )
        ? true
        : 'web/student-loan-refi/pages directory missing';
    },
    level: 'warn',
  },
];

// ============================================================================

function runChecks(): void {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Playwright Pre-Flight Health Check                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  let errorCount = 0;
  let warnCount = 0;

  for (const { name, check, level } of CHECKS) {
    const result = check();
    const passed = result === true;
    const symbol = passed ? '✓' : '✗';
    const color = passed ? '\x1b[32m' : level === 'error' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${color}${symbol}${reset} ${name}`);
    if (!passed) {
      console.log(`  ${typeof result === 'string' ? result : 'Failed'}`);
      if (level === 'error') errorCount++;
      else warnCount++;
    }
  }

  console.log('\n' + '─'.repeat(56));

  if (errorCount === 0 && warnCount === 0) {
    console.log('\n✓ All checks passed! Ready to run tests.\n');
    process.exit(0);
  }

  if (warnCount > 0) {
    console.log(`⚠ ${warnCount} warning(s). Tests may not run as expected.\n`);
  }

  if (errorCount > 0) {
    console.log(`✗ ${errorCount} error(s). Fix these before running tests.\n`);
    process.exit(1);
  }
}

// ============================================================================

runChecks();

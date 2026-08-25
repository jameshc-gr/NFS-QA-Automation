import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const memoryDir = path.resolve(process.cwd(), 'memory');
const locatorHistoryPath = path.join(memoryDir, 'locator-history.json');
const flakyTestsPath = path.join(memoryDir, 'flaky-tests.json');
const healingHistoryPath = path.join(memoryDir, 'healing-history.json');

function readJson<T>(filePath: string, defaultValue: T): T {
  if (!existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export interface LocatorHistoryEntry {
  timestamp: string;
  platform: 'android' | 'ios';
  selectorKey: string;
  previousSelectors: string[];
  newSelectors: string[];
  reason: string;
  testFile?: string;
}

export function recordLocatorHistory(entry: LocatorHistoryEntry): void {
  const history = readJson<{ locators: LocatorHistoryEntry[] }>(locatorHistoryPath, { locators: [] });
  history.locators.push(entry);
  writeJson(locatorHistoryPath, history);
}

export interface FlakyTestEntry {
  timestamp: string;
  testFile: string;
  testName: string;
  failureType: string;
  rootCause?: string;
  fixApplied?: string;
  status: 'open' | 'resolved';
}

export function recordFlakyTest(entry: FlakyTestEntry): void {
  const memory = readJson<{ flaky: FlakyTestEntry[] }>(flakyTestsPath, { flaky: [] });
  memory.flaky.push(entry);
  writeJson(flakyTestsPath, memory);
}

export interface HealingHistoryEntry {
  timestamp: string;
  testFile: string;
  testName: string;
  failureType: string;
  remediation: string;
  filesChanged: string[];
  verificationStatus: 'pass' | 'fail';
}

export function recordHealingHistory(entry: HealingHistoryEntry): void {
  const history = readJson<{ history: HealingHistoryEntry[] }>(healingHistoryPath, { history: [] });
  history.history.push(entry);
  writeJson(healingHistoryPath, history);
}

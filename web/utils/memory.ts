import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Memory Tracking for Playwright Tests
 * Purpose: Agents learn from past failures and selector changes
 *
 * Files (persistent, not committed):
 *   - memory/playwright-locator-history.json
 *   - memory/playwright-flaky-tests.json
 *   - memory/playwright-healing-history.json
 */

const MEMORY_DIR = resolve(process.cwd(), 'memory');
const LOCATOR_HISTORY_FILE = resolve(MEMORY_DIR, 'playwright-locator-history.json');
const FLAKY_TESTS_FILE = resolve(MEMORY_DIR, 'playwright-flaky-tests.json');
const HEALING_HISTORY_FILE = resolve(MEMORY_DIR, 'playwright-healing-history.json');

/**
 * Locator History: Track selector changes applied by healer
 */
export interface LocatorChange {
  date: string;
  testName: string;
  selector: string;
  oldValue: string;
  newValue: string;
  reason: string;
  healer: string; // e.g., "playwright-test-healer"
}

export function recordLocatorHistory(change: LocatorChange): void {
  const data = readMemoryFile<{ locator_history: LocatorChange[] }>(
    LOCATOR_HISTORY_FILE,
    { locator_history: [] }
  );
  data.locator_history.push(change);
  writeMemoryFile(LOCATOR_HISTORY_FILE, data);
}

export function getLocatorHistory(): LocatorChange[] {
  const data = readMemoryFile<{ locator_history: LocatorChange[] }>(
    LOCATOR_HISTORY_FILE,
    { locator_history: [] }
  );
  return data.locator_history;
}

/**
 * Flaky Tests: Track intermittent failures (pass on retry without code changes)
 */
export interface FlakyTestRecord {
  date: string;
  testName: string;
  failurePattern: string; // e.g., "Timeout waiting for selector"
  occurrences: number;
  lastSeen: string;
  recommendation: string;
}

export function recordFlakyTest(test: FlakyTestRecord): void {
  const data = readMemoryFile<{ flaky_tests: FlakyTestRecord[] }>(
    FLAKY_TESTS_FILE,
    { flaky_tests: [] }
  );

  // Update occurrence if already exists
  const existing = data.flaky_tests.find((t) => t.testName === test.testName);
  if (existing) {
    existing.occurrences += 1;
    existing.lastSeen = test.lastSeen;
  } else {
    test.occurrences = 1;
    data.flaky_tests.push(test);
  }

  writeMemoryFile(FLAKY_TESTS_FILE, data);
}

export function getFlakyTests(): FlakyTestRecord[] {
  const data = readMemoryFile<{ flaky_tests: FlakyTestRecord[] }>(
    FLAKY_TESTS_FILE,
    { flaky_tests: [] }
  );
  return data.flaky_tests;
}

/**
 * Healing History: Timeline of all fixes applied
 */
export interface HealingRecord {
  date: string;
  testName: string;
  failureClass: string; // e.g., "Selector Failure", "Timing"
  rootCause: string;
  fixApplied: string;
  verified: boolean; // Did re-test pass?
  agent: string; // Which healer agent applied this
}

export function recordHealing(record: HealingRecord): void {
  const data = readMemoryFile<{ healing_history: HealingRecord[] }>(
    HEALING_HISTORY_FILE,
    { healing_history: [] }
  );
  data.healing_history.push(record);
  writeMemoryFile(HEALING_HISTORY_FILE, data);
}

export function getHealingHistory(): HealingRecord[] {
  const data = readMemoryFile<{ healing_history: HealingRecord[] }>(
    HEALING_HISTORY_FILE,
    { healing_history: [] }
  );
  return data.healing_history;
}

/**
 * Check if a selector was already fixed recently
 */
export function wasSelectorRecentlyFixed(
  selector: string,
  withinMinutes: number = 60
): LocatorChange | null {
  const history = getLocatorHistory();
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
  return (
    history.find(
      (c) => c.selector === selector && new Date(c.date) > cutoff
    ) || null
  );
}

/**
 * Get selector candidates from history
 */
export function getSelectorCandidatesFromHistory(testName: string): string[] {
  const history = getLocatorHistory();
  return history
    .filter((c) => c.testName === testName)
    .map((c) => c.newValue);
}

// ============================================================================
// Internal utilities
// ============================================================================

function readMemoryFile<T>(filePath: string, defaultValue: T): T {
  if (!existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

function writeMemoryFile<T>(filePath: string, data: T): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

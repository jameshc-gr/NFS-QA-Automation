import { Page, expect } from '@playwright/test';

/**
 * Step-Level Checkpoint Helper for Playwright Tests
 * Purpose: Structured step logging and validation with automatic diagnostics
 *
 * On failure, provides:
 *   - Step name + timing
 *   - Last successful step
 *   - Page context (URL, title)
 *   - Screenshot (automatic)
 */

interface StepResult {
  name: string;
  duration: number;
  status: 'pass' | 'fail';
  timestamp: string;
  error?: string;
}

class StepCheckpointTracker {
  private steps: StepResult[] = [];
  private startTime: number = 0;

  /**
   * Record a step with automatic validation and logging
   */
  async recordStep(
    page: Page,
    stepName: string,
    stepFn: () => Promise<void>
  ): Promise<void> {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    try {
      console.log(`[STEP] ${stepName} (start)`);
      await stepFn();
      const duration = Date.now() - start;
      this.steps.push({
        name: stepName,
        duration,
        status: 'pass',
        timestamp,
      });
      console.log(`[STEP] ${stepName} ✓ (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.steps.push({
        name: stepName,
        duration,
        status: 'fail',
        timestamp,
        error: errorMsg,
      });
      console.error(`[STEP] ${stepName} ✗ (${duration}ms) → ${errorMsg}`);

      // Capture diagnostics on failure
      await this.captureFailureDiagnostics(page, stepName);
      throw error;
    }
  }

  /**
   * Capture detailed diagnostics when a step fails
   */
  private async captureFailureDiagnostics(page: Page, failedStep: string): Promise<void> {
    console.log('\n[DIAGNOSTICS] Capturing failure context...');
    console.log(`  Failed step: ${failedStep}`);
    console.log(`  Current URL: ${page.url()}`);
    console.log(`  Page title: ${await page.title()}`);

    // Show last successful step
    const lastPass = this.steps.filter((s) => s.status === 'pass').slice(-1)[0];
    if (lastPass) {
      console.log(`  Last successful step: ${lastPass.name} (${lastPass.timestamp})`);
    }

    // Show all steps for context
    console.log('\n  Step history:');
    this.steps.forEach((s) => {
      const status = s.status === 'pass' ? '✓' : '✗';
      console.log(`    [${s.timestamp}] ${status} ${s.name} (${s.duration}ms)`);
    });

    // Capture screenshot for visual diagnostics
    try {
      const screenshotPath = `/tmp/step-failure-${failedStep}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);
    } catch (e) {
      console.warn(`  Could not capture screenshot: ${e}`);
    }

    console.log('[/DIAGNOSTICS]\n');
  }

  /**
   * Get step history for reporting
   */
  getStepHistory(): StepResult[] {
    return this.steps;
  }

  /**
   * Reset for next test
   */
  reset(): void {
    this.steps = [];
  }
}

/**
 * Global tracker instance (one per test)
 */
const tracker = new StepCheckpointTracker();

/**
 * Export for test usage
 */
export async function withStepCheckpoint(
  page: Page,
  stepName: string,
  stepFn: () => Promise<void>
): Promise<void> {
  return tracker.recordStep(page, stepName, stepFn);
}

/**
 * Get history for reporting
 */
export function getCheckpointHistory(): StepResult[] {
  return tracker.getStepHistory();
}

/**
 * Reset tracker (call at start of each test)
 */
export function resetCheckpoints(): void {
  tracker.reset();
}

/**
 * Example usage in a test:
 *
 * test('Login flow', async ({ page }) => {
 *   resetCheckpoints();
 *
 *   await withStepCheckpoint(page, 'Navigate to login', async () => {
 *     await page.goto('/login');
 *   });
 *
 *   await withStepCheckpoint(page, 'Fill email', async () => {
 *     await page.locator('input[name="email"]').fill('test@example.com');
 *   });
 *
 *   await withStepCheckpoint(page, 'Submit login', async () => {
 *     await page.locator('button[type="submit"]').click();
 *     await page.waitForURL('/dashboard');
 *   });
 *
 *   // On failure, checkpoint captures:
 *   // [STEP] Navigate to login ✓ (234ms)
 *   // [STEP] Fill email ✓ (156ms)
 *   // [STEP] Submit login ✗ (5234ms) → Timeout 5000ms waiting for element
 *   // [DIAGNOSTICS] Last successful: Fill email
 *   // [DIAGNOSTICS] Screenshot: /tmp/step-failure-...png
 * });
 */

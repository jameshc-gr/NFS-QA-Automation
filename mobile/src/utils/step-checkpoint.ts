import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface StepCheckpointOptions<T = unknown> {
  name: string;
  action: () => Promise<T>;
  expectedState?: () => Promise<boolean>;
  expectedResult?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onFailure?: (error: Error) => Promise<void>;
}

export interface StepCheckpointResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: Error;
  diagnosticsPath?: string;
}

function runId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function captureDiagnostics(stepName: string, error: Error): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);
  const project = process.env.TEST_PROJECT || 'mobile';
  const runStamp = process.env.RUN_ID || runId();
  const diagnosticsDir = path.join(process.cwd(), 'test-results', date, project, runStamp, 'diagnostics');
  mkdirSync(diagnosticsDir, { recursive: true });

  const safeStepName = stepName.replace(/[^a-z0-9]+/gi, '_');
  const prefix = path.join(diagnosticsDir, `${safeStepName}-${Date.now()}`);

  const bundle: Record<string, unknown> = {
    stepName,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };

  try {
    const b = (globalThis as any).browser;
    bundle.screenshot = b?.takeScreenshot ? await b.takeScreenshot() : null;
  } catch {
    bundle.screenshot = null;
  }

  try {
    const b = (globalThis as any).browser;
    bundle.pageSource = b?.getPageSource ? await b.getPageSource() : null;
  } catch {
    bundle.pageSource = null;
  }

  const bundlePath = `${prefix}.json`;
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');
  return bundlePath;
}

/**
 * Executes a test step with strict validation and fail-fast behavior.
 *
 * 1. Runs the action.
 * 2. Validates expectedState (if provided) with polling.
 * 3. On failure: captures diagnostics (screenshot + page source) and stops.
 */
export async function stepCheckpoint<T = unknown>(
  options: StepCheckpointOptions<T>
): Promise<StepCheckpointResult<T>> {
  const { name, action, expectedState, timeoutMs = 15000, pollIntervalMs = 500, onFailure } = options;

  console.log(`[stepCheckpoint] Starting: ${name}`);
  let value: T | undefined;

  try {
    value = await action();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[stepCheckpoint] Action failed for "${name}": ${err.message}`);
    const diagnosticsPath = await captureDiagnostics(name, err);
    await onFailure?.(err);
    return { success: false, error: err, diagnosticsPath };
  }

  if (!expectedState) {
    console.log(`[stepCheckpoint] Completed: ${name}`);
    return { success: true, value };
  }

  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const stateOk = await expectedState();
      if (stateOk) {
        console.log(`[stepCheckpoint] Completed with validation: ${name}`);
        return { success: true, value };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const validationError = lastError || new Error(`Expected state was not reached after ${timeoutMs}ms for step: ${name}`);
  console.error(`[stepCheckpoint] Validation failed for "${name}": ${validationError.message}`);
  const diagnosticsPath = await captureDiagnostics(name, validationError);
  await onFailure?.(validationError);
  return { success: false, error: validationError, diagnosticsPath };
}

/**
 * Throws on checkpoint failure so callers can fail-fast a whole test.
 */
export async function mustPassStep<T = unknown>(options: StepCheckpointOptions<T>): Promise<T> {
  const result = await stepCheckpoint(options);
  if (!result.success) {
    throw result.error || new Error(`Step "${options.name}" failed`);
  }
  return result.value!;
}

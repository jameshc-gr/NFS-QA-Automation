import { resolveMobilePlatform } from '../config/mobile.config';

export type SelectorCandidate = string;
export type SelectorList = string[];

export interface ResolvedElement {
  selector: string;
  element: any;
}

/**
 * Tries a list of candidate selectors in order and returns the first one that
 * resolves to a displayed element. This keeps page objects free of inline
 * fallback chains and makes selector healing a one-file edit.
 */
export async function resolveFirstVisible(
  candidates: SelectorList,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<ResolvedElement> {
  const { timeoutMs = 15000, pollIntervalMs = 500 } = options;
  const deadline = Date.now() + timeoutMs;

  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      try {
        const getElement = (globalThis as any).$ || ((sel: string) => sel);
        const element = getElement(candidate);
        const isDisplayed = typeof element?.isDisplayed === 'function'
          ? await element.isDisplayed().catch(() => false)
          : true;
        if (isDisplayed) {
          return { selector: candidate, element };
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const selectorPreview = candidates.slice(0, 3).join(', ');
  throw lastError || new Error(`No visible element found for selectors: ${selectorPreview}...`);
}

/**
 * Generates a platform-agnostic selector key lookup path.
 */
export function platformSelectorPath(baseName: string): string {
  const platform = resolveMobilePlatform();
  return `mobile/src/selectors/${platform}/${baseName}.selectors`;
}

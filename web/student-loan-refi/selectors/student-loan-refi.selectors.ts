import { Page, Locator } from '@playwright/test';

/**
 * Playwright Selector Registry for Student Loan Refi
 * Platform: Web (Chromium, Firefox, WebKit)
 * Purpose: Centralized, maintainable selectors with fallback candidates
 *
 * Pattern:
 *   Each selector has a primary (preferred) and fallback candidates.
 *   Agents can update this registry (Tier 2) when selectors change.
 *   Healer uses fallbacks when primary fails.
 */

export const studentLoanRefiSelectors = {
  // Personal Info Page
  firstName: {
    primary: 'input[data-testid="first-name"]',
    fallbacks: [
      'input[name="firstName"]',
      'input[placeholder*="First name"]',
      'text=First name >> .. >> input',
    ],
  },
  lastName: {
    primary: 'input[data-testid="last-name"]',
    fallbacks: [
      'input[name="lastName"]',
      'input[placeholder*="Last name"]',
      'text=Last name >> .. >> input',
    ],
  },
  email: {
    primary: 'input[data-testid="email"]',
    fallbacks: [
      'input[name="email"]',
      'input[type="email"]',
      'text=Email >> .. >> input',
    ],
  },
  phone: {
    primary: 'input[data-testid="phone"]',
    fallbacks: [
      'input[name="phone"]',
      'input[type="tel"]',
      'text=Phone >> .. >> input',
    ],
  },

  // Address Page
  address: {
    primary: 'input[data-testid="address"]',
    fallbacks: [
      'input[name="address"]',
      'input[placeholder*="Street address"]',
      'text=Street address >> .. >> input',
    ],
  },
  city: {
    primary: 'input[data-testid="city"]',
    fallbacks: [
      'input[name="city"]',
      'input[placeholder*="City"]',
      'text=City >> .. >> input',
    ],
  },
  state: {
    primary: 'select[data-testid="state"]',
    fallbacks: [
      'select[name="state"]',
      'text=State >> .. >> select',
      'combobox[aria-label*="State"]',
    ],
  },
  zipCode: {
    primary: 'input[data-testid="zip-code"]',
    fallbacks: [
      'input[name="zipCode"]',
      'input[placeholder*="ZIP"]',
      'text=ZIP code >> .. >> input',
    ],
  },

  // Employment Page
  employmentStatus: {
    primary: 'select[data-testid="employment-status"]',
    fallbacks: [
      'select[name="employmentStatus"]',
      'combobox[aria-label*="Employment"]',
      'text=Employment status >> .. >> select',
    ],
  },
  employer: {
    primary: 'input[data-testid="employer"]',
    fallbacks: [
      'input[name="employer"]',
      'input[placeholder*="Employer"]',
      'text=Employer >> .. >> input',
    ],
  },

  // Common buttons
  nextButton: {
    primary: 'button[data-testid="next"]',
    fallbacks: [
      'button:has-text("Next")',
      'button[type="submit"]:has-text("Next")',
      'text=Next',
    ],
  },
  continueButton: {
    primary: 'button[data-testid="continue"]',
    fallbacks: [
      'button:has-text("Continue")',
      'button[type="submit"]:has-text("Continue")',
      'text=Continue',
    ],
  },
  submitButton: {
    primary: 'button[type="submit"]',
    fallbacks: [
      'button:has-text("Submit")',
      'button[data-testid="submit"]',
    ],
  },

  // Validation & error messages
  errorMessage: {
    primary: '[role="alert"]',
    fallbacks: [
      '.error',
      '.alert-danger',
      'text=/Error|error|Required/i',
    ],
  },
  successMessage: {
    primary: '[role="status"]',
    fallbacks: [
      '.success',
      '.alert-success',
      'text=/Success|successful/i',
    ],
  },
};

/**
 * Helper to get primary selector
 */
export function getPrimarySelector(
  selectorGroup: { primary: string; fallbacks: string[] }
): string {
  return selectorGroup.primary;
}

/**
 * Helper to get all candidates (primary first, then fallbacks)
 */
export function getAllSelectors(
  selectorGroup: { primary: string; fallbacks: string[] }
): string[] {
  return [selectorGroup.primary, ...selectorGroup.fallbacks];
}

/**
 * Resilient locator finder: tries primary, then fallbacks
 */
export async function findElementResilient(
  page: Page,
  selectorGroup: { primary: string; fallbacks: string[] }
): Promise<Locator | null> {
  const selectors = getAllSelectors(selectorGroup);
  for (const selector of selectors) {
    const locator = page.locator(selector);
    try {
      await locator.waitFor({ state: 'attached', timeout: 2000 });
      return locator;
    } catch {
      // Try next selector
      continue;
    }
  }
  return null;
}

/**
 * Get selector for diagnostics
 */
export function getLastSelectorAttempted(
  selectorGroup: { primary: string; fallbacks: string[] }
): string {
  return getAllSelectors(selectorGroup).slice(-1)[0];
}

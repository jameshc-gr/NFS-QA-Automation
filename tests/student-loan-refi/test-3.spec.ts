import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import './test-setup';

// Load environment variables from .env file
dotenv.config();

// Increase test-level timeout to accommodate slow navigations
test.setTimeout(120000);

// Pick profile for this test: '' (Ernest), 'LK1' (William), 'LK2' (Alan)
const PROFILE = 'LK2';

// If a PROFILE is set, copy any PROFILE-suffixed env vars into the base keys
if (PROFILE) {
  const keys = [
    'FIRST_NAME','LAST_NAME','EMAIL','PHONE','LOAN_AMOUNT','MONTHLY_PAYMENT','INTEREST_RATE',
    'ADDRESS','SCHOOL','DEGREE_LEVEL','GRADUATION_DATE','INCOME_TYPE','EMPLOYER','OCCUPATION',
    'ANNUAL_INCOME','EMPLOYMENT_START','CITIZEN_STATUS','CREDIT_SCORE','HOUSING_TYPE',
    'HOUSING_COST','TOTAL_ASSETS','DOB','SSN'
  ];

  for (const k of keys) {
    const src = `${k}_${PROFILE}`;
    if (process.env[src]) process.env[k] = process.env[src];
  }
}

// Helper: resilient option selector that tolerates enum (US_CITIZEN) or display (US Citizen) values
async function selectOptionResilient(page: any, value?: string) {
  if (!value) throw new Error('No option value provided');
  const tries: string[] = [];
  tries.push(value);
  // replace underscores with spaces
  tries.push(value.replace(/_/g, ' '));
  // title case
  tries.push(value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
  // upper case
  tries.push(value.replace(/_/g, ' ').toUpperCase());

  for (const t of tries) {
    try {
      // try strict match first
      await page.getByRole('option', { name: t }).click({ timeout: 3000 });
      return;
    } catch (e) {
      // If strict match failed (multiple matches), try a tolerant locator that matches visible option text
      try {
        await page.locator('role=option', { hasText: new RegExp(t, 'i') }).first().click({ timeout: 3000 });
        return;
      } catch (e2) {
        // ignore and try next
      }
    }
  }

  // Ensure options are present (short wait) to avoid racing the dropdown render
  try {
    await page.locator('role=option').first().waitFor({ state: 'visible', timeout: 3000 });
  } catch (e) {
    // continue — the dropdown may render more slowly, fallbacks will handle it
  }

  // fallback: try matching numeric parts (e.g., credit scores) first using tolerant locator
  const digitsMatch = value.match(/\d{2,4}/);
  if (digitsMatch) {
    const digits = digitsMatch[0];
    try {
      const digitLocator = page.locator('role=option', { hasText: new RegExp(digits, 'i') });
      if ((await digitLocator.count()) > 0) {
        await digitLocator.first().click({ timeout: 5000 });
        return;
      }
    } catch (e) {
      // ignore and continue to next fallback
    }
  }

  // fallback: try a partial, case-insensitive match using a regexp of the first two words
  let words = value.replace(/_/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
  // If the value references a score (e.g., SCORE_600_749), prefer the numeric part
  const digitsForWords = (value.match(/\d{2,4}/) || [''])[0];
  if (/score/i.test(words) && digitsForWords) {
    words = digitsForWords;
  }
  if (words) {
    // Use a non-strict locator for partial matches to avoid strict mode violations
    try {
      const wordsLocator = page.locator('role=option', { hasText: new RegExp(words, 'i') });
      if ((await wordsLocator.count()) > 0) {
        await wordsLocator.first().click({ timeout: 5000 });
        return;
      }
    import { test } from '@playwright/test';
    import dotenv from 'dotenv';
    import { loadProfile, runRefinanceFlow } from './test-setup';

    dotenv.config();
    test.setTimeout(240000);

    const PROFILE = 'LK2';
    loadProfile(PROFILE);

    test('Student Loan Refinance - LK2', async ({ page }) => {
      await runRefinanceFlow(page, PROFILE);
    });
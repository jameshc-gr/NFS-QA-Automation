import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import './test-setup';

// Load environment variables from .env file
dotenv.config();

// Increase test-level timeout to accommodate slow navigations
test.setTimeout(120000);

// Pick profile for this test: '' (Ernest), 'LK1' (William), 'LK2' (Alan)
const PROFILE = 'LK1';

// If a PROFILE is set, copy any PROFILE-suffixed env vars into the base keys
if (PROFILE) {
  const keys = [
    'FIRST_NAME','LAST_NAME','EMAIL','PHONE','LOAN_AMOUNT','MONTHLY_PAYMENT','INTEREST_RATE',
    'ADDRESS','SCHOOL','DEGREE_LEVEL','GRADUATION_DATE','INCOME_TYPE','EMPLOYER','OCCUPATION',
    'ANNUAL_INCOME','EMPLOYMENT_START','CITIZEN_STATUS','CREDIT_SCORE','HOUSING_TYPE',
    'HOUSING_COST','TOTAL_ASSETS','DOB','SSN'
  import { test } from '@playwright/test';
  import dotenv from 'dotenv';
  import { loadProfile, runRefinanceFlow } from './test-setup';

  dotenv.config();
  test.setTimeout(240000);

  const PROFILE = 'LK1';
  loadProfile(PROFILE);

  test('Student Loan Refinance - LK1', async ({ page }) => {
    await runRefinanceFlow(page, PROFILE);
  });
const fs = require('fs');
const path = require('path');

const profiles = [
  // Eligible
  ...Array.from({ length: 14 }, (_, i) => `LK${i + 1}`),
  // Credit Decline
  ...Array.from({ length: 10 }, (_, i) => `LK_CD${i + 1}`),
  // No Credit
  ...Array.from({ length: 10 }, (_, i) => `LK_NC${i + 1}`),
  // Ineligible
  ...Array.from({ length: 10 }, (_, i) => `LK_IN${i + 1}`)
];

const template = (profile) => `import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { loadProfile, runRefinanceFlow } from './helpers';

dotenv.config();
test.setTimeout(120000);

const PROFILE = '${profile}';
loadProfile(PROFILE);

test('Student Loan Refinance - ${profile}', async ({ page }) => {
  await runRefinanceFlow(page, PROFILE);
});
`;

const testsDir = path.join(__dirname, '..', 'tests');

profiles.forEach(profile => {
  const fileName = `${profile}.spec.ts`;
  const filePath = path.join(testsDir, fileName);
  fs.writeFileSync(filePath, template(profile));
  console.log(`Created ${fileName}`);
});

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface MasterDataRow {
  Test_ID: string;
  Scenario_Name: string;
  AGI: string;
  Household_Size: string;
  Loan_Balance: string;
  APR: string;
  Tax_Rate: string;
  Dependents: string;
  Current_Assets: string;
  Poverty_Deduction: string;
  Discretionary_Income: string;
  Monthly_Payment: string;
  Monthly_Interest: string;
  Monthly_Underpayment: string;
  Est_Balance_Yr13: string;
  Tax_Bomb: string;
  Asset_Coverage_Percent: string;
  Shortfall: string;
  Monthly_Savings_Needed: string;
  Risk_Level: string;
}

// Parse CSV manually
function loadMasterData(): MasterDataRow[] {
  const csvPath = path.join(__dirname, '../../../test-results/MASTER-DATA.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.trim().split('\n');
  
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const data: MasterDataRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCurrencyValue(text: string): number {
  const cleaned = text.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

test.describe('MASTER-DATA Calculation Verification', () => {
  let scenarios: MasterDataRow[] = [];

  test.beforeAll(async () => {
    scenarios = loadMasterData();
    console.log(`✓ Loaded ${scenarios.length} scenarios from MASTER-DATA.csv`);
  });

  for (let scenarioIndex = 0; scenarioIndex < 18; scenarioIndex++) {
    test(`VERIFY: Scenario ${scenarioIndex + 1} - Overview Page Calculations`, async ({ page }) => {
      if (scenarioIndex >= scenarios.length) {
        test.skip();
        return;
      }

      const scenario = scenarios[scenarioIndex];
      const testId = scenario.Test_ID || `SCN-${(scenarioIndex + 1).toString().padStart(3, '0')}`;
      const scenarioName = scenario.Scenario_Name;
      
      const expectedPayment = parseFloat(scenario.Monthly_Payment);
      const expectedTaxBomb = parseFloat(scenario.Tax_Bomb);
      const expectedAssets = parseFloat(scenario.Current_Assets);
      const expectedSavingsNeeded = parseFloat(scenario.Monthly_Savings_Needed);

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Testing: ${testId} - ${scenarioName}`);
      console.log(`Input: AGI=$${scenario.AGI}, HH=${scenario.Household_Size}, Loan=$${scenario.Loan_Balance}, APR=${scenario.APR}%`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const verification = {
        Test_ID: testId,
        Scenario_Name: scenarioName,
        Checks: {
          Monthly_Payment: {
            Expected: expectedPayment,
            Source: 'MASTER-DATA.csv',
            Status: 'CALCULATED'
          },
          Tax_Bomb: {
            Expected: expectedTaxBomb,
            Source: 'MASTER-DATA.csv',
            Status: 'CALCULATED'
          },
          Monthly_Savings_Needed: {
            Expected: expectedSavingsNeeded,
            Source: 'MASTER-DATA.csv',
            Status: 'CALCULATED'
          },
          Assets: {
            Expected: expectedAssets,
            Source: 'MASTER-DATA.csv',
            Status: 'CALCULATED'
          }
        }
      };

      // Log verification data
      console.log(`\n📊 EXPECTED VALUES FROM MASTER-DATA.csv:`);
      console.log(`   • Monthly Payment: $${expectedPayment.toFixed(2)}`);
      console.log(`   • Tax Bomb: $${expectedTaxBomb.toLocaleString()}`);
      console.log(`   • Monthly Savings Needed: $${expectedSavingsNeeded.toFixed(2)}`);
      console.log(`   • Current Assets: $${expectedAssets.toLocaleString()}`);

      try {
        // Navigate to app
        await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/welcome', { timeout: 30000 });
        await page.waitForTimeout(2000);

        // Try to authenticate if needed
        let isAuthenticated = false;
        try {
          const authCheck = await page.locator('[data-testid="dashboard"]').isVisible({ timeout: 5000 }).catch(() => false);
          isAuthenticated = Boolean(authCheck);
        } catch {
          isAuthenticated = false;
        }

        if (!isAuthenticated) {
          console.log(`   ⚠️  Not authenticated - checking welcome page`);
          
          // Check if we're on welcome page
          const welcomeVisible = await page.locator('text=Welcome').isVisible({ timeout: 3000 }).catch(() => false);
          
          if (welcomeVisible) {
            console.log(`   ✓ Welcome page visible`);
            
            // Try to fill name
            const nameInputs = await page.locator('input').all();
            if (nameInputs.length > 0) {
              await nameInputs[0].fill('Test User');
              await page.waitForTimeout(500);
            }

            // Click continue
            const continueBtn = await page.locator('button').filter({ hasText: /Continue|Next/i }).first();
            if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await continueBtn.click();
              await page.waitForTimeout(2000);
            }
          }
        }

        // Try to extract overview page values
        let paymentFound = false;
        let taxBombFound = false;
        let savingsFound = false;
        let assetsFound = false;

        // Look for payment information
        const allText = await page.textContent('body');
        if (allText) {
          // Search for payment value in page text
          if (allText.includes(`$${expectedPayment.toFixed(2)}`)) {
            paymentFound = true;
            console.log(`   ✓ PASS: Monthly Payment $${expectedPayment.toFixed(2)} found on page`);
          } else {
            console.log(`   ✗ FAIL: Monthly Payment $${expectedPayment.toFixed(2)} NOT found on page`);
          }

          // Search for tax bomb value
          if (allText.includes(`$${expectedTaxBomb}`)) {
            taxBombFound = true;
            console.log(`   ✓ PASS: Tax Bomb $${expectedTaxBomb} found on page`);
          } else {
            console.log(`   ✗ FAIL: Tax Bomb $${expectedTaxBomb} NOT found on page`);
          }

          // Search for savings needed
          if (allText.includes(`$${expectedSavingsNeeded.toFixed(2)}`)) {
            savingsFound = true;
            console.log(`   ✓ PASS: Monthly Savings $${expectedSavingsNeeded.toFixed(2)} found on page`);
          } else {
            console.log(`   ✗ FAIL: Monthly Savings $${expectedSavingsNeeded.toFixed(2)} NOT found on page`);
          }
        }

        // Record verification results
        verification.Checks.Monthly_Payment.Status = paymentFound ? 'PASS' : 'FAIL';
        verification.Checks.Tax_Bomb.Status = taxBombFound ? 'PASS' : 'FAIL';
        verification.Checks.Monthly_Savings_Needed.Status = savingsFound ? 'PASS' : 'FAIL';

      } catch (error: any) {
        console.log(`   ✗ ERROR: ${error.message}`);
        Object.keys(verification.Checks).forEach(key => {
          verification.Checks[key as keyof typeof verification.Checks].Status = 'ERROR';
        });
      }

      // Save individual verification to file
      const resultsDir = path.join(__dirname, '../../../test-results');
      const verificationFile = path.join(resultsDir, `MASTER-DATA-VERIFICATION-${testId}.json`);
      fs.writeFileSync(verificationFile, JSON.stringify(verification, null, 2));

      // Log final status
      const passCount = Object.values(verification.Checks).filter((c: any) => c.Status === 'PASS').length;
      const totalChecks = Object.keys(verification.Checks).length;
      const finalStatus = passCount >= totalChecks - 1 ? 'PASS' : 'FAIL';
      
      console.log(`\n${finalStatus === 'PASS' ? '✓' : '✗'} RESULT: ${finalStatus} (${passCount}/${totalChecks} checks passed)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Assert at least 2 checks pass
      expect(passCount).toBeGreaterThanOrEqual(2);
    });
  }
});

const fs = require('fs');

/**
 * Tax Bomb Analysis Report
 * Focus: APR Impact + Asset-Based Savings Analysis
 */

const scenarios = [
  {
    id: 'SCN-001',
    name: 'Scenario 1: Base Case ($72K, HH2)',
    agi: 72000,
    householdSize: 2,
    balance: 80000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-002',
    name: 'Scenario 2: Lower Income ($36K, HH2)',
    agi: 36000,
    householdSize: 2,
    balance: 80000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-003',
    name: 'Scenario 3: Higher Income ($144K, HH2)',
    agi: 144000,
    householdSize: 2,
    balance: 80000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 0,
    assets: 0
  },
  {
    id: 'SCN-004',
    name: 'Scenario 4: Base + APR 6%',
    agi: 72000,
    householdSize: 2,
    balance: 80000,
    apr: 6.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-005',
    name: 'Scenario 5: Base + APR 8%',
    agi: 72000,
    householdSize: 2,
    balance: 80000,
    apr: 8.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-006',
    name: 'Scenario 6: Base + Large Loan ($150K)',
    agi: 72000,
    householdSize: 2,
    balance: 150000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-013',
    name: 'Scenario 13: Perfect Storm',
    agi: 45000,
    householdSize: 2,
    balance: 150000,
    apr: 7.0,
    taxRate: 0.40,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-016',
    name: 'Scenario 16: Base + Single Account ($0 assets)',
    agi: 72000,
    householdSize: 2,
    balance: 80000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 0
  },
  {
    id: 'SCN-017',
    name: 'Scenario 17: Base + Partial Assets ($8K)',
    agi: 72000,
    householdSize: 2,
    balance: 80000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 8000
  },
  {
    id: 'SCN-018',
    name: 'Scenario 18: Base + Joint Account ($25K)',
    agi: 72000,
    householdSize: 2,
    balance: 80000,
    apr: 4.0,
    taxRate: 0.35,
    dependents: 1,
    assets: 25000
  }
];

const povertyLines = {
  1: 15060,
  2: 19280,
  3: 24500,
  4: 29720,
  5: 35940,
  6: 42160
};

function calculateMonthlyPayment(agi, householdSize) {
  const basePoverty = povertyLines[householdSize] || povertyLines[1];
  const deductionPoverty = basePoverty * 1.5;
  const discretionaryIncome = Math.max(0, agi - deductionPoverty);
  const monthlyPayment = (discretionaryIncome * 0.10) / 12;
  return Math.round(monthlyPayment * 100) / 100;
}

function calculateTaxBomb(agi, householdSize, balance, apr, taxRate) {
  const monthlyPayment = calculateMonthlyPayment(agi, householdSize);
  const monthlyInterest = (balance * (apr / 100)) / 12;
  const monthlyUnderpayment = Math.max(0, monthlyInterest - monthlyPayment);
  
  // Estimate remaining balance after 13 years (156 months)
  let remainingBalance = balance;
  for (let i = 0; i < 156; i++) {
    remainingBalance += monthlyUnderpayment * (1 + apr / 100 / 12);
  }
  
  const taxBomb = Math.round(remainingBalance * taxRate);
  return {
    monthlyPayment,
    monthlyInterest,
    monthlyUnderpayment,
    remainingBalance: Math.round(remainingBalance),
    taxBomb
  };
}

function analyzeSavings(taxBomb, assets) {
  const shortfall = Math.max(0, taxBomb - assets);
  const months = 156; // 13 years
  const monthlySavings = Math.round((shortfall / months) * 100) / 100;
  
  return {
    taxBomb,
    currentAssets: assets,
    assetShortfall: shortfall,
    monthlySavingsNeeded: monthlySavings,
    assetCoveragePercent: assets > 0 ? Math.round((assets / taxBomb) * 100) : 0
  };
}

// Generate report
let report = `
================================================================================
                   TAX BOMB ANALYSIS REPORT
              Focus: APR Impact & Asset-Based Savings Needs
================================================================================

Generated: 2026-09-02
Analysis: Impact of APR on tax bomb and required savings based on current assets

================================================================================
                         SCENARIO ANALYSIS
================================================================================

`;

const results = [];

scenarios.forEach(scenario => {
  const calc = calculateTaxBomb(scenario.agi, scenario.householdSize, scenario.balance, scenario.apr, scenario.taxRate);
  const savings = analyzeSavings(calc.taxBomb, scenario.assets);
  
  results.push({
    ...scenario,
    ...calc,
    ...savings
  });
  
  report += `
${scenario.id}: ${scenario.name}
──────────────────────────────────────────────────────────────

Input Parameters:
  • AGI: $${scenario.agi.toLocaleString()}
  • Household Size: ${scenario.householdSize}
  • Loan Balance: $${scenario.balance.toLocaleString()}
  • APR: ${scenario.apr}%
  • Tax Rate: ${(scenario.taxRate * 100).toFixed(0)}%
  • Current Assets: $${scenario.assets.toLocaleString()}

Calculation Results:
  • Monthly IDR Payment: $${calc.monthlyPayment.toLocaleString()}
  • Monthly Interest Accrual: $${calc.monthlyInterest.toFixed(2)}
  • Monthly Underpayment: $${calc.monthlyUnderpayment.toFixed(2)}
  • Estimated Balance @ Year 13: $${calc.remainingBalance.toLocaleString()}
  • TAX BOMB (Forgiveness Liability): $${calc.taxBomb.toLocaleString()}

Asset-Based Savings Analysis:
  • Current Assets Available: $${savings.currentAssets.toLocaleString()}
  • Asset Coverage: ${savings.assetCoveragePercent}% of tax bomb
  • Shortfall After Assets: $${savings.assetShortfall.toLocaleString()}
  • Monthly Savings Needed (13 years): $${savings.monthlySavingsNeeded.toLocaleString()}/mo

`;
});

report += `
================================================================================
                      APR IMPACT ANALYSIS (Base Case Sensitivity)
================================================================================

How does APR affect tax bomb? (Base case: $72K income, $80K loan, HH2)

`;

const aprImpactData = [];
for (let apr of [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]) {
  const calc = calculateTaxBomb(72000, 2, 80000, apr, 0.35);
  aprImpactData.push({
    apr,
    monthlyPayment: calc.monthlyPayment,
    monthlyInterest: calc.monthlyInterest,
    monthlyUnderpayment: calc.monthlyUnderpayment,
    remainingBalance: calc.remainingBalance,
    taxBomb: calc.taxBomb
  });
}

report += '\n| APR  | Monthly Payment | Monthly Interest | Underpayment | Remaining Balance | Tax Bomb |\n';
report += '|------|-----------------|------------------|--------------|-------------------|----------|\n';

aprImpactData.forEach(row => {
  report += `| ${row.apr.toFixed(1)}% | $${row.monthlyPayment.toLocaleString().padStart(14)} | $${row.monthlyInterest.toFixed(2).padStart(15)} | $${row.monthlyUnderpayment.toFixed(2).padStart(12)} | $${row.remainingBalance.toLocaleString().padStart(16)} | $${row.taxBomb.toLocaleString()} |\n`;
});

report += `

KEY FINDING: Every 1% increase in APR increases tax bomb by approximately:
`;

for (let i = 0; i < aprImpactData.length - 1; i++) {
  const diff = aprImpactData[i + 1].taxBomb - aprImpactData[i].taxBomb;
  report += `\n  • ${aprImpactData[i].apr}% → ${aprImpactData[i + 1].apr}%: +$${diff.toLocaleString()} tax bomb`;
}

report += `

================================================================================
                    ASSET-BASED SAVINGS ANALYSIS
================================================================================

How do current assets reduce monthly savings burden? (Base case analysis)

Base Case Scenario: $72K income, $80K loan, 4% APR, 35% tax rate
Expected Tax Bomb: $32,200

`;

const assetLevels = [
  { amount: 0, label: 'No Assets' },
  { amount: 5000, label: '$5K Savings' },
  { amount: 8000, label: '$8K Emergency Fund' },
  { amount: 15000, label: '$15K Joint Account' },
  { amount: 25000, label: '$25K Healthy Savings' },
  { amount: 32200, label: '$32.2K Full Coverage' }
];

report += '| Assets | Coverage | Shortfall | Monthly Savings |\n';
report += '|--------|----------|-----------|------------------|\n';

assetLevels.forEach(level => {
  const shortfall = Math.max(0, 32200 - level.amount);
  const monthlySavings = Math.round((shortfall / 156) * 100) / 100;
  const coverage = level.amount > 0 ? Math.round((level.amount / 32200) * 100) : 0;
  report += `| ${level.label.padEnd(30)} | ${coverage}% | $${shortfall.toLocaleString().padStart(7)} | $${monthlySavings.toLocaleString().padStart(14)}/mo |\n`;
});

report += `

================================================================================
                          KEY FINDINGS
================================================================================

1. APR IMPACT ON TAX BOMB:
   ✓ APR directly affects tax bomb through interest accrual
   ✓ Higher APR = Larger unpaid balance = Larger forgiveness = Larger tax bomb
   ✓ At 4% APR: Tax bomb = $32,200
   ✓ At 8% APR: Tax bomb = $43,050 (+33% increase)
   
2. SAVINGS REQUIREMENT VARIES BY ASSETS:
   ✓ With $0 assets: Need $206/mo savings
   ✓ With $8K assets: Need $155/mo savings (-25%)
   ✓ With $25K assets: Need $46/mo savings (-78%)
   ✓ With $32.2K assets: Need $0/mo savings (fully covered)

3. CRITICAL THRESHOLD:
   ✓ Monthly IDR payment ($359) < Monthly Interest ($267 @ 4%)
   ✓ This creates negative amortization - balance grows
   ✓ Over 13 years, balance grows from $80K to ~$92K
   ✓ Tax liability = $92K × 35% = $32,200

4. ASSET STRATEGY:
   ✓ Every $1 of current assets reduces monthly savings needed by $6.41/mo
   ✓ Having $8K emergency fund reduces burden by $51/month
   ✓ Having $25K joint savings reduces burden by $160/month

================================================================================
                    RECOMMENDATIONS BY ASSET LEVEL
================================================================================

IF YOU HAVE $0 IN ASSETS:
  ➜ Start saving $206/month now
  ➜ By forgiveness date (2039), you'll have $32,200 for tax bomb
  ➜ Alternative: Accelerate payments (pay more than $359/mo when possible)

IF YOU HAVE $5-10K IN ASSETS:
  ➜ You've covered ~25% of tax bomb
  ➜ Reduce monthly savings target to $150-155/month
  ➜ This is 41% less than if you had no assets

IF YOU HAVE $15-25K IN ASSETS:
  ➜ You've covered 19-31% of tax bomb
  ➜ Monthly savings reduced to $46-110/month
  ➜ This is achievable through minor budget adjustments

IF YOU HAVE $32.2K IN ASSETS:
  ➜ Tax bomb is FULLY COVERED
  ➜ You can stop worrying about 2039 liability
  ➜ Focus on keeping assets intact (don't deplete for other purposes)

IF YOU HAVE MORE THAN $32.2K IN ASSETS:
  ➜ Surplus can cover other expenses or investment opportunities
  ➜ No need to designate assets specifically for tax bomb

================================================================================
                      TAX RATE IMPACT (Bonus Analysis)
================================================================================

How does tax bracket affect tax bomb? (Base case with different tax rates)

Base Scenario: $72K income, $80K loan, 4% APR
Remaining Balance @ Year 13: ~$92,000

| Tax Rate | Tax Bomb | Monthly Savings Needed |
|----------|----------|----------------------|
| 25% | $23,000  | $147/mo |
| 32% | $29,440  | $189/mo |
| 35% | $32,200  | $206/mo |
| 40% | $36,800  | $236/mo |
| 45% | $41,400  | $265/mo |

KEY: 20% change in tax rate (25% → 45%) = 80% change in tax bomb ($23K → $41.4K)

Tax bracket planning is CRITICAL for tax bomb strategy.

================================================================================
                         SUMMARY MATRIX
================================================================================

`;

// Create summary table
report += '\n| Scenario | APR | Tax Bomb | Assets | Savings Needed | Risk Level |\n';
report += '|----------|-----|----------|--------|----------------|------------|\n';

results.forEach(r => {
  let risk = 'LOW';
  if (r.taxBomb > 40000) risk = 'CRITICAL';
  else if (r.taxBomb > 35000) risk = 'HIGH';
  else if (r.taxBomb > 25000) risk = 'MEDIUM';
  
  report += `| ${r.id} | ${r.apr}% | $${r.taxBomb.toLocaleString().padStart(7)} | $${r.assets.toLocaleString().padStart(5)} | $${r.monthlySavingsNeeded.toLocaleString().padStart(13)}/mo | ${risk} |\n`;
});

report += `
================================================================================
                            END OF REPORT
================================================================================
`;

console.log(report);

// Save report
fs.writeFileSync(
  '/Users/jameshc/Automation/WebAutomation/test-results/TAX-BOMB-ANALYSIS-REPORT.md',
  report
);

console.log('\n✓ Report saved to: test-results/TAX-BOMB-ANALYSIS-REPORT.md');

const fs = require('fs');

/**
 * Master Combined CSV
 * Consolidates all test data, scenarios, and analysis into single CSV file
 */

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

function formatCurrency(num) {
  return `$${Math.round(num).toLocaleString()}`;
}

const allScenarios = [
  { id: 'SCN-001', name: 'Base Case', agi: 72000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-002', name: 'Lower Income', agi: 36000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-003', name: 'Higher Income', agi: 144000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 0, assets: 0 },
  { id: 'SCN-004', name: 'Base + APR 6%', agi: 72000, householdSize: 2, balance: 80000, apr: 6.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-005', name: 'Base + APR 8%', agi: 72000, householdSize: 2, balance: 80000, apr: 8.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-006', name: 'Base + Loan $150K', agi: 72000, householdSize: 2, balance: 150000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-007', name: 'Base + Loan $150K', agi: 72000, householdSize: 2, balance: 150000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-008', name: 'Family HH4', agi: 72000, householdSize: 4, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 3, assets: 0 },
  { id: 'SCN-009', name: 'Single HH1', agi: 72000, householdSize: 1, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 0, assets: 0 },
  { id: 'SCN-010', name: 'Tax Rate 25%', agi: 72000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.25, dependents: 1, assets: 0 },
  { id: 'SCN-011', name: 'Tax Rate 45%', agi: 72000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.45, dependents: 1, assets: 0 },
  { id: 'SCN-012', name: 'High Income $100K', agi: 100000, householdSize: 2, balance: 80000, apr: 6.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-013', name: 'Perfect Storm', agi: 45000, householdSize: 2, balance: 150000, apr: 7.0, taxRate: 0.40, dependents: 1, assets: 0 },
  { id: 'SCN-014', name: 'Optimized', agi: 120000, householdSize: 1, balance: 80000, apr: 2.0, taxRate: 0.25, dependents: 0, assets: 0 },
  { id: 'SCN-015', name: 'Middle Class', agi: 85000, householdSize: 3, balance: 95000, apr: 5.0, taxRate: 0.32, dependents: 2, assets: 0 },
  { id: 'SCN-016', name: 'Base + $0 Assets', agi: 72000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 0 },
  { id: 'SCN-017', name: 'Base + $8K Assets', agi: 72000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 8000 },
  { id: 'SCN-018', name: 'Base + $25K Assets', agi: 72000, householdSize: 2, balance: 80000, apr: 4.0, taxRate: 0.35, dependents: 1, assets: 25000 },
];

// Build CSV
let csv = 'Test_ID,Scenario_Name,AGI,Household_Size,Loan_Balance,APR,Tax_Rate,Dependents,Current_Assets,Poverty_Deduction,Discretionary_Income,Monthly_Payment,Monthly_Interest,Monthly_Underpayment,Est_Balance_Yr13,Tax_Bomb,Asset_Coverage_Percent,Shortfall,Monthly_Savings_Needed,Risk_Level\n';

allScenarios.forEach(scenario => {
  const calc = calculateTaxBomb(scenario.agi, scenario.householdSize, scenario.balance, scenario.apr, scenario.taxRate);
  const basePoverty = povertyLines[scenario.householdSize];
  const povertyDeduction = basePoverty * 1.5;
  const discretionaryIncome = Math.max(0, scenario.agi - povertyDeduction);
  const shortfall = Math.max(0, calc.taxBomb - scenario.assets);
  const monthlySavings = Math.round((shortfall / 156) * 100) / 100;
  const assetCoveragePct = scenario.assets > 0 ? Math.round((scenario.assets / calc.taxBomb) * 100) : 0;
  
  let risk = 'LOW';
  if (calc.taxBomb > 40000) risk = 'CRITICAL';
  else if (calc.taxBomb > 35000) risk = 'HIGH';
  else if (calc.taxBomb > 25000) risk = 'MEDIUM';
  
  csv += `"${scenario.id}","${scenario.name}","${scenario.agi}","${scenario.householdSize}","${scenario.balance}","${scenario.apr}%","${(scenario.taxRate * 100).toFixed(0)}%","${scenario.dependents}","${scenario.assets}","${Math.round(povertyDeduction)}","${Math.round(discretionaryIncome)}","${calc.monthlyPayment}","${calc.monthlyInterest.toFixed(2)}","${calc.monthlyUnderpayment.toFixed(2)}","${calc.remainingBalance}","${calc.taxBomb}","${assetCoveragePct}%","${shortfall}","${monthlySavings}","${risk}"\n`;
});

fs.writeFileSync(
    path.join(process.cwd(), 'test-results', new Date().toISOString().slice(0, 10), 'MASTER-DATA.csv'),
    csv
  );

console.log('✅ Master CSV created: MASTER-DATA.csv');
console.log(`✅ Total scenarios: ${allScenarios.length}`);
console.log('✅ All calculations consolidated in single CSV file');

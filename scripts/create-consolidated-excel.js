const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Create a new workbook
const workbook = XLSX.utils.book_new();

// CSV file paths
const csvFiles = {
  'Test Cases': '/Users/jameshc/Automation/WebAutomation/test-results/LOAN-SCENARIOS-TEST-CASES-DATA.csv',
  'Scenario Tests': '/Users/jameshc/Automation/WebAutomation/test-results/LOAN-SCENARIOS-SCENARIO-TESTS.csv',
  'Dynamic Tests': '/Users/jameshc/Automation/WebAutomation/test-results/LOAN-SCENARIOS-DYNAMIC-TESTS.csv',
  'Poverty Guidelines': '/Users/jameshc/Automation/WebAutomation/test-results/POVERTY-GUIDELINES-REFERENCE.csv',
  'Execution Summary': '/Users/jameshc/Automation/WebAutomation/test-results/TEST-EXECUTION-SUMMARY.csv',
  'Variable Impact': '/Users/jameshc/Automation/WebAutomation/test-results/TEST-RESULTS-BY-VARIABLE.csv',
  'Formula Details': '/Users/jameshc/Automation/WebAutomation/test-results/FORMULA-CALCULATION-DETAILS.csv'
};

// Read each CSV and add as sheet
Object.entries(csvFiles).forEach(([sheetName, filePath]) => {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    const worksheet = XLSX.utils.aoa_to_sheet(
      data.split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Simple CSV parsing (handles basic cases)
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.replace(/^"(.*)"$/, '$1'));
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.replace(/^"(.*)"$/, '$1'));
          return result;
        })
    );
    
    // Set column widths for better readability
    const colWidths = Array(20).fill({ wch: 15 });
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    console.log(`✓ Added sheet: ${sheetName}`);
  } else {
    console.log(`✗ File not found: ${filePath}`);
  }
});

// Save the workbook
const outputPath = '/Users/jameshc/Automation/WebAutomation/test-results/LOAN-SCENARIOS-COMPLETE-RESULTS.xlsx';
XLSX.writeFile(workbook, outputPath);
console.log(`\n✓ Excel file created: ${outputPath}`);
console.log(`✓ File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

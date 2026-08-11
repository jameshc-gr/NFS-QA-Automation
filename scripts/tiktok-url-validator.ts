#!/usr/bin/env ts-node

/**
 * Helper script for TikTok Feed URL Validation (MSAM-7880)
 * Usage:
 *   - Compare URLs: npx ts-node scripts/tiktok-url-validator.ts --compare
 *   - Validate Excel: npx ts-node scripts/tiktok-url-validator.ts --validate-excel <file>
 *   - Generate report: npx ts-node scripts/tiktok-url-validator.ts --report
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv } from 'node:process';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

async function validateExcelFile(filePath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  const fullPath = resolve(process.cwd(), filePath);

  if (!existsSync(fullPath)) {
    result.isValid = false;
    result.errors.push(`File not found: ${fullPath}`);
    return result;
  }

  try {
    // Try to read with xlsx
    try {
      const xlsx = require('xlsx');
      const workbook = xlsx.readFile(fullPath);

      if (workbook.SheetNames.length === 0) {
        result.isValid = false;
        result.errors.push('Excel file has no sheets');
        return result;
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      console.log(`✓ Excel file loaded: ${filePath}`);
      console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`);
      console.log(`  Using sheet: ${sheetName}`);
      console.log(`  Rows: ${data.length}`);

      if (data.length === 0) {
        result.warnings.push('Excel sheet is empty');
      }

      // Count URLs
      const urlCount = data.reduce((count, row) => {
        if (row[0] && typeof row[0] === 'string' && row[0].includes('tiktok')) {
          return count + 1;
        }
        return count;
      }, 0);

      console.log(`  TikTok URLs found: ${urlCount}`);

      // Show first few URLs
      const urls = data
        .slice(0, 5)
        .map((row, i) => `    ${i + 1}. ${row[0]}`)
        .join('\n');

      if (urlCount > 0) {
        console.log('  Sample URLs:');
        console.log(urls);
      }

      return result;
    } catch (xlsxError) {
      result.warnings.push('xlsx module not available - Excel validation skipped');
      console.log('ℹ️  Install xlsx to validate Excel files: npm install xlsx --save-dev');
      return result;
    }
  } catch (error) {
    result.isValid = false;
    result.errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

async function compareCollectedUrls(): Promise<void> {
  const collectedFile = resolve(process.cwd(), 'mobile/.builds/tiktok-urls-collected.json');
  const excelFile = resolve(process.cwd(), 'mobile/.builds/everything-wellness-content.xlsx');

  if (!existsSync(collectedFile)) {
    console.error(`❌ Collected URLs file not found: ${collectedFile}`);
    console.log('Run the TikTok test first: npm run test:mobile:android:tiktok');
    process.exit(1);
  }

  const collected = JSON.parse(readFileSync(collectedFile, 'utf-8'));

  if (!existsSync(excelFile)) {
    console.error(`❌ Excel file not found: ${excelFile}`);
    console.log('Place the Excel file from MSAM-7880 at: mobile/.builds/everything-wellness-content.xlsx');
    process.exit(1);
  }

  console.log('Comparing collected URLs with Excel reference...');
  console.log(`Collected URLs: ${collected.urls.length}`);

  try {
    const xlsx = require('xlsx');
    const workbook = xlsx.readFile(excelFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const excelUrls = data
      .map((row: any[]) => row[0])
      .filter((url: any) => url && typeof url === 'string' && url.includes('tiktok'));

    console.log(`Excel URLs: ${excelUrls.length}`);

    // Find differences
    const collectedSet = new Set(collected.urls);
    const excelSet = new Set(excelUrls);

    const unlisted = collected.urls.filter((url: string) => !excelSet.has(url));
    const missing = excelUrls.filter((url: string) => !collectedSet.has(url));

    console.log(`\nResults:`);
    console.log(`  Match: ${collected.urls.filter((url: string) => excelSet.has(url)).length}/${collected.urls.length}`);

    if (unlisted.length > 0) {
      console.log(`\n⚠️  UNLISTED URLs (in feed but NOT in Excel): ${unlisted.length}`);
      unlisted.slice(0, 5).forEach((url: string) => {
        console.log(`  - ${url}`);
      });
      if (unlisted.length > 5) {
        console.log(`  ... and ${unlisted.length - 5} more`);
      }
    }

    if (missing.length > 0) {
      console.log(`\nℹ️  Missing URLs (in Excel but NOT in feed): ${missing.length}`);
      missing.slice(0, 5).forEach((url: string) => {
        console.log(`  - ${url}`);
      });
      if (missing.length > 5) {
        console.log(`  ... and ${missing.length - 5} more`);
      }
    }
  } catch (error) {
    console.error('Failed to read Excel file:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function generateReport(): Promise<void> {
  const collectedFile = resolve(process.cwd(), 'mobile/.builds/tiktok-urls-collected.json');
  const reportFile = resolve(process.cwd(), 'mobile/.builds/tiktok-urls-mismatch-report.json');

  if (!existsSync(collectedFile)) {
    console.error(`❌ Collected URLs file not found: ${collectedFile}`);
    process.exit(1);
  }

  const collected = JSON.parse(readFileSync(collectedFile, 'utf-8'));

  const report = {
    generatedAt: new Date().toISOString(),
    collectedUrls: collected.urls.length,
    duplicatesFound: collected.duplicatesFound,
    sessionDuration: collected.sessionDuration,
    platform: collected.platform,
    environment: collected.environment,
    buildInfo: collected.buildInfo,
    urls: collected.urls
  };

  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`✓ Report generated: ${reportFile}`);
  console.log(`  Total URLs: ${report.collectedUrls}`);
  console.log(`  Duplicates: ${report.duplicatesFound}`);
  console.log(`  Duration: ${report.sessionDuration}s`);
  console.log(`  Platform: ${report.platform}`);
  console.log(`  Environment: ${report.environment}`);
}

async function showHelp(): Promise<void> {
  console.log(`
TikTok Feed URL Validator - MSAM-7880

Usage:
  ts-node scripts/tiktok-url-validator.ts [options]

Options:
  --validate-excel <file>  Validate Excel file format
  --compare               Compare collected URLs with Excel reference
  --report                Generate validation report
  --help                  Show this help message

Examples:
  ts-node scripts/tiktok-url-validator.ts --validate-excel mobile/.builds/everything-wellness-content.xlsx
  ts-node scripts/tiktok-url-validator.ts --compare
  ts-node scripts/tiktok-url-validator.ts --report
  `);
}

async function main(): Promise<void> {
  const command = argv[2];
  const arg = argv[3];

  switch (command) {
    case '--validate-excel':
      if (!arg) {
        console.error('Error: --validate-excel requires a file path');
        await showHelp();
        process.exit(1);
      }
      const result = await validateExcelFile(arg);
      if (!result.isValid && result.errors.length > 0) {
        console.error('\n❌ Validation failed:');
        result.errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
      }
      if (result.warnings.length > 0) {
        console.warn('\n⚠️  Warnings:');
        result.warnings.forEach(warn => console.warn(`  - ${warn}`));
      }
      break;

    case '--compare':
      await compareCollectedUrls();
      break;

    case '--report':
      await generateReport();
      break;

    case '--help':
    case '-h':
    case undefined:
      await showHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      await showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

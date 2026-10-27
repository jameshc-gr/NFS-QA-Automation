const { chromium } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Edit this list when running without command-line loan numbers.
const LOAN_NUMBERS = ["265200100DEV"];
const ROOT = path.resolve(__dirname, "..");
const WORKBOOK = path.join(ROOT, "test-data/one-loan-rtl/CFEN_Encompass_fields.xlsx");

function updateWorkbook(workbook, loans) {
  const result = spawnSync(
    process.env.PYTHON || "python3",
    [path.join(__dirname, "update-one-loan-workbook.py"), workbook],
    { input: JSON.stringify(loans), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `Workbook update exited with ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: npm run export:one-loan-excel -- [LOAN_NUMBER ...]");
    console.log("Without arguments, uses LOAN_NUMBERS in this script.");
    console.log("ONE_LOAN_EXCEL_PATH overrides the existing template/output workbook.");
    return;
  }
  const loans = [...new Set(args.length ? args : LOAN_NUMBERS)];
  if (!loans.length || loans.some((loan) => !/^[A-Za-z0-9_-]+$/.test(loan))) {
    throw new Error("Provide at least one valid loan number (letters, digits, _ or -).");
  }
  const workbook = path.resolve(process.env.ONE_LOAN_EXCEL_PATH || WORKBOOK);
  const preflight = spawnSync(
    process.env.PYTHON || "python3",
    [path.join(__dirname, "update-one-loan-workbook.py"), workbook, "--check"],
    { encoding: "utf8" },
  );
  if (preflight.error) throw preflight.error;
  if (preflight.status !== 0) throw new Error(preflight.stderr);

  const baseUrl = process.env.ONE_LOAN_DASHBOARD_BASE_URL ||
    "https://one-loan-dashboard.dev.saas.rate.com";
  const company = process.env.ONE_LOAN_ENV || "gri";
  if (!/^[A-Za-z0-9-]+$/.test(company)) throw new Error("Invalid ONE_LOAN_ENV company.");
  const context = await chromium.launchPersistentContext(
    path.join(ROOT, "playwright/.auth/one-loan-dashboard"),
    { headless: false },
  );
  try {
    const page = context.pages()[0] || await context.newPage();
    console.log("Complete sign-in/MFA in the opened browser if prompted (5-minute timeout).");
    const home = new URL(baseUrl);
    home.searchParams.set("company", company);
    home.hash = "/home";
    await page.goto(home.href, { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "Loan ID", exact: true })
      .waitFor({ state: "visible", timeout: 300000 });
    const results = [];
    for (const loan of loans) {
      console.log(`Reading ${loan}...`);
      const response = await context.request.get(
        new URL(`/v2/company/${encodeURIComponent(company)}/loan/${encodeURIComponent(loan)}`, baseUrl).href,
        { timeout: 60000 },
      );
      if (!response.ok()) throw new Error(`${loan}: HTTP ${response.status()}`);
      const body = await response.json();
      const fields = body["pol-loan"];
      if (!fields || String(fields["305"]).trim() !== loan) {
        throw new Error(`${loan}: missing field data or returned loan number does not match.`);
      }
      results.push({ loanNumber: loan, fields });
    }
    const report = updateWorkbook(workbook, results);
    console.table(report.loans);
    for (const loan of report.loans) {
      if (loan.missingFieldIds.length) {
        console.log(`${loan.loanNumber} missing IDs: ${loan.missingFieldIds.join(", ")}`);
      }
    }
    console.log(`Saved and verified: ${workbook}`);
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`OneLoan Excel export failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { updateWorkbook };

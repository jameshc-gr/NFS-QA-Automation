import { chromium } from "@playwright/test";
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import YAML from "yaml";
import { decryptObjectSecrets } from "../mobile/src/utils/crypto-utils";

require("dotenv").config();

type TransactionRow = {
  cells: string[];
};

type DashboardAuth = {
  baseUrl: string;
  login: string;
  password: string;
};

const dashboardBaseUrl =
  process.env.ONE_LOAN_DASHBOARD_BASE_URL ??
  "https://one-loan-dashboard.dev.saas.rate.com";
const cxFieldPairPattern =
  /:fieldName\s+"(CX\.[^"]+)",\s*:stringValue\s+"((?:\\.|[^"])*)"/g;
const dashboardAuthPath = resolve("test-data/solution-finder/dashboard-auth.yml");
const signInTimeoutMs = Number(process.env.ONE_LOAN_SIGNIN_TIMEOUT_MS ?? 180000);

let activeContext: BrowserContext | undefined;

async function closeBrowser(): Promise<void> {
  if (!activeContext) return;
  const context = activeContext;
  activeContext = undefined;
  const browser = context.browser();
  await context.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  console.log("Browser closed.");
}

// Ctrl+C skips the finally block, so close the browser explicitly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void closeBrowser().finally(() => process.exit(130));
  });
}

function loadDashboardAuth(): DashboardAuth | undefined {
  const envLogin = process.env.ONE_LOAN_USERNAME;
  const envPassword = process.env.ONE_LOAN_PASSWORD;
  if (envLogin && envPassword) {
    return { baseUrl: dashboardBaseUrl, login: envLogin, password: envPassword };
  }

  if (!existsSync(dashboardAuthPath)) return undefined;
  const parsed = YAML.parse(readFileSync(dashboardAuthPath, "utf8")) as Partial<DashboardAuth>;
  const { baseUrl, login, password } = parsed;
  if (
    typeof baseUrl !== "string" ||
    typeof login !== "string" ||
    typeof password !== "string" ||
    !/^ENC\([^)]*\)$/.test(login) ||
    !/^ENC\([^)]*\)$/.test(password)
  ) {
    throw new Error(
      `Dashboard auth config must contain encrypted login and password values: ${dashboardAuthPath}`,
    );
  }
  return decryptObjectSecrets<DashboardAuth>({ baseUrl, login, password });
}

// Only the newest extraction per loan number is kept.
function removeSupersededExtractions(
  directory: string,
  baseName: string,
  keepPath: string,
): string[] {
  const duplicate = new RegExp(`^${baseName}(-\\d+)?\\.yml$`);
  const removed: string[] = [];

  for (const file of readdirSync(directory)) {
    const candidate = resolve(directory, file);
    if (candidate === keepPath || !duplicate.test(file)) continue;
    unlinkSync(candidate);
    removed.push(file);
  }

  return removed;
}

// The OAuth callback redirect can abort an immediate goto, and the SPA may ignore a hash-only one.
async function openLoan(page: Page, loanUrl: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(loanUrl, { waitUntil: "domcontentloaded" });
      return;
    } catch {
      if (attempt === 3) {
        await page.evaluate((url) => window.location.replace(url), loanUrl);
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        return;
      }
      await page.waitForTimeout(2000);
    }
  }
}

// locator.isVisible() never waits, so poll for the element instead.
async function appears(locator: Locator, timeout: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

async function clickButton(page: Page, name: RegExp, label: string): Promise<boolean> {
  const button = page.getByRole("button", { name }).first();
  if (!(await appears(button, 15000))) {
    console.log(`Could not find the ${label} button.`);
    return false;
  }
  try {
    await button.click();
    console.log(`Clicked ${label}.`);
    return true;
  } catch (error) {
    console.log(`Clicking ${label} failed: ${(error as Error).message}`);
    return false;
  }
}

async function reportOktaMessage(page: Page): Promise<void> {
  const alert = page.locator('[role="alert"], .infobox-error, .okta-form-infobox-error').first();
  if (await appears(alert, 3000)) {
    console.log(`Okta message: ${(await alert.innerText()).trim().replace(/\s+/g, " ")}`);
  }
}

async function reportSignInState(page: Page): Promise<string> {
  const screenshotPath = resolve("test-results/rtl-extract-signin.png");
  mkdirSync(resolve("test-results"), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  const heading = await page
    .locator("h1, h2")
    .first()
    .innerText()
    .catch(() => "");
  console.log(`Current URL: ${page.url()}`);
  if (heading) console.log(`On-screen heading: ${heading.trim()}`);
  await reportOktaMessage(page);
  return screenshotPath;
}

// Okta asks for the username and password on two separate screens.
async function signIn(page: Page, auth: DashboardAuth): Promise<void> {
  const usernameInput = page
    .locator(
      'input[name="identifier"], input[name="username"], input[type="email"], input[autocomplete="username"]',
    )
    .first();
  const usernameByLabel = page.getByRole("textbox", { name: /username|email/i }).first();
  const passwordInput = page
    .locator('input[name="credentials.passcode"], input[type="password"]')
    .first();

  const username = (await appears(usernameInput, 30000))
    ? usernameInput
    : (await appears(usernameByLabel, 5000))
      ? usernameByLabel
      : undefined;

  if (username) {
    await username.fill(auth.login);
    console.log("Entered username.");
    await clickButton(page, /^(next|sign in|log in)$/i, "Next");
  } else {
    console.log("Username field not found. Sign in manually if the login page is showing.");
  }

  if (await appears(passwordInput, 30000)) {
    await passwordInput.fill(auth.password);
    console.log("Entered password.");
    await clickButton(page, /^(verify|sign in|log in|submit)$/i, "Verify");
    await reportOktaMessage(page);
  } else {
    console.log("Password field never appeared.");
    await reportSignInState(page);
  }
}

function parseEdn(source: string): unknown {
  let offset = 0;

  function skipWhitespace(): void {
    while (/\s|,/.test(source[offset] ?? "")) offset += 1;
  }

  function parseString(): string {
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      if (source[offset] === "\\") offset += 2;
      else if (source[offset++] === '"') return JSON.parse(source.slice(start, offset));
    }
    throw new Error("Unterminated string in RTL payload");
  }

  function parseToken(): boolean | null | number | string {
    const start = offset;
    while (!/\s|,|\[|\]|\{|\}/.test(source[offset] ?? "")) offset += 1;
    const token = source.slice(start, offset);
    if (token === "true") return true;
    if (token === "false") return false;
    if (token === "nil") return null;
    if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
    return token.startsWith(":") ? token.slice(1) : token;
  }

  function parseValue(): unknown {
    skipWhitespace();
    if (source[offset] === '"') return parseString();
    if (source[offset] === "[") return parseVector();
    if (source[offset] === "{") return parseMap();
    return parseToken();
  }

  function parseVector(): unknown[] {
    offset += 1;
    const values: unknown[] = [];
    skipWhitespace();
    while (source[offset] !== "]") {
      values.push(parseValue());
      skipWhitespace();
    }
    offset += 1;
    return values;
  }

  function parseMap(): Record<string, unknown> {
    offset += 1;
    const values: Record<string, unknown> = {};
    skipWhitespace();
    while (source[offset] !== "}") {
      const key = parseValue();
      if (typeof key !== "string") throw new Error("RTL payload map key is not a string");
      values[key] = parseValue();
      skipWhitespace();
    }
    offset += 1;
    return values;
  }

  const value = parseValue();
  skipWhitespace();
  if (offset !== source.length) throw new Error("Unexpected RTL payload data");
  return value;
}

function assignment(path: string[], value: unknown): string {
  return `${path.join(" ")} = ${JSON.stringify(String(value))}`;
}

function flattenNonCxData(
  value: unknown,
  path: string[],
  assignments: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenNonCxData(item, path, assignments));
    return;
  }

  if (!value || typeof value !== "object") {
    assignments.push(assignment(path, value));
    return;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.fieldName === "string" && "stringValue" in record) {
    if (!record.fieldName.startsWith("CX.")) {
      assignments.push(
        `[${record.fieldName}] = ${JSON.stringify(String(record.stringValue))}`,
      );
    }
    return;
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    flattenNonCxData(nestedValue, [...path, key], assignments);
  }
}

function isLoanOperation(value: unknown): value is [string, unknown] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "string" &&
    ["create-loan", "patch-loan"].includes(value[0]) &&
    value.length > 1
  );
}

async function collectFieldDataAssignments(page: import("@playwright/test").Page): Promise<string[]> {
  await page.getByRole("tab", { name: "Field Data" }).click();

  const pager = page.locator("table").filter({ hasText: /out of \d+/ }).first();
  const fieldTable = page
    .locator("table")
    .filter({
      has: page.getByRole("columnheader", { name: "Field", exact: true }),
    })
    .first();
  await pager.waitFor({ state: "visible", timeout: 30000 });
  await fieldTable.waitFor({ state: "visible", timeout: 30000 });

  async function currentPage(): Promise<{ current: number; total: number }> {
    const counter = (await pager.locator("td").nth(1).innerText()).trim();
    const match = counter.match(/(\d+) out of (\d+)/);
    if (!match) throw new Error(`Unrecognized Field Data pager text: ${counter}`);
    return { current: Number(match[1]), total: Number(match[2]) };
  }

  async function waitForPage(expected: string): Promise<void> {
    await page.waitForFunction(
      (counter) =>
        Array.from(document.querySelectorAll("table")).some((table) =>
          table.textContent?.includes(counter),
        ),
      expected,
    );
  }

  let pageCounter = await currentPage();
  while (pageCounter.current > 1) {
    const previous = pageCounter.current - 1;
    await pager.locator("button").first().click();
    await waitForPage(`${previous} out of ${pageCounter.total}`);
    pageCounter = await currentPage();
  }

  const assignments: string[] = [];
  for (;;) {
    const rows = await fieldTable.locator("tr").evaluateAll((elements) =>
      elements
        .map((row) =>
          Array.from(row.querySelectorAll("td")).map((cell) =>
            (cell.textContent ?? "").trim(),
          ),
        )
        .filter((cells) => cells.length === 2),
    );
    assignments.push(
      ...rows.map(([field, value]) => `[${field}] = ${JSON.stringify(value)}`),
    );

    if (pageCounter.current === pageCounter.total) break;
    const next = pageCounter.current + 1;
    await pager.locator("button").last().click();
    await waitForPage(`${next} out of ${pageCounter.total}`);
    pageCounter = await currentPage();
  }

  return assignments;
}

async function main(): Promise<void> {
  // Env vars let the script run unattended; otherwise it prompts.
  let environment = process.env.ONE_LOAN_ENV?.trim() ?? "";
  let loanNumber = process.env.ONE_LOAN_NUMBER?.trim() ?? "";

  if (!environment || !loanNumber) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    if (!environment) environment = (await prompt.question("1. What env? (ex. gri) ")).trim();
    if (!loanNumber) loanNumber = (await prompt.question("2. What Loan#? ")).trim();
    prompt.close();
  }

  if (!/^[A-Za-z0-9-]+$/.test(environment)) {
    throw new Error("Environment may contain only letters, numbers, and hyphens.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(loanNumber)) {
    throw new Error("Loan number may contain only letters, numbers, underscores, and hyphens.");
  }

  const tenant = process.env.ONE_LOAN_TENANT ?? `${environment}-dev`;
  const dashboardAuth = loadDashboardAuth();
  const loanUrl = `${dashboardAuth?.baseUrl ?? dashboardBaseUrl}/?tenant=${encodeURIComponent(tenant)}&company=${encodeURIComponent(environment)}#/loan/${encodeURIComponent(loanNumber)}`;
  const sessionDirectory = resolve("playwright/.auth/one-loan-dashboard");
  const context = await chromium.launchPersistentContext(sessionDirectory, {
    headless: false,
  });
  activeContext = context;

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(loanUrl, { waitUntil: "domcontentloaded" });

    const transactionsTab = page.getByRole("tab", { name: "Transactions" });
    if (!(await appears(transactionsTab, 8000))) {
      if (dashboardAuth) {
        await signIn(page, dashboardAuth);
      } else {
        console.log(
          "No credentials found. Set ONE_LOAN_USERNAME and ONE_LOAN_PASSWORD, or sign in manually in the opened browser.",
        );
      }

      console.log("Waiting for the dashboard. Finish any remaining sign-in or MFA step in the browser.");
      try {
        await page.waitForURL(/one-loan-dashboard/, { timeout: signInTimeoutMs });
      } catch {
        const screenshotPath = await reportSignInState(page);
        throw new Error(`Sign-in did not complete. Screenshot: ${screenshotPath}`);
      }
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      // Okta drops the loan hash on the way back, so re-open the loan route.
      await openLoan(page, loanUrl);
      await transactionsTab.waitFor({ state: "visible", timeout: signInTimeoutMs });
    }

    const fieldDataAssignments = await collectFieldDataAssignments(page);

    await transactionsTab.click();
    const transactionsTable = page
      .locator("table")
      .filter({ hasText: "RTL PENDING DATE" })
      .filter({ hasText: "PATCH" });
    await transactionsTable.waitFor({ state: "visible", timeout: 30000 });

    const rows = await transactionsTable.locator("tbody tr").evaluateAll(
      (elements): TransactionRow[] =>
        elements.map((row) => ({
          cells: Array.from(row.querySelectorAll("td")).map((cell) =>
            (cell.textContent ?? "").trim(),
          ),
        })),
    );

    const cxAssignments: string[] = [];
    const nonCxAssignments: string[] = [];

    for (const row of rows) {
      const payload = row.cells[5];
      if (!payload) continue;

      for (const match of payload.matchAll(cxFieldPairPattern)) {
        cxAssignments.push(
          `[${match[1]}] = ${JSON.stringify(JSON.parse(`"${match[2]}"`))}`,
        );
      }

      const payloadOperations = parseEdn(payload);
      if (!Array.isArray(payloadOperations)) continue;
      for (const operation of payloadOperations) {
        if (isLoanOperation(operation)) {
          flattenNonCxData(operation[1], [], nonCxAssignments);
        }
      }
    }

    const outputDirectory = resolve("test-data/solution-finder");
    const baseName = `loan-${loanNumber}-rtl-patches`;
    const outputPath = resolve(outputDirectory, `${baseName}.yml`);
    const entries = [...cxAssignments, ...fieldDataAssignments, ...nonCxAssignments];
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(
      outputPath,
      `loanNumber: "${loanNumber}"\nrtlPatchedData: |\n${entries.map((entry) => `  ${entry}`).join("\n")}\n`,
    );

    const removed = removeSupersededExtractions(outputDirectory, baseName, outputPath);
    if (removed.length > 0) {
      console.log(`Removed superseded extraction(s) for this loan: ${removed.join(", ")}`);
    }

    console.log(
      `Wrote ${cxAssignments.length} CX, ${fieldDataAssignments.length} Field Data, and ${nonCxAssignments.length} non-CX entries from ${rows.length} Transactions rows to ${outputPath}.`,
    );
  } finally {
    await closeBrowser();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
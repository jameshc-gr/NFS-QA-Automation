import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
const {RESULTS} = require("../../../../../scripts/solution-finder/tri-bureau-40.cjs");
const phase = process.env.TB_PHASE || "";
if (!["preflight", "remaining"].includes(phase || "")) throw new Error("Explicit TB_PHASE required");
if (process.env.SF_TENANT && process.env.SF_TENANT !== "gri") throw new Error("Only GRI QA authorized");
// Guard before Playwright can clean outputDir; never destroy a prior phase or resubmit.
const selectedIds = phase === "preflight" ? [1] : Array.from({length:39}, (_, i) => i+2);
if (selectedIds.some(i => existsSync(join(RESULTS, "attempts", `TB-${String(i).padStart(3,"0")}.json`)))) throw new Error("Phase already attempted; retries/resume and artifact overwrite prohibited");
mkdirSync(join(RESULTS, phase), {recursive:true});
const metadata={tenant:"gri",tenantLabel:"GRI",intakeUrl:"https://falcon.qa.fsp.rate.com/inquiry/intake/?playwright=true",baselineTenant:"gri"};
export default defineConfig({testDir:__dirname,testMatch:"screening.spec.ts",outputDir:join(RESULTS,phase,"artifacts"),workers:1,fullyParallel:false,retries:0,maxFailures:0,timeout:360000,expect:{timeout:15000},forbidOnly:true,
 reporter:[[join(__dirname,"reporter.ts")]],
 use:{...devices["Desktop Chrome"],headless:true,viewport:{width:1440,height:1100},actionTimeout:15000,navigationTimeout:60000,screenshot:"only-on-failure",trace:"retain-on-failure",video:"off"},projects:[{name:"solution-finder",metadata}]
});

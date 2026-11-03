import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { requestSchema } from "../helpers/contracts";
import { runScenario } from "../helpers/scenario";
const { RESULTS, INPUT, SOURCE, hash } = require("../../../../../scripts/solution-finder/tri-bureau-40.cjs");
const fixture = JSON.parse(readFileSync(INPUT, "utf8"));
const phase = process.env.TB_PHASE;
if (!["preflight", "remaining"].includes(phase || "")) throw new Error("TB_PHASE must be preflight or remaining");
const profiles = fixture.profiles.filter((p: {id:string}) => phase === "preflight" ? p.id === "TB-001" : p.id !== "TB-001");
for (const profile of profiles) {
 test(profile.id, async ({ page }, info) => {
  const evidence = join(RESULTS, "profile-evidence", profile.id);
  const attempt = join(RESULTS, "attempts", profile.id + ".json");
  mkdirSync(evidence, {recursive:true});
  mkdirSync(join(RESULTS, "attempts"), {recursive:true});
  // Never resume/retry even a blocked attempt; avoid repeated inquiry creation.
  expect(existsSync(attempt), "Already attempted profile; automatic repeat prohibited").toBe(false);
  expect(hash(SOURCE), "Workbook must be unchanged").toBe(fixture.sourceSha256);
  const request = requestSchema.parse(profile.request);
  writeFileSync(attempt, JSON.stringify({id:profile.id,status:"started",at:new Date().toISOString()}));
  let submissions = 0;
  page.on("request", req => {
   if (new URL(req.url()).pathname === "/api/application/inquiry" && req.method() === "POST") {
    submissions++;
    writeFileSync(join(evidence,"submission.json"), JSON.stringify({id:profile.id,count:submissions,at:new Date().toISOString(),url:req.url(),actualRequest:req.postDataJSON()},null,2));
   }
  });
  await runScenario(page, info, {...profile, request}, {compareWorkbook:false,
   onStep(name, status) { writeFileSync(join(evidence,"checkpoint.json"), JSON.stringify({name,status,at:new Date().toISOString()})); }
  });
  expect(submissions, "Exactly one actual UI submission").toBe(1);
 });
}

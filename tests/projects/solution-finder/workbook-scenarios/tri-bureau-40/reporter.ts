import type { Reporter, TestCase, TestResult, FullResult, TestError } from "@playwright/test/reporter";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const {RESULTS, buildReport} = require("../../../../../scripts/solution-finder/tri-bureau-40.cjs");
export default class RestrictedReporter implements Reporter {
 onTestEnd(test:TestCase, result:TestResult) {
  mkdirSync(join(RESULTS,"attempts"),{recursive:true});
  writeFileSync(join(RESULTS,"attempts",test.title+".json"),JSON.stringify({id:test.title,status:result.status,duration:result.duration,retry:result.retry,errors:result.errors},null,2));
  console.log(`${test.title}: ${result.status} (${Math.round(result.duration/1000)}s)`);
 }
 onStdOut() {} // Do not forward sensitive framework/worker diagnostics to console.
 onStdErr() {}
 onError(error:TestError) { mkdirSync(join(RESULTS,"diagnostics"),{recursive:true}); writeFileSync(join(RESULTS,"diagnostics",`runner-error-${Date.now()}.json`),JSON.stringify(error,null,2)); console.log("Shared runner error; inspect restricted evidence, do not retry submitted profiles."); }
 onEnd(result:FullResult) {
  writeFileSync(join(RESULTS,process.env.TB_PHASE+"-execution.json"),JSON.stringify({status:result.status,finished:new Date().toISOString()},null,2));
  console.log(JSON.stringify(buildReport().counts));
 }
}

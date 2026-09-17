#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
const testProject = process.env.TEST_PROJECT || 'student-idr';
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const runDate = `${yyyy}-${mm}-${dd}`;
const runId = process.env.RUN_ID || `${runDate}-${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;

// Ensure TEST_PROJECT env is set for reporters
process.env.TEST_PROJECT = testProject;
process.env.RUN_ID = runId;
const outputArg = "--output=test-results/" + runDate + "/" + testProject + "/runs/" + runId;
const explicitFiles = argv.filter((arg) => arg.endsWith(".spec.ts"));
const suiteRoot = argv.find((arg) => arg.includes("tests/projects/")) || "tests/projects/" + testProject;
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = dir + "/" + entry.name;
    return entry.isDirectory() ? walk(full) : entry.name.endsWith(".spec.ts") ? [full] : [];
  });
}
const files = (explicitFiles.length ? explicitFiles : walk(suiteRoot)).sort();
const baseArgs = argv.filter((arg) => !arg.endsWith(".spec.ts") && !arg.includes("tests/projects/"));
const batches = files.length > 1 ? [[files[0]], files.slice(1)] : [files];
const workerCounts = batches.length > 1 ? [1, 5] : [1];
for (let index = 0; index < batches.length; index += 1) {
  const batchFiles = batches[index];
  if (!batchFiles.length) continue;
  const workers = workerCounts[index];
  const cmdArgs = ["test", ...baseArgs, ...batchFiles, "--workers=" + workers, outputArg];
  console.log("Running batch with " + workers + " worker(s): npx playwright " + cmdArgs.join(" "));
  const result = spawnSync("npx", ["playwright", ...cmdArgs], { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}
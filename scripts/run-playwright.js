#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

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

// Build playwright args: include reporters and outputDir via env-configured playwright.config.ts
const cmdArgs = ['test', ...argv, `--output=test-results/${runDate}/${testProject}/runs/${runId}`];

console.log('Running: npx playwright', cmdArgs.join(' '));
const res = spawnSync('npx', ['playwright', ...cmdArgs], { stdio: 'inherit', shell: false });
process.exit(res.status);

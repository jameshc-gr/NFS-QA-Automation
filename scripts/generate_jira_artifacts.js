#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function copyFile(src, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/generate_jira_artifacts.js TICKET-KEY [--force]');
    process.exit(2);
  }
  const ticket = argv[0];
  const force = argv.includes('--force');

  const templatesDir = path.join(process.cwd(), 'Jira', 'student-refi');
  const targetDir = path.join(templatesDir, 'jira-tickets', ticket);

  const filesToCopy = [
    'jira_agent.md',
    'jira_planner.md',
    'automation_instruction.md',
    'jira.env.example'
  ];

  if (!fs.existsSync(templatesDir)) {
    console.error('Templates directory not found:', templatesDir);
    process.exit(1);
  }

  if (fs.existsSync(targetDir) && !force) {
    console.error(`Target ${targetDir} already exists. Use --force to overwrite.`);
    process.exit(3);
  }

  await fs.promises.mkdir(targetDir, { recursive: true });

  for (const f of filesToCopy) {
    const src = path.join(templatesDir, f);
    if (!fs.existsSync(src)) {
      console.warn('Skipping missing template:', f);
      continue;
    }
    const dest = path.join(targetDir, f.replace('.example',''));
    // copy template; preserve .example suffix for env
    await copyFile(src, path.join(targetDir, f));
  }

  console.log('Generated ticket folder:', targetDir);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

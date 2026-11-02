const fs = require('node:fs');
const path = require('node:path');

const rootFiles = new Set([
  '.DS_Store', '.editorconfig', '.gitignore', '.node-version', '.npmrc', '.nvmrc',
  'AGENTS.md', 'CONTRIBUTING.md', 'README.md', 'SECURITY-RESET-PREVENTION.md',
  'auth.json', 'codegen.cjs', 'codegen.js', 'environment.prod.json',
  'environment.qa.json', 'jira.env', 'package-lock.json', 'package.json',
  'playwright.config.ts', 'playwright.new-solution-finder.config.ts',
  'tsconfig.json', 'tsconfig.new-solution-finder.json', 'wdio.conf.ts',
]);
const generatedDirectories = new Set([
  '.playwright-mcp', 'allure-results', 'allure-report', 'playwright-report',
  'blob-report',
]);

function checkRepositoryRoot(root = path.resolve(__dirname, '..')) {
  const unexpected = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      ? generatedDirectories.has(entry.name)
      : !rootFiles.has(entry.name) && !/^\.env(?:\.[A-Za-z0-9_-]+)*$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
  if (unexpected.length) {
    throw new Error(
      `Unexpected repository-root output/files:\n${unexpected.map(name => `  - ${name}`).join('\n')}\n` +
      'Write diagnostics, screenshots, response captures and reports under ' +
      'test-results/<YYYY-MM-DD>/<project>/<run>/. ' +
      'For intentional new root source/config files, update scripts/check-repository-root.js.'
    );
  }
}

if (require.main === module) {
  try {
    checkRepositoryRoot();
    console.log('Repository root hygiene passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkRepositoryRoot };

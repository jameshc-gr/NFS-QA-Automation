'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const { checkRepositoryRoot } = require('../../check-repository-root');

const root = path.resolve(__dirname, '../../..');
const runtimeFiles = [
  'scripts/new-solution-finder-environment.js',
  'scripts/solution-finder/lab/server.js',
  'scripts/solution-finder/lab/contracts.js',
  'scripts/solution-finder/lab/catalog.js',
  'scripts/solution-finder/lab/playwright.config.js',
  'tests/projects/solution-finder/helpers/inquiry-form.js',
  'tests/projects/solution-finder/workbook-scenarios/helpers/contracts.js',
  'tests/projects/solution-finder/workbook-scenarios/helpers/comparison.js',
  'tests/projects/solution-finder/workbook-scenarios/helpers/scenario.js',
  'tests/projects/solution-finder/lab/inquiry.spec.js',
  'test-data/solution-finder/workbook-scenarios/environments.json',
  'test-data/solution-finder/portable-scenarios.json'
];
const publicFiles = ['index.html', 'app.js', 'style.css', 'suite-results.html', 'suite-results.js'];
const scenarioFiles = [
  'test-data/solution-finder/workbook-scenarios/original-scenarios.json',
  'test-data/solution-finder/workbook-scenarios/scenarios.json',
  'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profiles.json',
  'test-data/solution-finder/workbook-scenarios/tri-bureau-40/profile-reference.json'
];

function command(program, args, cwd) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
}
function filesIn(directory, base = directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in the archive: ${file}`);
    return entry.isDirectory() ? filesIn(file, base) : [path.relative(base, file).split(path.sep).join('/')];
  }).sort();
}
function buildPortableLab({ includeScenarios = false } = {}) {
  if (typeof includeScenarios !== 'boolean') throw new Error('includeScenarios must be a boolean.');
  checkRepositoryRoot();
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const output = path.join(root, 'test-results', date, 'solution-finder/lab-distribution');
  fs.mkdirSync(output, { recursive: true });
  const build = fs.mkdtempSync(path.join(output, 'build-'));
  const directory = path.join(build, 'solution-finder-lab');
  const archive = path.join(output, `solution-finder-lab-${includeScenarios ? 'internal-165-' : ''}${today.toISOString().replace(/[:.]/g, '-')}.zip`);
  try {
    const entrypoints = [
      'scripts/solution-finder/lab/server.ts',
      'scripts/solution-finder/lab/playwright.config.ts',
      'tests/projects/solution-finder/lab/inquiry.spec.ts'
    ].map(file => path.join(root, file));
    const program = ts.createProgram(entrypoints, {
      rootDir: root, outDir: directory, target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true, esModuleInterop: true, resolveJsonModule: true,
      skipLibCheck: true, noEmitOnError: true, sourceMap: false,
      types: ['node', '@playwright/test'], ignoreDeprecations: '5.0'
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n'
    }));
    if (program.emit().emitSkipped) throw new Error('Portable lab compilation did not emit runtime files.');
    const emitted = filesIn(directory);
    if (JSON.stringify(emitted) !== JSON.stringify([...runtimeFiles].sort())) {
      throw new Error(`Compiler output differs from the explicit runtime allowlist:\n${emitted.join('\n')}`);
    }
    if (includeScenarios) {
      for (const file of scenarioFiles) {
        const source = path.join(root, file);
        if (!fs.lstatSync(source).isFile()) throw new Error(`Scenario input must be a regular file: ${file}`);
        fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
        fs.copyFileSync(source, path.join(directory, file));
      }
    }
    for (const name of publicFiles) {
      const target = path.join(directory, 'scripts/solution-finder/lab/public', name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'public', name), target);
    }
    fs.mkdirSync(path.join(directory, 'launcher'));
    fs.copyFileSync(path.join(__dirname, 'portable/start.cjs'), path.join(directory, 'launcher/start.cjs'));
    fs.copyFileSync(path.join(__dirname, includeScenarios ? 'portable/README-internal.md' : 'portable/README.md'),
      path.join(directory, 'README.md'));
    const manifest = {
      name: 'solution-finder-lab', version: '1.4.1', private: true,
      description: includeScenarios
        ? 'Restricted internal Solution Finder QA lab with original 23, additional 102 and separately selectable 40 normalized Tri-Bureau IR profiles; no credentials.'
        : 'Standalone local Solution Finder QA lab; no customer inputs or credentials included.',
      sfLabCatalog: includeScenarios ? 'internal165' : 'synthetic5',
      sfLabProfileSource: includeScenarios ? 'tri-bureau-ir' : 'synthetic',
      ...(includeScenarios ? { sfLabReferenceSource: 'ir-profile-offer-chart' } : {}),
      engines: { node: '>=22' },
      scripts: { start: 'node launcher/start.cjs', 'solution-finder:lab': 'npm start', setup: 'playwright install chromium' },
      dependencies: {
        '@playwright/test': require('@playwright/test/package.json').version,
        zod: require('zod/package.json').version
      }
    };
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    if (!process.env.npm_execpath) throw new Error('Run the packager using npm run package:solution-finder:lab.');
    command(process.execPath, [process.env.npm_execpath,
      'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], directory);
    const allowed = [...runtimeFiles, ...(includeScenarios ? scenarioFiles : []),
      ...publicFiles.map(name => `scripts/solution-finder/lab/public/${name}`),
      'launcher/start.cjs', 'README.md', 'package.json', 'package-lock.json'
    ].sort();
    const packaged = filesIn(directory);
    if (JSON.stringify(packaged) !== JSON.stringify(allowed)) throw new Error('Unexpected files in portable archive staging directory.');
    command('zip', ['-X', '-q', '-r', archive, 'solution-finder-lab'], build);
    const sha256 = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    fs.writeFileSync(`${archive}.sha256`, `${sha256}  ${path.basename(archive)}\n`);
    checkRepositoryRoot();
    return { archive, sha256, files: packaged };
  } catch (error) {
    if (fs.existsSync(archive)) fs.unlinkSync(archive);
    throw error;
  } finally {
    fs.rmSync(build, { recursive: true, force: true });
  }
}

module.exports = { buildPortableLab, runtimeFiles, publicFiles, scenarioFiles };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--include-scenarios')) {
    throw new Error('Use npm run package:solution-finder:lab [-- --include-scenarios].');
  }
  console.log(JSON.stringify(buildPortableLab({ includeScenarios: args.length === 1 }), null, 2));
}

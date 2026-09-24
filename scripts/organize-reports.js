const fs = require('fs');
const path = require('path');

const workspace = process.cwd();
const docsDir = path.join(workspace, 'docs');
const resultsDir = path.join(workspace, 'test-results');

function ensureDir(dir){
  if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function dateFolder(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function findReports(dir){
  if(!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  return files.filter(f => /test-execution-report/i.test(f));
}

function typeFromName(name){
  const m = name.match(/student-?IDR|student-IDR|student/i);
  if(m) return 'student-IDR';
  // try project token
  const p = name.match(/projects-([A-Za-z0-9-_]+)/);
  if(p) return p[1];
  return 'misc';
}

function moveReport(srcPath){
  const name = path.basename(srcPath);
  const type = typeFromName(name);
  const destDir = path.join(resultsDir, dateFolder(), type);
  ensureDir(destDir);
  const destPath = path.join(destDir, name);
  fs.renameSync(srcPath, destPath);
  console.log(`Moved ${srcPath} -> ${destPath}`);
}

function run(){
  ensureDir(resultsDir);
  // look in docs root
  const reports = findReports(docsDir).map(f => path.join(docsDir, f));

  // also look for any reports in workspace root
  const rootReports = fs.readdirSync(workspace).filter(f => /test-execution-report/i.test(f)).map(f => path.join(workspace, f));

  const all = reports.concat(rootReports);
  if(all.length===0){
    console.log('No reports found to organize.');
    return;
  }
  all.forEach(moveReport);
}

function warnOnLooseFiles(){
  ensureDir(resultsDir);
  const entries = fs.readdirSync(resultsDir, {withFileTypes: true});
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const looseFiles = [];
  
  for (const entry of entries) {
    // Skip dotfiles, date folders, allure results dir, and already-named project subdirs that look intentional
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'allure') continue;
    if (dateRegex.test(entry.name)) continue;
    
    // Check if this looks like an orphaned file or unexpected directory
    const fullPath = path.join(resultsDir, entry.name);
    if (entry.isFile() && !entry.isDirectory()) {
      looseFiles.push(`  [FILE] ${fullPath}`);
    } else if (entry.isDirectory()) {
      // Only warn on directories that aren't date-prefixed
      looseFiles.push(`  [DIR] ${fullPath} - consider moving to a dated subfolder`);
    }
  }
  
  if (looseFiles.length > 0) {
    console.log('⚠️  WARNING: Loose files/directories found directly under test-results/ root:');
    looseFiles.forEach(f => console.log(f));
    return true;
  }
  return false;
}

// Automatically sweep any loose files in test-results/ root into the canonical
// test-results/YYYY-MM-DD/<project>/[screenshots|reports|misc]/ structure.
function sweepLooseRootResults(){
  ensureDir(resultsDir);
  const entries = fs.readdirSync(resultsDir, {withFileTypes: true});
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let movedCount = 0;

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'allure') continue;
    if (dateRegex.test(entry.name)) continue;

    const fullPath = path.join(resultsDir, entry.name);
    if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      const mtime = stat.mtime;
      const yyyy = mtime.getFullYear();
      const mm = String(mtime.getMonth()+1).padStart(2, '0');
      const dd = String(mtime.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      let project = 'general';
      const lower = entry.name.toLowerCase();
      if (lower.includes('rate-wealth')) project = 'rate-wealth';
      else if (lower.includes('student-idr') || lower.includes('idr')) project = 'student-IDR';
      else if (lower.includes('solution-finder')) project = 'solution-finder';
      else if (lower.includes('student-loan-refi') || lower.includes('refi')) project = 'student-loan-refi';
      else if (process.env.TEST_PROJECT) project = process.env.TEST_PROJECT;

      let subfolder = 'misc';
      const ext = path.extname(entry.name).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        subfolder = 'screenshots';
      } else if (['.html', '.md'].includes(ext)) {
        subfolder = 'reports';
      }

      const targetDir = path.join(resultsDir, dateStr, project, subfolder);
      ensureDir(targetDir);
      const targetPath = path.join(targetDir, entry.name);
      const finalDest = fs.existsSync(targetPath) ? path.join(targetDir, `${path.parse(entry.name).name}-${Date.now()}${ext}`) : targetPath;
      fs.renameSync(fullPath, finalDest);
      console.log(`Auto-organized loose file: ${entry.name} -> ${path.relative(workspace, finalDest)}`);
      movedCount++;
    }
  }
  return movedCount;
}

// Allure results must live under test-results/allure/. allure-playwright silently falls back
// to a loose `./allure-results/` folder in the repo root whenever `resultsDir` is missing or
// misconfigured, so relocate any stray folder instead of leaving it at the root.
function sweepStrayAllureResults(){
  const strayDir = path.join(workspace, 'allure-results');
  if(!fs.existsSync(strayDir) || !fs.statSync(strayDir).isDirectory()) return false;

  const entries = fs.readdirSync(strayDir).filter(e => e !== '.DS_Store');
  if(entries.length === 0){
    try { fs.rmdirSync(strayDir); } catch(e) { /* ignore */ }
    console.log('Removed empty stray allure-results/ from repo root.');
    return true;
  }

  const d = new Date();
  const stamp = String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') +
    String(d.getFullYear()).slice(-2) + '_' + String(d.getHours()).padStart(2,'0') +
    String(d.getMinutes()).padStart(2,'0') + String(d.getSeconds()).padStart(2,'0');
  const project = process.env.TEST_PROJECT || 'playwright';
  const destDir = path.join(resultsDir, 'allure', `${stamp}_${project}`);
  ensureDir(destDir);

  for(const entry of entries){
    const src = path.join(strayDir, entry);
    let dest = path.join(destDir, entry);
    if(fs.existsSync(dest)){
      const parsed = path.parse(entry);
      dest = path.join(destDir, `${parsed.name}-${Date.now()}${parsed.ext}`);
    }
    fs.renameSync(src, dest);
  }
  try { fs.rmdirSync(strayDir); } catch(e) { /* ignore */ }

  console.log(`Moved stray allure-results/ -> ${path.relative(workspace, destDir)}`);
  return true;
}

// Playwright HTML reports default to writing to a loose `./playwright-report/` in the
// repo root if run with default options or --reporter=html.
// Relocate any stray report folder into test-results/YYYY-MM-DD/<project>/reports/test-report-<timestamp>/
function sweepStrayPlaywrightReports(){
  const strayDir = path.join(workspace, 'playwright-report');
  if(!fs.existsSync(strayDir) || !fs.statSync(strayDir).isDirectory()) return false;

  const entries = fs.readdirSync(strayDir).filter(e => e !== '.DS_Store');
  if(entries.length === 0){
    try { fs.rmdirSync(strayDir); } catch(e) { /* ignore */ }
    console.log('Removed empty stray playwright-report/ from repo root.');
    return true;
  }

  // Determine date and time from index.html mtime or current time
  const indexPath = path.join(strayDir, 'index.html');
  let dateStr;
  let timeStr;
  if (fs.existsSync(indexPath)) {
    const stat = fs.statSync(indexPath);
    const mtime = stat.mtime;
    const yyyy = mtime.getFullYear();
    const mm = String(mtime.getMonth()+1).padStart(2, '0');
    const dd = String(mtime.getDate()).padStart(2, '0');
    dateStr = `${yyyy}-${mm}-${dd}`;
    const hh = String(mtime.getHours()).padStart(2, '0');
    const min = String(mtime.getMinutes()).padStart(2, '0');
    const ss = String(mtime.getSeconds()).padStart(2, '0');
    timeStr = `${dateStr}-${hh}-${min}-${ss}`;
  } else {
    dateStr = dateFolder();
    const d = new Date();
    timeStr = `${dateStr}-${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}-${String(d.getSeconds()).padStart(2,'0')}`;
  }

  // Detect project name from data/ error context files, embedded content, or env
  let project = process.env.TEST_PROJECT;
  if (!project) {
    const dataDir = path.join(strayDir, 'data');
    if (fs.existsSync(dataDir)) {
      const dataFiles = fs.readdirSync(dataDir);
      for (const df of dataFiles) {
        if (df.endsWith('.md')) {
          try {
            const content = fs.readFileSync(path.join(dataDir, df), 'utf8');
            const match = content.match(/projects\/([A-Za-z0-9_-]+)/);
            if (match) {
              project = match[1];
              break;
            }
          } catch(e) {}
        }
      }
    }
  }
  if (!project) project = 'general';

  const destDir = path.join(resultsDir, dateStr, project, 'reports', `test-report-${timeStr}`);
  ensureDir(path.dirname(destDir));

  let finalDest = destDir;
  if (fs.existsSync(finalDest)) {
    finalDest = `${destDir}-${Date.now()}`;
  }

  fs.renameSync(strayDir, finalDest);
  console.log(`Moved stray playwright-report/ -> ${path.relative(workspace, finalDest)}`);
  return true;
}

if(require.main === module){
  sweepLooseRootResults();
  sweepStrayAllureResults();
  sweepStrayPlaywrightReports();
  run();
  warnOnLooseFiles();
}

module.exports = { run, sweepStrayAllureResults, sweepStrayPlaywrightReports, sweepLooseRootResults };

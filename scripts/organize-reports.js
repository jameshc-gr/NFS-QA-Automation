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
    // Skip dotfiles, date folders, and already-named project subdirs that look intentional
    if (entry.name.startsWith('.')) continue;
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
    console.log('⚠️  WARNING: Loose files found directly under test-results/ root. These should be moved to dated subfolders:');
    looseFiles.forEach(f => console.log(f));
    return true;
  }
  return false;
}

if(require.main === module){
  const hadLoose = warnOnLooseFiles();
  if (hadLoose) {
    console.log('\nPlease move these to the appropriate dated/project subfolder or remove them.');
  }
  run();
}

module.exports = { run };

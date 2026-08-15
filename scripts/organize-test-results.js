const fs = require('fs');
const path = require('path');

// Usage: node scripts/organize-test-results.js [projectName] [--dry-run] [--merge] [--run-id=ID]
const workspaceRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(workspaceRoot, 'test-results');
const rawArgs = process.argv.slice(2);
function parseArgs(args) {
  const out = { _: [] };
  for (const a of args) {
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      if (v === undefined) out[k] = true; else out[k] = v;
    } else {
      out._.push(a);
    }
  }
  return out;
}
const argv = parseArgs(rawArgs);
const projectName = String(argv._[0] || process.env.TEST_PROJECT || 'default-project');
const dryRun = !!argv['dry-run'] || !!argv.dryRun;
const mergeMode = !!argv.merge;
const runId = (typeof argv['run-id'] === 'string' ? argv['run-id'] : process.env.RUN_ID);

function isDateFolder(name) {
  // match formats like 2026-07-29 or MMDDYYYY
  return /^(\d{4}-\d{2}-\d{2})$/.test(name) || /^(0?\d{6,8})$/.test(name) || /^(\d{6,8})$/.test(name);
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function timestamp() {
  if (runId) return runId;
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function moveItem(src, dest) {
  // If dest is inside src (would create ancestor -> descendant move), move children instead
  const resolvedSrc = path.resolve(src);
  const resolvedDest = path.resolve(dest);
  // If dest is inside src (would create ancestor -> descendant move) OR dest already exists,
  // and src is a directory, move children individually into dest to avoid invalid rename.
  if (fs.existsSync(src) && fs.statSync(src).isDirectory() && (resolvedDest.startsWith(resolvedSrc + path.sep) || fs.existsSync(dest))) {
    ensureDir(dest);
    const children = fs.readdirSync(src);
    for (const c of children) {
      const childSrc = path.join(src, c);
      const childDest = path.join(dest, c);
      // if childDest exists, rename with timestamp to avoid clobber
      if (fs.existsSync(childDest)) {
        const renamed = childDest + '-' + Date.now();
        fs.renameSync(childSrc, renamed);
        console.log('Moved', childSrc, '->', renamed);
      } else {
        fs.renameSync(childSrc, childDest);
        console.log('Moved', childSrc, '->', childDest);
      }
    }
    try { fs.rmdirSync(src); } catch (e) { /* ignore */ }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.renameSync(src, dest);
  console.log('Moved', src, '->', dest);
}

function organize() {
  if (!fs.existsSync(resultsDir)) {
    console.error('test-results folder not found:', resultsDir);
    process.exit(1);
  }

  const entries = fs.readdirSync(resultsDir);
  for (const e of entries) {
    const abs = path.join(resultsDir, e);
    if (e === '.DS_Store') continue;
    if (fs.statSync(abs).isDirectory() && isDateFolder(e)) {
      // create standardized layout: test-results/YYYY-MM-DD/<projectName>/<run-timestamp>/...
          const date = String(e.includes('-') ? e : formatPlainDate(e));
      const runStamp = timestamp();
      const targetBase = path.join(resultsDir, date, projectName, runStamp);
      ensureDir(targetBase);
      // move or merge children into the run folder
      const children = fs.readdirSync(abs);
      for (const c of children) {
        const src = path.join(abs, c);
        const dest = path.join(targetBase, c);
        if (dryRun) {
          console.log('[dry-run] would move', src, '->', dest);
          continue;
        }
        if (mergeMode && fs.existsSync(dest)) {
          // if destination exists and is directory, move contents inside
          if (fs.statSync(dest).isDirectory() && fs.statSync(src).isDirectory()) {
            const subchildren = fs.readdirSync(src);
            for (const sc of subchildren) {
              moveItem(path.join(src, sc), path.join(dest, sc));
            }
            try { fs.rmdirSync(src); } catch (err) { /* ignore */ }
            continue;
          }
          // if file exists, rename with timestamp
          const renamedDest = dest + '-' + Date.now();
          moveItem(src, renamedDest);
          continue;
        }
        moveItem(src, dest);
      }
      // remove now-empty original folder
      try { fs.rmdirSync(abs); } catch (err) { /* ignore */ }
    }
    // If an item is a file or a non-date folder, move into today's date/project/run/misc
    if (!isDateFolder(e)) {
      const stat = fs.statSync(abs);
      const date = String(new Date().toISOString().slice(0,10));
      const runStamp = String(timestamp());
      const targetBase = path.join(resultsDir, date, projectName, runStamp, 'misc');
      const dest = path.join(targetBase, e);
      if (dryRun) {
        console.log('[dry-run] would move root item', abs, '->', dest);
      } else {
        ensureDir(targetBase);
        // if dest exists, rename it
        if (fs.existsSync(dest)) {
          const renamed = dest + '-' + Date.now();
          moveItem(abs, renamed);
        } else {
          moveItem(abs, dest);
        }
      }
    }
  }
  console.log('Organization complete.');
}

function formatPlainDate(s) {
  // Accept MMDDYYYY or MDDYYYY etc.
  if (!/^(\d{6,8})$/.test(s)) return s;
  const parts = s.match(/^(\d{2})(\d{2})(\d{4})$/) || s.match(/^(\d{1})(\d{2})(\d{4})$/);
  if (!parts) return s;
  const mm = parts[1].padStart(2,'0');
  const dd = parts[2].padStart(2,'0');
  const yyyy = parts[3];
  return `${yyyy}-${mm}-${dd}`;
}

organize();

module.exports = { organize };

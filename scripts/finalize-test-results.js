const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(workspaceRoot, 'test-results');
const project = process.argv[2] || process.env.TEST_PROJECT || 'general';
const runId = process.argv[3] || process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

if (!fs.existsSync(resultsDir)) {
  console.error('test-results not found');
  process.exit(1);
}

const targetBase = path.join(resultsDir, new Date().toISOString().slice(0,10), project, runId);
ensureDir(targetBase);
ensureDir(path.join(targetBase, 'misc'));

const entries = fs.readdirSync(resultsDir);
for (const e of entries) {
  if (e === '.DS_Store') continue;
  if (/^\d{4}-\d{2}-\d{2}$/.test(e)) continue; // date folder
  const abs = path.join(resultsDir, e);
  try {
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      const dest = path.join(targetBase, 'misc', e);
      fs.renameSync(abs, dest);
      console.log('Moved file', e, '->', dest);
      continue;
    }
    if (stat.isDirectory()) {
      // move children into misc (do not rename parent dir)
      const children = fs.readdirSync(abs);
      if (children.length === 0) {
        // safe remove
        try { fs.rmdirSync(abs); console.log('Removed empty dir', e); } catch (err) { }
        continue;
      }
      for (const c of children) {
        const src = path.join(abs, c);
        const dest = path.join(targetBase, 'misc', `${e}-${c}`);
        fs.renameSync(src, dest);
        console.log('Moved', src, '->', dest);
      }
      // attempt to remove now-empty dir
      try { fs.rmdirSync(abs); console.log('Removed dir', e); } catch (err) { }
    }
  } catch (err) {
    console.warn('Skipping', e, err.message);
  }
}

console.log('Finalize complete.');

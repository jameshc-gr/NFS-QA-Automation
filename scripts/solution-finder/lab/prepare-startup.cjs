const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function preserveRootFirebaseDebugLog(
  root = path.resolve(__dirname, '../../..'),
  now = new Date()
) {
  const source = path.join(root, 'firebase-debug.log');
  if (!fs.existsSync(source)) return null;
  if (!fs.lstatSync(source).isFile()) {
    throw new Error(`Expected a regular file at ${source}`);
  }

  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const directory = path.join(root, 'test-results', date, 'solution-finder', 'lab-startup');
  fs.mkdirSync(directory, { recursive: true });

  let destination = path.join(directory, 'firebase-debug.log');
  if (fs.existsSync(destination)) {
    destination = path.join(directory, `firebase-debug-${randomUUID()}.log`);
  }
  fs.renameSync(source, destination);
  return path.relative(root, destination);
}

if (require.main === module) {
  const preserved = preserveRootFirebaseDebugLog();
  if (preserved) console.log(`Preserved root Firebase diagnostic at ${preserved}`);
}

module.exports = { preserveRootFirebaseDebugLog };

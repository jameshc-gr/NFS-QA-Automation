const fs = require('fs')
const path = require('path')

const repoRoot = process.env.GIT_ROOT || path.resolve(__dirname, '..')
const testResults = path.join(repoRoot, 'test-results')

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

if (!fs.existsSync(testResults)) process.exit(0)

const entries = fs.readdirSync(testResults).filter(e => e !== '.' && e !== '..')
// ignore only the date-folders (YYYY-MM-DD) and hidden files
const nonDate = entries.filter(e => {
  if (e.startsWith('.')) return false
  return !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(e)
})

if (nonDate.length > 0) {
  console.error('test-results root contains unexpected files/folders:')
  nonDate.forEach(e => console.error('  -', e))
  console.error('\nPlease run scripts/finalize-test-results.js <project> <RUN_ID> to move them into dated run folders.')
  process.exit(2)
}

process.exit(0)

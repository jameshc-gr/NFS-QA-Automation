import * as fs from 'fs'
import * as path from 'path'

type Input = {
  query?: string
  profile?: string
  browser?: string
}

type Match = {
  file: string
  reason: string
}

function listSpecFiles(testsDir: string): string[] {
  if (!fs.existsSync(testsDir)) return []
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (/\.spec\.ts$/.test(entry)) files.push(full)
    }
  }
  walk(testsDir)
  return files
}

export async function discoverTests(input: Input = {}): Promise<{matches: Match[]; command: string}> {
  const repoRoot = process.cwd()
  const testsDir = path.join(repoRoot, 'tests')
  const files = listSpecFiles(testsDir)

  const q = (input.query || '').toLowerCase()
  const profile = (input.profile || '').toLowerCase()

  const scored = files.map(f => {
    const name = path.relative(repoRoot, f)
    let score = 0
    if (q && name.toLowerCase().includes(q)) score += 10
    if (profile && name.toLowerCase().includes(profile)) score += 8
    if (/integration|e2e|flow/.test(name.toLowerCase())) score += 2
    return {file: name, score}
  }).filter(x => x.score > 0)

  scored.sort((a,b) => b.score - a.score)

  const top = scored.slice(0,3).map(s => ({file: s.file, reason: `match score ${s.score}`}))
  const command = top.length ? `npx playwright test ${top[0].file}` : 'npx playwright test --list'

  return {matches: top, command}
}

// CLI convenience
if (require.main === module) {
  const argv = process.argv.slice(2).join(' ')
  discoverTests({query: argv}).then(res => console.log(JSON.stringify(res, null, 2)))
}

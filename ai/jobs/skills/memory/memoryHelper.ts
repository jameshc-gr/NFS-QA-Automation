import * as fs from 'fs'
import * as path from 'path'

const MEM_DIR = path.join(process.cwd(), 'memory')

function ensureDir() {
  if (!fs.existsSync(MEM_DIR)) fs.mkdirSync(MEM_DIR, {recursive: true})
}

export function readJSON<T>(name: string): T | null {
  ensureDir()
  const p = path.join(MEM_DIR, name)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T
  } catch (e) {
    return null
  }
}

export function writeJSON(name: string, data: any): void {
  ensureDir()
  const p = path.join(MEM_DIR, name)
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

export function recordLocatorChange(oldLocator: string, newLocator: string) {
  const file = 'locator-history.json'
  const cur = readJSON<{locators: any[] }>(file) || {locators: []}
  const existing = cur.locators.find(l => l.oldLocator === oldLocator && l.newLocator === newLocator)
  if (existing) existing.fixedCount = (existing.fixedCount || 0) + 1
  else cur.locators.push({oldLocator, newLocator, fixedCount: 1, lastFixed: new Date().toISOString()})
  writeJSON(file, cur)
}

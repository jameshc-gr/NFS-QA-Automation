import {readJSON, writeJSON, recordLocatorChange} from '../../skills/memory/memoryHelper'
import * as path from 'path'

type Suggestion = {
	oldLocator: string
	newLocator: string
	confidence: number
}

function loadLocatorHistory() {
	const p = path.join(process.cwd(), 'memory', 'locator-history.json')
	const cur = readJSON<any>('locator-history.json')
	return cur || {locators: []}
}

export function proposeFix(failureMessage: string): Suggestion[] {
	// naive heuristic: if failure mentions "locator" or "selector", propose known replacements
	const hist = loadLocatorHistory().locators as any[]
	const matches: Suggestion[] = []
	for (const h of hist) {
		if (failureMessage.includes(h.oldLocator) || failureMessage.toLowerCase().includes('locator')) {
			matches.push({oldLocator: h.oldLocator, newLocator: h.newLocator, confidence: Math.min(0.9, (h.fixedCount||1)/10)})
		}
	}
	return matches
}

export async function applyFix(s: Suggestion): Promise<boolean> {
	// In a real implementation this would patch page objects or selectors and run a targeted test.
	// For now record the change in memory and return true.
	recordLocatorChange(s.oldLocator, s.newLocator)
	return true
}

if (require.main === module) {
	// CLI shim for quick testing
	const msg = process.argv.slice(2).join(' ') || 'locator #submitBtn not found'
	const suggestions = proposeFix(msg)
	console.log('Suggestions:', suggestions)
}

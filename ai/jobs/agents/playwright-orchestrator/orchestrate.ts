import {spawnSync} from 'child_process'
import * as path from 'path'

const agents = [
	'framework-context-agent',
	'test-planner-agent',
	'test-generator-agent',
	'test-executor-agent',
	'result-analyzer-agent',
	'root-cause-agent',
	'self-healing-agent',
	'coverage-agent',
]

function runAgent(agentDir: string) {
	const entry = path.join(__dirname, '..', agentDir, 'index.js')
	const alt = path.join(__dirname, '..', agentDir, `${agentDir.replace(/-/g,'_')}.js`)
	const tsEntry = path.join(__dirname, '..', agentDir)
	// Try node entrypoint (compiled) then fallback to running the .ts via node (if ts-node available)
	const candidates = [entry, alt, path.join(__dirname, '..', agentDir, `${agentDir}.js`)]
	for (const c of candidates) {
		try {
			const res = spawnSync('node', [c], {stdio: 'inherit'})
			if (res.status === 0) return true
		} catch (e) {
			// continue
		}
	}
	return false
}

async function orchestrate() {
	console.log('Orchestrator: starting flow')
	for (const a of agents) {
		console.log(`Orchestrator: invoking ${a}`)
		const ok = runAgent(a)
		if (!ok) console.warn(`Agent ${a} did not run (missing entrypoint)`)
	}
	console.log('Orchestrator: done')
}

if (require.main === module) orchestrate()

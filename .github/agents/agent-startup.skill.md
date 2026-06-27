This file has been moved to .github/skills/playwright-framework-context/SKILL.md.

Keep this stub only as a migration note while the workspace adopts separate prompts, skills, and agents folders.

Recent workspace additions (local feature branch `feat/jira-generator`):

- Jira artifacts and generator:
	- `Jira/student-refi/jira_agent.md`
	- `Jira/student-refi/jira_planner.md`
	- `Jira/student-refi/automation_instruction.md`
	- `Jira/student-refi/jira.env.example`
	- `scripts/generate_jira_artifacts.js` (usage: `node scripts/generate_jira_artifacts.js TICKET-KEY [--force]`)

- CI and Appium MCP scaffolding:
	- `.github/workflows/appium-mcp-ci.yml` (manual dispatch; Android/iOS jobs)
	- `Jira/student-refi/capabilities.json` (example capabilities for Appium MCP)

Notes:
- A committed `jira.env` with secrets was removed and replaced by `jira.env.example`; `jira.env` is now ignored in `.gitignore`.
- Work has been committed locally to branch `feat/jira-generator`. Add a remote and push the branch to open a PR when ready.



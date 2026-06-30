# Project Test Script Folders

Use this directory to keep tests separated by project.

## Structure

- `student-loan-refi/`: student loan refinance tests

## Notes

- Active student-loan suite lives in `tests/projects/student-loan-refi/`.
- Use `npm run test:project:student-loan-refi` or `npm run test:web` for project-scoped runs.

## Path Convention

- Use repo-relative paths in docs and prompts (`tests/projects/...`).
- Do not use leading slash paths such as `/tests/...`.

## AI Agent Workflow Integration

- Plan scenarios in `specs/` using the planner agent.
- Generate tests into `tests/projects/<project>/generated/`.
- Validate with narrow commands before running broader suites.

See `ai/agents/readme-agents.md` for end-to-end flow and authoring templates.

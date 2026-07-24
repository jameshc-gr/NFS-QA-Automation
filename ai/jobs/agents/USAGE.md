# Agents, Skills, and Memory — Usage Guide

This document explains how to use the agent hierarchy, skills, and persistent memory in this Playwright automation framework.

**Quick summary**
- Agents orchestrate and make decisions; they do NOT call Playwright or the shell directly.
- Skills are executable MCP-style tools (TypeScript runners) that perform concrete actions (discover tests, execute suites, analyze traces).
- Memory is a small file-backed store under `memory/` used by healer and analytics agents to learn over time.

**Agent hierarchy**
- `playwright-orchestrator`: top-level coordinator that sequences the flow.
- `framework-context-agent`: provides conventions, fixture and locator strategy.
- `test-planner-agent`: turns requirements into a prioritized plan.
- `test-generator-agent`: generates or modifies test code from plan items.
- `test-executor-agent`: invokes the `test-execution` skill to run tests and collect artifacts.
- `result-analyzer-agent`: analyzes results, classifies failures, and extracts signatures.
- `root-cause-agent`: maps failure signatures to probable causes.
- `self-healing-agent`: proposes and applies fixes using learned memory.
- `coverage-agent`: collects coverage and reporting data.

Core skills (examples)
- `ai/jobs/skills/test-discovery/discover_tests.ts` — find the smallest relevant spec files.
- `ai/jobs/skills/test-execution/*` — run individual tests/suites and produce traces (implement as MCP tools).
- `ai/jobs/skills/failure_analyzer/*` — classify failures and extract traces.
- `ai/jobs/skills/playwright-framework-context/*` — share conventions and helpers.

Memory
- Location: `memory/` with JSON files:
  - `locator-history.json` — learned locator mappings (old → new, fixedCount, lastFixed).
  - `healing-history.json` — records of healing attempts and results.
  - `flaky-tests.json` — flakiness metadata for tests.
- Access: use `ai/jobs/skills/memory/memoryHelper.ts` helpers: `readJSON`, `writeJSON`, `recordLocatorChange`.

Recommended flow (automated)
1. Requirement arrives → `test-planner-agent` produces plan items.
2. `test-generator-agent` converts plan items into test files or picks seed files.
3. `test-executor-agent` calls `test-execution` skill to run focused tests.
4. `result-analyzer-agent` classifies failures and forwards signatures to `root-cause-agent`.
5. `root-cause-agent` suggests probable causes; if fixable, call `self-healing-agent`.
6. `self-healing-agent` proposes locator or code fixes, applies (optionally), records outcome in `memory/`, and requests re-run from `test-executor-agent`.
7. `coverage-agent` aggregates results and produces summary reports.

CLI examples (quick)
```
# Discover tests
node ai/jobs/skills/test-discovery/discover_tests.js "loan application"

# Propose fixes from failure message
node ai/jobs/agents/self-healing-agent/heal.js "locator #submitBtn not found"
```

Integration notes
- Agents should call skills via an MCP tool interface (e.g., RPC or CLI wrapper) rather than shelling out to Playwright.
- Keep skills focused: a single skill should do one thing (discover, run, analyze, update locator).
- Use `framework-context` for coding standards, naming conventions, and locator strategy to avoid drift across generated tests.

How to extend
- Add a new skill under `ai/jobs/skills/<skill-name>/` with `skill.md` and a TypeScript runner.
- Add an agent under `ai/jobs/agents/<agent-name>/` with `agent.md` and an entrypoint that calls skills.
- Update `mcp.json` (or similar manifest) to expose new tools to agents.

Safety & guardrails
- Agents must never modify production code without explicit review; healer changes should be small, reversible patches.
- Memory updates should be audited; include timestamps and provenance when recording fixes.

Contact
- If you have questions about conventions, see `ai/jobs/skills/playwright-framework-context/SKILL.md` and the orchestrator README.

---
description: "Run one or more Playwright tests from the tests/ folder with the repo's profile and timing conventions."
name: "Run Tests"
argument-hint: "[specs...] [--project=chromium|firefox|webkit] [--headed] [--grep=pattern]"
agent: "playwright-test-orchestrator"
---
Run the selected Playwright tests from the `tests/` folder.

Use this when the target specs are already known or when you want a fast verification pass.

## Steps
1. Identify the exact spec files or glob pattern to run.
2. Run `npx playwright test` with the requested project, headed mode, or grep options.
3. Report the command used and summarize the pass/fail result.

## Expected Output
- Command executed
- Target specs/projects
- Pass/fail summary
- Next recommended action

## Constraints
- Prefer a single spec and single browser first
- Follow repository conventions in `readme.md` and `ai/agents/skills/playwright-framework-context/SKILL.md`

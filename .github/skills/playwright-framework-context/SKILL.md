---
name: playwright-framework-context
description: 'Living framework context for this Playwright repo. Use when you need the current test mechanics, profile mapping, locator strategy, timing conventions, or agent workflow guidance.'
argument-hint: 'Initialize the repo context'
---

# Playwright Framework Context

Purpose
- A living reference for the current mechanics of this Playwright test framework.
- Keep this file updated whenever the repository's test flow, profile mapping, prompts, agents, or conventions change.

When to use
- At the beginning of a Playwright test task
- When you need the repo conventions before editing or running tests
- When you want the first-pass mental model for profile-driven test data
- When you need the canonical explanation of how the repo's agents, prompts, and skills fit together

Procedure
1. Read `AGENTS.md`, `README.md`, `playwright.config.js`, `tests/student-loan-refi/test-setup.ts`, and representative specs such as `tests/student-loan-refi/LK1.spec.ts` and `tests/student-loan-refi/LK_CD1.spec.ts`.
2. Summarize the profile rules, mapping logic, locator strategy, timing conventions, common pitfalls, and the purpose of the `ER`, `LK`, `LK_CD`, `LK_NC`, and `LK_IN` families.
3. Note which prompt, skill, or agent should be used for the task and why.
4. Identify three quick checks to run first, then propose a short action plan.

Rules
- Prefer role-based locators first, then test IDs, then CSS selectors.
- Avoid `waitForTimeout` unless it is explicitly justified.
- Use the profile-switch boilerplate and prefer LK1/LK2 enum values for dropdowns.
- Propose changes before making them unless the user explicitly asked for edits.

Current Framework Notes
- Profile values are loaded through `tests/student-loan-refi/test-setup.ts` from suffix-based env vars such as `FIRST_NAME_LK1`.
- Specialized profiles use uppercase enum-style values for dropdowns where possible.
- Narrow test runs are preferred before broad suite runs.
- The authoritative customization split is `.github/agents/`, `.github/prompts/`, and `.github/skills/`.

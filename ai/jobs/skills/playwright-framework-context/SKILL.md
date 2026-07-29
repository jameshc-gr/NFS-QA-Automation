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
1. Read `AGENTS.md`, `readme.md`, `playwright.config.ts`, `tests/projects/student-loan-refi/test-setup.ts`, and representative specs such as `tests/projects/student-loan-refi/LK1.spec.ts` and `tests/projects/student-loan-refi/LK_CD1.spec.ts`.
2. Summarize the profile rules, mapping logic, locator strategy, timing conventions, common pitfalls, and the purpose of the `ER`, `LK`, `LK_CD`, `LK_NC`, and `LK_IN` families.
3. Note which prompt, skill, or agent should be used for the task and why.
4. Identify three quick checks to run first, then propose a short action plan.

Rules
- Prefer role-based locators first, then test IDs, then CSS selectors.
- Avoid `waitForTimeout` unless it is explicitly justified.
- Use the profile-switch boilerplate and prefer LK1/LK2 enum values for dropdowns.
- Propose changes before making them unless the user explicitly asked for edits.

Current Framework Notes
- Profile values are loaded through `tests/projects/student-loan-refi/test-setup.ts` from suffix-based env vars such as `FIRST_NAME_LK1`.
- Specialized profiles use uppercase enum-style values for dropdowns where possible.
- Narrow test runs are preferred before broad suite runs.
- The authoritative customization split is `ai/jobs/agents/`, `ai/jobs/prompts/`, and `ai/jobs/skills/`.
- API tests now run from `api/tests/` via the `api-tests` Playwright project.
- The API runner loads dotenv in `playwright.config.ts`, reads collection and mapping JSON from `api/postman/<projectname>/` and `api/api-mappings/<projectname>/`, and resolves placeholders from runtime saves, Postman environment JSON, `process.env`, and `API_PROJECT` selection.
- Mobile runs resolve the app under test from a named build in
  `test-data/mobile-app/gri/<platform>/config.yml`, selected with
  `MOBILE_ANDROID_BUILD` / `MOBILE_IOS_BUILD` or the config's `defaultBuild`.
  Android sources are `local`, `firebase`, `firebase-web` and `url`; iOS sources
  are `simulator`, `xcode`, `ipa` and `testflight`.
- Every mobile artifact is republished to
  `test-data/mobile-app/gri/<platform>/<version>/<environment>/` with a
  `build-info.json`, so the build under test is identifiable from the repo alone.
  Use `npm run build:mobile:ios` and `npm run build:mobile:android` to produce them.
- The iOS app clone is read-only for automation. Build it with `xcodebuild`, but
  never commit, push, or otherwise write to that repo.
- Firebase downloads need either an App Distribution API token or the browser
  session saved by `npm run setup:firebase-session`. Google sign-in is always
  performed by hand and never scripted.

Output Contract
- Return a short framework snapshot with:
	- Active test root and project folder
	- Profile loading behavior and suffix mapping model
	- Locator and wait conventions
	- One recommended prompt or agent for the task
	- Three smallest commands/checks to run first

Recent changes (2026-07-29)
- Mobile build selection is config-driven on both platforms, with versioned,
  per-environment artifacts and `build-info.json` provenance.
- Added Firebase App Distribution downloads for Android, over the REST API and
  over the web UI with Playwright for testers without API access.

Recent changes (2026-06-30)
- Confirmed all agent assets are centralized under `ai/jobs/*`.
- Added explicit output contract to make skill responses consistent.
- Updated guidance to align with single test root under `tests/projects`.

How to use this file
1. Read `AGENTS.md`, then this SKILL.md before editing or running tests.
2. Use role-based locators first, test IDs second, CSS selectors last.
3. Avoid `waitForTimeout` unless explicitly required; prefer Playwright built-in waiters.

Contact
- For framework changes, update this SKILL.md and then open a PR with the rationale.

Changelog
- 2026-06-26: Added "Recent changes" section and migration notes.
- 2026-06-26: Consolidated `agent-startup` guidance into this file.
- 2026-06-30: Migrated canonical references from `.github/*` to `ai/jobs/*`.
- 2026-07-29: Documented config-driven mobile build selection, versioned artifacts, and Firebase downloads.

Recommended next steps
- If this repo is under Git, create a small commit and push the updates so collaborators see the migration notes.
- Consider updating `AGENTS.md` to reference this SKILL.md explicitly where agent bootstrap flow is documented.

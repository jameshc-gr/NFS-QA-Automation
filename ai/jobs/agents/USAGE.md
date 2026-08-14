# Agents, Skills, and Memory — Usage Guide

This document explains how to use the agent hierarchy, skills, and persistent memory in this Playwright automation framework.

**Quick Summary**
- Agents orchestrate workflows and make testing decisions using specialised modes (`*.agent.md`).
- Skills (`ai/jobs/skills/*/SKILL.md`) are domain-specific operating procedures that provide expert QA knowledge for Web, Mobile, API, Test Data, Planning, and Bug Reporting.
- Memory is stored under `memory/` and `/memories/repo/webautomation.md` to track locator changes, flaky tests, and framework conventions over time.

**Copilot Agent Modes**
- `playwright-test-orchestrator`: Top-level coordinator that discovers, executes, and summarizes test workflows.
- `playwright-test-planner`: Converts feature requests and user stories into structured test plans in `specs/`.
- `playwright-test-generator`: Translates test specs into clean Playwright tests under `tests/projects/`.
- `playwright-test-healer`: Diagnoses failures and repairs broken locators or timing issues.
- `mobile-test-generator`: Dedicated 2-phase agent for mobile test case planning (`ai/tests/mobile/`) and WDIO spec generation (`mobile/tests/`).

**Core QA Skills**
- `playwright-framework-context`: Framework mechanics, profile mappings, locator rules, and conventions.
- `api-testing`: Postman collection auto-extraction, contract testing, gateway config loading, and schema validation.
- `mobile-testing`: Appium/WDIO execution for Android & iOS, build selection, and OTP channels (Guerrilla Mail, Outlook, Google Voice).
- `test-data-engineer`: Secure, environment-compliant test data generation, realistic human names, `--ra` tag rules, and password validation checks.
- `test-plan-generation`: Transforming requirements and Jira tickets into reviewable Markdown specifications.
- `bug-report-writing`: Root cause analysis, failure categorization, and standardized Jira bug reports ([SLF]/[FAL] format).
- `visual-regression-testing`: Screenshot baselines (`toHaveScreenshot`), dynamic element masking, and diff tolerance.
- `accessibility-testing`: Automated WCAG 2.1 A/AA auditing using `axe-core` and `@axe-core/playwright`.
- `performance-testing`: Client Web Vitals, API response time SLAs, and k6 load testing scenarios.
- `flaky-test-management`: Isolating, diagnosing, memory-tracking, and auto-healing intermittent test failures.
- `test-discovery`, `test-execution`, `test-summary`: Spec discovery, focused runner, and failure summary skills.

**Memory**
- Location: `memory/` with JSON files:
  - `locator-history.json` — learned locator mappings.
  - `healing-history.json` — records of healing attempts and results.
  - `flaky-tests.json` — flakiness metadata for tests.
- Repository Memory: `/memories/repo/webautomation.md` for living framework conventions and build rules.

**Recommended Workflow**
1. **Plan**: Use `test-plan-generation` skill or `playwright-test-planner` agent to draft `.md` test specs in `specs/` or `ai/tests/mobile/`.
2. **Generate**: Use `playwright-test-generator` or `mobile-test-generator` to create executable `.ts` tests.
3. **Execute**: Use `test-discovery` and `test-execution` skills (or `playwright-test-orchestrator`) to run narrow specs.
4. **Heal / Report**: On failure, use `bug-report-writing` skill and `playwright-test-healer` agent to diagnose root causes and patch locators.

**Token Economics & Model Tiers**
- **Tier 2/3 Economical Default (`gpt-4o-mini` / `claude-3.5-haiku` / `gemini-2.0-flash`)**: Configured for 90%+ of workflow steps (Orchestration, Planning, Generation, Prompts, Discovery, Execution, Summary, Data Engineering). Achieves ~95% token cost savings vs Tier 1 models.
- **Tier 1 Reasoning (`claude-3.5-sonnet` / `gpt-4o`)**: Assigned exclusively to `playwright-test-healer` agent and `flaky-test-management` skill where complex root cause analysis and self-healing logic are required.

**Safety & Guardrails**
- Run narrow spec files first before executing full suites.
- Never hardcode credentials; rely on `test-data-engineer` guidelines and environment configuration loaders.

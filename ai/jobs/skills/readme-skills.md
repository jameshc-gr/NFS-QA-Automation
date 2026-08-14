# QA Skills Directory

Skills are compact, reusable operating procedures that equip AI coding agents with expert testing domain knowledge.

## Core QA Skills & Model Economics

| Skill | Category | Description | Target AI Model | Model Tier |
| --- | --- | --- | --- | --- |
| `playwright-framework-context` | Web E2E | Living framework architecture, profile mappings, locator strategy, and conventions | `gpt-4o-mini` | Tier 3 (Fast / Token-Efficient) |
| `api-testing` | API | Postman collection auto-extraction, contract testing, gateway config loading, and schema validation | `gpt-4o-mini` | Tier 2/3 (JSON & Contract Parsing) |
| `mobile-testing` | Mobile | WebdriverIO + Appium for Android & iOS, build routing, OTP channels, and Compose/XCUITest locators | `gpt-4o-mini` | Tier 2 (Appium Session Routing) |
| `test-data-engineer` | Data | Environment-aware account strategy, name/password rule compliance, and email/phone tagging | `gpt-4o-mini` | Tier 3 (Data Rule Formatting) |
| `test-plan-generation` | Planning | Requirements and Jira stories to structured, reviewable Markdown test specifications | `gpt-4o-mini` | Tier 2 (Spec Extraction) |
| `bug-report-writing` | Reporting | Root cause analysis, defect categorization, and standard Jira bug report formatting | `gpt-4o-mini` | Tier 3 (Jira Bug Formatting) |
| `visual-regression-testing` | Visual | Screenshot baseline comparisons (`toHaveScreenshot`), dynamic element masking, and diff tolerance | `gpt-4o-mini` | Tier 2/3 (Diff Evaluation) |
| `accessibility-testing` | Accessibility | Automated WCAG 2.1 A/AA compliance auditing with `axe-core` and `@axe-core/playwright` | `gpt-4o-mini` | Tier 3 (Axe Report Parsing) |
| `performance-testing` | Performance | Web Vitals metrics, network response time SLAs, and k6 backend load testing scenarios | `gpt-4o-mini` | Tier 3 (Metric Check) |
| `flaky-test-management` | Quality | Diagnosing, isolating, auto-healing, and quarantining intermittent test failures | `claude-3.5-sonnet` | Tier 1 (High Reasoning / Deep Healing) |
| `test-discovery` | Discovery | Spec discovery and narrowing before execution | `gpt-4o-mini` | Tier 3 (Fast Spec Search) |
| `test-execution` | Execution | Safe, focused test execution runner | `gpt-4o-mini` | Tier 3 (Command Trigger) |
| `test-summary` | Summary | Test output diagnosis, failure categorization, and triage | `gpt-4o-mini` | Tier 3 (Log Summarization) |

## Model Selection Guidelines

- **Tier 2/3 Economical Models (`gpt-4o-mini`, `claude-3.5-haiku`, `gemini-2.0-flash`)**: Use by default for 90%+ of operational tasks (discovery, execution, test case drafting, data generation, log parsing). Saves ~95% token cost compared to flagship models.
- **Tier 1 High-Reasoning Models (`claude-3.5-sonnet`, `gpt-4o`)**: Use selectively only for deep self-healing, race-condition isolation, and complex multi-file locator debugging (`flaky-test-management`).

## Naming & Location

- Folder: `ai/jobs/skills/<skill-name>/`
- File: `SKILL.md`

## Required Sections

- Frontmatter (`name`, `description`, `argument-hint`)
- When to Use
- Inputs
- Procedure
- Output Contract
- Guardrails

## Quality Checklist

- Procedure has 3-6 concrete steps
- Output contract is specific and testable
- No repo paths to deprecated locations
- Keeps operations narrow by default
- Uses repo-relative paths (for example `tests/projects/...`, `test-data/...`) without leading `/`

## Template

Use [ai/jobs/skills/SKILL_TEMPLATE.md](ai/jobs/skills/SKILL_TEMPLATE.md).

## Related Guides

- [Root framework guide](../../../readme.md)
- [AI agent framework guide](../readme-agents.md)
- [API how-to guide](../../../api/README.md)

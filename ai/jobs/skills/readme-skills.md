# QA Skills Directory

Skills are compact, reusable operating procedures that equip AI coding agents with expert testing domain knowledge.

## Core QA Skills

| Skill | Category | Description |
| --- | --- | --- |
| `playwright-framework-context` | Web E2E | Living framework architecture, profile mappings, locator strategy, and conventions |
| `api-testing` | API | Postman collection auto-extraction, contract testing, gateway config loading, and schema validation |
| `mobile-testing` | Mobile | WebdriverIO + Appium for Android & iOS, build routing, OTP channels, and Compose/XCUITest locators |
| `test-data-engineer` | Data | Environment-aware account strategy, name/password rule compliance, and email/phone tagging |
| `test-plan-generation` | Planning | Requirements and Jira stories to structured, reviewable Markdown test specifications |
| `bug-report-writing` | Reporting | Root cause analysis, defect categorization, and standard Jira bug report formatting |
| `visual-regression-testing` | Visual | Screenshot baseline comparisons (`toHaveScreenshot`), dynamic element masking, and diff tolerance |
| `accessibility-testing` | Accessibility | Automated WCAG 2.1 A/AA compliance auditing with `axe-core` and `@axe-core/playwright` |
| `performance-testing` | Performance | Web Vitals metrics, network response time SLAs, and k6 backend load testing scenarios |
| `flaky-test-management` | Quality | Diagnosing, isolating, auto-healing, and quarantining intermittent test failures |
| `test-discovery` | Discovery | Spec discovery and narrowing before execution |
| `test-execution` | Execution | Safe, focused test execution runner |
| `test-summary` | Summary | Test output diagnosis, failure categorization, and triage |

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

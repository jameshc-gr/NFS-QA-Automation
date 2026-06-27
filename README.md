# WebAutomation - Playwright Test Suite

Automated end-to-end tests for student loan application flows on the Guaranteed Rate platform using Playwright.

## Quick Start

```bash
# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install --with-deps

# Run the full suite
npx playwright test

# Run a focused suite by profile group
npx playwright test tests/LK[0-9]*.spec.ts
npx playwright test tests/LK_CD*.spec.ts
npx playwright test tests/LK_NC*.spec.ts
npx playwright test tests/LK_IN*.spec.ts

# View the latest HTML report
npx playwright show-report
```

## Current Framework Layout

```
tests/              # Playwright test files (*.spec.ts)
specs/              # Test plans and documentation
.github/agents/     # Specialized AI agents and orchestrators
.github/prompts/     # Reusable prompt templates for focused tasks
.github/skills/      # Reusable workflow skills and living framework context
playwright.config.js # Playwright configuration
tests/test-setup.ts # Compatibility shim for the shared helpers in tests/student-loan-refi/test-setup.ts
.env                # Test data and credentials (not in git)
```

## Latest Framework Updates

The shared test framework now lives in [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts), with a compatibility shim at [tests/test-setup.ts](tests/test-setup.ts), and handles the common behavior for every profile-driven test:

- `loadProfile(PROFILE)` maps base values like `FIRST_NAME` to suffixed values such as `FIRST_NAME_LK1`.
- `selectOptionResilient()` handles dropdown labels that can appear in different formats, especially for enum-style values.
- `runRefinanceFlow()` drives the full refinance flow and writes pass/fail artifacts to `test-results/`.
- The flow now distinguishes `ER`, `LK`, `LK_CD`, `LK_NC`, and `LK_IN` profiles so the expected offer/no-offer path is enforced automatically.
- Shared timing is centralized with longer per-test and navigation timeouts for the slower refinance and offer pages.
- The canonical framework-context skill lives in [.github/skills/playwright-framework-context/SKILL.md](.github/skills/playwright-framework-context/SKILL.md) and should be updated whenever the framework mechanics change.

## Recent Additions (local)

The repository has a small feature branch workflow for Jira-driven QA templates and Appium MCP CI scaffolding. Key files added locally on branch `feat/jira-generator`:

- Jira templates and generator:
	- `Jira/student-refi/jira_agent.md` — agent prompt template for converting Jira tickets into QA artifacts.
	- `Jira/student-refi/jira_planner.md` — QA planner template (test cases, preconditions, notes).
	- `Jira/student-refi/automation_instruction.md` — automation hints and generator guidance.
	- `Jira/student-refi/jira.env.example` — example env values; do not commit real secrets.
	- `scripts/generate_jira_artifacts.js` — copies templates into `Jira/student-refi/jira-tickets/<TICKET>/` (non-destructive by default).

- CI / Appium MCP:
	- `.github/workflows/appium-mcp-ci.yml` — manual dispatch workflow that starts `appium-mcp`, provisions an Android emulator on Ubuntu or runs iOS steps on macOS, and runs Playwright tests.
	- `Jira/student-refi/capabilities.json` — example capabilities for Android/iOS used by Appium MCP.

Notes and usage
- Generate ticket scaffolding locally:

```bash
node scripts/generate_jira_artifacts.js TEST-123
```

- npm scripts added:
	- `npm run generate:jira` — wrapper for the generator
	- `npm run generate:jira:force` — runs generator with `--force` to overwrite

- Secrets: a committed `jira.env` was replaced with `jira.env.example`. Add your `jira.env` locally and keep it out of the repo. `.gitignore` includes `jira.env`.

- Branch workflow: changes are committed locally on branch `feat/jira-generator`. If you want, provide a remote URL and I can push the branch and open a PR.


## Test Data Management

This project uses profile-based environment variables to support multiple personas:

- `ER` / default Ernest profiles use base env vars with no suffix.
- `LK1` through `LK14` are eligible LendKey profiles.
- `LK_CD1` through `LK_CD10` are credit-decline profiles.
- `LK_NC1` through `LK_NC10` are no-credit profiles.
- `LK_IN1` through `LK_IN10` are ineligible profiles.

For reliable dropdown selection, prefer uppercase enum-style values in `LK*` profiles such as `US_CITIZEN`, `SALARY`, `BACHELORS`, `SCORE_600_749`, and `GREATER_THAN_799`.

See [AGENTS.md](AGENTS.md) for the canonical testing conventions and patterns.

## Running Tests with npx

```bash
# Run all tests
npx playwright test

# Run a single browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run in headed mode
npx playwright test --headed

# Debug with Playwright Inspector
npx playwright test --debug

# Run one file
npx playwright test tests/LK1.spec.ts

# Run multiple matching profile groups
npx playwright test tests/LK_CD1.spec.ts tests/LK_CD2.spec.ts
```

The package scripts are thin wrappers around the same `npx playwright test` commands:

```bash
npm run test
npm run test:eligible
npm run test:decline
npm run test:nocredit
npm run test:ineligible
```

## Specialized AI Agents

This project includes three AI agents for test automation:

- `Playwright Test Planner` creates comprehensive test plans from application exploration.
- `Playwright Test Generator` generates test code from test plans with proper structure.
- `Playwright Test Healer` debugs and fixes failing tests automatically.
- `Playwright Test Orchestrator` coordinates discovery, execution, and result review for focused test runs.

These agents are configured in [.github/agents/](.github/agents/).

Reusable prompt templates live in [.github/prompts/](.github/prompts/), and reusable workflow skills live in [.github/skills/](.github/skills/).

## Environment Setup

1. Create or update `.env` with the profile values for the tests you plan to run.
2. Fill in at least one complete profile set, ideally `LK1` or `LK2` for stable enum-based selections.
3. Keep dropdown values in uppercase enum form for the LendKey flows.

## CI/CD

Tests run automatically on push/PR to `main` or `master` via GitHub Actions:

- Runs against Chromium, Firefox, and WebKit.
- Captures HTML reports and run artifacts.
- Retains reports for 30 days.

## Documentation

- [AGENTS.md](AGENTS.md) - Comprehensive guide for AI coding agents
- [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts) - Shared flow and profile-loading logic
- [tests/test-setup.ts](tests/test-setup.ts) - Compatibility shim for older imports
- [.github/skills/playwright-framework-context/SKILL.md](.github/skills/playwright-framework-context/SKILL.md) - Living framework context for agents
- [specs/](specs/) - Test plans and scenarios
- [Playwright Documentation](https://playwright.dev/docs/intro)

## Target Environment

Tests run against QA environment:

- **Base URL**: `https://student-loans.qa.fsp.rate.com`
- **Application**: Student Loan refinancing application

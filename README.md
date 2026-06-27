# NFS-QA-Automation

Playwright-based QA automation framework focused on Student Loan Refinance flows.

Status & scope
- Implemented feature: end-to-end automated tests for the student-loan-refi application (flows under `tests/student-loan-refi`).
- Not implemented: other domain flows — this repo is currently scoped to student loan refinance automation only.

Quick start

Prerequisites
- Node.js 16+ and npm installed.

Install dependencies and Playwright browsers

```bash
npm install
npx playwright install
```

Run tests (examples)

- Run the full suite:

```bash
npx playwright test
```

- Run a single spec (example):

```bash
npx playwright test tests/student-loan-refi/LK1.spec.ts
```

- Use the npm scripts from [package.json](package.json):

```bash
npm run test
npm run test:eligible   # pattern-based runs (see notes below)
```

Repository layout (key files)
- [tests/](tests) — Playwright specs; `tests/test-setup.ts` re-exports the student-loan-refi test helpers.
- [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts) — framework helpers (`loadProfile`, `runRefinanceFlow`, utilities).
- [test-data/student-loan-refi/](test-data/student-loan-refi) — sample profiles and fixtures (see `profiles.json`).
- [scripts/generate_tests.js](scripts/generate_tests.js) — generates profile-driven spec files.
- [playwright.config.js](playwright.config.js) — Playwright configuration and reporter settings.
- [.github/skills/playwright-framework-context/SKILL.md](.github/skills/playwright-framework-context/SKILL.md) — repo-specific conventions for agents and tests.
- [.github/agents/agent-startup.skill.md](.github/agents/agent-startup.skill.md) — migration stub (kept for backward compatibility).
- [AGENTS.md](AGENTS.md) — agent bootstrap guidance and pointers.

How the framework works (high level)
- Each spec sets a `PROFILE` identifier (e.g., `LK1`) and calls `loadProfile(PROFILE)` from [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts). `loadProfile` copies environment variables named with the `_PROFILE` suffix into base names used by the test (for example, `FIRST_NAME_LK1` -> `FIRST_NAME`).
- The main test flow is implemented in `runRefinanceFlow(page, profile)` (in [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts)) which drives the web UI, fills fields, submits forms, waits for redirects to lender pages, and collects artifacts.
- Test artifacts (per-test markdown reports, screenshots) are written via `writeRunArtifacts` and placed under the Playwright output directory configured in [playwright.config.js](playwright.config.js) (look in `test-results/`).

Profiles and test data
- The helpers expect environment variables in the form `KEY_<PROFILE>`. Example keys include:
	- `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `PHONE`, `LOAN_AMOUNT`, `MONTHLY_PAYMENT`, `INTEREST_RATE`, `ADDRESS`, `SCHOOL`, `DEGREE_LEVEL`, `GRADUATION_DATE`, `INCOME_TYPE`, `EMPLOYER`, `OCCUPATION`, `ANNUAL_INCOME`, `EMPLOYMENT_START`, `CITIZEN_STATUS`, `CREDIT_SCORE`, `HOUSING_TYPE`, `HOUSING_COST`, `TOTAL_ASSETS`, `DOB`, `SSN`.

Example `.env` snippet for profile `LK1` (place in project root or export into your environment)

```bash
FIRST_NAME_LK1=John
LAST_NAME_LK1=Doe
EMAIL_LK1=john@example.com
PHONE_LK1=5551234567
LOAN_AMOUNT_LK1=15000
MONTHLY_PAYMENT_LK1=200
INTEREST_RATE_LK1=8.5
ADDRESS_LK1="123 Main St, Anytown, CA 90001"
SCHOOL_LK1="Example University"
DEGREE_LEVEL_LK1=Bachelors
GRADUATION_DATE_LK1=06/01/2015
INCOME_TYPE_LK1=SALARY
EMPLOYER_LK1=ExampleCorp
OCCUPATION_LK1=Engineer
ANNUAL_INCOME_LK1=85000
EMPLOYMENT_START_LK1=01/01/2015
CITIZEN_STATUS_LK1=US_CITIZEN
CREDIT_SCORE_LK1=SCORE_750_774
HOUSING_TYPE_LK1=RENT
HOUSING_COST_LK1=1200
TOTAL_ASSETS_LK1=0
DOB_LK1=01/01/1990
SSN_LK1=123456789
```

Notes on loading profiles
- `loadProfile(PROFILE)` will copy `KEY_PROFILE` entries into `process.env.KEY`. If a value is missing, the test helpers may generate fallbacks (address/SSN) to avoid failing on minor data omissions.
- The test harness currently attempts to load environment values via dotenv from `test-data/student-loan-refi/student-loan-refi.yaml` (see [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts)). That YAML file is not present in the repository by default; recommended options:
	- Create a `.env` file in the repo root with `KEY_PROFILE` entries (dotenv supports `.env`).
	- Or export the `KEY_PROFILE` variables in your shell / CI environment before running tests.

Generating tests
- Use [scripts/generate_tests.js](scripts/generate_tests.js) to auto-generate per-profile spec files. Example:

```bash
node scripts/generate_tests.js
```

- Note: `generate_tests.js` writes files into the `tests/` directory root (it generates `LK1.spec.ts`, `LK_CD1.spec.ts`, etc.). Your existing suite lives under `tests/student-loan-refi/`; you may want to adjust the script output path if you prefer generated specs to live alongside the existing folder structure.

Running and debugging
- Tests run with Playwright and will collect traces, screenshots, and video on failure (see `playwright.config.js`).
- Test artifacts are written to `test-results/<MMDDYYYY>/runs` and HTML reports are placed under `test-results/<MMDDYYYY>/reports/student-loan-test-report-<timestamp>` by default. To open a report:

```bash
npx playwright show-report test-results/<MMDDYYYY>/reports/student-loan-test-report-<timestamp>
```

- For quick debugging of a single test you can run with headed mode and a single worker:

```bash
npx playwright test tests/student-loan-refi/LK1.spec.ts --headed --workers=1
```

Agents, prompts, and skills (how to use them)
- This repository includes agent guidance and skills to be used by AI-assisted workflows. The human-readable entry points are [AGENTS.md](AGENTS.md) and [.github/skills/playwright-framework-context/SKILL.md](.github/skills/playwright-framework-context/SKILL.md).
- Purpose of the pieces:
	- `AGENTS.md` — bootstrap instructions for any agent that will operate on this repository.
	- `.github/skills/playwright-framework-context/SKILL.md` — canonical framework rules (locator strategy, profile mapping, timing conventions) that an agent should follow when generating or fixing tests.
	- `.github/agents/agent-startup.skill.md` — a compatibility stub that points to the SKILL entry; keep for backward compatibility.
- Example agent-driven workflows (conceptual):
	1. Test generation: an agent reads `SKILL.md`, inspects `test-data/`, and writes new spec files (or runs `node scripts/generate_tests.js`).
	2. Test healing: when a test fails, an agent (or a human) uses the `playwright-framework-context` rules to suggest resilient selectors, retry logic, or to add fallbacks.
	3. Orchestration: an agent coordinates narrow test runs, collects artifacts, and summarizes failures for triage.

CI recommendations
- Pass the profile environment variables into your CI job (or generate a `.env` at pipeline runtime) so that `loadProfile(PROFILE)` will pick them up.
- Set `CI=true` in CI to use the Playwright `retries` and `workers` settings present in [playwright.config.js](playwright.config.js).

Notable caveats & recommended fixes
- The test harness references `test-data/student-loan-refi/student-loan-refi.yaml` via `dotenv` but that YAML file is not present; either supply that file or use a `.env` in the repo root. The easiest approach is to create a `.env` containing `KEY_PROFILE` variables.
- `package.json` includes helpful npm scripts that assume specs live directly under `tests/` (for example `test:eligible` targets `tests/LK[0-9]*.spec.ts`). If your working specs are under `tests/student-loan-refi/`, update the scripts or run Playwright directly with the correct path.

Where to look next
- Test helpers and flow: [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts)
- Test generator: [scripts/generate_tests.js](scripts/generate_tests.js)
- Agent guidance and framework conventions: [.github/skills/playwright-framework-context/SKILL.md](.github/skills/playwright-framework-context/SKILL.md) and [AGENTS.md](AGENTS.md)

If you'd like, I can:
- Generate a `.env` from `test-data/student-loan-refi/profiles.json` and add it to the repo (or to `.env.example`).
- Update `scripts/generate_tests.js` to write specs into `tests/student-loan-refi/` instead of `tests/`.
- Commit these README changes and push a branch for review.

Changelog
- 2026-06-26: Expanded README to include analysis, installation, profile mapping, agent guidance, and known caveats.

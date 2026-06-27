# NFS-QA-Automation

Playwright QA automation for the Student Loan Refinance flow.

## Current Scope

This repository is focused on the student-loan-refi suite under [tests/student-loan-refi](tests/student-loan-refi). The active profile source of truth is [test-data/student-loan-refi/student-loan-refi.yaml](test-data/student-loan-refi/student-loan-refi.yaml). The root [`.env`](.env) file is kept as a compatibility copy of the same profile data.

The old [test-data/student-loan-refi/profiles.json](test-data/student-loan-refi/profiles.json) file has been removed.

## Setup

Prerequisites:

- Node.js 16+ and npm.

Install dependencies and browsers:

```bash
npm install
npx playwright install
```

## Running Tests

Run the student-loan-refi suite with Chromium:

```bash
npx playwright test tests/student-loan-refi --project=chromium
```

Run the full Playwright suite:

```bash
npx playwright test
```

Open the latest HTML report:

```bash
npx playwright show-report
```

## Profile Data

The test helpers load profile values through dotenv from [test-data/student-loan-refi/student-loan-refi.yaml](test-data/student-loan-refi/student-loan-refi.yaml). `loadProfile(PROFILE)` copies `KEY_PROFILE` values into the base keys used by the tests, for example `FIRST_NAME_LK1` becomes `FIRST_NAME`.

Profiles are grouped as follows:

- Eligible: `LK1` to `LK14`
- Credit decline: `LK_CD1` to `LK_CD10`
- No credit: `LK_NC1` to `LK_NC10`
- Ineligible: `LK_IN1` to `LK_IN10`
- Earnest aliases: `ER_OFFER_SUCCESS`, `ER_CD_BANKRUPTCY`, `ER_CD_LOW_FICO`, `ER_0`

Required keys for each profile include:

- `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `PHONE`, `DOB`, `SSN`
- `LOAN_AMOUNT`, `MONTHLY_PAYMENT`, `INTEREST_RATE`, `LOAN_TYPE`
- `ADDRESS`, `SCHOOL`, `DEGREE_LEVEL`, `GRADUATION_DATE`
- `INCOME_TYPE`, `EMPLOYER`, `OCCUPATION`, `ANNUAL_INCOME`, `EMPLOYMENT_START`
- `CITIZEN_STATUS`, `CREDIT_SCORE`, `HOUSING_TYPE`, `HOUSING_COST`, `TOTAL_ASSETS`

## Test Flow

The shared flow lives in [tests/student-loan-refi/test-setup.ts](tests/student-loan-refi/test-setup.ts). It handles:

- loading the selected profile into environment variables
- driving the refinance form
- detecting offer vs no-offer outcomes
- writing screenshots and markdown reports into Playwright output folders

Most specs in [tests/student-loan-refi](tests/student-loan-refi) are thin wrappers that set `PROFILE` and call `runRefinanceFlow(page, PROFILE)`.

## Repository Notes

- [package.json](package.json) contains npm shortcuts for the Playwright suite.
- [scripts/generate_tests.js](scripts/generate_tests.js) is a legacy generator that still targets root-level spec files.
- [playwright.config.js](playwright.config.js) defines retries, reporters, and artifact output.
- [AGENTS.md](AGENTS.md) and [.github/skills/playwright-framework-context/SKILL.md](.github/skills/playwright-framework-context/SKILL.md) contain the repo guidance used by agents.

## Troubleshooting

- If profile values are missing, confirm the `KEY_PROFILE` entries exist in [test-data/student-loan-refi/student-loan-refi.yaml](test-data/student-loan-refi/student-loan-refi.yaml) or in `.env`.
- If a run fails, check the latest files in `test-results/` and the Playwright HTML report.
- If you are adding new profiles, keep the YAML and `.env` copies aligned so `loadProfile(PROFILE)` continues to work.

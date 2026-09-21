**Reporting Layout**

Purpose: standardize test reports under `test-results` by date, project, and run id.

Layout:
- Allure results: `test-results/allure/MMDDYY_HHMMSS_<project>`
- Playwright HTML reports: `test-results/YYYY-MM-DD/<project>/reports/test-report-<timestamp>` (Playwright config)
- Screenshots (WDIO): `test-results/YYYY-MM-DD/<project>/<run-id>/screenshots`

How to produce consistent `run-id` across runners:
- Export `RUN_ID` before running tests, e.g. `export RUN_ID=$(date -u +%Y-%m-%dT%H-%M-%SZ)`
- Playwright and WDIO will use `RUN_ID` when present.

Important: There should be no files directly inside the `test-results/` root. The organizer will move any loose files or non-date folders into `test-results/YYYY-MM-DD/misc`.

- Allure: generate HTML from results: `npx allure generate test-results/allure/MMDDYY_HHMMSS_<project> --clean -o allure-report` then `npx allure open allure-report`.

**Report placement convention**

- All test execution reports must live under `test-results/`.
- Reports should be organized by date and test type: `test-results/YYYY-MM-DD/<type>/report-file.md`.
- If a single test script is run, ensure a report is generated and placed under the proper date/type folder.

How to enforce

- A helper script `scripts/organize-reports.js` is provided to move any stray `*-test-execution-report*.md` files from `docs/` or the repository root into `test-results/YYYY-MM-DD/<type>/`.
- `npm test` will run the script automatically via the `posttest` hook. You can also run it manually:

```bash
npm run organize-reports
```

If you'd like, we can also add a Playwright reporter plugin to output structured reports directly into the date/type folders. Open an issue or ask me to implement that next.

See also: `test-data/student-IDR/readme.md` for details about per-worker email counters and how generated credentials are recorded in `test-results` during runs.

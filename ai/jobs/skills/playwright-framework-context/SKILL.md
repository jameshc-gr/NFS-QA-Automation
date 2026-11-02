---
name: playwright-framework-context
description: 'Living framework context for this Playwright repo. Use when you need the current test mechanics, profile mapping, locator strategy, timing conventions, or agent workflow guidance.'
argument-hint: 'Initialize the repo context'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 3 - Fast Framework Context Summary)
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
- Root hygiene: `npm run check:root` rejects unexpected root files and default
  reporter/MCP output directories. `npm test` and the shared Playwright wrapper
  check the root; browser CI jobs check it even after failure. Direct commands
  and MCP sessions must also use explicit `test-results/` destinations and run
  the guard on completion. Ignoring output does not redirect its writer.
- Memory is selective, not a full archive. Append dated request/change/validation
  history to affected-folder READMEs and link from root README; use tracked
  `memory/webautomation.md` when the external memory mount is unavailable.
- Profile values are loaded through `tests/projects/student-loan-refi/test-setup.ts` from suffix-based env vars such as `FIRST_NAME_LK1`.
- Specialized profiles use uppercase enum-style values for dropdowns where possible.
- Narrow test runs are preferred before broad suite runs.
- Reuse existing project folders across `tests/projects/`, `test-data/` and
  `test-results/<date>/`. Create a new project folder only when the user
  explicitly identifies a new project; scenario sets and tenants are subfolders.
- Solution Finder has two intentionally separate sets: the original
  `tests/projects/solution-finder/` general regression suite, and the explicitly
  requested 102-case `tests/projects/solution-finder/workbook-scenarios/` group.
  Do not merge or replace the original tests. The new suite uses
  `playwright.new-solution-finder.config.ts` and checked-in inputs from
  `test-data/solution-finder/workbook-scenarios/`; the original config excludes it.
  Both runners use the `solution-finder` project name; existing `:new` commands
  select the workbook group without creating a separate project.
  Run `SF_TENANT=gri npm run test:solution-finder:new` (also `owning`,
  `citywide`, `certainty`, `onq`; default GRI, unknown values error).
  Certainty uses `/inquiry/?playwright=true`, not `/inquiry/intake/`.
  Expectations are GRI-observed: other tenants are flagged as unapproved
  baselines and differences are not silently ignored. Tests submit only
  through UI, compare actual API and DOM offers with workbook expectations,
  ignore generated IDs and product ordering but retain numeric/eligibility
  checks. Workbook APR comparisons ignore hundredths/thousandths without
  rounding (8.449% matches 8.471%, but not 8.500%); UI/API APR remains exact.
  Ignored APR values are recorded in QA comments, not rewritten in baselines.
  Tests save a QA comment plus evidence for every run under
  `test-results/<date>/solution-finder/workbook-scenarios/<tenant>/<run-id>/`.
  Validate with `npm run test:solution-finder:new:unit` and
  `npm run typecheck:solution-finder:new`; regenerate specs only from
  explicitly reviewed fixture changes.
- Solution Finder Lab: `npm run solution-finder:lab` serves
  `http://127.0.0.1:4180` (override `SF_LAB_PORT`). Source lives in
  `scripts/solution-finder/lab/`; its fixed spec is under
  `tests/projects/solution-finder/lab/` and excluded from original discovery.
  It validates pasted JSON, previews inputs, runs one UI inquiry for a selected
  existing QA tenant, and shows actual JSON, parsed offers/IDs and screenshots.
  Its picker has 125 input templates: original23 first as `SF-N-Original`,
  then existing102 `NSF-*` cases. Original source JSON/mapping notices remain
  visible; original12 now uses the user-approved title-aligned retirement DOB
  with an explicit correction notice and preserved source. Retired SSI maps
  automatically to SOCIAL_SECURITY in Navigator; validate calendar age 62+
  and the source/type pairing, and compare actual submitted income type.
  GRI form-only clock probes verified exact birthday/leap boundaries.
  This is observed Navigator behavior, not federal SSI eligibility: Social
  Security retirement and age-based SSI are distinct programs. Flag the
  "Retired SSI" / SOCIAL_SECURITY label ambiguity for Product; never infer a
  benefits rule or silently replace the observed UI cutoff with age 65.
  Original, workbook and lab paths reuse selectInquiryIncomeSource from
  the original form helper for exact native/custom primary/additional income
  selection. Missing options fail; never choose employment/first available.
  The original retirement spec asserts the real submitted DOB and income
  source/type/amount and includes permanent form-only browser clock probes.
  Original22 source is N/A, but user-authorized lab input clones SF-1 with DOB
  January 1 of current local year minus 17, refreshed per load/queue;
  clamp residence start to DOB when needed. It is selectable,
  with an explicit generated-data notice, not an original customer request.
  Use property/borrower/repeatable-income tables or the always-visible JSON
  copy/paste area above them. Paste works before Load; selecting a case still
  requires Load. Old servers get a visible restart notice and correct legacy
  group labels. New servers snapshot page assets at startup so API/static
  versions remain consistent; restart after code changes, not during a run.
  Top-level **Reset / New run** clears workspace inputs/selections/results,
  resets GRI/fresh-email defaults and keeps saved runs/suites/templates.
  Disable it during active execution or pending UI requests; never submit,
  delete persisted work or cancel a running inquiry as part of reset.
  Validation shows eight readable address/currency/name/SSN-last-four/income
  lines; values come from the actual request. Edits invalidate stale previews.
  Saved-run labels/profile derive borrower, actual submitted email and returned
  identifiers from persisted evidence. A true `loanId` is never synthesized
  from internalAppId, inquiryId, offerId or officer IDs; missing loan ID is
  explicit and application/inquiry fallbacks retain their real labels.
  Edit loaded/pasted inputs and use **Save as new template** for validated named
  copies in the persisted **Saved templates** group. Each gets a new
  `SF-CUSTOM-<UUID>`; originals/previous copies are never overwritten.
  Input-only JSON lives in gitignored
  `test-data/solution-finder/workbook-scenarios/lab-templates/`; no run evidence
  belongs there. Saving never executes or creates a response baseline/spec.
  **Run a scenario suite** uses explicit grouped checkboxes for saved
  original/NSF/custom inputs; no modifier-key multi-select. It targets one tenant,
  with group/Clear controls and separate count/tenant authorization.
  Suite Tenant (above Scenario group) and Configure an inquiry Tenant sync
  bidirectionally with intake/target labels and reset both confirmations.
  Both selectors lock while an inquiry or suite is active.
  Prevalidate/snapshot all requests before launching; all 23 originals are
  selectable. Use one fixed browser child at a time, mutually exclusive
  with single runs. First failure stops the queue and skips pending cases;
  stop-after-current never interrupts the current inquiry. No retries/resume.
  Combined results/history link each child profile, offers, JSON and screenshot;
  **Open all suite results in a new tab** opens a read-only, auto-updating
  full-suite report with every case/offer/decline/JSON/log/screenshot, including
  saved history. It makes GET requests only; opening a report never re-executes.
  The existing Actual results panel still inspects one child at a time.
  suite snapshots/summaries stay under dated `solution-finder/lab/sf-suite-*`
  results, not test-data. Interrupted suites fail/skip rather than auto-submit.
  Unsaved editor variations must be saved as templates before batch selection.
  It reuses the workbook browser flow with `compareWorkbook: false`; placeholder
  expected responses do not decide lab PASS. Exact UI/API checks remain.
  Default fresh emails are explicit/optional; UI-controlled routing metadata
  is recorded, not injected. A returned internal application ID is not a
  completed loan. All input snapshots/history/evidence stay in
  `test-results/<date>/solution-finder/lab/<run-id>/`.
  Validate with `npm run test:solution-finder:lab` and the scoped typecheck.
  Standalone distribution: `npm run package:solution-finder:lab` compiles an
  explicit runtime allowlist into a ZIP beneath dated Solution Finder
  lab-distribution results. Include minimal pinned npm dependencies, UI,
  tenant registry and Node launcher; never customer/workbook inputs, secrets,
  account records, saved runs/templates or installed modules/browser binaries.
  Packaged launcher sets SF_LAB_PORTABLE=1, skips both datasets and displays an
  empty-catalog notice; recipients paste approved JSON and save local templates.
  Normal mode still requires its original sources. Compiled worker/config use
  JS while repo mode uses TS. `npm run verify:solution-finder:lab -- <ZIP>`
  installs/exercises the extracted copy with module-isolation enforcement;
  no live inquiries. Recipients need Node 22/24 LTS, npm ci, npm run setup,
  npm start and QA/VPN access. macOS verified; Windows/Linux not certified.
- Start continuation tasks from `test-data/README.md` for the October 2026
  reusable-input inventory and focused commands. Do not use prior test results
  as current coverage. One-off exploration/capture/probe specs, media report
  builders, backlog controllers, and hard-coded issue migrations were retired
  on 2026-10-27; their historical commands are no longer supported.
- Team PM owns delivery and delegates the Playwright test workstream to the
  existing Playwright Test Orchestrator, which routes planning, generation, and
  reproduced test failures to the existing specialists. All team roles follow
  `ai/team-agent/README.md`'s coordination contract: single-writer ownership,
  serialized shared resources, evidence handoffs, independent QA, and preserved
  human tester workflows. Product/framework defects return to PM/Developer;
  unresolved failures must not be hidden with skips or weaker assertions.
- The authoritative customization split is `ai/jobs/agents/`, `ai/jobs/prompts/`, and `ai/jobs/skills/`.
- API tests now run from `api/tests/` via the `api-tests` Playwright project.
- The API runner loads dotenv in `playwright.config.ts`, reads collection and mapping JSON from `api/postman/<projectname>/` and `api/api-mappings/<projectname>/`, and resolves placeholders from runtime saves, Postman environment JSON, `process.env`, and `API_PROJECT` selection.
- DMX scenarios are defined in `test-data/DMX/dmx-scenarios.yml`; generated catalog specs call shared route-driven flows. `npm run dmx:dashboard` starts a loopback-only UI for choosing a catalog case, editing/saving scenario JSON templates, and launching one Chromium worker at a time. Dashboard run overrides use the ignored `test-data/DMX/dmx-dashboard-run.json`; the existing account CSV and local dashboard history contain plaintext account credentials and loan identifiers. Dashboard launch input must remain restricted to catalog spec paths, and manual MFA remains opt-in outside the dashboard.
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
- Firebase downloads reuse the Google browser profile saved by
  `npm run setup:gv-session` (the same one Google Voice uses); there is no
  separate Firebase login. Google sign-in is always performed by hand and never
  scripted. Verify access with `npm run verify:firebase-access`.
- Prod Android App Distribution releases are `.aab` and need Java + bundletool
  (`android.bundletoolJar`) to become an installable universal apk; QA releases
  are already `.apk`.
- Mobile verification is environment-driven via `MOBILE_ENV`, resolved from
  `environments.<env>` in `test-data/mobile-app/gri/android/config.yml`:
  `prod` reads codes from Guerrilla Mail, `qa` reads them from the Outlook
  mailbox `v3test@rate.com`. Yopmail is retired for create-account (reCAPTCHA).
  `AuthPage.assertEnvironmentMatchesBuild()` fails fast on an env/build mismatch.
- Both platforms share `test-data/mobile-app/gri/android/{login,config}.yml`
  (`authRoot` in `mobile/src/utils/mobile-auth.ts`); the iOS `config.yml` only
  supplies `ios.builds`.
- Mobile specs run under WebdriverIO, not Playwright: `npx wdio run
  mobile/wdio.conf.ts` with `MOBILE_SPECS` paths relative to `mobile/`.
- Inventory/reuse existing devices before launching mobile tests. Keep at most
  one test-owned simulator per platform. Simulator capabilities accept
  `MOBILE_IOS_DEVICE_UDID`. Stop owned Android AVDs when
  finished, but never stop someone else's active device.
- At the start and end of every exploratory phase, match booted simulator and
  emulator hubs to running test workers. Shut down inactive test-owned hubs
  promptly, including on failure and before reporting, while preserving any
  active run or device owned by another tester.
- iOS WDIO preflight hard-caps at 10 booted simulators (environment overrides
  cannot raise it), requires an explicit `MOBILE_IOS_DEVICE_UDID`, and refuses an
  unbooted requested UDID (prevents Appium auto-selection/creation).
  Retired `MOBILE_MEDIA_BATCH` / `MOBILE_MEDIA_BACKLOG_CHILD` invocations fail
  explicitly rather than falling through to default regression selection.
- Dated mobile reference snapshots remain historical baselines, not current-build
  coverage. Their old crawler/report commands are retired. Preserve machine-readable
  fixtures, account registries, counters, build metadata, and October evidence.

Output Contract
- Return a short framework snapshot with:
	- Active test root and project folder
	- Profile loading behavior and suffix mapping model
	- Locator and wait conventions
	- One recommended prompt or agent for the task
	- Three smallest commands/checks to run first

Recent changes (2026-07-31)
- Create-account verification is now environment-driven: `MOBILE_ENV=prod` reads
  codes from Guerrilla Mail, `MOBILE_ENV=qa` from Outlook `v3test@rate.com`.
- Implemented `scripts/download-firebase-build.ts` for the `firebase-web` source;
  it reuses the Google Voice browser profile, so tester access is sufficient.
- iOS/Android create-user specs verified green end to end, including SMS
  verification and dismissing the "working with someone from Rate?" modal.

Recent changes (2026-10-30)
- DMX login waits for delayed fields, quotes the Okta passcode selector, supports separate username/password screens and waits for URL completion without serializing Node functions. Expired manual MFA must fail, not report login success.
- Registration uses a typed URL predicate rather than competing waits, skips password entry on authenticated application routes and preserves the selected entry in dashboard fallback. Residence supports current Years*/Months* controls derived from MM/YYYY and legacy date controls.
- `npm run test:dmx:unit` covers these paths offline with intercepted Chromium fixtures. Fresh-account DEV LO-B PUR-01 passed live; existing-account live login/MFA remains unverified. See `tests/projects/DMX/README.md` for dated evidence and limitations.

Recent changes (2026-09-30)
- Added the local DMX Loan Lab dashboard for scenario templates, serialized single-case launches, streamed logs/progress and local loan/account results. It binds to `127.0.0.1`; do not expose it or publish its ignored credential-bearing files.
- Dashboard has a dedicated field-based Template Workshop: prefill from an automated DMX case, edit labeled borrower/co-borrower/residence/employment/assets/property/loan/expectation fields, add/remove asset rows or add a co-borrower, then create a separately named new template. Existing template edits remain available through the JSON editor. Builder case changes do not mutate the catalog scenario. DMX failures emit page/route/error diagnostics and a screenshot under the run's Playwright output; only complete/resumed-complete loan outcomes are green.
- DMX route handlers must avoid fixed sleeps and `networkidle` for SPA progress. Use locator/DOM state and route checkpoints; the shared click helper logs slow clicks with route and button name and has a bounded timeout.
- Dashboard DEV LO selector has a fixed allowlist of entry URLs: LO-A `emp-id=12657` (`/apply/loan-purpose`), LO-B `emp-id=4723` (`/apply/loan-purpose`), LO-C `emp-id=6068` (`/apply/lo-selection`). Thread the selected entry URL from dashboard config into `register`; do not accept arbitrary URLs. Attribution assertions use the selected LO display name; LO-B retains its NMLS assertion. LO-C currently waits for an available LO selection control before continuing and must be validated against DEV before claiming end-to-end selection behavior.
- Multi-tenant/environment entry targets are centralized in `tests/projects/DMX/dmx-environments.ts`; read-only entry checks live in `DMX-TENANT-ENTRY-SMOKE.spec.ts` and `npm run test:dmx:tenant-entry`. The dashboard can run one selected entry check. PROD checks require exact `READ-ONLY` UI confirmation and a confirming request header; the launch API never allows PROD loan creation. Until tenant-specific application flows are verified, only GRI Enhanced DEV + LO-B may use loan creation; all other selectable targets are entry smoke only. Owning DEV (`apply-owning.dev...emp-id=100000029`) and OP DEV (`apply-op.dev...emp-id=921`) use separate links.
- The tenant smoke spec filters one target with `DMX_ENTRY_TARGET_ID` for dashboard launches. It validates expected pathname via `expect.poll(() => new URL(page.url()).pathname)` because `toHaveURL(regex)` receives the full URL, not just the path. Smoke checks capture failed page/route/error/screenshot and mark the result `loanCreated: false`.
- DMX dashboard accepts a repeated existing account email; there is no registry duplicate guard. The account registry is append-only and may contain multiple loans/runs for the same email. The current create-account route uses the supplied password; existing-account login/reuse through registration has not been end-to-end validated, so fail with the actual UI validation if the application does not accept the account.
- Loan Lab exposes the 20 automated CSV loan cases (14 complete plus 6 resume/relogin) and separately the 20 tenant/environment read-only entry targets. Do not add duplicate case scripts for these; `ENTRY-01` remains an attribution-only check, not a loan creation option.

Recent changes (2026-07-29)
- iOS QA localization capture: language changes require a process restart. Use
  `mobile: launchApp` with `arguments: ['-AppleLanguages', '(es)']` or `(en)`;
  verify rendered localized labels and selected tabs before recording evidence.
  Capture/dismiss the system Save Password sheet and Tools goals dialog before
  root screenshots. A switch accessibility value alone is not language proof.
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

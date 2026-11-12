# AI Agent Instructions

This repo's latest human-readable guidance lives in [README.md](README.md). Treat that file as the source of truth for commands, profile rules, test layout, and agent references.

## Screenshot Output Rule

- Save all generated screenshots only under the repository's `test-results/` directory, preferably `test-results/<YYYY-MM-DD>/<project>/<run>/`.
- This applies to automated tests, exploratory/manual browser captures, MCP browser tools, failure diagnostics, and report previews.
- Before capturing, create the destination directory and explicitly set a screenshot path resolving inside `test-results/`. Never rely on a tool's default output location.
- Never create screenshots in the repository root, `test-data/`, source directories, or any location outside `test-results/`.

## Test Data Retention Rule

- Keep `test-data/` limited to inputs and supporting resources necessary to execute or reproduce tests: fixtures, scenario definitions, expected-data contracts, configuration, account registries/counters, and required application builds.
- Do not store screenshots, execution reports, diagnostic captures, or other generated run evidence in `test-data/`; put them under `test-results/`.
- Preserve required input assets and application-bundle resources (such as app icons); these are not screenshots or disposable test results.

## Project Folder Rule

- Reuse the existing project folder in `tests/projects/`, `test-data/`, and
  `test-results/<YYYY-MM-DD>/`. Add scenario groups, tenants and runs beneath it.
- Create a new project folder only when the user explicitly identifies a new
  project. A new scenario set, workbook, tenant or environment is not a new project.
- Solution Finder workbook scenarios belong under
  `tests/projects/solution-finder/workbook-scenarios/`, with inputs under
  `test-data/solution-finder/workbook-scenarios/` and evidence under
  `test-results/<YYYY-MM-DD>/solution-finder/workbook-scenarios/`.

## Agent Bootstrap

- Memory is selective context, not a complete work archive. For every completed
  task, append a dated work-history entry to each affected area/folder's README
  (create one if missing), recording the request, root cause/decision, changes,
  validation and remaining limitations. Link detailed records from the root
  README. Preserve older entries; distinguish historical outcomes from current
  behavior. Never copy secrets, account data or raw response payloads into history.
- All generated diagnostics, snapshots, response captures, logs and reports must
  resolve under `test-results/`, including one-off shell and MCP work. Configure
  browser MCP providers with `--output-dir` under `test-results/` when supported;
  otherwise pass explicit result paths. Run `npm run check:root` before reporting
  completion; ignoring a file is not output routing.

- Read [README.md](README.md) first, then [ai/jobs/skills/playwright-framework-context/SKILL.md](ai/jobs/skills/playwright-framework-context/SKILL.md) when you need the current framework mechanics.
- For ANY mobile testing task, [docs/mobile-testing-rules.md](docs/mobile-testing-rules.md) is the permanent, canonical rule set (email formats, verification routing, account recording, page-verbiage assertions). It must not be relaxed or reinterpreted without explicit user approval.
- Before mobile work, also read [ai/jobs/skills/mobile-testing/SKILL.md](ai/jobs/skills/mobile-testing/SKILL.md). Resolve platform, explicit environment/build, pinned emulator/device, flow, account/session readiness, locale, and side-effect authorization. Never ask for passwords, tokens, session files, or OTPs in chat; require explicit authorization before creating accounts or running production flows.
- For every future mobile rule, test, provider, locator, or workflow addition, update the canonical rules document and the affected specs/docs in the same change, then run and report the relevant validation matrix.
- Use the framework-context skill for profile mapping, locator strategy, timing conventions, and other repo-specific test behavior.
- Use the specialized agents listed in [README.md](README.md) for planning, generating, healing, and orchestrating tests.
- After every validated code/config behavior change, run `doc-memory-sync` (`ai/jobs/agents/doc-memory-sync.agent.md`) to keep `README.md` and `/memories/repo/webautomation.md` current.
- If the testing framework changes, update [README.md](README.md) and [ai/jobs/skills/playwright-framework-context/SKILL.md](ai/jobs/skills/playwright-framework-context/SKILL.md) together.

## Autonomy Tiers & Pre-Authorized Execution

Agents must operate with pre-authorized decision boundaries. Minimize human interruption by choosing the most reasonable standard path when ambiguity is within these tiers.

| Tier | Scope | Allowed Autonomous Actions | When to Ask User |
| :--- | :--- | :--- | :--- |
| **Tier 0** | Read & Diagnose | Search, read files, inspect logs, capture screenshots/hierarchy. | Never ask. |
| **Tier 1** | Additive Test Development | Create Markdown plans in `ai/tests/mobile/`, generate `.ts` specs using existing page objects, run focused narrow tests. | Only when the requirement contradicts documented business logic or canonical mobile rules. |
| **Tier 2** | Self-Healing & Refactor | Fix selectors in registry, replace sleeps with polling, update `test-data/mobile-app/` config values, recycle created accounts. | Only when all fallback selectors fail or a UI redesign is suspected. |
| **Tier 3** | Critical / Architectural | Changing `docs/mobile-testing-rules.md`, adding auth providers, modifying CI secrets, switching real OTP providers. | **Always ask before acting.** |

> **Rule of Engagement:** If an agent can proceed safely under Tier 1 or Tier 2, it must proceed, document the assumption, and continue. Do not stop to ask clarifying questions unless the action would fall under Tier 3.

## Step-Gated Execution & Fail-Fast Rules

Every agent-driven test workflow must validate the outcome of each step before advancing.

1. **Validate Every Step:** Each interaction must be followed by a checkpoint assertion (element visibility, screen state, absence of errors).
2. **Stop on Failure:** If any checkpoint fails, halt execution immediately. Do not continue to subsequent steps.
3. **Capture & Diagnose:** Automatically capture page source, screenshot, and filtered log slice.
4. **Root Cause Analysis:** Classify the failure (selector, timing, verification, app crash, infra) using the `mobile-triage` skill.
5. **Fix & Re-Test:** Apply the smallest safe remediation, re-run only the failed step, and only continue after success.
6. **Report:** Emit a structured execution report with pass/fail per step, diagnostic bundle links, and any applied remediation.

## Atlassian & Jira TWG Integration

- For Jira ticket analysis, acceptance criteria extraction, PRD fetching, and duplicate defect detection, use the TWG skill family in [ai/jobs/skills/jira twg](ai/jobs/skills/jira twg).
- Detailed agent operating workflows, command patterns, and autonomy tier boundaries are documented in [docs/agents/jira-twg-agent-guide.md](docs/agents/jira-twg-agent-guide.md).

## Canonical Locations

- Agents: [ai/jobs/agents](ai/jobs/agents)
- Prompts: [ai/jobs/prompts](ai/jobs/prompts)
- Skills: [ai/jobs/skills](ai/jobs/skills)

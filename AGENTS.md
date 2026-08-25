# AI Agent Instructions

This repo's latest human-readable guidance lives in [readme.md](readme.md). Treat that file as the source of truth for commands, profile rules, test layout, and agent references.

## Agent Bootstrap

- Read [readme.md](readme.md) first, then [ai/jobs/skills/playwright-framework-context/SKILL.md](ai/jobs/skills/playwright-framework-context/SKILL.md) when you need the current framework mechanics.
- For ANY mobile testing task, [docs/mobile-testing-rules.md](docs/mobile-testing-rules.md) is the permanent, canonical rule set (email formats, verification routing, account recording, page-verbiage assertions). It must not be relaxed or reinterpreted without explicit user approval.
- For every future mobile rule, test, provider, locator, or workflow addition, update the canonical rules document and the affected specs/docs in the same change, then run and report the relevant validation matrix.
- Use the framework-context skill for profile mapping, locator strategy, timing conventions, and other repo-specific test behavior.
- Use the specialized agents listed in [readme.md](readme.md) for planning, generating, healing, and orchestrating tests.
- After every validated code/config behavior change, run `doc-memory-sync` (`ai/jobs/agents/doc-memory-sync.agent.md`) to keep `readme.md` and `/memories/repo/webautomation.md` current.
- If the testing framework changes, update [readme.md](readme.md) and [ai/jobs/skills/playwright-framework-context/SKILL.md](ai/jobs/skills/playwright-framework-context/SKILL.md) together.
igg
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

## Canonical Locations

- Agents: [ai/jobs/agents](ai/jobs/agents)
- Prompts: [ai/jobs/prompts](ai/jobs/prompts)
- Skills: [ai/jobs/skills](ai/jobs/skills)

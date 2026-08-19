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

## Canonical Locations

- Agents: [ai/jobs/agents](ai/jobs/agents)
- Prompts: [ai/jobs/prompts](ai/jobs/prompts)
- Skills: [ai/jobs/skills](ai/jobs/skills)

# AI Agent Instructions

This repo's latest human-readable guidance lives in [readme.md](readme.md). Treat that file as the source of truth for commands, profile rules, test layout, and agent references.

## Agent Bootstrap

- Read [readme.md](readme.md) first, then [ai/jobs/skills/playwright-framework-context/SKILL.md](ai/jobs/skills/playwright-framework-context/SKILL.md) when you need the current framework mechanics.
- For ANY mobile testing task, [docs/mobile-testing-rules.md](docs/mobile-testing-rules.md) is the permanent, canonical rule set (email formats, verification routing, account recording, page-verbiage assertions). It must not be relaxed or reinterpreted without explicit user approval.
- Use the framework-context skill for profile mapping, locator strategy, timing conventions, and other repo-specific test behavior.
- Use the specialized agents listed in [readme.md](readme.md) for planning, generating, healing, and orchestrating tests.
- If the testing framework changes, update [readme.md](readme.md) and [ai/jobs/skills/playwright-framework-context/SKILL.md](ai/jobs/skills/playwright-framework-context/SKILL.md) together.

## Canonical Locations

- Agents: [ai/jobs/agents](ai/jobs/agents)
- Prompts: [ai/jobs/prompts](ai/jobs/prompts)
- Skills: [ai/jobs/skills](ai/jobs/skills)

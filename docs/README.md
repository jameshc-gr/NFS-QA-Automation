# Documentation history

## 2026-11-11 - Canonical mobile agent runbook

- Request: ensure agents know what mobile run inputs to resolve and how to start
  Android/iOS targets, open the configured app, log in, register a test
  account, and complete MFA.
- Decision: `docs/mobile-testing-rules.md` was absent despite references from
  `AGENTS.md`, mobile skills, and mobile agents. Restored it by consolidating
  current helper/config/spec behavior without changing providers or business
  rules.
- Updated the shared mobile-testing skill, startup entry, and generator,
  orchestrator, healer, root agent instructions, and README index.
- Validation: `npm run test:mobile:unit` passed 3 tests;
  `npm run typecheck:mobile`, `npm run check:root`, and `git diff --check`
  passed.
- Limitation: no simulator/device session or live login, registration, or MFA
  was run; account creation remains explicitly gated.

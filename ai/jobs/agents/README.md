# Agent history

Agent definitions are stored in this folder and its `mobile_agents/` subfolder.
Start with [the repository guide](../../../README.md) and
[shared mobile rules](../../../docs/mobile-testing-rules.md).

## 2026-11-11 - Mobile agent onboarding

- Updated the mobile test generator, orchestrator, and healer to collect
  platform/build/device/account/session/locale/authorization inputs from
  configuration and requests, use the canonical emulator/simulator and
  login/registration/MFA runbook, and avoid requesting secrets or OTPs in chat.
- Updated the shared usage guide to route mobile runs through the canonical
  mobile-testing skill and rules.
- Validation: `npm run test:mobile:unit` passed 3 tests;
  `npm run typecheck:mobile`, `npm run check:root`, and `git diff --check`
  passed. No device-backed flow was run.

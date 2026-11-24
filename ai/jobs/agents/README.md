# Agent history

Agent definitions are stored in this folder and its `mobile_agents/` subfolder.
Start with [the repository guide](../../../README.md) and
[shared mobile rules](../../../docs/mobile-testing-rules.md).

## 2026-11-24 - GR MCP loan systems agent

- Added the discoverable GR MCP Loan Systems profile and a workspace MCP
  definition for the hosted DEV endpoint. The server allowlist is limited to
  loan read/search plus create/copy/update/patch operations; mutations require
  per-operation confirmation.
- The bearer token is referenced through `GR_MCP_DEV_TOKEN` and is not stored
  in workspace files. Local server startup remains unavailable without AWS
  credentials; the hosted DEV endpoint responded but requires authentication.
- Validation: JSON syntax, root hygiene and focused root-hygiene tests passed.
  No authenticated MCP calls or loan-system changes were made.

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

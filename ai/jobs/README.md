# Automation agent guidance history

Canonical assets live in [agents](agents/), [skills](skills/) and [prompts](prompts/).
Start with the [repository guide](../../README.md).

## 2026-10-30 - Durable work history and root-output rules

- Request: retain work history even when assistant memory does not contain all
  prior work. Memory is selective context, not a complete archive or backup.
- Change: agent bootstrap now requires dated affected-folder README history.
  The documentation-sync agent uses tracked
  [repository memory](../../memory/webautomation.md) when the external memory
  mount is unavailable, rather than targeting a nonexistent path.
- Framework context now documents the root guard, explicit evidence output
  paths and the history contract. Earlier historical records remain intact.
- Validation: these are documentation changes; runtime guard evidence is in the
  [scripts history](../../scripts/README.md) and repository README.
- Limit: this policy cannot reconstruct unrecorded past work or promise that
  external tools save every conversation. Record decisions and verified
  outcomes, not secrets, personal data or raw response payloads.

---
name: agent-startup
description: 'Shared repository startup guidance that routes agents to the correct web or mobile operating procedures before execution.'
argument-hint: 'Initialize the repo context'
---

# Agent Startup

1. Read the root `README.md` and `AGENTS.md`.
2. For web work, use the
   [Playwright framework context](../playwright-framework-context/SKILL.md).
3. For any native mobile work, read the
   [canonical mobile rules](../../../../docs/mobile-testing-rules.md) and
   [mobile-testing skill](../mobile-testing/SKILL.md) before asking for inputs,
   starting a device, opening the app, or handling login/registration/MFA.
4. Use only a focused test and explicit output destinations under
   `test-results/`.

## Mobile agent intake

Resolve platform, explicit environment/build, target device, focused flow, test
account source, provider-session readiness, locale, and action authorization
from the request/config. Ask only for missing or contradictory information.
Never ask users to paste passwords, secrets, session files, or OTPs into chat.
Do not create a new account or perform a production action without explicit
authorization.

---
name: agent-startup
description: 'Migration stub for the renamed framework-context skill. Use the new playwright-framework-context skill for current test mechanics, profile mapping, locator strategy, timing conventions, or agent workflow guidance.'
argument-hint: 'Initialize the repo context'
---

# Agent Startup (Migration Stub)

This file now points to [ai/jobs/skills/playwright-framework-context/SKILL.md](../playwright-framework-context/SKILL.md).

Keep it only so older references can be migrated cleanly.

## Mobile Rules Snapshot (2026-08-12)

For all mobile testing tasks, apply these guardrails:

1. Create-user email format:
	- prod: my-rateapp-auto-jcXXXXXX--ra@pokemail.net
	- dev/qa/stage: my-rateapp-auto-jcXXXXXX@pokemail.net
2. Create-user email verification routing:
	- prod: Guerrilla Mail inbox for the created account
	- dev/qa/stage: Outlook v3test@rate.com inbox
3. Login-time verification email routing (all environments):
	- always use Guerrilla Mail inbox for the login email used
4. SMS verification routing:
	- use configured phone and retrieve code from Google Voice
5. Yopmail:
	- do not use for mobile verification flows.



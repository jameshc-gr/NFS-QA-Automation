# Team Memory

This is the durable, checked-in memory for the closed-loop team-agent workflow.
Agents must read it together with `README.md` and `AGENTS.md` before acting.

## Verified operating decisions

- The CEO is the user. Team PM is the default point of contact and orchestration
  role.
- Copilot custom-agent profiles are discoverable from `.github/agents/`.
  Detailed role instructions are maintained under `ai/team-agent/roles/`.
- PM coordinates peer work through explicit agent delegation and structured
  handoffs. An agent file is a profile, not a running agent; the host must load
  the profile and PM must invoke it.
- Do not create or switch branches, commit, push, or open a pull request unless
  the CEO explicitly authorizes that action.
- Use focused verification and preserve the repository's canonical testing and
  safety rules; the team workflow does not override them.
- Pentest execution requires explicit scope and authorization. Never infer
  production or destructive testing permission from a URL or feature request.

## Learning log

Append only durable learnings that were verified during completed work. Include
the date, evidence or source, and affected role/process. Do not store secrets,
personal data, speculative findings, or routine task history.

- 2026-10-14: Added seven Copilot team profiles under `.github/agents/` with
  role instructions under `ai/team-agent/roles/`; YAML frontmatter parsed and
  each profile's role/memory references were checked for existence. Runtime
  agent-picker discovery was not exercised in this workspace.
- 2026-10-14: Established a shared Playwright coordination contract for all
  seven team roles. PM owns delivery and delegates the bounded test workstream
  to the existing Playwright Test Orchestrator; the Orchestrator owns test
  discovery/execution and uses the existing planner, generator, and healer.
  Developer owns framework fixes, and QA verifies independently. Assignments
  must make file ownership, shared accounts/browser sessions/output paths, and
  evidence explicit while preserving existing human-tester workflows. The
  four Playwright `.github/agents` profiles and their
  `ai/jobs/agents/playwright_agents` mirrors are byte-identical, and specialist
  profiles include the read tool. The healer must reproduce focused failures
  and report unresolved blockers rather than add skips. Verified by parsing 14
  discoverable agent profiles, four mirrors, and the framework skill with the
  Node YAML parser; checking allowlist targets and bootstrap references,
  mirror identity, and coordination coverage for all seven roles; `git diff
  --check` passed and the Problems tool reported no framework-skill errors.
  Live runtime delegation and browser tests were not exercised.

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

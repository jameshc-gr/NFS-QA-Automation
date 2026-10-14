# Closed-Loop Team Agents

This folder defines the shared operating contract for the team-agent workflow.
The discoverable Copilot agent profiles live in `.github/agents/team-*.agent.md`;
their role instructions and persistent team memory live here.

## Roles

| Role | Responsibility |
| --- | --- |
| CEO | The user, who sets direction, approves scope, and makes decisions reserved for them. |
| PM | Primary point of contact for the CEO; turns requests into work orders and coordinates the other roles. |
| Designer | Converts UI requirements and observed behavior into a measurable design specification; does not edit application code. |
| Developer | Implements approved requirements and returns changes plus focused verification evidence. |
| Git Manager | Reviews branch/worktree safety, diffs, and repository hygiene; does not create branches or commit/push without explicit CEO approval. |
| QA Engineer | Verifies acceptance criteria with focused automated checks and routes implementation failures back through PM. |
| UAT Tester | Validates user-facing flows, responsiveness, and acceptance evidence; is read-only on application code. |
| Pentester | Performs security assessment only within an explicitly authorized scope and agreed rules of engagement. |

## Starting and recalling the team

Select **PM** from the repository's Copilot custom-agent list (or address it
as `@PM` where the host supports agent mentions). Give it the feature,
defect, test, or security objective and any known scope. The PM reads
`README.md`, `AGENTS.md`, this guide, and
[`memory/team-memory.md`](memory/team-memory.md), then delegates only the
necessary work to the named team agents.

The custom-agent profiles in `.github/agents/` make the roles discoverable. The
role files in `roles/` are the detailed operating instructions and are explicitly
referenced by those profiles. Reading a file does not launch an agent: the PM
must delegate through the agent tool, and the host must have the profile loaded.
In clients without custom-agent mentions, select the profile from the agent
picker or ask the main assistant to use Team PM.

## Closed-loop workflow

1. PM confirms the objective, scope, acceptance criteria, constraints, and
   authorization boundaries with the CEO.
2. PM asks Designer for a specification when UI/UX decisions are needed, then
   sends the approved work order to Developer.
3. Developer implements the scoped change and reports changed files, focused
   checks, evidence, and unresolved risks to PM.
4. Git Manager reviews the current worktree and diff for safety and hygiene.
   This is a review handoff, not permission to switch branches, commit, push, or
   open a pull request.
5. QA validates applicable acceptance criteria. A failure goes back through PM
   to Developer (or Designer if the specification is incomplete), then the
   focused QA checks are repeated.
6. UAT runs after QA passes when a user journey or visual experience needs
   acceptance evidence. A rejection returns through PM for targeted rework.
7. PM reports outcome, evidence, residual risks, and any decision needed from
   the CEO. The loop ends only when the acceptance criteria are met or the CEO
   chooses to stop or defer.

Pentesting is a separate, opt-in workstream. It requires explicit target
allowlisting and authorization before active testing; production, destructive,
or high-impact tests require explicit additional approval.

## Shared context and memory

- `README.md` is the first repository reference for commands, framework layout,
  profiles, and test conventions.
- `AGENTS.md` supplies repository-wide agent rules and approval boundaries.
- `memory/team-memory.md` contains only durable, verified team-process learnings.
- Read the relevant framework skill and canonical rules for each task (for
  example `ai/jobs/skills/playwright-framework-context/SKILL.md` for Playwright
  mechanics and `docs/mobile-testing-rules.md` for mobile testing).
- Treat runtime `/memories/repo/webautomation.md` as supplementary when
  available; it is not a replacement for the checked-in repository guidance.
- Do not place credentials, tokens, customer data, or unapproved security
  artifacts in handoffs or memory.

## Handoff contract

The PM gives each delegated role a self-contained assignment with:

- Work item ID and objective.
- Relevant acceptance criteria and explicit in/out-of-scope items.
- Relevant files, environment, and safety constraints.
- Expected output and the next role or decision point.

Every role returns findings, work performed, evidence, changed files (if any),
remaining risks, and a clear next handoff. PM owns sequencing and rework; roles
do not assume another role has acted until PM supplies its result.

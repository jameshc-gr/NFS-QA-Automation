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

## Coordination with existing Playwright agents and users

The team extends the existing Playwright workflow; it does not replace it or
create a second test framework. All team roles follow this contract whenever
their work affects Playwright tests, tooling, or tester workflows.

| Owner | Playwright handoff |
| --- | --- |
| PM | Owns delivery scope and acceptance; delegates the bounded test workstream to Playwright Test Orchestrator. |
| Playwright Test Orchestrator | Owns discovery, focused execution, and result summaries; delegates to the existing planner, generator, or healer only when needed. Returns results to PM without delegating back to PM. |
| Designer | Supplies measurable UI acceptance checks through PM for the existing planner; does not create a competing test plan. |
| Developer | Owns shared framework implementation; reuses existing fixtures, page objects, profiles, and helpers. Sends test-generation/healing needs through PM to the Orchestrator. |
| Git Manager | Checks test paths, generated artifacts, and diff ownership against the agreed handoff; reports conflicts to PM. |
| QA Engineer | Independently verifies criteria against implementation and specialist evidence; requests focused specialist runs through PM rather than launching duplicate work. |
| UAT Tester | Reuses approved scenarios and QA evidence, checks remaining user-facing acceptance, and routes coverage gaps through PM. |
| Pentester | Coordinates any authorized browser checks through PM without extending target scope or reusing another agent's authorization. |

Use `playwright-test-planner` for scenario planning,
`playwright-test-generator` for approved automated scenarios, and
`playwright-test-healer` for reproduced test defects. Application/framework
defects go to Developer through PM; unclear requirements go to PM/Designer.
QA verification follows remediation and is not replaced by a healer's pass.

Every Playwright assignment includes the work item ID, acceptance criteria,
project/spec selectors, browser, environment, profile/account strategy, approved
commands, plan/seed paths where applicable, evidence locations, and explicit
file ownership. Return exact commands, pass/fail/blocked results, changed files,
diagnostics, and the next handoff. Never include secret values.

- Read the framework-context skill and use the existing discovery, execution,
  and summary skills. Preserve documented commands, test layout, profile
  mapping, locator strategy, checkpoint assertions, and reporting conventions.
- PM assigns one writer per file and sequences work sharing accounts, browser
  sessions, or output paths. Do not launch duplicate runs or edit files another
  role owns; return conflicts to PM.
- Preserve workflows used by existing human testers. Document any intentional
  command/configuration change and its migration path; obtain approval for
  breaking changes rather than silently replacing an established workflow.
- Start with the narrowest relevant spec/browser. Stop dependent steps on
  checkpoint failure; do not weaken assertions or skip failing tests to claim
  success. Unresolved product defects remain reported failures/blockers.
- If a specialist is unavailable, report the limitation to PM; do not pretend
  delegation happened. PM may explicitly assign a bounded fallback.
- After validated framework changes, run doc-memory-sync and update `README.md`
  and the framework-context skill together.

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
- For Playwright work, the test-workstream owner and selectors, shared-resource
  constraints, and evidence requirements defined in the coordination contract.
- Expected output and the next role or decision point.

Every role returns findings, work performed, evidence, changed files (if any),
remaining risks, and a clear next handoff. PM owns sequencing and rework; roles
do not assume another role has acted until PM supplies its result.

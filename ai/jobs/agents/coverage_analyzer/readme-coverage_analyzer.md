# Coverage Analyzer Agent

Purpose
- Detect requirement-to-test gaps by mapping user stories and JIRA tickets to existing specs.

Scope
- Compare requirements against tests under `tests/projects`.
- Highlight high-risk paths with no automated validation.

Inputs
- Requirement statements
- JIRA ticket corpus
- Current test inventory
- Optional production incident history

Outputs
- Missing scenarios
- Risk severity
- Suggested generated tests
- Suggested target folder in `tests/projects/<project>/generated/`

Integration
- Feed missing scenarios into planner output under `specs/`.
- Use generator agent to turn prioritized gaps into runnable specs.

Path convention
- Keep scenario targets in `tests/projects/<project>/...`.
- Keep project data references in `test-data/<project>/...`.
- Avoid leading slash path notation.

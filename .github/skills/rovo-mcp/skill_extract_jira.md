Skill: Extract Jira Ticket Data

Purpose: Extract structured data from a Jira ticket JSON to create human-readable summaries, preconditions, acceptance criteria, and a list of attachments for downstream processing.

Inputs:
- `issue` (object) — Jira REST API issue JSON

Outputs:
- `summary` (string)
- `description` (string)
- `acceptanceCriteria` (string[]) — heuristically extracted from description
- `attachments` ({filename, mimeType, contentUrl}[])
- `comments` (string[])
- `meta` (reporter, assignee, status, created, updated, labels)

Behavior:
- Parse `issue.fields.description` (handle Atlassian storage format object or plain text).
- Extract common markers like "Acceptance Criteria:", "AC:", "Given/When/Then" to build `acceptanceCriteria`.
- Collect `fields.attachment` info and return structured list for downloading.

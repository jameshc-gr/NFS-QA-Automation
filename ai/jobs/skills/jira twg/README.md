# TWG (The Work Graph) Atlassian Skills

This folder contains the suite of 14 TWG skills connecting AI agents to Atlassian enterprise context across Jira, Confluence, Bitbucket/GitHub, Rovo, and Assets (CMDB).

## Comprehensive Guide

For the full agent workflow guide, routing matrix, playbooks, autonomy tier boundaries, and token optimization rules, see:
👉 [docs/agents/jira-twg-agent-guide.md](../../../docs/agents/jira-twg-agent-guide.md)

## Skills Directory

| Skill Folder | Description |
| :--- | :--- |
| [twg/SKILL.md](twg/SKILL.md) | Root umbrella skill, command discovery, live help (`twg help`), batching engine. |
| [twg-jira/SKILL.md](twg-jira/SKILL.md) | Jira workitems, JQL querying, field metadata, workflow transitions, remote links, comments, duplicate detection. |
| [twg-context-discovery/SKILL.md](twg-context-discovery/SKILL.md) | Enterprise dependency maps, related PRs, documentation, project-to-repo maps. |
| [twg-engineering-work/SKILL.md](twg-engineering-work/SKILL.md) | Code search across indexed repos, PR status, reverse dependencies, issue-to-PR tracing. |
| [twg-jira-resolve-merged-work/SKILL.md](twg-jira-resolve-merged-work/SKILL.md) | Reconciling stale Jira tickets with merged PRs and commits (dry-run plans first). |
| [twg-code-review/SKILL.md](twg-code-review/SKILL.md) | Code review combining local diffs, PR metadata, and Jira requirements. |
| [twg-agentic-search/SKILL.md](twg-agentic-search/SKILL.md) | Deep enterprise cross-surface search with Rovo (Jira, Confluence, Slack, Drive, Bitbucket, GitHub). |
| [twg-confluence/SKILL.md](twg-confluence/SKILL.md) | Reading and updating Confluence PRDs, architecture pages, spaces, and CQL queries. |
| [twg-status-rollups/SKILL.md](twg-status-rollups/SKILL.md) | Engineering velocity, sprint progress, launch & go/no-go readiness briefs. |
| [twg-responsibility-routing/SKILL.md](twg-responsibility-routing/SKILL.md) | Identifying declared owners, maintainers, SMEs, approvers, and escalation paths. |
| [twg-operational-health/SKILL.md](twg-operational-health/SKILL.md) | Incidents, post-incident reviews (PIR), on-call handoffs, Assets/CMDB, golden signals. |
| [twg-artifacts/SKILL.md](twg-artifacts/SKILL.md) | Publishing standalone HTML test reports, test summaries, and docs as Atlassian Artifacts. |
| [twg-space-creation/SKILL.md](twg-space-creation/SKILL.md) | Bootstrapping, designing, or cloning Confluence spaces from blueprints or codebases. |
| [twg-bench-lite/SKILL.md](twg-bench-lite/SKILL.md) | A/B benchmark evaluation comparing raw MCP vs TWG CLI graph context. |

## Quick Command Syntax

```bash
# Read a ticket
twg jira workitem get MSAM-8082 --full

# Query via JQL
twg jira workitem query --jql 'project = MSAM AND statusCategory != Done ORDER BY priority DESC'

# Semantic Rovo search
twg rovo search "IDR calculation rules" --agent-fields @compact

# Discover transitions (read-only)
twg jira workitem transition --id MSAM-8082 -o json
```

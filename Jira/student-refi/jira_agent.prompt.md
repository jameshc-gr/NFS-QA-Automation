Jira Agent Prompt (Rovo MCP)

Task: Given a Jira ticket JSON, produce a concise human-readable summary, extract acceptance criteria and produce a prioritized test plan. Output must be valid markdown with sections: Summary, Preconditions, Acceptance Criteria, Test Plan (with numbered test cases and steps), and Suggested Automation Hints (locators, data requirements).

Rules:
- Keep outputs concise (max 400 words summary, test cases limited to 12 steps each).
- Do not include secrets; reference environment variables for credentials.
- Prefer Given/When/Then structure for test steps when applicable.

Example output structure:

```
# Summary

# Preconditions

# Acceptance Criteria

# Test Plan
1. Title: ...
   Steps:
     - Given ...
     - When ...
     - Then ...
   Expected: ...

# Suggested Automation Hints
- Platform: Android / iOS / Web
- Locators: accessibility id: "...", xpath: "..."
```

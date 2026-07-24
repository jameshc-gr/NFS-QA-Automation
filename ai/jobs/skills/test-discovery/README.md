# Test Discovery Skill

This skill implements a minimal `discoverTests` runner that scans `tests/` for Playwright spec files and returns the top matches for a query.

Usage:

```
node dist/ai/jobs/skills/test-discovery/discover_tests.js "loan application flow"
```

Or import and call `discoverTests({query, profile})` from other tools/agents.

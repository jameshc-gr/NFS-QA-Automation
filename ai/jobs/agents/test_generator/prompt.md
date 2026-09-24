<!-- Migrated from docs/agents/test-generator-agent.md -->

# Test Generator Agent Prompt

The following content was migrated from `docs/agents/test-generator-agent.md`. The original file describes how the test generator agent produces Playwright TypeScript tests from JIRA ticket data and where generated files are written.

Key files referenced:
- `ai/jobs/agents/test_generator/index.ts` — generator module
- `ai/jobs/agents/playwright-test-generator.agent.md` — agent mode
- `ai/jobs/prompts/PROMPT_TEMPLATE.md` — prompt template
- `scripts/generate-test.js` — CLI entrypoint

Usage snippet (migrated):
```
node scripts/generate-test.js --jira PROJ-123 --summary "happy path" --description "Validate student loan offer flow"
```


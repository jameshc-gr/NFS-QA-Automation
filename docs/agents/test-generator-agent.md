# Test Generator Agent

## Objective

Generate syntactically valid, runnable Playwright TypeScript tests from JIRA ticket data.

## Files

- ai/agents/agents/test_generator/prompt.md: LLM prompt template
- ai/agents/agents/test_generator/index.ts: Anthropic-powered generator module
- ai/agents/agents/playwright-test-generator.agent.md: generator agent mode
- ai/agents/prompts/PROMPT_TEMPLATE.md: prompt template for extension work
- scripts/generate-test.js: CLI entrypoint for local generation

## Usage

1. Generate a baseline spec:

```bash
node scripts/generate-test.js --jira PROJ-123 --summary "happy path" --description "Validate student loan offer flow"
```

2. Generated files are written to:

- tests/projects/student-loan-refi/generated/

## Recommended Flow

1. Create or refine a scenario plan in `specs/`.
2. Generate baseline tests with the generator agent.
3. Run focused validation (`chromium` first) on generated specs.
4. Use the healer agent for deterministic failures.

See `ai/agents/readme-agents.md` for the complete framework flow chart and authoring standards.

## Next integration step

Replace fallback generation in scripts/generate-test.js with a call to ai/agents/agents/test_generator/index.ts plus JIRA API ticket fetch.

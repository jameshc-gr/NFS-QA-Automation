# Prompt Authoring Guide

Prompts in this folder are reusable entrypoints that route requests to agents.

## Naming

- File: `<intent>.prompt.md`
- Examples: `run-tests.prompt.md`, `summarize-test-results.prompt.md`

## Required Frontmatter

- `name`
- `description`
- `argument-hint`
- `agent`

## Best Practices

- Keep purpose narrow and explicit.
- Declare expected outputs in bullet form.
- Include constraints aligned to repo conventions.
- Prefer actionable, deterministic instructions.
- Use repo-relative paths like `tests/projects/...` and `test-data/...` (avoid leading slash paths).

## Template

Start from [ai/jobs/prompts/PROMPT_TEMPLATE.md](ai/jobs/prompts/PROMPT_TEMPLATE.md).

## Related Guides

- [Root framework guide](../../../readme.md)
- [AI agent framework guide](../readme-agents.md)
- [API how-to guide](../../../api/README.md)

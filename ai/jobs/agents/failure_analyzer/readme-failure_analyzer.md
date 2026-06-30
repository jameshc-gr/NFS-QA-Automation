# Failure Analyzer Agent

Purpose
- Classify failures as infrastructure, product defect, flaky test, data issue, or unknown.

Scope
- Analyze Playwright run output, traces, and metadata.
- Provide deterministic next checks before broad reruns.

Planned inputs
- Playwright test result JSON
- Trace metadata
- Console/network summaries
- Command that produced the failure

Expected output
- Category
- Confidence score
- Suggested immediate action
- One narrow rerun or debug command

Integration
- Pair with `ai/agents/prompts/summarize-test-results.prompt.md`.
- Use after focused execution from `ai/agents/prompts/run-tests.prompt.md`.

Path convention
- Reference tests as `tests/projects/<project>/...`.
- Reference data as `test-data/<project>/...`.
- Avoid leading slash path notation.

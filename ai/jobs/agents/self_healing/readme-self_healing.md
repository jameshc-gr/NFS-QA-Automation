# Self-Healing Agent

Purpose
- Propose and optionally apply safe locator fixes for flaky UI changes.

Scope
- Focus on selector drift and wait/synchronization instability.
- Keep changes minimal and easy to review.

Capabilities roadmap
- Locator fallback ranking (role -> testId -> css)
- Wait strategy improvements using built-in Playwright waiting
- Minimal patch generation with before/after validation

Integration
- Use after a failing focused run and summary diagnosis.
- Pair with healer agent mode in `ai/agents/agents/playwright-test-healer.agent.md`.

Path convention
- Use repo-relative paths (`tests/projects/...`, `test-data/...`).
- Avoid leading slash path notation.

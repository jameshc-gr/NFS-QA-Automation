# Automation Instruction Template

Purpose: Provide concise automation instructions for engineers and generator scripts.

Sections:

- Summary: Short description of what to automate.
- Target platforms: Android / iOS / Web
- Recommended approach: Playwright / Appium MCP
- Required env vars: LIST_REQUIRED
- Test data: any fixtures or seed scripts
- Locators: prefer `accessibility id`, then `id`, then platform predicates; avoid xpath unless necessary.

Generator Hints:
- Provide example test names and tags.
- Indicate whether the test should be unit, integration, or E2E.

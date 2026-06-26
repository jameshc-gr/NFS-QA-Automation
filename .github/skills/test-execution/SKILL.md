---
name: test-execution
description: 'Run Playwright tests with the right browser, profile, and command shape; prefer narrow runs and clear commands.'
argument-hint: 'Execute the selected tests'
---

# Test Execution

Use this skill to choose and run the safest useful Playwright command.

## When to Use
- A specific test file or subset is already known
- You need a dry-run or a focused browser-specific validation
- You want to validate a fix with the smallest reasonable command

## Procedure
1. Choose the narrowest spec selection that still validates the change.
2. Add the requested browser project or grep filter only when needed.
3. Prefer Chromium first unless the user asked for another browser.
4. Report the exact command and the result.

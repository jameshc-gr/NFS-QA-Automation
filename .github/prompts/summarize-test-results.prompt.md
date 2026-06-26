---
description: "Summarize Playwright test output, isolate the likely failure, and recommend the next check."
name: "Summarize Test Results"
argument-hint: "[test output | report path]"
agent: "playwright-test-orchestrator"
---
Summarize the provided Playwright results.

Focus on:
- Which tests passed and failed
- The most likely failure category: selector, timing, data, or environment
- The smallest next check that would confirm or disprove the hypothesis

Keep the response concise and actionable.

---
description: "Summarize Playwright test output, isolate the likely failure, and recommend the next check."
name: "Summarize Test Results"
argument-hint: "[test output | report path]"
agent: "playwright-test-orchestrator"
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 3 - Fast Log Parsing & Summary)
---
Summarize the provided Playwright results.

Focus on:
- Which tests passed and failed
- The most likely failure category: selector, timing, data, or environment
- The smallest next check that would confirm or disprove the hypothesis

Keep the response concise and actionable.

## Expected Output
- `Result`: pass/fail totals
- `Diagnosis`: likely category with confidence
- `Next Check`: one focused command or file to inspect

## Constraints
- Prefer evidence-based diagnosis only
- Recommend narrow checks before broad reruns

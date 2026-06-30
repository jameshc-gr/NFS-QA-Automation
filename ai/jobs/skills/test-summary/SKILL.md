---
name: test-summary
description: 'Summarize Playwright test output, isolate the likely failure cause, and suggest the next narrow check.'
argument-hint: 'Summarize test output'
---

# Test Summary

Use this skill to turn raw Playwright output into a short diagnosis.

## When to Use
- Tests fail and you need a concise explanation
- You want to separate selector issues from timing or data problems
- You need the next best command after a failing run

## Procedure
1. Identify the failed tests and the failure pattern.
2. Classify the likely cause as selector, timing, data, environment, or app behavior.
3. Recommend the smallest follow-up check.
4. Keep the summary short and specific.

## Inputs
- Playwright terminal output or report path
- Optional recent command details

## Output Contract
- Passed count and failed count
- Failure category with confidence
- One narrow follow-up command

## Guardrails
- Do not over-diagnose without evidence
- Keep recommendations reproducible and minimal

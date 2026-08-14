---
name: Example Prompt
description: "What this prompt does"
argument-hint: "[required args] [optional flags]"
agent: "playwright-test-orchestrator"
model: gpt-4o-mini
# Economical Model Options:
# Tier 2/3 (Default): gpt-4o-mini | claude-3.5-haiku | gemini-2.0-flash (Fast Execution & Parsing)
# Tier 1 (Complex Reasoning): claude-3.5-sonnet | gpt-4o (Deep Failure Analysis)
---

Use this prompt for: [short purpose].

## Inputs
- Input A
- Input B

## Steps
1. Validate inputs.
2. Execute the smallest useful action.
3. Return result with evidence.

## Expected Output
- Commands executed
- Pass/fail summary
- Next recommended action

## Constraints
- Keep scope narrow by default.
- Use repository conventions from README.

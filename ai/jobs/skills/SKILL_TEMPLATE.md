---
name: example-skill
description: "One-line purpose of this skill"
argument-hint: "What the caller should provide"
model: gpt-4o-mini
# Economical Model Options:
# Tier 2/3 (Default): gpt-4o-mini | claude-3.5-haiku | gemini-2.0-flash (Fast, Low Token Cost)
# Tier 1 (Complex Reasoning): claude-3.5-sonnet | gpt-4o (Deep Diagnosis & Healing)
---

# Example Skill

## When to Use
- Condition 1
- Condition 2

## Inputs
- Required input A
- Optional input B

## Procedure
1. Gather minimal context.
2. Perform the narrowest valid action.
3. Return concise result + next check.

## Output Contract
- Include matched files/commands.
- Include assumptions.
- Include next recommended action.

## Guardrails
- Do not broaden test scope prematurely.
- Do not use brittle selectors when role/testid exists.

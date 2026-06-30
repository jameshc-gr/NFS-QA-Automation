---
name: test-discovery
description: 'Find the relevant Playwright spec files in tests/ for a requested flow, profile, or regression.'
argument-hint: 'Discover the best test files'
---

# Test Discovery

Use this skill to identify the narrowest and most relevant Playwright test files before running anything.

## When to Use
- A user asks which specs cover a feature or flow
- You need the smallest useful test subset for a regression check
- You want to map a profile family to the likely spec files

## Procedure
1. Inspect the `tests/` folder and the naming pattern.
2. Match the requested flow to the closest existing profile or scenario file.
3. Prefer one or two precise specs over a broad suite when possible.
4. Report the matching files and why they are the best fit.

## Inputs
- Feature or user flow description
- Optional profile family (`LK`, `LK_CD`, `LK_NC`, `LK_IN`, `ER_*`)
- Optional target browser or execution constraints

## Output Contract
- Return the top matching spec files (1-3 max)
- Include why each file matches the request
- Include one recommended narrow command to run first

## Guardrails
- Do not recommend full-suite runs before focused runs
- Do not return generated files unless explicitly requested

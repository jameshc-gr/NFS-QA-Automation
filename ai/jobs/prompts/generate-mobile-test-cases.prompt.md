---
name: "Generate Mobile Test Cases"
description: "Create review-first mobile test case Markdown files, then generate WDIO TypeScript specs after approval."
argument-hint: "[feature|screen] [platform=android|ios] [count] [phase=plan|implement] [target-folder]"
agent: "mobile-test-generator"
---
Generate mobile tests using a two-phase workflow.

## Inputs
- Feature or screen area (for example `auth`, `create-account`, `forgot-password`)
- Platform (`android` default)
- Number of test cases
- Phase:
  - `plan`: generate or update `.md` files only
  - `implement`: generate `.ts` tests from approved `.md` files
- Optional target folder (default `ai/tests/mobile`)

## Steps
1. Discover existing page objects, selectors, and mobile specs.
2. In `plan` phase, create one `.md` file per test case under `ai/tests/mobile`.
3. Wait for review/approval signal.
4. In `implement` phase, generate `.ts` WDIO tests from approved `.md` cases.
5. Save generated specs under `mobile/tests/android/generated/` unless caller provides a different path.

## Expected Output
- Files created/updated
- Summary of covered scenarios
- Any assumptions, gaps, or open questions

## Constraints
- Do not generate `.ts` specs during `plan` phase.
- Keep one test case per Markdown file.
- Reuse existing page objects where possible.
- Follow repo conventions from `readme.md`.

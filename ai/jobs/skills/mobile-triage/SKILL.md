---
name: mobile-triage
argument-hint: 'Diagnose a failed mobile test step'
description: 'Extract a concise diagnostic bundle from mobile test failures and classify the root cause without loading full logs into context.'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 3 - Fast Log Parsing & Failure Classification)
---

# Mobile Triage Skill

Use this skill after a WebdriverIO/Appium mobile test fails to produce a small, actionable diagnostic payload for the `mobile-test-healer` agent.

## When to Use

- A mobile spec failed and you need to understand why.
- You want to avoid feeding multi-thousand-line Appium logs into an LLM.
- You need a failure classification (selector, timing, verification, app crash, infra) before attempting a fix.

## Inputs

- Test file path and test title.
- Path to the spec log, Allure results, or `test-results/` run folder.
- Optional: platform (`android` | `ios`) and environment (`qa` | `stage` | `prod`).

## Procedure

1. **Locate Artifacts**:
   - Find the most recent `test-results/YYYY-MM-DD/mobile/<run>/` folder.
   - Collect: `wdio.log` (or stdout), Allure result JSON, screenshot PNG, and any page-source XML dumps.

2. **Extract Failure Slice**:
   - Filter the log for the failing test title.
   - Capture the last 30 lines before the assertion error and the stack trace.
   - Pull the final page source/hierarchy dump if present.

3. **Classify Root Cause**:

   | Classification | Indicators |
   | :--- | :--- |
   | `selector` | `no such element`, `stale element reference`, selector timeout, element not found by XPath/id |
   | `timing` | Element found but not interactable, `ElementClickIntercepted`, animation/keyboard overlay |
   | `verification` | OTP/email/SMS timeout, `Could not find verification code`, Guerrilla Mail/Outlook/G-Voice failure |
   | `app-crash` | Native crash log, ANR, `session terminated`, `disconnected from app` |
   | `infra` | Appium server error, `ECONNREFUSED`, emulator/simulator not booted, build artifact missing |
   | `data` | Wrong credentials, account already exists, environment mismatch assertion |

4. **Build Diagnostic Bundle**:
   - Return a JSON object with:
     - `testFile`, `testTitle`
     - `failureType`
     - `errorMessage` (one line)
     - `failingSelector` (if any)
     - `lastSuccessfulStep`
     - `screenshotPath`
     - `logSlice` (≤ 300 lines)
     - `recommendedAction`

5. **Recommend Next Step**:
   - `selector` → invoke `mobile-test-healer` with selector registry path.
   - `timing` → invoke `mobile-test-healer` to add polling/wait.
   - `verification` → trigger resend/retry protocol or switch to mock mode.
   - `app-crash` / `infra` → capture device logs and restart session; do not patch test code.
   - `data` → update test data/account pool and rerun only the failed step.

## Output Contract

- One short diagnostic bundle (target < 500 tokens).
- Clear failure classification.
- One concrete next action for the healer or orchestrator.

## Guardrails

- Do not return the entire log unfiltered.
- Do not attempt to fix code; only diagnose and route.
- If classification is uncertain, return `unknown` and request a rerun with `MOBILE_LOG_LEVEL=debug`.

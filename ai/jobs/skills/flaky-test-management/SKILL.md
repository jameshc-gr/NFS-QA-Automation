---
name: flaky-test-management
description: 'Identify, isolate, diagnose, and repair flaky tests across Web, Mobile, and API suites using memory tracking and resilient auto-healing strategies.'
argument-hint: 'Diagnose and quarantine flaky tests'
model: claude-3.5-sonnet
# High-Reasoning Model: claude-3.5-sonnet / gpt-4o (Tier 1 - Required for Race Condition Isolation & Self-Healing Logic)
---

# Flaky Test Management Skill

Use this skill to detect, quarantine, diagnose, and eliminate flaky tests across all automation layers.

## When to Use
- A test passes intermittently or fails randomly in CI/CD without code changes
- Isolating state leakage, race conditions, dynamic element timing, or environment instability
- Recording flaky test metadata in `memory/flaky-tests.json` or applying quarantine status (`test.fixme` / `test.skip`)
- Applying resilience patterns (Playwright auto-waiting, resilient WebdriverIO retries, state resetting)

## Inputs
- Test file path and test name
- Failure logs, run history, or flake rate
- Target environment (`qa`, `stage`, `prod`)

## Procedure
1. **Detect & Verify Flakiness**:
   - Run the suspect test repeatedly (e.g. 5-10 iterations) to reproduce the flake:
     `npx playwright test tests/projects/student-loan-refi/LK1.spec.ts --repeat-each=5`
2. **Analyze Root Cause of Flakiness**:
   - **Timing / Race Condition**: Missing await, reliance on hardcoded `page.waitForTimeout()`, non-atomic dynamic DOM rendering.
   - **State Leakage**: Test depends on data created by a previous test or leaves dirty browser state/cookies.
   - **Element Volatility**: Dynamic selector (generated IDs, non-deterministic class names).
   - **Environment/Network Flakiness**: Slow API backend or intermittent network timeout.
3. **Apply Resilient Fixes**:
   - Replace explicit `waitForTimeout()` with web-first assertions (`expect(locator).toBeVisible()`).
   - Use role-based locators (`getByRole`) or stable test IDs over brittle CSS/XPath.
   - Ensure clean test isolation (`beforeEach` state reset / context isolation).
4. **Quarantine or Track in Memory**:
   - Record flaky test details in `memory/flaky-tests.json`.
   - If a fix cannot be immediately applied, temporarily mark with `test.fixme` and log the issue ticket key.

## Output Contract
- Flakiness diagnostic report (reproduction rate, root cause classification)
- Refactored code snippet with resilient pattern applied
- Updated `memory/flaky-tests.json` tracking entry

## Guardrails
- Never increase test retries as a permanent substitute for fixing flaky test logic.
- Avoid using arbitrary `page.waitForTimeout()` sleeps to fix timing issues.

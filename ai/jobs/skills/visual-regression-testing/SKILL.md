---
name: visual-regression-testing
description: 'Visual regression testing patterns, screenshot baseline comparison, dynamic element masking, and threshold management using Playwright and WebdriverIO.'
argument-hint: 'Execute or design visual regression tests'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 2/3 - Fast Masking & Diff Evaluation)
---

# Visual Regression Testing Skill

Use this skill to design, execute, and maintain visual regression tests across Web and Mobile applications.

## When to Use
- Validating UI layout, alignment, typography, and styling consistency
- Comparing component or page screenshots against established baselines (`toHaveScreenshot`)
- Masking dynamic content (timestamps, usernames, randomized data, ads, videos)
- Updating visual baselines or troubleshooting visual snapshot diffs

## Inputs
- Target page, component, or spec file (`tests/projects/...` or `mobile/tests/...`)
- Snapshot threshold tolerance (`maxDiffPixels`, `maxDiffPixelRatio`, `threshold`)
- Element selectors to mask or hide (`mask: [page.locator(...) ]`)

## Procedure
1. **Configure Visual Assertions**:
   - Web (Playwright): Use `expect(page).toHaveScreenshot('homepage.png', { maxDiffPixelRatio: 0.05, mask: [page.locator('.timestamp')] })`.
   - Mobile (WDIO): Use `expect(await driver.checkScreen('home-screen')).toBeLessThan(0.05)`.
2. **Mask Dynamic Content**:
   - Always mask elements that change between test runs: dates, dynamic user IDs, live tickers, videos, animated banners.
   - For web, use the `mask` option in `toHaveScreenshot`.
   - For CSS animations, disable animations before taking screenshots (`animations: 'disabled'`).
3. **Execute & Inspect Visual Tests**:
   - Run visual spec: `npx playwright test tests/projects/student-loan-refi/visual.spec.ts`
   - Review failed diffs in `test-results/` (actual, expected, diff images).
4. **Baseline Management**:
   - To update baseline images after intentional UI changes, run with `--update-snapshots`:
     `npx playwright test --update-snapshots`

## Output Contract
- Visual comparison result (Matched / Mismatched)
- Diff ratio and pixel difference count if mismatched
- Diff artifact file paths saved under `test-results/`
- Action recommendation (Update baseline or fix UI regression)

## Guardrails
- Never commit broken visual snapshot diffs.
- Always mask unpredictable or dynamic data elements before taking screenshots.
- Store all visual artifacts under `test-results/` (gitignored).

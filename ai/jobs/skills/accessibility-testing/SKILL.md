---
name: accessibility-testing
description: 'Automated accessibility auditing using axe-core and @axe-core/playwright to enforce WCAG 2.1 AA compliance, ARIA standards, and color contrast.'
argument-hint: 'Audit page accessibility compliance'
---

# Accessibility Testing Skill

Use this skill to perform automated accessibility (a11y) audits across Web pages and UI components.

## When to Use
- Scanning web pages or flows for WCAG 2.1 Level A/AA accessibility violations
- Validating ARIA labels, role attributes, form field labels, and color contrast ratios
- Generating accessibility audit reports for compliance tracking

## Inputs
- Target URL or Playwright page context
- Target WCAG standard tags (e.g. `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`)
- Optional target container selector (e.g. `main`, `#app`, `.modal`)

## Procedure
1. **Integrate Axe Builder**:
   - Import `AxeBuilder` from `@axe-core/playwright`.
   - Initialize scanner:
     ```ts
     const accessibilityScanResults = await new AxeBuilder({ page })
       .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
       .analyze();
     ```
2. **Scan & Assert Compliance**:
   - Assert zero critical/serious violations:
     `expect(accessibilityScanResults.violations).toEqual([]);`
3. **Analyze Violations**:
   - Extract impact level (`critical`, `serious`, `moderate`, `minor`).
   - Identify target DOM nodes, HTML snippet, help URL, and remediation steps.
4. **Generate Audit Summary**:
   - Output formatted accessibility report detailing passing checks and violation breakdown.

## Output Contract
- Total violations count grouped by impact (`critical`, `serious`, `moderate`, `minor`)
- Detailed list of violating elements, rule IDs (e.g. `color-contrast`, `label`, `button-name`), and remediation links
- Pass/Fail assertion decision

## Guardrails
- Automated accessibility scanners cover ~30-40% of WCAG guidelines; pair with manual keyboard navigation checks when necessary.
- Exclude third-party embedded widgets (if unconfigurable) using `.exclude('.third-party-widget')`.

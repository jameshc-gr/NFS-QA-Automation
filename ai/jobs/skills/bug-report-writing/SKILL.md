---
name: bug-report-writing
description: 'Root cause analysis, failure categorization, and standardized Jira bug report generation.'
argument-hint: 'Draft a bug report from test failure'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 3 - Fast Defect Formatting & Log Structuring)
---

# Bug Report Writing Skill

Use this skill to analyze test failures, perform root cause analysis, and format standardized Jira bug reports.

## When to Use
- A test run fails and requires root cause analysis or defect logging
- Triage flaky or failing web, mobile, or API test cases
- Generating Jira-ready defect reports matching repository standards

## Inputs
- Test failure output, stack trace, or terminal log
- Screenshot / XML page source / network log path from `test-results/` or `mobile/.builds/`
- Component / project area (e.g. `Student Loans`, `FAL`, `MSAM`)

## Procedure
1. **Root Cause Analysis (RCA)**:
   - Categorize failure type:
     - **Selector / UI Change**: Element missing, changed accessibility ID, ambiguous XPath.
     - **Timing / Race Condition**: Element not clickable/visible within timeout.
     - **Test Data / Validation**: Password rule violation, invalid email domain, expired session.
     - **Application Defect**: Backend HTTP 500, crash, incorrect UI calculation or state.
2. **Isolate Reproduction Steps**:
   - Verify minimal reproducible steps, exact environment (`qa`, `stage`, `prod`), build version, and platform.
3. **Format Bug Report (Jira Style)**:
   - Summary format: `[SLF] <Concise bug title>` or `[FAL] <Title>`
   - Sections:
     - **Classification**: Defect / Flaky Test / Environmental Block
     - **Environment**: OS, Browser/Device, Build version, Environment (`qa`/`prod`)
     - **Steps to Reproduce**: Numbered, precise user steps
     - **Observed Result**: Exact UI text, error message, or behavior seen
     - **Expected Result**: Expected business logic or UI state
     - **Attachments**: Screenshot path, trace file, or XML dump link
4. **Proofread**:
   - Verify spelling and clarity (e.g. `Wealth` not `Weatlh`, `uses` not `ues`).

## Output Contract
- Standardized Jira-ready Markdown bug report.
- One-line classification summary and recommended next action for QA/Dev team.

## Guardrails
- Always distinguish between framework test code bugs and actual application defects.
- Include exact observed text and error codes from logs — never paraphrase error messages.

---
name: test-plan-generation
description: 'Transform requirements, Jira tickets, or user stories into structured, reviewable test plans and test case specifications.'
argument-hint: 'Generate test plans and test specifications'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 2 - Efficient Requirements Extraction & Spec Formatting)
---

# Test Plan Generation Skill

Use this skill to convert requirements, feature requests, or Jira tickets into structured Markdown test specifications before writing code.

## When to Use
- A user asks to plan testing for a new feature, API endpoint, or mobile screen
- Creating a comprehensive test plan prior to test code generation
- Reviewing test coverage against business requirements or Jira user stories

## Inputs
- Requirement text, Jira issue summary/key (e.g. `FAL-3131`, `MSAM-7880`), or design specification
- Target layer (`web`, `mobile`, `api`)
- Target project (`student-loan-refi`, `student-IDR`, `mobile-app`)

## Procedure
1. **Analyze Requirements & Journeys**:
   - Extract primary happy path user flows.
   - Identify edge cases, boundary conditions, error handling, and validation rules.
   - Determine required test data, environments, and prerequisite states.
2. **Draft Test Plan Specification**:
   - Structure as a Markdown file in `specs/` or `ai/tests/mobile/`.
   - Include: Objective, Scope, Test Environments, Prerequisites, Risk Matrix.
3. **Detail Test Cases**:
   - For each test case, define: Test Case ID, Title, Description, Preconditions, Test Steps, Expected Results, Test Data Requirements.
4. **Review & Handoff**:
   - Review against framework locator and data guidelines.
   - Handoff test plan to the appropriate test generator agent (`playwright-test-generator` or `mobile-test-generator`).

## Output Contract
- Structured Markdown test plan document in `specs/<project>-plan.md` or `ai/tests/<layer>/tc-<feature>.md`.
- Summary of test case count, coverage types (Functional, Validation, UI, Security), and risk areas.

## Guardrails
- Keep test specifications human-readable and decoupled from raw implementation code.
- Ensure every test step includes an explicit, verifiable assertion.

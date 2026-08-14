---
name: test-data-engineer
description: 'Secure, environment-aware test data generation and account management across Web, Mobile, and API testing.'
argument-hint: 'Generate or resolve test data'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 3 - Fast Data Formatting & Validation Rule Enforcement)
---

# Test Data Engineer Skill

Use this skill to generate compliant, environment-aware test data and manage automation test account registries.

## When to Use
- Generating new user signup profiles (email, first/last name, password, SSN, address)
- Resolving fixed automation accounts for login tests
- Ensuring test data meets app validation rules across environments (Dev, Stage, QA, Prod)
- Tagging email addresses and phone numbers for automated OTP retrieval

## Inputs
- Target environment (`prod`, `qa`, `stage`, `dev`)
- Test scope (`createUser`, `login`, `api`, `webProfile`)
- Target platform (`web`, `mobile`, `api`)

## Procedure
1. **Name & Password Rules**:
   - **CRITICAL**: Never use the word "test" (case-insensitive) in first name, last name, or email local part when using the default password `Test123!`. The app password validator rejects passwords that contain parts of the user's name or email.
   - Always use realistic human names (e.g., `Jordan Smith`, `Alex Rivera`, `Morgan Taylor`).
2. **Email Formatting & Tagging**:
   - **PROD Mobile Create-User**: Must use `--ra` tag and Guerrilla Mail domain: `my-rateapp-auto<6digits>--ra@sharklasers.com`. The `--ra` tag bypasses server-side domain allowlist restrictions.
   - **QA/Dev Mobile Create-User**: Use Outlook alias: `v3test+auto<6digits>@rate.com` (redirects to shared inbox `v3test@rate.com`).
   - **Web / Refi Profiles**: Use suffix-based env vars (`FIRST_NAME_LK1`, `ADDRESS_LK_CD1`) loaded via `test-setup.ts`.
3. **Fixed Shared Accounts**:
   - Prod Fixed Login: `my-rateapp-jc0020--ra@yopmail.com` / `Test123!`
   - Non-Prod Shared Login: `myaccount-suapp-jc0015@yopmail.com` / `Test123!`
4. **Phone Numbers**:
   - Use Google Voice fixed automation number: `616-320-0701` for SMS OTP verification.

## Output Contract
- Valid account object or profile payload
- Environment compliance verification
- OTP channel mapping details

## Guardrails
- Never hardcode user passwords in plain text outside configuration files.
- Always update test account registries (`login.yml`, `config.yml`, `memory/`) when creating persistent accounts.

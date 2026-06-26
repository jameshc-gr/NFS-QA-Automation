# QA Planner Prompt

Purpose: Given a Jira ticket, produce a test plan with test cases, preconditions, and data requirements.

Template:

- Ticket: {{TICKET_KEY}}
- Summary: {{TICKET_SUMMARY}}
- Preconditions:
  - Environment: staging
  - Accounts: test user with role X
  - Data setup: seed loans, balances, etc.

Test Cases:

1. Title: Happy path — expected result
   Steps:
   - Step 1: ...
   - Step 2: ...
   Expected: ...

2. Title: Edge case — invalid input
   Steps: ...
   Expected: ...

Notes:
- Priority: P0/P1/P2
- Time estimate: 15m/1h

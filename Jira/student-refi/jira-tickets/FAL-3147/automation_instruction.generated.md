# Automation Instructions (Generated) — FAL-3147

Goal: Create Playwright tests to validate field order, presence of "Existing mortgage amount", checkbox defaults, and basic validation.

Files to generate:
- tests/generated/FAL-3147.field-order.spec.ts
- tests/generated/FAL-3147.existing-mortgage.spec.ts

Suggested Playwright Steps:
1) Field order test:
   - goto BASE_URL/login and sign in as LO
   - navigate to inquiry form
   - capture headings and assert order

2) Existing mortgage validations:
   - ensure field exists
   - attempt submit empty -> expect validation error
   - enter invalid text -> expect validation
   - enter valid numeric -> expect success on submit

Notes:
- Use environment variable `BASE_URL` for target site.
- Use `test.use({ viewport: { width: 1280, height: 800 } })` for desktop and set `isMobile` viewport for mobile checks.

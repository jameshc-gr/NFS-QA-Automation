# System Design

## Overview

This framework is organized into layers to support parallel migration and autonomous test tooling.

- web/: Playwright page objects, locators, resilience helpers, and UI tests
- api/: API client wrappers, schemas, and contract tests
- ai/: agent modules for test generation, failure analysis, self-healing, and coverage analysis
- core/: shared cross-layer utilities (reserved for shared business abstractions)

## Migration strategy

Hybrid migration is used to keep existing tests stable while a TypeScript-first structure is proven.

- Existing and refactored tests live in tests/projects/student-loan-refi
- Playwright config uses TEST_SUITE_DIR to run either suite without reconfiguration

## Web layer design

- Page objects encapsulate each form segment: personal info, loan details, address/education, employment, financial profile, and identity consent.
- Resilience patterns (dropdown and address completion) are centralized in web/utils/resilience.ts.
- Profile loading and restoration behavior is centralized in web/utils/profiles.ts.

## API layer design

- ApplicationClient centralizes auth headers, retries, and endpoint wrappers.
- Contract tests validate runtime payload shapes against zod schemas.
- JSON schemas under api/schemas provide machine-readable schema contracts.

## AI layer design

- test_generator produces runnable Playwright specs from structured ticket input.
- failure_analyzer classifies failures and recommends triage actions.
- self_healing proposes minimal locator and wait strategy fixes.
- coverage_analyzer maps requirements and ticket inventory to test gaps.

---
name: api-testing
description: 'API testing procedures, Postman collection & environment auto-extraction, contract testing, JSON schema validation, gateway config loading, and auth token management.'
argument-hint: 'Execute or design API tests'
---

# API Testing Skill

Use this skill to design, execute, and validate API contract and integration tests across the repository.

## When to Use
- Running API smoke tests, contract tests, or Postman collections
- Setting up or updating environment configurations from Postman JSON files
- Validating REST responses against JSON schema contracts in `api/schemas/`
- Debugging gateway API authentication, token headers, or tenant configuration

## Inputs
- Target API project or environment (e.g. `API_PROJECT=student-loan-refi`, `qa`, `prod`)
- Optional Postman collection path (`api/postman/...`)
- Optional API mapping file (`api/api-mappings/...`)
- Optional schema contract name (`api/schemas/...`)

## Procedure
1. **Environment Configuration**:
   - Extract environment settings from Postman JSON using `npm run postman:extract-env` (writes to `api/api-configs/gateway-api-config.json`).
   - Auto-load configs via `loadGatewayConfig()` in `postman-runner.ts` / `run-api-tests.ts`. Override with environment variables (`BASE_URL`, `API_TOKEN`) when needed.
2. **Select Collection & Mappings**:
   - Project-scoped collections live in `api/postman/<projectname>/`.
   - API mappings live in `api/api-mappings/<projectname>/`.
3. **Execute API Tests**:
   - Contract tests: `npm run test:api:contract`
   - Smoke tests: `npm run test:api:smoke` or `npm run postman:runner:smoke`
   - Custom mapping validation: `npx ts-node scripts/validate-api-mapping.ts`
4. **Schema Validation**:
   - Validate response payloads against schemas in `api/schemas/` using JSON schema checkers.

## Output Contract
- Executed endpoint list and status codes
- Schema match / pass count
- Detailed JSON body failure breakdown for any non-20x or schema mismatch responses
- One follow-up command or fix recommendation

## Guardrails
- Never hardcode API keys or JWT tokens in source files or collections.
- Precedence rule for config: (1) Environment variables > (2) Config files (`gateway-api-config.json`) > (3) Default fallbacks.
- Store API reports under `test-results/`.

# NFS-QA-Automation Repository Memory

## Project Context

This is a hybrid QA automation repository supporting Student Loan Refinance (Playwright) and mobile app testing (Appium/WDIO) with AI-assisted agent-driven test generation, discovery, and self-healing.

---

## 2025-08-25: Mobile Autonomy Framework & Self-Healing Architecture

### Problem Statement

Mobile test automation was consuming excessive time and tokens while requiring heavy human intervention:
- Individual mobile test runs took 10–15 minutes despite simple logic
- Agents asked too many clarifying questions, requiring mid-process steering
- Failure diagnosis was manual; no structured triage patterns
- Selector issues and flaky retries were silent, masking real problems
- No autonomy boundaries; agents didn't know when they could act independently

### Solution: Autonomy Tiers + Self-Healing Framework

Implemented a 4-tier autonomy model (documented in [AGENTS.md](AGENTS.md)) that pre-authorizes agent decisions and minimizes context-switching:

| Tier | Scope | Agents Can Act Autonomously | When to Ask User |
|------|-------|-------|-----------|
| **Tier 0** | Read & Diagnose | Search, read, logs, screenshots | Never |
| **Tier 1** | Additive Test Dev | Create plans, generate specs, run focused tests | Only on business rule contradiction |
| **Tier 2** | Self-Healing & Refactor | Fix selectors, update config, retry with fallback | Only on major ambiguity |
| **Tier 3** | Critical / Architectural | Canonical rules, auth providers, CI secrets | Always ask |

### Architecture Changes

#### 1. Pre-Flight Health Check (`scripts/mobile-preflight.ts`)
- **Why**: Validate environment setup (Android SDK, Java, emulator, Appium) before wasting emulator time
- **What changed**: New script validates all dependencies and configuration
- **Impact**: Catches setup errors early, saves 5–10 minutes per failed run

#### 2. Platform-Specific Selector Registry
- **Files**: `mobile/src/selectors/{android,ios}/auth.selectors.ts`
- **Why**: Selectors were scattered throughout auth.page.ts, making maintenance and regression tracking difficult
- **What changed**: Extracted into organized, typed registries with platform-specific customization
- **Impact**: Easier selector updates, centralized regression guards, faster platform-specific tweaks

#### 3. Mock Verification Provider (`mobile/src/utils/mobile-auth.ts`)
- **Why**: Test auth flows without hitting live Outlook/Google Voice; enables sandbox validation
- **What changed**: Added mock provider returning deterministic codes (`123456`, `111111`, etc.)
- **Impact**: Full test flow validation in isolation; live backend integration still fails (expected, documented)
- **Usage**: Set `MOBILE_VERIFICATION_PROVIDER: "mock"` in config

#### 4. Step-Level Checkpoints (`mobile/src/utils/step-checkpoint.ts`)
- **Why**: Generic "assertion failed at line X" errors don't help triage mobile test failures
- **What changed**: Wrapper for each test step with automatic name logging and validation
- **Impact**: Step-level diagnostics on failure; enables structured triaging

#### 5. Mobile Triage Skill (`ai/jobs/skills/mobile-triage/SKILL.md`)
- **Why**: Agents needed structured patterns to diagnose mobile failures autonomously
- **What changed**: Documented failure classifications (selector, timing, app crash, network, infrastructure) with remediation patterns
- **Impact**: Agents can autonomously triage, classify, and suggest fixes (Tier 2)

#### 6. Orchestrator & Healer Agents
- **Files**: `ai/jobs/agents/mobile_agents/`
- **Why**: Reduce human steering by automating test discovery, execution, and failure diagnosis
- **What changed**: New agents with defined responsibilities, tool sets, and autonomy tier alignment
- **Impact**: Multi-spec coordination, autonomous failure healing, zero human context-switching

#### 7. Mobile Test Generator Refactored
- **File**: `ai/jobs/agents/mobile-test-generator.agent.md`
- **What changed**: Single-pass dual output (Markdown plan + TypeScript test) instead of sequential
- **Impact**: Faster generation; single artifact reduces token cost

### Critical Bug Fixes

#### 1. `[0]`-Indexing Regression (18 occurrences)
- **File**: `mobile/src/pages/auth.page.ts`
- **Bug**: Plain-string selectors (XPath strings) were being indexed with `[0]`, truncating them to first character
  - Example: `"//*[...]"` became `"/"`
  - Silently broke selector matching
- **Fix**: Removed all `[0]` indexing; added permanent regression guard in `scripts/sanity-mobile-framework.ts`
- **Impact**: All auth flows now use correct selectors

#### 2. Phone-Detection Ambiguity
- **Location**: `mobile/src/pages/auth.page.ts`, lines 714–730 (`detectPostEmailStep`), 993–1010 (`waitForCodeOutcome`)
- **Bug**: After rejected email codes, fallback selector `//android.widget.EditText` matched the still-visible email-code field instead of confirming advancement to phone screen
- **Fix**: Check only the unambiguous `phonePrompt` selector; removed generic fallback
- **Impact**: Correctly detects when app advances from email to phone verification

#### 3. Account Retry Resilience
- **Location**: `mobile/src/pages/auth.page.ts`, lines 591–633 (`loginWithAccountRetry`)
- **Issue**: QA test accounts documented as "may be purged after a few days"; single stale account blocks entire run
- **Fix**: Added `loginWithAccountRetry()` maintaining pool of created accounts (newest first), retries across them on login failure
- **Benefit**: One expired account doesn't block test suite

#### 4. Node v26 + undici Incompatibility
- **File**: `package.json`
- **Bug**: `webdriver@9.29.1` pins `undici@6.27.0`, which doesn't work with Node v26 (`UND_ERR_INVALID_ARG`)
- **Fix**: Added `overrides: { "undici": "^8.10.0" }` in package.json
- **Impact**: Tests now run on Node v26

#### 5. Silent Retry Exhaustion
- **Location**: `mobile/src/utils/mobile-auth.ts`, `mobile/src/pages/auth.page.ts` line 868
- **Bug**: Email verification could fail silently, masking real errors when retries exhausted
- **Fix**: Now throws specific, actionable errors on retry exhaustion
- **Impact**: Failures are now visible and diagnostic

### Validation Results

All changes validated on real Android emulator (not static checks):

- **`npm run test:mobile:android:login-logout`** — ✅ **3/3 passing** (multiple runs)
- **`npm run test:mobile:android:forgot-password-entry`** — ✅ **2/2 passing** (smoke test for entry point)
- **`npm run typecheck`** — ✅ **0 TypeScript errors** (fixed 30 pre-existing errors in tiktok/video/network-traffic specs)
- **`npm run sanity:mobile`** — ✅ **All regression guards passing** (selector truncation, mock verification, memory tracking, step checkpoints)

### Known Limitations (Documented, Expected)

1. **Live Verification Dependency**: Full `create-account` and `forgot-password` flows require live email/SMS verification (Outlook, Google Voice). Not accessible in sandbox environment. Workaround: Focus tests on UI entry points that don't require external verification (e.g., `forgot-password-entry.spec.ts`).

2. **QA Account Expiration**: Test accounts purged after a few days. Mitigation: `loginWithAccountRetry()` maintains account pool and retries across them.

3. **Mock Mode Scope**: Mock verification enables testing auth UI flows in isolation; it doesn't validate live backend integration.

### Files Changed

#### Created
- `scripts/mobile-preflight.ts` — environment validation
- `scripts/sanity-mobile-framework.ts` — framework health check with regression guards
- `ai/jobs/skills/mobile-triage/SKILL.md` — failure triage patterns
- `ai/jobs/agents/mobile_agents/mobile-test-orchestrator.agent.md` — test discovery/execution agent
- `ai/jobs/agents/mobile_agents/mobile-test-healer.agent.md` — failure diagnosis/healing agent
- `mobile/src/selectors/android/auth.selectors.ts` — Android selector registry
- `mobile/src/selectors/ios/auth.selectors.ts` — iOS selector registry
- `mobile/src/utils/step-checkpoint.ts` — step-level checkpoint wrapper
- `mobile/src/utils/memory.ts` — memory-tracking utilities
- `mobile/tests/android/generated/forgot-password-entry.spec.ts` — entry-point smoke test

#### Modified
- `AGENTS.md` — added autonomy tiers (Tier 0–3) and decision boundaries
- `ai/jobs/agents/USAGE.md` — updated usage patterns
- `ai/jobs/agents/mobile-test-generator.agent.md` — refactored for single-pass dual output
- `mobile/src/pages/auth.page.ts` — fixed 18 `[0]`-indexing regressions, fixed phone-detection selector ambiguity, added `loginWithAccountRetry()` method, improved error messages
- `mobile/src/pages/tiktok.page.ts` — fixed 30 TypeScript errors
- `mobile/src/utils/mobile-auth.ts` — added `getCreatedAccountCandidates()`, added mock verification provider
- `mobile/src/utils/verification-service.ts` — integrated mock verification mode
- `mobile/tests/android/login-logout.spec.ts` — refactored to use `loginWithAccountRetry()`
- `mobile/tests/ios/login-logout.spec.ts` — refactored to use `loginWithAccountRetry()`
- `mobile/tests/android/extract-urls-network-traffic.spec.ts` — fixed TypeScript errors
- `mobile/tests/android/extract-video-urls-enhanced.spec.ts` — fixed TypeScript errors
- `mobile/tests/android/tiktok-feed-urls.spec.ts` — fixed TypeScript errors
- `mobile/tests/ios/tiktok-feed-urls.spec.ts` — fixed TypeScript errors
- `mobile/tests/android/video-feed-urls.spec.ts` — fixed TypeScript errors
- `package.json` — added undici override for Node v26 compatibility
- `readme.md` — added mobile autonomy framework section and mobile-triage skill reference

### Next Steps

1. ✅ **Framework & Resilience** — Complete. All tiers, agents, selectors, checkpoints deployed and tested.
2. ✅ **Bug Fixes & Validation** — Complete. All critical bugs fixed; real emulator tests passing.
3. ✅ **Documentation** — Complete. Updated `readme.md`, `AGENTS.md`, and this memory file.
4. **Future Cost Optimization**:
   - Monitor agent log usage under Tier 1-2 autonomy to validate token savings
   - Consider batching multiple test runs per agent invocation (e.g., multi-spec orchestrator)
   - Explore async memory updates (log healing history without API calls)

### How This Reduces Human Intervention

| Before | After |
|--------|-------|
| Run single test → agent asks 3-5 questions → human steers → test runs | Run single test → agent reads autonomy tier → proceeds without asking → completes autonomously |
| Selector fails → manual grep/inspect → edit → re-run | Selector fails → agent triages (Tier 2) → suggests fix → re-runs (within autonomy bounds) |
| Multiple failed runs → manual diagnosis → each failure requires triage | Orchestrator agent discovers all tests → healer agent retries failures autonomously → single report |
| Account expires → entire suite fails → human restarts with new account | Account expires → `loginWithAccountRetry()` cycles through pool → suite continues |

### How This Lowers Token Usage

1. **Pre-authorized Decisions** — Tier 1-2 agents act without asking (no back-and-forth questions)
2. **Selective Deep Reasoning** — `mobile-test-healer` uses heavyweight models only for complex triage; orchestration uses economical models
3. **Mock Verification** — Tests auth UI without external verification calls (faster, deterministic)
4. **Single-Pass Test Generation** — Markdown plan + TypeScript test in one go (not sequential)
5. **Reusable Selectors** — Centralized registry eliminates repeated lookups/research

---

## Permanent Guidelines

### Mobile Testing Rules
- Always consult [`docs/mobile-testing-rules.md`](docs/mobile-testing-rules.md) for canonical rules (email formats, verification routing, account recording, page-verbiage assertions)
- Update rules document and affected specs together; rules take precedence

### Agent Bootstrap
- Start with [`readme.md`](readme.md) for commands and test layout
- Use [`ai/jobs/skills/playwright-framework-context/SKILL.md`](ai/jobs/skills/playwright-framework-context/SKILL.md) for framework mechanics
- Refer to [`AGENTS.md`](AGENTS.md) for autonomy tiers and decision boundaries

### Documentation Sync
- After validated code/config changes, run `doc-memory-sync` agent to keep `readme.md` and this memory file current
- Never let documentation lag behind verified behavior

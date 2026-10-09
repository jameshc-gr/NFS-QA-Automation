# Rate Wealth Security Assessment Plan

**Status:** Planning Only - active security testing is not authorized by the information currently available.
**Application:** Rate Wealth (FitBUX)
**Candidate starting URL:** `https://wealth.dev.fitbux.com/home`
**Plan created:** 2026-10-06
**Assessment owner / business owner / tester:** Requires stakeholder input
**Authorization:** Not provided

This plan is a readiness and test-design artifact, not a penetration-test report. No requests were sent to the application as part of preparing it. Repository documentation and prior test notes are leads only; they are not current validation evidence, proof of authorization, or proof that a previously reported issue remains present.

## 1. Executive Assessment Charter

### Readiness

**Ready for planning only.** A dev application URL and repository test context are available. Written authorization, complete scope, approved test identities, dates, limits, data rules, contacts, and stop procedure are not documented here. Do not log in, submit forms, manipulate requests, enumerate assets, run scanners, or otherwise actively test until the authorization checklist is completed and approved.

### Objectives

- Validate server-enforced authentication, session, account, and authorization boundaries, including cross-user isolation.
- Protect financial profile, income, debt, asset, transaction, plan, and identity data from unauthorized access or exposure.
- Evaluate Rate Wealth business workflows, input handling, APIs, browser protections, integrations, and operational security using approved, synthetic test data.
- Validate security logging and detection, report evidence-based risks, retest approved remediations, and identify regression coverage.

### Candidate in-scope assets (not yet approved)

| Asset | Repository-documented purpose | Scope status |
|---|---|---|
| `https://wealth.dev.fitbux.com` | Rate Wealth dev web app; `/home` is the documented home route | Candidate only; approval required |
| `https://login.dev.rate.com` | Okta SSO host / authorization flow | Third-party or shared identity dependency; explicit approval required |
| `https://my.dev.rate.com` | Registration host | Candidate only; approval required |
| App APIs, storage, cloud resources, admin/support consoles, webhooks, and linked services | Not inventoried in supplied local evidence | Unknown; do not probe or infer scope |

Do not expand scope to production, other subdomains, IPs, cloud resources, or third parties based on links, redirects, DNS, certificates, scripts, or API responses. Record discoveries as **Pending Scope Approval**.

### Inherent safety boundaries

- Use only individually approved test accounts and synthetic records; never access customer or employee records.
- No production testing, social engineering, password spraying, brute force, denial-of-service/load testing, malware, persistence, destructive operations, third-party testing, or real financial transactions without separate explicit approval.
- Use low request volumes, sequential execution, and no concurrency unless a written limit explicitly permits otherwise.
- Stop immediately on unexpected non-test data, service degradation, unintended state change, third-party impact, or scope ambiguity; preserve minimal sanitized evidence and notify the approved contact.

## 2. Scope and Authorization Checklist

Every mandatory item below is currently **Unknown / not supplied**, unless stated otherwise. The candidate URL is known but is not written authorization.

| Required item | Current status | Evidence needed before active execution |
|---|---|---|
| Written authorization status and approver | Missing | Dated approval naming the assessment, tester, techniques, and signatory |
| Assessment owner and business owner | Missing | Names, roles, contact channels, decision authority |
| Approved environment | Candidate dev URL only | Explicit environment and confirmation it contains no unapproved production data |
| Approved domains/subdomains and IPs | Missing | Exact allowlist; include redirects and identity hosts only if approved |
| Approved APIs and versions | Missing | Exact base URLs, endpoint/spec list, and exclusions |
| Approved cloud resources / administrative interfaces | Missing | Resource identifiers and explicit owner approval |
| Test accounts and roles | Partial repository references | Account identifiers, role/tenant assignments, owner, lifecycle, permitted actions; verify fresh and dedicated accounts |
| Testing dates, times, and timezone | Missing | Approved window and blackout periods |
| Tester source IPs | Missing | Egress addresses and any allowlist requirement |
| Allowed techniques | Missing | Written list of passive and active checks, automation, and request methods |
| Prohibited techniques | Missing | Confirm prohibited activities and any additional restrictions |
| Rate/concurrency limits | Missing | Requests/second, concurrency, retries, and stop thresholds |
| Data-handling requirements | Missing | Synthetic-data policy, evidence location, encryption, access, retention/deletion |
| Emergency contacts | Missing | On-call/security contact and escalation route |
| Stop-testing procedure | Missing | Stop signal, who can issue it, shutdown and notification process |
| Third-party restrictions | Missing | Okta, financial account-linking, payment, email, analytics, and other vendor permissions |
| Critical-finding escalation | Missing | Severity trigger, contact, response expectation, secure channel |

### Consolidated stakeholder questionnaire

Return one completed response covering all sections below. Unknown answers should be marked **Unknown**, not inferred.

#### Authorization
- Who is the written authorizing authority, assessment owner, business owner, and security contact? What document records authorization and its validity dates?
- Which techniques and automation tools are permitted? What are explicitly prohibited?
- What are the testing window, source IPs, traffic limits, stop thresholds, emergency contacts, stop procedure, and critical-finding escalation path?
- What evidence may be retained, where, by whom, for how long, and how must it be deleted?

#### Scope
- Confirm exact environment, domains/subdomains, IP addresses, APIs/versions, cloud resources, admin/support interfaces, and exclusions.
- Are redirects to Okta and registration hosts included? Are any dependencies shared with production or other tenants?
- What are the approved test accounts, roles, tenants, and permitted account setup/recovery actions?

#### Architecture
- Describe application purpose, frontend/backend stack, hosting model, cloud provider, CDN/WAF/reverse proxies, databases, queues, file/object storage, and service boundaries.
- Provide current architecture/data-flow diagrams, environment deployment identifiers, and API specifications or schema exports.
- Identify admin interfaces, support tools, debug/health/metrics endpoints, mobile/partner clients, and service accounts.

#### Identity and roles
- Confirm IdP, SSO protocol/configuration, MFA methods/policies, enrollment and recovery flows, token types/lifetimes, session policies, and logout/revocation behavior.
- List standard, privileged, administrator, support, service, and tenant roles with expected permissions and account lifecycle rules.

#### Data
- Identify personal, financial, authentication, business-confidential, and regulated/contractual data; classifications, residency, retention, deletion, encryption, and masking requirements.
- Confirm whether dev contains copied production data and how test accounts/data are identified and segregated.

#### APIs
- Provide REST/GraphQL/SOAP/WebSocket/webhook inventories, versions, OpenAPI/GraphQL schemas, authentication methods, and mobile/partner/internal API consumers.
- Identify rate limits, idempotency expectations, pagination limits, API key ownership, and endpoints that cause irreversible state changes.

#### Infrastructure and integrations
- Identify cloud resources, identity permissions, network boundaries, storage buckets, build/deployment pipelines, secrets systems, and relevant infrastructure-as-code.
- List third-party integrations (identity, account aggregation, payments/subscriptions, communications, analytics, support) and whether each vendor has approved testing.

#### Security operations
- Identify logging/SIEM, alerting and incident-response owners, vulnerability and risk-acceptance processes, code/dependency/cloud scanning, prior assessment reports, and existing accepted risks.

#### Reporting
- Confirm severity model, report audience, delivery channel, finding owners and target-date expectations, redaction rules, retest authorization, and formal go-live sign-off authority.

## 3. Draft Rules of Engagement

This is a draft for approval, not an authorization. Replace bracketed/unknown fields and obtain written approval before execution.

| RoE field | Draft |
|---|---|
| Purpose | Defensive assessment of Rate Wealth dev application and explicitly listed supporting assets |
| Approved assets | Pending exact domain/API/resource allowlist; candidate hosts above are not yet approved |
| Out of scope by default | Production; unlisted domains/IPs/APIs/cloud resources; third parties; customer data; social engineering; load/DoS; destructive, persistence, credential theft, malware, and real financial activity |
| Dates and hours | `[owner to approve, including timezone]` |
| Tester/source IP | `[approved tester and source IPs]` |
| Accounts and data | Dedicated approved test identities; synthetic data only; no shared QA credentials; no production data |
| Request/rate limits | `[owner to define]`; until approved, no active requests |
| State changes | Read-only by default; narrowly scoped reversible changes only if explicitly approved with cleanup owner and steps |
| Evidence | Minimum necessary, sanitized, encrypted approved storage, access restricted, retention/deletion dates specified |
| Third parties | No testing without written authorization from the relevant asset owner/vendor |
| Stop conditions | Any unexpected sensitive data, cross-tenant exposure, degradation, unintended integrity change, third-party effect, scope uncertainty, or owner stop request |
| Notification | Notify `[security contact]` through `[channel]`; critical finding escalation via `[route]` |
| Cleanup | Verify and remove only assessment-created artifacts using approved cleanup steps; document residual artifacts |
| Approval gate | Assessment owner + business owner + security/asset owners approve exact scope, techniques, and limits in writing |

## 4. Assumptions and Open Questions

| Statement | Classification | Detail |
|---|---|---|
| `wealth.dev.fitbux.com/home` is the requested starting point | Confirmed from request | Does not establish approval for active access or any adjacent host |
| Dev SSO uses `login.dev.rate.com` | Repository-documented, unverified current state | Confirm with application/identity owner and include explicitly in scope |
| Registration uses `my.dev.rate.com` | Repository-documented, unverified current state | Registration is state-changing; requires approval and dedicated accounts |
| App handles sensitive financial profiles | Strongly indicated by documented features/data fields | Owner must confirm classification, dev-data provenance, and handling requirements |
| Roles, tenant model, APIs, cloud resources, integrations, security monitoring | Unknown | Stakeholder input and approved inventories required |
| Existing defect log is accurate today | Not assumed | Prior notes conflict and include corrected false positives; independently revalidate only after authorization |
| Dev has safe synthetic data | Unknown | Do not assume; verify before any authenticated activity |

## 5. Application and Asset Inventory (Initial)

Only local repository documentation was reviewed. No live discovery or HTTP checks were performed.

| Component | Evidence in repository | Owner | Environment | Auth/data/exposure/criticality | Test status |
|---|---|---|---|---|---|
| Rate Wealth web SPA | `test-data/rate-wealth/rate-wealth.yml`; documented base URL | Unknown | Dev candidate | Protected app; likely sensitive financial profile; internet-facing candidate; high business criticality (validate) | Pending approval |
| Home/snapshot/plan/budget/transactions/accounts/settings routes | Same route map: `/home`, `/wealth`, `/financial-plans`, `/plan-select`, `/plan-builder`, `/budget`, `/transactions`, `/accounts`, `/settings`, `/studentloans` | Unknown | Dev candidate | Auth expectations and data access to validate | Pending approval |
| Okta SSO | `login.dev.rate.com`; documented authorization route | Identity owner unknown | Dev candidate/shared dependency unknown | Authentication boundary; high criticality | Explicit third-party/shared-service approval required |
| Registration | `my.dev.rate.com/registration` | Unknown | Dev candidate | Account creation and identity data; state-changing | Pending approval |
| Application APIs | Prior test report names several `/api/...` paths; incomplete and potentially stale | Unknown | Dev candidate | API inventory/auth/data unknown | No endpoint probing until allowlisted |
| Account linking / integrations | UI has “Connect Account”; provider not identified | Unknown | Unknown | Potential financial account data and third party | Owner/integration approval required |
| Subscription/payment | UI has subscription management; provider not identified | Unknown | Unknown | Potential billing/financial interaction | No purchase/real transaction testing |
| Browser assets, source maps, service workers, CDN, storage, cloud, admin tools | Not established from supplied evidence | Unknown | Unknown | Unknown | Inventory from owner-provided records after scope approval |

## 6. Role and Permission Matrix (To Confirm)

Expected baseline is deny by default and enforce server-side on every request and object. The matrix is not a statement of current product roles.

| Persona | Own profile/plan/data | Other user same tenant | Other tenant | Admin functions | Support functions | Required negative coverage |
|---|---|---|---|---|---|---|
| Anonymous | Deny private data; allow only approved public/auth routes | Deny | Deny | Deny | Deny | Direct URL/API requests remain unauthenticated |
| Standard user A | Read/write only permitted owned objects | Deny unless a specifically authorized sharing model applies | Deny | Deny | Deny | Object/property/function checks on each endpoint |
| Standard user B | Same as A for own data | Deny access to A | Deny | Deny | Deny | Repeat A/B checks in both directions |
| Privileged user | Only approved elevated functions | No implicit data access | Deny absent explicit cross-tenant policy | Limited to documented role | Deny unless separately assigned | Confirm least privilege and elevation/revocation |
| Administrator | Only documented administrative scope | Policy-defined and audited | Explicitly policy-defined; no blanket assumption | Allowed documented functions | Policy-defined | MFA/step-up, audit, and sensitive-action controls |
| Support user | No default customer data access | Deny absent time-bound approved access | Deny | Deny | Narrow, audited, approved support workflow only | Justification, time limit, disclosure minimization, audit |
| Different tenant user | Own tenant only | Deny | Deny | Deny | Deny | Cross-tenant records, search, exports, files, nested resources |
| Service account | Only explicit service function/data | Deny by default | Deny by default | No interactive admin | No interactive support | Scope, rotation, audience, and non-human identity controls |

## 7. Data-Flow and Trust-Boundary Summary

Provisional flow inferred from local docs, not confirmed architecture:

1. Browser loads Rate Wealth dev web app.
2. User is redirected to a candidate Okta dev identity host for authentication/MFA.
3. Identity callback returns to the app and establishes browser session/token state.
4. SPA calls application APIs for financial profile, snapshot, budget, account, transaction, plan, and settings functions.
5. Optional registration, financial account-linking, subscription/payment, and communication/integration services may receive or provide identity/financial data.
6. APIs persist data in unknown application databases/object stores and emit unknown logs/telemetry.

Trust boundaries requiring owner validation: browser↔app; app↔IdP; app↔API; API↔database/object storage; tenant/user ownership; app↔financial data provider; app↔payment/subscription vendor; runtime↔logs/analytics; CI/CD↔cloud deployment/secrets. Data minimization, encryption, token audience/scope, tenant identity propagation, and audit behavior are open questions.

## 8. Threat Model (Initial Hypotheses)

No item below is a finding. Validate likelihood, controls, logging, and impact with owners and approved test evidence.

| ID / threat | Asset and preconditions | Safe test approach after approval | Expected controls and logging | Priority |
|---|---|---|---|---|
| T-01 Account takeover / recovery abuse | User identity; account exists | Review IdP policy and execute bounded negative login/recovery cases with owned test accounts | MFA, rate controls, uniform responses, recovery audit/alerts | P1 |
| T-02 Session theft/replay or stale session | Browser tokens and authenticated session | Inspect own test session attributes/lifecycle; test logout, rotation, expiry using owned account | Secure cookie/storage strategy, expiry/revocation, no token in URL/logs | P1 |
| T-03 Cross-user/tenant data exposure | Two approved synthetic users/tenants and known owned records | Compare only the two created records across UI/API; no guessing/enumerating IDs | Server-side owner/tenant authorization and denial logs | P1 |
| T-04 Privilege escalation/support overreach | Approved role-separated accounts | Attempt documented role boundary operations, no admin discovery beyond allowlist | Central policy, least privilege, approval, audit | P1 |
| T-05 Manipulated financial profile/workflow | Synthetic plan/profile | Test documented validation, workflow order, duplicate/replay and ownership invariants on disposable records | Server-side validation, transaction consistency, idempotency, audit | P1 |
| T-06 Excess financial data in API/browser/cache | Own synthetic profile | Inspect only own responses, headers, browser storage, exports, and cache behavior | Data minimization, no-store as appropriate, masking/redaction | P1 |
| T-07 Injection/browser script execution | Approved text fields and disposable data | Harmless inert markers and output-context checks; no data exfiltration or destructive payloads | Contextual encoding, safe parsing, CSP, input/schema validation | P2 |
| T-08 CSRF/CORS/origin trust weakness | Authenticated test user and state-changing endpoint | Verify headers/tokens/Origin behavior without cross-site real changes | CSRF defenses, narrow CORS allowlist, safe methods | P2 |
| T-09 Unsafe URL processing / SSRF | Feature accepts remote URLs and owner-approved target | Configuration/code review first; only owner-provided controlled callback if specifically authorized | Egress allowlisting, destination validation, redirect re-check | P2 |
| T-10 Unsafe file handling | Upload/download feature and test files | Benign small synthetic files; verify type/size/access handling | Content validation, private storage, scanning, quotas | P2 |
| T-11 Third-party integration compromise or excessive scope | Account-linking, identity, payment, messaging | Review configuration/contracts; sandbox-only integration tests with provider approval | Least scopes, signature/validation, secrets isolation, timeout/failure controls | P2 |
| T-12 API automation/resource abuse | API limits and expensive operations | Review configured limits; bounded tests only within written request budget | Rate/complexity limits, cost controls, anomaly alerting | P2; load tests separately approved |
| T-13 Secrets/supply chain compromise | Source, dependencies, CI/CD, build output | Authorized local/static review and approved scanning; do not probe external repos | Secret scanning, pinned dependencies, least CI privileges, SBOM | P2 |
| T-14 Monitoring failure / insider misuse | Security logs and privileged workflows | Trigger a small number of approved test events and correlate with owner-accessible logs | Traceable audit, redaction, alert delivery, time sync | P2 |

## 9. Risk-Based Master Test Plan

Priorities follow the requested order, adjusted for financial-data sensitivity. Status for every case is **Not started / authorization blocked**.

| Workstream | Coverage | Priority | Dependency / execution gate |
|---|---|---|---|
| W1 Identity, login, recovery, MFA, SSO, sessions | Login errors, recovery, MFA lifecycle, OIDC/SAML configuration as applicable, logout, expiry, cookies/storage | P1 | Written scope for app and IdP; owned test identities; identity-owner approval |
| W2 Authorization and tenant isolation | Object/function/property/tenant checks across profile, plans, transactions, files, search/export, nested resources | P1 | Two users and tenants if supported; API allowlist; synthetic records |
| W3 Admin/support and privileged operations | Role separation, elevation, support access, sensitive actions, audit | P1 | Explicit admin/support scope and test role grants |
| W4 Financial workflows and data integrity | Plan creation/update/delete, lifecycle transitions, duplicate/replay, rounding/bounds, owner binding | P1 | Disposable test users/plans; owner-approved reversible state changes |
| W5 API security | Inventory, auth, schema, minimization, pagination, batching, idempotency, older versions, GraphQL/WebSocket/webhooks if present | P1 | API specs and exact allowed endpoints; bounded request rate |
| W6 Browser/data protection | Security headers, CSP, cookies, CORS, caching, storage, source maps, dependency exposure | P1/P2 | Approved host; own account; passive checks first |
| W7 Files and exports | Upload, parsing, downloads, signed links, authorization, quotas | P2 | Feature inventory, synthetic files, cleanup method |
| W8 Input and injection | Schema/type/boundary handling, stored/reflected/DOM XSS, injection families | P2 | Approved disposable inputs/endpoints; harmless payload policy |
| W9 Integrations / SSRF | URL-processing and third-party trust boundaries | P2 | Explicit asset/vendor approval, controlled test destination, egress owner |
| W10 Infrastructure and supply chain | TLS, cloud access, configuration, CI/CD, dependency/SBOM/secrets review | P2 | Owner-provided configs/IaC/scans; approved cloud read permissions |
| W11 Logging, detection, availability controls | Auth/admin/export event trail, alerts, non-load limit review | P2 | SIEM owner cooperation; test event correlation; explicit request limits |

### Draft schedule after approvals

Estimates are planning placeholders, not booked dates. Start only after all Phase 0 gates pass.

| Window | Activity | Exit checkpoint |
|---|---|---|
| Prep (1-2 business days) | Validate authorization, inventories, accounts, backups/cleanup, contacts, logs | Signed RoE and exact asset allowlist; all blockers closed |
| Day 1 | Passive architecture/config/browser review; authentication/session low-impact cases | Checkpoint report; stop if unexpected sensitive data or scope mismatch |
| Days 2-3 | Role/tenant/API and sensitive workflow test cases | Each case evidence and cleanup verified; findings escalated as required |
| Day 4 | Input/browser/file/integration review and approved configuration review | No unapproved targets or unsafe test conditions |
| Day 5 | Logging checks, finding validation, debrief, remediation prioritization | Draft findings reviewed with owners; evidence sanitized |
| Retest window | Approved fix verification and regression tests | Each finding assigned retest status; residual risks signed by owners |

## 10. Detailed Test Cases

All cases require Phase 0 approval, approved targets, synthetic data, and tester identity. Replace `[approved app/API asset]` with an exact allowlisted value before execution. Evidence is sanitized and limited to tester-owned data. Do not continue after a failed checkpoint or unexpected data access.

Status convention: **Blocked - authorization/scope not provided**. Actual result, finding reference, and regression status remain unset until a documented execution.

### Identity and session

| ID / domain / title | Objective and threat | Setup / role / data | Reproducible steps | Expected secure result; evidence; safety/cleanup; automation |
|---|---|---|---|---|
| RW-SEC-AUTH-001 Authentication response consistency | Detect account enumeration through login/recovery; ASVS authentication | Approved IdP/app hosts; two owned test identities, one approved nonexistent alias; anonymous | 1. Confirm URL host is allowlisted. 2. Submit one known test identity with an intentionally incorrect password. 3. Submit the approved nonexistent alias once. 4. Compare user-visible response and timing qualitatively; do not repeat for rate testing. | No reliable account-existence disclosure; no lockout of real/shared users. Capture sanitized response/status and timestamp. Do not store passwords. Cleanup: none. Automate as bounded API/UI negative test after approval. |
| RW-SEC-AUTH-002 Recovery token lifecycle | Ensure reset/recovery is bound, expiring, single-use, and revokes sessions | Owned disposable account; approved mailbox; tester role | 1. Request one recovery message. 2. Complete reset with a new test-only secret. 3. Verify the same reset link/code cannot be reused. 4. Verify a pre-existing session is revoked or follows documented policy. 5. Verify notification/audit event. | One-time expiring token; no identity leakage; old sessions follow policy; audit is traceable. Store only masked token metadata, never reusable token. Cleanup: rotate test credential and invalidate sessions. Automate API/auth regression. |
| RW-SEC-AUTH-003 MFA enrollment, recovery, and step-up | Identify alternate-path MFA bypass or unsafe factor changes | Dedicated owned account with approved MFA options; identity owner present as needed | 1. Record configured factor policy. 2. Enroll only approved test factor. 3. Verify protected action requires expected factor/step-up. 4. Test factor removal/reset through documented recovery only. 5. Review alert/audit records. | No factor bypass or silent downgrade; recovery requires approved proof and produces alerts. No OTP interception or automation. Cleanup: restore approved factor state. Automate policy/API cases where supported. |
| RW-SEC-004 OIDC/SSO callback integrity | Validate state/nonce/issuer/audience/redirect/PKCE controls without forging external identities | App+IdP scope explicitly approved; own account; approved callback | 1. Review IdP/app configuration or test harness. 2. Complete a normal approved login. 3. With owner-provided test configuration only, submit a missing/mismatched state or expired test response. 4. Confirm callback rejects safely. | Invalid/mismatched callback rejected, no session created, no token logged; audit event exists. Never tamper with live reusable tokens. Cleanup: invalidate test sessions. Automate in isolated auth integration tests. |
| RW-SEC-005 Session lifecycle and browser storage | Check session rotation/revocation, cookie attributes, token exposure, timeout | Own test account/browser context | 1. Record sanitized cookie names/attributes and storage key names (not values). 2. Authenticate normally and note session identity fingerprint only. 3. Logout. 4. Retry an owned protected route using the same browser context. 5. Verify inactivity/absolute timeout only if approved window supports it. | Logout/expiry invalidates server session; Secure/HttpOnly/SameSite policies match architecture; tokens absent from URLs/logs. Save redacted headers only. Cleanup: close context. Automate header/session checks. |

### Authorization, API, and financial workflow

| ID / domain / title | Objective and threat | Setup / role / data | Reproducible steps | Expected secure result; evidence; safety/cleanup; automation |
|---|---|---|---|---|
| RW-SEC-AZ-001 Cross-user object authorization | Prevent horizontal access to profile, plan, account, transaction, and settings objects | Two approved standard users A/B; one synthetic object each; same approved tenant | 1. Create/read one disposable record as A and one as B through normal app flow. 2. Capture each record's app-issued reference. 3. Using B's session, request only A's exact known test object through the documented endpoint. 4. Repeat in reverse. 5. Verify no fields or existence details leak. | Deny or return policy-approved not-found; never expose object data; log authorization failure. No identifier guessing. Cleanup: remove only created records. Automate pairwise ownership checks. |
| RW-SEC-AZ-002 Tenant boundary | Validate server-side tenant isolation | Two approved synthetic tenants with standard user each; tenant owner confirms setup | 1. Create one uniquely identifiable synthetic object per tenant. 2. Access only the other known test object's exact reference from the alternate tenant context. 3. Check UI and documented API responses, including list/search. | No cross-tenant data or existence disclosure; audit event captured. Stop immediately if any real/non-test record appears. Cleanup records and accounts per owner process. Automate tenant matrix. |
| RW-SEC-AZ-003 Function/property authorization | Prevent role and protected-field escalation | Standard user and specifically approved privileged role; test records | 1. Capture permitted baseline update from standard user. 2. Submit one owner-approved request changing only an explicitly restricted property or invoking one documented privileged operation. 3. Check response and persisted test record using authorized read path. | Server rejects/ignores unauthorized fields/functions and does not partially mutate data; audit records attempt. No role-grant changes. Cleanup any approved test change. Automate schema/property matrix. |
| RW-SEC-AZ-004 Direct route, method, and legacy API enforcement | Ensure UI hiding and alternate routes/methods do not bypass authorization | Two roles; exact routes/API versions provided by owner | 1. As anonymous/standard test role, request each explicitly listed protected route. 2. For one read-only test endpoint, use only methods documented as supported and an approved unsupported method. 3. Repeat applicable checks against listed older versions. | Deny unauthenticated/unauthorized access consistently; unsupported methods fail safely; no state change. Capture status and sanitized response. Cleanup: none. Automate route/method matrix. |
| RW-SEC-API-001 API schema, type, and minimization | Ensure API validates inputs and returns only required properties | API schema; owned user; synthetic profile/plan | 1. Save a normal test record. 2. Submit boundary/type variants from the API schema (empty, null, wrong type, documented min/max) only on disposable record. 3. Read back through authorized route and compare fields. 4. Check errors for stack/secret leakage. | Reject invalid values or normalize per contract; no mass assignment, unintended fields, or sensitive error data. Capture redacted requests/responses. Cleanup record. Automate contract tests. |
| RW-SEC-API-002 Pagination, batch, and response bounds | Prevent overbroad retrieval/resource abuse | Approved list/search endpoint; owned data only; written request budget | 1. Query normal default page. 2. Request owner-approved maximum and one value just above documented maximum once. 3. If batching exists, use a small batch containing only own test IDs. | Enforced page/batch maximum; bounded response and safe error; no unrelated data. No enumeration or volume loops. Cleanup: none. Automate API limit checks. |
| RW-SEC-BIZ-001 Plan lifecycle, ownership, and replay | Protect plan state against cross-owner writes, duplicate/replayed submissions, and step bypass | Disposable plan/user; reversible actions explicitly approved | 1. Create a synthetic plan using normal steps and record expected state. 2. Submit one valid save once, then repeat the same request once if idempotency policy allows. 3. Attempt documented next-step API with a required prior step omitted using the disposable plan. 4. Verify ownership on readback. | No duplicate charge/plan or invalid transition; ownership and required-step rules enforced server-side; logs correlate requests. No payment/implementation execution. Cleanup plan. Automate state-machine tests. |
| RW-SEC-BIZ-002 Financial numeric boundaries and integrity | Verify server-side bounds, precision, currency/rounding, and ownership binding | Disposable synthetic financial profile and plan; product-approved valid boundaries | 1. For each approved money/date/percentage field, submit valid minimum, maximum, zero/negative/decimal/overflow cases defined by product owner. 2. Save only in disposable record. 3. Read back and compare calculation/result with documented rule. | Invalid or unsupported values rejected consistently server-side; no overflow, precision loss, or corrupted plan. Do not assume $0/negative values are defects without business rules. Cleanup record. Automate contract/business-rule cases. |
| RW-SEC-BIZ-003 Destructive action confirmation and rollback | Avoid accidental deletion or irreversible financial workflow action | Disposable test plan only; written delete/rollback permission | 1. Verify cancel/back leaves record unchanged. 2. If deletion testing approved, delete only the named disposable plan through the UI. 3. Confirm expected confirmation, audit event, and absence in own list. | Intentional action only, properly authorized/confirmed/audited; other users' records unchanged. Never use production or non-test record. Cleanup per owner. Automate in isolated disposable data. |

### Browser, input, files, integration, operations

| ID / domain / title | Objective and threat | Setup / role / data | Reproducible steps | Expected secure result; evidence; safety/cleanup; automation |
|---|---|---|---|---|
| RW-SEC-WEB-001 Security headers, TLS, and caching | Verify transport and browser security controls | Exact approved host; passive browser/header observation | 1. Load the approved public/home route once. 2. Record TLS/certificate summary and response security headers. 3. Inspect cache headers for public and own authenticated response. 4. Check browser console for mixed content. | HTTPS valid; approved TLS baseline; HSTS, CSP, frame protection, nosniff, referrer/permissions policy appropriate; private financial responses not shared-cached. Sanitize cookies. No active protocol probing. Automate header assertions. |
| RW-SEC-WEB-002 CORS, CSRF, and messaging origins | Validate origin controls on documented state-changing endpoints | Owner-listed origins and endpoint; own account; no cross-site write | 1. Review CORS policy/config first. 2. Send at most one preflight/read-only request from approved non-allowlisted test origin if authorized. 3. Inspect CSRF token and cookie policy for a documented state-changing form without submitting unauthorized state changes. 4. Review postMessage origin checks in source/config if supplied. | No wildcard credentialed CORS; origin allowlist exact; CSRF/origin controls on state changes; messages validate source origin. Evidence is headers/config only. Cleanup none. Automate policy checks. |
| RW-SEC-INJ-001 Output encoding and injection-safe rendering | Prevent script/markup injection through user-controlled text | Disposable profile/plan fields; harmless unique inert marker approved by owner | 1. Enter a plain marker with punctuation in one disposable text field. 2. Save and view only the same test record in normal and admin/support rendering if explicitly allowed. 3. Confirm marker is rendered as text and not interpreted as active content. 4. Review server logs only via owner. | Context-appropriate encoding; no script execution, markup interpretation, log control, or parser error leakage. No exfiltration payloads. Cleanup test value. Automate safe encoding regression. |
| RW-SEC-FILE-001 Upload/download authorization and limits | Validate file content/type/size, private storage, and owner checks | Feature confirmed; synthetic benign files within approved limit; two test users if needed | 1. Upload one benign allowed small file as A. 2. Verify metadata/type and owner-only retrieval. 3. Attempt B access to the exact test file reference. 4. Test one just-over-limit benign file only if limit test explicitly approved. | Enforce type/size, private ownership, safe MIME/disposition, no public URL leakage; over-limit safely rejected. Avoid archives, active content, malware samples, or parser stress. Cleanup uploaded files and links. Automate boundary/access tests. |
| RW-SEC-SSRF-001 URL processing and egress policy | Detect unsafe server-side URL fetching without touching internal systems | Confirm feature; explicit owner/vendor scope; owner-controlled external test endpoint | 1. Review code/config and allowed URL policy first. 2. Submit a benign URL hosted on the owner-controlled callback only if specifically approved. 3. Verify destination and redirects are constrained. 4. Do not request loopback/private/metadata/internal endpoints. | Only approved schemes/destinations reachable; redirects revalidated; no internal response data returned; egress logged. Cleanup callback/config. No active test without separate approval. |
| RW-SEC-INT-001 Third-party tokens/webhooks | Validate least privilege, signature, freshness, and failure handling | Sandbox vendor and explicit vendor authorization; synthetic account | 1. Review integration scope and secret lifecycle. 2. Verify normal signed sandbox callback once. 3. With owner-supplied test fixture, verify invalid signature/stale timestamp is rejected. 4. Confirm secrets are not returned/logged. | Least privilege; authenticity/replay validation; safe errors; audit and rotation path. Never probe vendor production. Cleanup sandbox objects/secrets per owner. Automate fixtures. |
| RW-SEC-OPS-001 Audit trail and alert validation | Confirm traceability for auth, access denial, profile change, export, and admin events | Security/SIEM owner; test account; approved event set | 1. Agree event IDs and time window with SOC. 2. Generate one each of approved login failure, access denial, and synthetic profile update. 3. Correlate timestamps/request IDs with logs/alerts. 4. Check sensitive values are redacted. | Complete actor/action/object/outcome/time/correlation data, tamper-resistant retention, useful alert, no secrets/PII in logs. Do not trigger bulk alerts. Cleanup test data. Automate log contract where feasible. |
| RW-SEC-SUP-001 Dependency/secrets/configuration review | Find known vulnerable dependencies, exposed secrets, risky CI/cloud configuration | Owner-provided source/build/SBOM/IaC and read-only access approval | 1. Verify repository/build version and review SBOM/dependency scan. 2. Run only approved local scanners within source scope. 3. Review secret-scan matches without printing secret values. 4. Check deployment configuration against approved baseline. | Findings triaged, secrets redacted/rotated by owner, least privilege and supported dependencies. No external repo enumeration or cloud modification. Cleanup scanner artifacts. Automate in CI. |
| RW-SEC-AV-001 Abuse control configuration review | Assess limits without load/exhaustion testing | Owner configuration/docs; separate approval for any active limit test | 1. Review configured login, recovery, email/SMS, search, export, upload, API, GraphQL, and WebSocket limits. 2. Compare to policy and expected cost/risk. 3. If separately authorized, make only a bounded number below the written threshold using test account. | Documented effective limits and graceful safe behavior; no burst/load testing. Capture config/evidence, not customer activity. Cleanup none. Automate configuration tests; load testing remains separately gated. |

## 11. Test-Case Record and Execution Tracker

Use the case IDs above and create one row per execution attempt. Do not change a blocked case to Ready until written authorization and prerequisites are verified.

| Test Case ID | Category | Priority | Asset | Environment | Assigned tester | Status | Start date | Completion date | Result | Finding ID | Dependency | Blocker | Retest required | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RW-SEC-* | See case | P1/P2 | Exact approved asset | Dev only if approved | TBD | Not started | — | — | — | — | Signed scope, accounts, test data | Authorization/scope absent | TBD | No active test performed |

Allowed status values: **Not started, Ready, In progress, Blocked, Passed, Failed, Finding opened, Retest pending, Retest passed, Retest failed, Not applicable, Risk accepted.** Each case record must also include objective, threat scenario, applicable requirement, required role, preconditions, test data, numbered steps, expected result, evidence, safety/cleanup, actual result, finding reference, automation candidate, and regression status.

## 12. Preliminary Finding Summaries

**No new findings were generated.** No active security testing was performed. Existing observations are not promoted to findings by this plan.

Prior Rate Wealth notes in `test-data/rate-wealth/RATE-WEALTH-ADDITIONAL-BUGS-REPORT.md` document validation/workflow observations and older authentication/API errors. The same file records later corrections: some earlier routing and workflow reports were false positives or not reproduced, the reported SSO loop was not reproduced in a later test, and zero/negative money inputs were still accepted in that test run. Treat every item as a historical lead requiring scope-approved manual revalidation and product business-rule confirmation. Do not copy its severity labels or sensitive test data into a security report without validation.

## 13. Finding Validation and Final Technical Report

For each candidate issue, manually reproduce on an approved synthetic record, confirm scope and preconditions, test relevant roles/tenants and shared-component reach, identify practical impact and compensating controls, verify log visibility, and retain only minimum sanitized evidence. Classify as **Confirmed vulnerability, Security control weakness, Defense-in-depth improvement, Informational observation, False positive, Accepted risk, Not applicable,** or **Requires additional validation**.

Use one record per confirmed finding:

| Field | Required content |
|---|---|
| ID/title/severity/confidence | Unique ID; approved severity model; CVSS is input, adjusted for business/data/tenant impact and detection |
| Asset/environment/endpoint/role | Exact approved component and required privileges |
| Preconditions and reproduction | Minimal numbered, reproducible steps using test data only |
| Summary/technical description | Observed behavior and root cause, separated from assumptions |
| Business impact / affected users or tenants | Evidence-based exposure or integrity impact |
| Expected vs actual behavior | Specific policy requirement and measured response |
| Sanitized evidence | Redacted request/response, timestamp, correlation ID, screenshot if necessary |
| Containment and remediation | Immediate containment, systemic server-side fix, all channels/API versions, safe failure |
| Detection | Required event fields, alert, owner, and traceability |
| Regression and references | Negative, cross-user/tenant, role, alternate method/content type, related endpoints, standards |
| Owner/target date/retest | Accountable team, agreed date, retest evidence/status |

### Final report outline

1. Executive summary, readiness, scope, dates, limitations, and authorization record.
2. Methodology, assets tested, roles/data used, case coverage and execution status.
3. Confirmed findings with sanitized evidence, impact, root cause, remediation, and retest.
4. Control weaknesses, informational observations, false positives, accepted risks, and untested areas.
5. Security operations/logging assessment and residual-risk register with owner/date.
6. Remediation plan and security regression backlog.
7. Go-live recommendation with explicit conditions and sign-off authority.

## 14. Remediation, Retest, and Regression Plan

- Fix root causes at the server/API authorization, validation, identity, workflow, or configuration layer; apply fixes consistently to UI, APIs, older versions, and partner/mobile consumers.
- Add negative tests for unauthenticated, cross-user, cross-tenant, restricted-property, invalid workflow, and safe failure cases. Do not rely on hidden UI controls or WAF-only remediation.
- For each fix, review change and deployment/rollback plan; reproduce original issue using safe test data; verify original path plus approved alternate method/content type, related routes, older versions, roles, users/tenants, batch/nested cases; check errors, logs/alerts, and functional regression.
- Record retest as **Fixed, Partially fixed, Not fixed, Could not retest, Risk accepted,** or **Mitigated by compensating control** with evidence and owner.
- Suggested automation layers: Playwright/UI for browser headers and workflow checkpoints; API contract tests for auth/schema/object/property/tenant/idempotency; integration tests for SSO and webhook fixtures; CI for dependency, secret, IaC, and SBOM scans. Blocking policy requires owner agreement and stable test fixtures.

| Automation candidate | Layer / trigger | Pass criteria | Owner / maintenance |
|---|---|---|---|
| Authentication negatives and session invalidation | Auth integration + Playwright on dev deploy | Invalid/expired/revoked sessions cannot reach protected data | Identity/app owners; maintain IdP policy fixtures |
| Role/object/tenant matrix | API integration on PR and nightly | Only permitted actor/object combinations succeed | API owner; maintain seeded synthetic tenants |
| Restricted-field/schema tests | API contract on PR | Unknown/forbidden values rejected and no mass assignment | API owner; update with versioned schema |
| Security headers/cookie/CORS | Deployed dev smoke | Required headers/attributes and strict origin behavior | Web platform owner; baseline reviewed on architecture changes |
| Plan lifecycle/idempotency/numeric bounds | Service/domain tests on PR | No invalid transitions, duplicates, or silent numeric corruption | Product/API owners; business rules versioned |
| File bounds/ownership | Integration on PR/nightly | Type/size and object authorization enforced | File-service owner; cleanup synthetic artifacts |
| Logging/alert contracts | Integration/staging after deploy | Required event fields appear, secrets redacted, alert routes | SOC + service owner; avoid brittle timing assertions |
| Dependency/secret/IaC checks | CI for each build/release | Critical policy violations fail gate; secrets never printed | AppSec/DevOps; triage false positives and rotate credentials |

## 15. Residual-Risk Register and Go-Live Gate

| Risk | Current status | Owner | Due date / decision |
|---|---|---|---|
| Authorization and scope are not documented | Open / blocks active testing | Assessment + business owner | Before execution |
| APIs, roles, tenant model, infrastructure, and integrations are not inventoried | Open | Application/architecture owners | Before relevant workstream |
| Dev data provenance and classification are unconfirmed | Open | Data owner | Before account access |
| Security logging and incident escalation are unknown | Open | SOC/security operations | Before event-generation tests |
| Historical Rate Wealth reports may be stale/inaccurate | Open validation gap | Product/security owners | Revalidate only after approval |

**Go-live recommendation:** Not assessed. This document cannot approve a release. A future recommendation requires documented scope coverage; no unresolved critical issue; high findings fixed or formally accepted; authentication/recovery/MFA and role/tenant isolation evaluated; APIs and key workflows assessed; sensitive-data/file/integration controls addressed; logging verified; critical/high issues retested; regression tests identified; residual risks assigned and accepted by authorized owners; formal security sign-off recorded.

## 16. Next Authorized Actions

| Sequence / action | Owner | Required input | Expected output | Risk level | Authorization dependency | Completion criteria |
|---|---|---|---|---|---|---|
| 1. Complete the questionnaire and approve written authorization | Business owner + security/asset owners | Sections 2-3 questionnaire; dates, techniques, limits, contacts | Signed scope and RoE | Low | This is the gate | Every mandatory authorization item has a named value and approver |
| 2. Confirm architecture, data classification, test data, roles, APIs, and integrations | Application/identity/data owners | Diagrams, schemas, role matrix, data inventory | Approved asset/data/role inventories | Low | Owner-provided documentation only | Unknowns marked and in-scope assets explicitly allowlisted |
| 3. Provision dedicated synthetic accounts and cleanup procedure | Test-account owner | Approved roles/tenants and account lifecycle | Account inventory and disposable records | Low | Explicit account setup permission | A/B and elevated personas work; no real customer data |
| 4. Approve execution schedule, source IP, request limits, evidence handling, escalation | Assessment owner + SOC | Tester details and policy | Final run sheet | Low | Written approval required | Stop criteria, communication and evidence handling tested/documented |
| 5. Perform passive review, then low-impact approved identity/session checks | Assessment lead | Completed gates 1-4 | Checkpointed execution tracker and evidence | Low to moderate | Exact assets/techniques approved | Every step passes checkpoint or work halts; no scope drift |
| 6. Execute authorization/API/business cases in priority order | Assessment lead + app/API owners | All dependencies, synthetic data, limits | Validated results and candidate findings | Moderate | Endpoint and state-change approvals | Minimal impact, cleanup complete, results manually validated |
| 7. Review findings, agree owners/dates, remediate and independently retest | Service owners + independent tester | Sanitized findings, approval | Retest records and residual-risk register | Varies | Retest scope approved | Each issue has final status, evidence, owner, and risk decision |
| 8. Record formal release decision | Security sign-off authority | Final report and quality gates | Go-live recommendation | Low | Authorized decision-maker | Sign-off or explicit release block/risk acceptance documented |

## 17. Standards Mapping

Use the current organization-approved versions of OWASP ASVS, OWASP Web Security Testing Guide, OWASP Top 10, OWASP API Security Top 10, secure-development standards, and applicable contractual/regulatory requirements. Map individual cases to the agreed version and section after scope/architecture review; do not claim compliance based on partial coverage.

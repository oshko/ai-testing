# Requirements Specification

**Project:** TechSpark Solutions — KYC & AML Platform with Conversational Assistant
**Doc:** TSS-KYC-SRS-v1.0 · **Date:** 29 Jul 2026 · **Status:** Baselined
**Produced with:** Generative AI (prompts in [06-genai-report.md](06-genai-report.md) §2)

---

## 1. Scope

One platform combining a **KYC/AML compliance engine** with a **conversational assistant** as its interface. The assistant serves customers (onboarding, documents, status) and compliance analysts (natural-language alert queries).

**In scope:** REST API (Node.js, Express, PostgreSQL), chatbot intents/entities, KYC onboarding and risk scoring, document verification, watchlist screening, AML transaction monitoring, alert lifecycle.

**Out of scope:** front-end UI, ML model training, live regulator filing, infrastructure.

### Deliberate simplifications

| # | Simplification | Reason |
|---|---|---|
| S1 | Auth is an `x-user-role` header, not a signed JWT | Role rules stay testable without an auth stack |
| S2 | Watchlist screening uses exact name match on a local table | Stands in for a commercial provider |
| S3 | NLP is a deterministic rule/lexicon classifier, not an LLM | A non-deterministic oracle makes an RTM meaningless |
| S4 | Performance requirements specified but **not executed** | No load harness — reported *Not Executed*, never *passed* |
| S5 | Fictional jurisdictions use reserved ISO codes (`XA`,`XB`,`QM`,`XP`,`ZZ`) | Avoids labelling a real country "prohibited" in a fixture |

**Verification methods:** `AUTO` = automated Jest/Supertest · `PERF` = needs load harness · `INSP` = inspection/review · `DEFERRED` = specified for a later release, not implemented in v1

### Coverage of the mandated requirement topics

The brief required requirements covering five topics. This table shows where each is addressed — the conversational assistant *is* the AI-driven customer-support surface of this platform.

| Mandated topic | Requirements | Count |
|---|---|---|
| Chatbot functionality | REQ-CHT-01 … 06 | 6 |
| NLP capabilities | REQ-NLP-01 … 06 | 6 |
| Integration with existing systems | REQ-INT-01 … 06 | 6 |
| Scalability needs | REQ-NFR-06, 07, 08, 09, 10 | 5 |
| Performance expectations | REQ-NFR-05, 11 | 2 |
| *Supporting domain scope* | REQ-KYC-01 … 11, REQ-AML-01 … 09, REQ-NFR-01 … 04 | 24 |

**A note on honesty in this specification.** Requirements gathering means specifying the target state; it does not mean everything specified ships in v1. Requirements marked `DEFERRED` are fully written with acceptance criteria but were not implemented this release, and the traceability matrix reports them as such rather than as covered. Nothing in this document claims verification it did not receive.

---

## 2. Requirements

### Chatbot — `REQ-CHT`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-CHT-01 | Conversational endpoint returning a structured reply | `POST /api/chat` → `200` with `reply`, `intent`, `confidence`, `entities`, `session_id`; empty message → `400` | Must | AUTO |
| REQ-CHT-02 | Answers KYC status queries; never invents a status | Resolvable customer → reply states `kyc_status` + `risk_rating`; unresolvable → asks for email, states no status | Must | AUTO |
| REQ-CHT-03 | States acceptable document types on request | `upload_document` reply enumerates accepted types | Must | AUTO |
| REQ-CHT-04 | Analysts query alerts in natural language; customers cannot | `ANALYST` → filtered alerts returned; `CUSTOMER` → refusal, no alert payload | Must | AUTO |
| REQ-CHT-05 | Escalates on explicit request or low confidence | `escalated: true` with `escalation_reason` of `USER_REQUESTED` / `LOW_CONFIDENCE` | Must | AUTO |
| REQ-CHT-06 | Persists full transcript with intent + confidence | One `chat_messages` row per turn; multi-turn shares `session_id` | Must | AUTO |

### NLP — `REQ-NLP`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-NLP-01 | Single-intent classification from a published catalogue: `greeting`, `onboarding_start`, `upload_document`, `check_kyc_status`, `query_alerts`, `human_handoff`, `unknown` | Each intent's representative utterance resolves with `confidence >= 0.70`; `GET /api/intents` lists the catalogue | Must | AUTO |
| REQ-NLP-02 | Case / punctuation / whitespace insensitive | `"check my status"`, `"CHECK MY STATUS!!!"`, `"  check  my  status  "` all → `check_kyc_status` | Must | AUTO |
| REQ-NLP-03 | Typed entities: `PERSON_NAME`, `EMAIL`, `COUNTRY`, `DOCUMENT_TYPE`, `MONEY_AMOUNT`, `ALERT_SEVERITY`; amounts normalised to value + ISO-4217 | `"$9,500"` → `{9500, USD}`; `"12k EUR"` → `{12000, EUR}`; `"15 alerts"` → **not** money; lowercase words not read as ISO codes | Must | AUTO |
| REQ-NLP-04 | Below threshold (default `0.60`) → `unknown`, not the nearest guess; pre-threshold guess exposed | Out-of-domain → `unknown` + `candidate_intent`; fallback asserts no compliance outcome | Must | AUTO |
| REQ-NLP-05 | Negation handling | `"I do not want to upload a document"` ≠ `upload_document`; affirmative form still matches | Should | AUTO |
| REQ-NLP-06 | Message length limit (1,000 chars) | 1,001 chars → `400 MESSAGE_TOO_LONG` | Should | AUTO |

### KYC — `REQ-KYC`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-KYC-01 | Onboard a customer, returning a unique reference | `POST /api/customers` → `201` + `customer_ref`; row matches payload | Must | AUTO |
| REQ-KYC-02 | Validate all mandatory fields, reporting **every** error; no partial record | Missing `country` → `400 VALIDATION_ERROR` naming it; 4 bad fields → all 4 named; table stays empty | Must | AUTO |
| REQ-KYC-03 | Reject under-18 with a distinct code; accept exactly 18 | Age 17 → `400 UNDERAGE_APPLICANT`; age 18 → `201` | Must | AUTO |
| REQ-KYC-04 | Accept 5 document types; validate number format; require expiry where the type demands it | Valid passport → `VERIFIED`; bad format → `FAILED`; missing required expiry → `FAILED`; unlisted type → `400` | Must | AUTO |
| REQ-KYC-05 | Expired documents → `EXPIRED`, do not verify; if also malformed, report the more serious `FAILED` | Past expiry → `EXPIRED`, not `VERIFIED`; malformed + expired → `FAILED` | Must | AUTO |
| REQ-KYC-06 | 0–100 risk score from **itemised** factors, deterministic; unknown countries fail closed; `PROHIBITED` is a hard gate | Factor points reconcile to score; same input → same output; unknown country scores higher than a known low-risk one; worst ordinary case caps at `99`/`HIGH` | Must | AUTO |
| REQ-KYC-07 | Bands: `LOW` 0–24, `MEDIUM` 25–49, `HIGH` 50–99, `PROHIBITED` 100 | High-risk occupation in a standard country → `MEDIUM` | Must | AUTO |
| REQ-KYC-08 | `HIGH` → Enhanced Due Diligence, never auto-approval | PEP in high-risk jurisdiction → `HIGH`, `IN_REVIEW`, `edd_required: true` | Must | AUTO |
| REQ-KYC-09 | Duplicate prevention by case-insensitive email | Repeat email → `409 DUPLICATE_CUSTOMER`, including differing case | Must | AUTO |
| REQ-KYC-10 | `VERIFIED` requires one verified identity **and** one verified address document; `REJECTED` never becomes `VERIFIED` | Identity alone → `IN_REVIEW`; + address → `VERIFIED`; prohibited customer stays `REJECTED` | Must | AUTO |
| REQ-KYC-11 | Consolidated profile in one call | `GET /api/customers/:id` returns record, documents, alert count; unknown id → `404` | Should | AUTO |

### AML — `REQ-AML`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-AML-01 | Ingest transactions and screen **synchronously** | `201` with an always-present `alerts` array; amount ≤ 0 → `400`; unknown customer → `404` | Must | AUTO |
| REQ-AML-02 | **AML-R01** cash ≥ threshold (10,000) → `HIGH`; boundary inclusive; cash only | 10,000 cash → alert; 9,999 → none; 50,000 wire → none; alert persisted `OPEN` | Must | AUTO |
| REQ-AML-03 | **AML-R02** ≥3 cash txns in the 50–99% band inside 72h aggregating ≥ threshold → `CRITICAL`, listing contributors; duplicates suppressed | 3 × 6,000 in 24h → `CRITICAL`, count 3, aggregate 18,000, 3 refs; 2 txns → none; 3 × 1,000 → none; 4th → suppressed, 1 alert total | Must | AUTO |
| REQ-AML-04 | **AML-R03** >10 txns in a rolling 24h → `MEDIUM` | 11th → alert (count 11); 10th → none; 12 over 5 days → none | Must | AUTO |
| REQ-AML-05 | **AML-R04** high-risk counterparty country → alert, `CRITICAL` above 50% of threshold; prohibited always `CRITICAL` | 7,500→`CRITICAL`; 900→`MEDIUM`; 150 to prohibited→`CRITICAL`; standard country→none | Must | AUTO |
| REQ-AML-06 | Thresholds configurable per environment without code change; applied values reportable | Override changes behaviour with no source edit; response exposes applied thresholds, defaults intact | Must | AUTO |
| REQ-AML-07 | Lifecycle `OPEN → IN_REVIEW → CLOSED_*`; invalid transitions rejected with permitted list | `OPEN→IN_REVIEW` ok; `OPEN→CLOSED_CONFIRMED` → `409` with `allowed:["IN_REVIEW"]`; out of closed → `409` | Must | AUTO |
| REQ-AML-08 | Alert queue filterable by status, severity, customer | `?severity=MEDIUM&status=OPEN` returns only matches | Should | AUTO |
| REQ-AML-09 | **AML-R05** rapid layering (large credit, 90%+ out within 24h) → `CRITICAL` | Descoped in the sprint re-plan — see [04-agile-plan.md](04-agile-plan.md) §6 | Could | DESCOPED |

### Integration — `REQ-INT`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-INT-01 | Screen applicants against a sanctions/PEP watchlist and act on the result | Sanctions match → `PROHIBITED`/`REJECTED`; PEP match sets `is_pep` even when the request omits it | Must | AUTO |
| REQ-INT-02 | Credentials from environment config, never source control | `.env` git-ignored; no secret literals in source | Must | INSP |
| REQ-INT-03 | Integrate with the **core banking system** to retrieve account and balance data | Adapter returns account records for a customer; an unavailable provider degrades per REQ-INT-06 rather than failing onboarding | Should | DEFERRED |
| REQ-INT-04 | Integrate with a **document OCR / identity-verification provider** returning extracted fields and an authenticity score | Provider response populates document fields; authenticity below threshold sets document status `FAILED` | Should | DEFERRED |
| REQ-INT-05 | Integrate with a **case management system**, attaching an external case reference to escalated alerts | Escalating an alert populates `details.external_case_ref` | Could | DEFERRED |
| REQ-INT-06 | Every outbound integration shall apply a timeout, bounded retry with exponential backoff, and a circuit breaker; an unavailable **non-critical** provider shall degrade gracefully rather than fail the request | Simulated outage: critical call → `503 PROVIDER_UNAVAILABLE`; non-critical call → success with a `degraded: true` flag; retries capped and observable | Must | DEFERRED |

### Non-functional — `REQ-NFR`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-NFR-01 | Consistent response envelope; structured errors, never crashes | Success `{success:true,data,error:null}`; failure `{success:false,data:null,error:{code,message}}`; unknown route → `404`; bad JSON → `400 MALFORMED_JSON` | Must | AUTO |
| REQ-NFR-02 | Role-gated compliance data | No role → `401`; `CUSTOMER` → `403` | Must | AUTO |
| REQ-NFR-03 | Parameterised SQL, injection-immune; no internal detail leaked | Injection payloads in body and query string inert, schema survives; forced 500 → generic message, no stack; `X-Powered-By` absent | Must | AUTO |
| REQ-NFR-04 | Liveness and readiness endpoints | `/health` → `200`; `/health/ready` → `200` with `database:"up"`, `503` when unreachable | Must | AUTO |

**Performance expectations**

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-NFR-05 | Chatbot round-trip p95 ≤ 500 ms and synchronous AML screening p95 ≤ 200 ms at 100 concurrent sessions | p95 within budget measured over ≥1,000 requests | Must | PERF |
| REQ-NFR-11 | Alert-queue queries shall return within p95 ≤ 1 s over a 1,000,000-row transaction table | p95 ≤ 1,000 ms at stated volume | Should | PERF |

**Scalability needs**

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-NFR-06 | The application shall be **stateless** so instances scale horizontally with no session affinity | Conversation and alert state live in PostgreSQL, never in process memory; a second instance can continue an existing session | Should | INSP |
| REQ-NFR-07 | The platform shall sustain **1,000 transactions/second** ingest and **10,000 concurrent chat sessions** | Sustained throughput at stated concurrency with error rate < 0.1% | Must | PERF |
| REQ-NFR-08 | Database access shall use a bounded connection pool sized per environment, and shall not leak connections under error conditions | Pool maximum configurable; repeated failing requests do not exhaust the pool | Must | INSP |
| REQ-NFR-09 | Transaction ingest shall accept batch submission of up to 500 records in one call, to bound per-request overhead at scale | A 500-record batch succeeds; 501 returns `400 BATCH_TOO_LARGE` | Could | DEFERRED |
| REQ-NFR-10 | The API shall enforce per-client rate limiting, returning `429` with a `Retry-After` header when exceeded | Exceeding the configured limit returns `429` with `Retry-After` | Must | DEFERRED |

---

## 3. Summary

| Family | Count | Must | Should | Could | AUTO | PERF | INSP | Deferred | Descoped |
|---|---|---|---|---|---|---|---|---|---|
| Chatbot | 6 | 6 | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| NLP | 6 | 4 | 2 | 0 | 6 | 0 | 0 | 0 | 0 |
| KYC | 11 | 10 | 1 | 0 | 11 | 0 | 0 | 0 | 0 |
| AML | 9 | 7 | 1 | 1 | 8 | 0 | 0 | 0 | 1 |
| Integration | 6 | 3 | 2 | 1 | 1 | 0 | 1 | 4 | 0 |
| Non-functional | 11 | 8 | 2 | 1 | 4 | 3 | 2 | 2 | 0 |
| **Total** | **49** | **38** | **8** | **3** | **36** | **3** | **3** | **6** | **1** |

**Coverage position.** 36 requirements are automated and **all 36 pass**. The remaining 13 break down honestly as:

- **3 `PERF`** (REQ-NFR-05, 07, 11) — need a load-testing harness and a sized environment. Reported **Not Executed**, never as passed. Quoting a p95 latency from a 1.7-second laptop run would be the most misleading thing this project could publish.
- **3 `INSP`** (REQ-INT-02, REQ-NFR-06, 08) — verified by design review: no secrets in source, no state in process memory, bounded pool with an error handler.
- **6 `DEFERRED`** (REQ-INT-03, 04, 05, 06, REQ-NFR-09, 10) — specified with acceptance criteria for a future release; **not implemented in v1**, and the RTM says so.
- **1 `DESCOPED`** (REQ-AML-09) — formally removed from v1 with the compliance officer's agreement during the sprint re-plan.

**All 36 automated requirements include every `Must` requirement that was implemented.** The four deferred/descoped `Must`-and-below items are integration adapters and rate limiting — infrastructure the v1 scope never included, recorded here so the gap is visible rather than hidden.

---

## 4. Assumptions · Constraints · Open questions

**Assumptions** — A1 watchlist simulates a commercial provider · A2 single-currency thresholds, FX deferred · A3 high-risk/prohibited lists are fictional test data, not a determination about any real country.

**Constraints** — C1 stack fixed (Node/Express/PostgreSQL) · C2 PostgreSQL 14, avoid PG15+ SQL · C3 5 two-week sprints, team of 6 reduced to 4 mid-project.

| # | Open question | Status | Resolution |
|---|---|---|---|
| Q1 | Brief specified **Pytest** but the stack is JavaScript | Resolved | Client chose a single-language JS suite; Jest+Supertest covers the equivalent scope. Deviation recorded in [05-test-report.md](05-test-report.md) §5 |
| Q2 | Is the chatbot separate, or the KYC/AML front door? | Resolved | One unified platform |
| Q3 | FX normalisation for thresholds in v1? | Deferred | Assumption A2; v2 backlog |

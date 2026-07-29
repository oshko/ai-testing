# Requirements Specification
## Conversational KYC & AML Compliance Platform

| Field | Value |
|---|---|
| **Project** | Conversational KYC & AML Compliance Platform |
| **Client / Org** | TechSpark Solutions |
| **Document ID** | TSS-KYC-SRS-v1.2 |
| **Author** | Test Manager, QA Practice |
| **Date** | 29 July 2026 |
| **Status** | Baselined for Sprint 1 |
| **Generated with** | Generative AI (prompt log: [00-prompt-library.md](00-prompt-library.md)) |

---

## 1. Purpose and Scope

TechSpark Solutions is building a **single unified platform** that merges two capabilities a mid-tier bank normally buys separately:

1. A **KYC/AML compliance engine** — customer onboarding, identity and document verification, risk scoring, sanctions/PEP screening, transaction monitoring, alert management and SAR filing.
2. A **conversational AI layer** — a chatbot with NLP that serves *two distinct audiences*: retail **customers** (onboarding guidance, document upload, status checks) and internal **compliance analysts** (natural-language interrogation of alerts and cases).

The conversational layer is not a bolt-on: it is the primary interface. This is what makes the requirement set coherent — chatbot, NLP, integration, scalability and performance requirements all attach to the same KYC/AML core, producing one traceability matrix rather than several.

### 1.1 In scope
- REST API (Node.js 18+, Express, PostgreSQL 13+)
- Chatbot intent recognition, entity extraction, dialogue state, escalation
- KYC onboarding and CDD/EDD workflows
- AML rule engine (threshold, structuring, velocity, geography, layering, mule-network)
- Alert lifecycle and SAR generation
- Integration contracts with core banking, screening providers, document OCR/IDV, and case management

### 1.2 Out of scope
- Production ML model training (the NLP layer is a deterministic, rule-and-lexicon classifier standing in for a hosted LLM/NLU service — see §4 note)
- Front-end web/mobile clients
- Real filing to a regulator's live gateway (FinCEN/FIU submission is stubbed)
- Physical/cloud infrastructure provisioning

### 1.3 Requirement ID scheme

Numbers are **globally unique** across the whole document, not merely unique within a prefix. This is a deliberate RTM design decision: a bare number in a defect report or commit message unambiguously identifies one requirement, with no prefix needed to disambiguate.

| Prefix | Range | Family |
|---|---|---|
| `REQ-CHT` | 101–112 | Chatbot functionality |
| `REQ-NLP` | 201–212 | NLP capabilities |
| `REQ-KYC` | 301–314 | Know Your Customer |
| `REQ-AML` | 401–414 | Anti-Money Laundering |
| `REQ-INT` | 501–510 | Integration with existing systems |
| `REQ-NFR` | 601–618 | Scalability, performance, security, availability, audit |

### 1.4 Legend

**Priority (MoSCoW):** `M` Must · `S` Should · `C` Could · `W` Won't (this release)

**Verification method:**
- `AUTO` — verified by the automated Jest/Supertest suite in this repository
- `PERF` — requires a load-testing harness (k6/Artillery); **specified but not executed in this release** (see [11-test-report.md](11-test-report.md) §6)
- `MAN` — manual/exploratory test
- `INSP` — verified by design review, inspection or static analysis

---

## 2. Stakeholders

| Stakeholder | Interest | Primary requirements |
|---|---|---|
| Chief Compliance Officer | Regulatory defensibility, audit trail, SAR quality | REQ-AML-*, REQ-NFR-608 |
| AML Analyst / Investigator | Low false-positive rate, fast case triage, NL querying | REQ-AML-407/408, REQ-CHT-108 |
| Retail Customer | Fast, low-friction onboarding in own language | REQ-CHT-*, REQ-KYC-301/304 |
| Head of Engineering | Scalability, maintainability, integration cost | REQ-NFR-*, REQ-INT-* |
| Data Protection Officer | PII minimisation, retention, encryption, right-to-erasure | REQ-NFR-609/610/612 |
| Regulator (external) | CDD adequacy, timely SAR filing, record retention | REQ-KYC-303, REQ-AML-409/412 |
| Test Manager (this role) | Testability, traceability, coverage evidence | Whole document |

---

## 3. Chatbot Functionality — `REQ-CHT-1xx`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-CHT-101** | The platform shall expose a conversational endpoint that accepts a free-text user message and returns a structured reply containing the bot response, detected intent and confidence. | `POST /api/v1/chat/message` with `{sessionId, message}` returns `200` and a body containing `reply`, `intent`, `confidence`, `entities`. | M | AUTO |
| **REQ-CHT-102** | The chatbot shall maintain conversation session state so that multi-turn dialogues retain context across messages. | Creating a session then sending two related messages: the second reply reflects context from the first; both messages are persisted against the same `session_id`. | M | AUTO |
| **REQ-CHT-103** | The chatbot shall support a slot-filling dialogue for KYC onboarding, prompting for each mandatory attribute still missing. | Given a partial onboarding utterance, the reply names the next missing mandatory field; when all slots are filled the bot confirms readiness to submit. | M | AUTO |
| **REQ-CHT-104** | The chatbot shall answer KYC application status queries for an identified customer. | Query "what is my KYC status" for a resolvable customer returns that customer's current `kyc_status`. | M | AUTO |
| **REQ-CHT-105** | The chatbot shall escalate to a human agent when intent confidence falls below the configured threshold, or on explicit user request, or after 3 consecutive unrecognised inputs. | Reply carries `escalated: true` and `escalationReason`; the message row records `escalated = true`. | M | AUTO |
| **REQ-CHT-106** | The chatbot shall never disclose another customer's data; every data-bearing response shall be scoped to the authenticated principal. | A `CUSTOMER`-role token asking about a different customer's status receives a refusal, not the data. | M | AUTO |
| **REQ-CHT-107** | The chatbot shall provide a guided document-upload flow that states which document types are acceptable for the customer's jurisdiction. | Intent `upload_document` returns the accepted `document_type` list for the customer's country. | S | AUTO |
| **REQ-CHT-108** | The chatbot shall let compliance analysts query alerts in natural language (e.g. "show me open critical alerts from last week"). | An analyst-role query returns matching alerts filtered by the extracted severity, status and time-range entities. | S | AUTO |
| **REQ-CHT-109** | The chatbot shall return a safe, non-committal fallback response for out-of-domain input without fabricating compliance guidance. | Off-topic input yields intent `unknown` and a fallback reply offering escalation; the reply must not assert any KYC/AML outcome. | M | AUTO |
| **REQ-CHT-110** | The chatbot shall persist a full transcript of every conversation, including detected intent and latency per message, for audit purposes. | After a conversation, `chat_messages` contains one row per turn with `detected_intent` and `response_time_ms` populated. | M | AUTO |
| **REQ-CHT-111** | The chatbot shall be reachable over web, mobile, WhatsApp, SMS and voice channels via a single channel-agnostic API. | `channel` is accepted and persisted on session creation; invalid channels are rejected with `400`. | S | AUTO |
| **REQ-CHT-112** | The chatbot shall present a regulatory disclaimer on the first turn of any session that touches advice-adjacent topics. | First bot reply in a session includes `disclaimer`. | C | AUTO |

---

## 4. NLP Capabilities — `REQ-NLP-2xx`

> **Design note (important for testability).** In production this layer would call a hosted LLM/NLU service. A non-deterministic remote model makes assertions flaky and makes the RTM meaningless. The platform therefore defines a `NluProvider` interface with a **deterministic rule-and-lexicon implementation** as the default. Requirements below are written against that interface, so they remain valid when a hosted model is swapped in — and the test suite stays deterministic. This is a testability trade-off made consciously, and is discussed in [12-genai-process-report.md](12-genai-process-report.md) §5.2.

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-NLP-201** | The NLP engine shall classify each inbound message into exactly one intent drawn from the published intent catalogue, with a confidence score in `[0,1]`. | For each catalogued intent, a representative utterance yields the correct intent with `confidence >= 0.70`. | M | AUTO |
| **REQ-NLP-202** | The intent catalogue shall cover at minimum: `greeting`, `onboarding_start`, `provide_personal_details`, `upload_document`, `check_kyc_status`, `query_alerts`, `explain_risk_rating`, `report_suspicious_activity`, `human_handoff`, `goodbye`, `unknown`. | All 11 intents are resolvable and enumerable via `GET /api/v1/chat/intents`. | M | AUTO |
| **REQ-NLP-203** | The NLP engine shall extract typed entities: `PERSON_NAME`, `DATE`, `COUNTRY`, `MONEY_AMOUNT`, `CURRENCY`, `DOCUMENT_TYPE`, `EMAIL`, `ALERT_SEVERITY`, `TIME_RANGE`. | Each entity type is extracted from a representative utterance with correct normalised value. | M | AUTO |
| **REQ-NLP-204** | Monetary amounts shall be normalised to a numeric value plus ISO-4217 currency, handling `$`, `USD`, thousands separators and `k`/`m` suffixes. | `"$9,500"` → `{amount: 9500, currency: "USD"}`; `"12k EUR"` → `{amount: 12000, currency: "EUR"}`. | M | AUTO |
| **REQ-NLP-205** | Relative time expressions shall be normalised to an absolute `[from, to]` window. | `"last week"`, `"yesterday"`, `"last 30 days"` each resolve to a bounded window with `from < to`. | S | AUTO |
| **REQ-NLP-206** | Intent classification shall be case-, punctuation- and whitespace-insensitive. | `"CHECK MY KYC STATUS!!!"`, `"check my kyc status"` and `"  check my  kyc status  "` all yield `check_kyc_status`. | M | AUTO |
| **REQ-NLP-207** | The engine shall tolerate common misspellings of domain terms via fuzzy matching without changing the resolved intent. | `"kyc statsu"`, `"sanctons screening"` resolve to the same intents as correct spellings. | S | AUTO |
| **REQ-NLP-208** | The engine shall detect message language and return an ISO-639-1 code, supporting at minimum `en`, `es`, `fr`, `de`. | A Spanish greeting returns `language: "es"`. | S | AUTO |
| **REQ-NLP-209** | Confidence below the configurable threshold (default `0.60`) shall resolve to intent `unknown` rather than the nearest guess. | An ambiguous utterance returns `unknown` with the pre-threshold best-guess exposed as `candidateIntent` for tuning. | M | AUTO |
| **REQ-NLP-210** | The engine shall redact detected PII from log output while retaining it in the encrypted transcript store. | Log formatter output for a message containing an email/ID number contains `[REDACTED]`, not the raw value. | M | AUTO |
| **REQ-NLP-211** | Negation shall be handled so that a negated statement is not classified as an affirmative intent. | `"I do not want to upload a document"` does **not** classify as `upload_document`. | S | AUTO |
| **REQ-NLP-212** | The engine shall reject or safely truncate messages exceeding 2,000 characters to bound processing cost. | A 5,000-character message returns `400` with a machine-readable error code. | S | AUTO |

---

## 5. KYC Requirements — `REQ-KYC-3xx`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-KYC-301** | The platform shall onboard a customer capturing full legal name, date of birth, nationality, residential address, country, email, occupation, annual income and source of funds. | `POST /api/v1/customers` with a valid payload returns `201` and a `customer_ref`; a persisted row matches the payload. | M | AUTO |
| **REQ-KYC-302** | All mandatory CIP fields shall be validated; incomplete or malformed submissions shall be rejected with field-level errors. | Missing `country` returns `400` with `details` naming `country`; no customer row is created. | M | AUTO |
| **REQ-KYC-303** | The platform shall reject applicants under 18 years of age. | DOB implying age 17 returns `400` with error code `UNDERAGE_APPLICANT`. | M | AUTO |
| **REQ-KYC-304** | The platform shall accept identity and address documents of types `PASSPORT`, `NATIONAL_ID`, `DRIVERS_LICENSE`, `UTILITY_BILL`, `BANK_STATEMENT`. | Each type is accepted; an unlisted type returns `400`. | M | AUTO |
| **REQ-KYC-305** | Expired documents shall be marked `EXPIRED` and shall not satisfy the verification requirement. | Uploading a document with a past `expiry_date` yields `verification_status = 'EXPIRED'` and leaves KYC unverified. | M | AUTO |
| **REQ-KYC-306** | Document verification shall validate document-number format per document type and record a failure reason on mismatch. | A passport number failing the format rule yields `FAILED` with a populated `failure_reason`. | M | AUTO |
| **REQ-KYC-307** | A customer shall reach `VERIFIED` only when at least one identity document **and** one address document are `VERIFIED`, and screening status is not `CONFIRMED_MATCH`. | Identity-only evidence leaves status `IN_REVIEW`; adding a verified address document transitions to `VERIFIED`. | M | AUTO |
| **REQ-KYC-308** | The platform shall compute a 0–100 risk score from weighted factors — country risk, PEP status, occupation, income band, source of funds, document integrity, screening outcome — and derive a rating of `LOW`/`MEDIUM`/`HIGH`/`PROHIBITED`. | Score is deterministic for identical input; each contributing factor is itemised in the response. | M | AUTO |
| **REQ-KYC-309** | Every scoring run shall be persisted immutably with its factor breakdown, so any historical decision can be reconstructed. | Re-scoring appends a new `risk_assessments` row; prior rows are unchanged. | M | AUTO |
| **REQ-KYC-310** | Customers rated `HIGH` shall be routed to Enhanced Due Diligence and shall not auto-approve. | A HIGH-rated customer's `kyc_status` becomes `IN_REVIEW` with `edd_required = true` in the response. | M | AUTO |
| **REQ-KYC-311** | Customers from prohibited jurisdictions shall be rated `PROHIBITED` and rejected outright. | Onboarding from a prohibited country yields rating `PROHIBITED` and `kyc_status = 'REJECTED'`. | M | AUTO |
| **REQ-KYC-312** | The platform shall detect duplicate customers by normalised email and prevent a second active record. | Re-submitting an existing email returns `409` with code `DUPLICATE_CUSTOMER`. | M | AUTO |
| **REQ-KYC-313** | KYC records shall carry a periodic-review due date driven by risk rating (HIGH 1y, MEDIUM 2y, LOW 3y). | Response exposes `nextReviewDate` consistent with the rating. | S | AUTO |
| **REQ-KYC-314** | The platform shall support retrieving a consolidated customer profile — details, documents, latest risk assessment, screening result and alert count — in a single call. | `GET /api/v1/customers/:id/profile` returns all five sections. | S | AUTO |

---

## 6. AML Requirements — `REQ-AML-4xx`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-AML-401** | The platform shall ingest transactions capturing amount, currency, direction, channel, counterparty name/account/country, description and timestamp. | `POST /api/v1/transactions` returns `201` and persists all fields. | M | AUTO |
| **REQ-AML-402** | Every ingested transaction shall be screened synchronously by the rule engine before the response is returned. | Response includes a `triggeredAlerts` array (possibly empty) reflecting rules evaluated for that transaction. | M | AUTO |
| **REQ-AML-403** | **Rule AML-R01 (Threshold):** a single cash transaction at or above the reporting threshold (default `10,000` USD) shall raise a `HIGH` alert. | A `10,000` cash transaction raises `AML-R01`; `9,999` does not. Boundary is inclusive. | M | AUTO |
| **REQ-AML-404** | **Rule AML-R02 (Structuring):** three or more cash transactions each between 50% and 100% of the threshold, by one customer within a 72-hour window and summing to at least the threshold, shall raise a `CRITICAL` alert. | Three `$4,000` cash deposits in 24h raise `AML-R02` with the contributing transaction refs in `details`. | M | AUTO |
| **REQ-AML-405** | **Rule AML-R03 (Velocity):** more than 15 transactions by one customer in a rolling 24-hour window shall raise a `MEDIUM` alert. | The 16th transaction in the window raises `AML-R03`; the 15th does not. | M | AUTO |
| **REQ-AML-406** | All rule thresholds and windows shall be configurable per environment without code change or redeployment. | Overriding threshold config changes rule behaviour with no source edit. | M | AUTO |
| **REQ-AML-407** | **Rule AML-R04 (High-risk geography):** a transaction whose counterparty country is on the high-risk list shall raise an alert, escalated to `CRITICAL` when the amount exceeds 50% of the threshold. | A wire to a high-risk jurisdiction raises `AML-R04` at the correct severity. | M | AUTO |
| **REQ-AML-408** | **Rule AML-R05 (Rapid layering / pass-through):** a large credit followed within 24 hours by debits returning 90%+ of that value shall raise a `CRITICAL` alert. | The in-then-out pattern raises `AML-R05` with the computed pass-through ratio in `details`. | M | AUTO |
| **REQ-AML-409** | **Rule AML-R06 (Dormant reactivation):** an account inactive 180+ days that receives a transaction above 25% of the threshold shall raise a `MEDIUM` alert. | Reactivation pattern raises `AML-R06`. | S | AUTO |
| **REQ-AML-410** | **Rule AML-R07 (Round-amount clustering):** five or more round-figure transactions (exact multiples of 1,000) by one customer within 7 days shall raise a `LOW` alert. | Five `$5,000` transfers in a week raise `AML-R07`. | C | AUTO |
| **REQ-AML-411** | Alerts shall follow the lifecycle `OPEN → IN_REVIEW → (ESCALATED \| CLOSED_FALSE_POSITIVE \| CLOSED_CONFIRMED)`; invalid transitions shall be rejected. | `PATCH` to a valid next state succeeds; `OPEN → CLOSED_CONFIRMED` without review returns `409 INVALID_TRANSITION`. | M | AUTO |
| **REQ-AML-412** | The platform shall generate a SAR from one or more confirmed alerts, including an auto-drafted narrative, aggregate amount and the contributing alert references. | `POST /api/v1/sars` from confirmed alerts returns `201` with `sar_ref` and a narrative naming the customer and triggered rules. | M | AUTO |
| **REQ-AML-413** | A SAR shall not be creatable from alerts that are not in a confirmed state. | Attempting a SAR from an `OPEN` alert returns `409`. | M | AUTO |
| **REQ-AML-414** | Only users holding `COMPLIANCE_OFFICER` or `ADMIN` role shall be permitted to file (submit) a SAR. | An `ANALYST` token receives `403` on submit; a `COMPLIANCE_OFFICER` token succeeds. | M | AUTO |

---

## 7. Integration with Existing Systems — `REQ-INT-5xx`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-INT-501** | All integrations shall sit behind versioned adapter interfaces so a provider can be replaced without touching business logic. | Each adapter exposes a documented interface with a swappable simulated implementation. | M | INSP |
| **REQ-INT-502** | The platform shall integrate with the **core banking system** to pull account and balance data. | Core-banking adapter returns account data; failures degrade gracefully per REQ-INT-507. | M | AUTO |
| **REQ-INT-503** | The platform shall integrate with an **external sanctions/PEP/adverse-media screening provider** and persist every screening response. | `POST /api/v1/customers/:id/screen` records a `screening_results` row with match score and type. | M | AUTO |
| **REQ-INT-504** | The platform shall integrate with a **document OCR / identity-verification provider** returning extracted fields and an authenticity score. | IDV adapter returns extracted fields; results drive `verification_status`. | M | AUTO |
| **REQ-INT-505** | The platform shall integrate with a **case management system**, pushing an external case reference onto escalated alerts. | Escalating an alert populates `details.externalCaseRef`. | S | AUTO |
| **REQ-INT-506** | The platform shall expose webhooks for `customer.verified`, `alert.created` and `sar.filed`. | Registered webhook subscribers receive a signed payload per event. | S | AUTO |
| **REQ-INT-507** | Every outbound integration shall apply a timeout, bounded retry with exponential backoff, and a circuit breaker; an unavailable non-critical provider shall degrade gracefully rather than fail the request. | Simulated provider outage returns `503` with `PROVIDER_UNAVAILABLE` for critical calls, and a degraded-but-successful result for non-critical ones; retries are capped. | M | AUTO |
| **REQ-INT-508** | Integration credentials shall be supplied by environment configuration, never committed to source. | No secret literals in source; `.env` is git-ignored. | M | INSP |
| **REQ-INT-509** | All API responses shall use a consistent envelope (`success`, `data`, `error`, `meta`, `requestId`) to simplify downstream consumption. | Every endpoint conforms, success and error alike. | M | AUTO |
| **REQ-INT-510** | The API shall be versioned by URL path (`/api/v1/...`) so consumers are insulated from breaking change. | All routes are served under `/api/v1`; an unknown version returns `404`. | M | AUTO |

---

## 8. Non-Functional: Scalability, Performance, Security, Availability — `REQ-NFR-6xx`

### 8.1 Performance

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-NFR-601** | Chatbot message round-trip shall complete within **500 ms at p95** under nominal load (100 concurrent sessions). | p95 ≤ 500 ms measured over ≥1,000 messages. | M | PERF |
| **REQ-NFR-602** | Synchronous AML screening of a transaction shall complete within **200 ms at p95**, and the API shall report per-request processing time. | Response `meta.processingTimeMs` present; p95 ≤ 200 ms under load. Functional smoke asserts the field and a generous local ceiling. | M | PERF + AUTO |
| **REQ-NFR-603** | Customer onboarding (including screening and scoring) shall complete within **2 s at p95**. | p95 ≤ 2,000 ms. | M | PERF |
| **REQ-NFR-604** | Alert list queries shall return within **1 s at p95** over a 1,000,000-row transaction table. | p95 ≤ 1,000 ms at stated volume. | S | PERF |

### 8.2 Scalability

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-NFR-605** | The API shall enforce per-client rate limiting (default 100 requests/minute) returning `429` with `Retry-After` when exceeded. | Exceeding the limit returns `429` and a `Retry-After` header. | M | AUTO |
| **REQ-NFR-606** | The application shall be **stateless** so instances can scale horizontally behind a load balancer; no session affinity may be required. | Conversation state lives in PostgreSQL, not process memory; verified by inspection plus a test proving a second app instance can continue an existing session. | M | AUTO + INSP |
| **REQ-NFR-607** | The platform shall sustain **1,000 transactions/second** ingest and **10,000 concurrent chat sessions**. | Sustained throughput at stated concurrency with error rate < 0.1%. | M | PERF |
| **REQ-NFR-608** | Database access shall use a bounded connection pool sized by environment, and shall not leak connections under error conditions. | Pool max is configurable; repeated failing requests do not exhaust the pool. | M | AUTO |
| **REQ-NFR-609** | Transaction ingest shall support batch submission of up to 500 records in one call to reduce per-request overhead at scale. | A 500-record batch succeeds; 501 returns `400`. | S | AUTO |

### 8.3 Security

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-NFR-610** | All non-public endpoints shall require a valid bearer JWT; missing or invalid tokens return `401`. | Unauthenticated request returns `401 UNAUTHENTICATED`. | M | AUTO |
| **REQ-NFR-611** | Authorisation shall be role-based (`CUSTOMER`, `ANALYST`, `SENIOR_ANALYST`, `COMPLIANCE_OFFICER`, `ADMIN`); insufficient role returns `403`. | Role matrix enforced per endpoint. | M | AUTO |
| **REQ-NFR-612** | All database access shall use parameterised queries; the platform shall be immune to SQL injection. | Injection payloads in every string input are stored/rejected as inert data — never executed. | M | AUTO |
| **REQ-NFR-613** | Passwords shall be stored only as salted bcrypt hashes (cost ≥ 10); plaintext must never be persisted or logged. | `password_hash` is a bcrypt digest; no plaintext appears in the row. | M | AUTO |
| **REQ-NFR-614** | Security response headers shall be set on every response (via Helmet), and `X-Powered-By` shall be suppressed. | Headers present; `X-Powered-By` absent. | M | AUTO |
| **REQ-NFR-615** | PII shall be redacted from application logs. | Log output contains `[REDACTED]` in place of emails, ID and document numbers. | M | AUTO |
| **REQ-NFR-616** | Error responses shall not leak stack traces, SQL fragments or internal paths in non-development environments. | A forced internal error returns a generic message with a `requestId` and no `stack`. | M | AUTO |

### 8.4 Availability, Observability & Audit

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| **REQ-NFR-617** | The platform shall expose `/health` (liveness) and `/health/ready` (readiness, including DB connectivity) endpoints. | `/health` returns `200` always; `/health/ready` returns `503` when the database is unreachable. | M | AUTO |
| **REQ-NFR-618** | Every state-changing operation shall append an immutable audit record capturing actor, action, entity, before/after state and timestamp; audit rows shall never be updated or deleted. | Onboarding, alert status change and SAR filing each append an `audit_log` row with before/after state. | M | AUTO |

---

## 9. Requirement Summary

| Family | Count | Must | Should | Could | AUTO | PERF | INSP |
|---|---|---|---|---|---|---|---|
| Chatbot (`REQ-CHT`) | 12 | 8 | 3 | 1 | 12 | 0 | 0 |
| NLP (`REQ-NLP`) | 12 | 7 | 5 | 0 | 12 | 0 | 0 |
| KYC (`REQ-KYC`) | 14 | 11 | 3 | 0 | 14 | 0 | 0 |
| AML (`REQ-AML`) | 14 | 12 | 1 | 1 | 14 | 0 | 0 |
| Integration (`REQ-INT`) | 10 | 7 | 3 | 0 | 8 | 0 | 2 |
| Non-functional (`REQ-NFR`) | 18 | 16 | 2 | 0 | 12 | 5 | 1 |
| **Total** | **80** | **61** | **17** | **2** | **72** | **5** | **3** |

> `REQ-NFR-602` and `REQ-NFR-606` are counted once each under their primary verification method; both additionally carry partial automated coverage as noted in §8.

**Coverage position taken by the test manager:** 72 of 80 requirements (90%) are verifiable by the automated suite in this repository. The 5 `PERF` requirements need a load harness and dedicated environment — they are specified precisely enough to be executed later, and are reported as **Not Executed**, not as passed. Claiming a p95 latency figure from a laptop-scale functional run would be the single most misleading thing this report could do.

---

## 10. Assumptions, Constraints & Open Questions

### Assumptions
1. **A1** — Sanctions/PEP screening is simulated by an internal `watchlist_entries` table standing in for a commercial provider feed.
2. **A2** — SAR submission to a regulator is stubbed at `SUBMITTED`; no live FIU gateway exists in this release.
3. **A3** — The NLP layer is deterministic by design (see §4 note) so the RTM records reproducible outcomes.
4. **A4** — All monetary thresholds are USD-denominated; multi-currency normalisation via FX rates is deferred to a later release.
5. **A5** — High-risk and prohibited jurisdiction lists are drawn from a **fictional, project-local list** for testing. They are not, and must not be read as, a real regulatory determination about any country.

### Constraints
1. **C1** — Stack fixed by the client: Node.js, Express, PostgreSQL.
2. **C2** — PostgreSQL 14 in the delivery environment: SQL must avoid PG15+ features (`MERGE`, `NULLS NOT DISTINCT`).
3. **C3** — 5 two-week sprints, team of 6 (reduced to 4 mid-project — see [06-conflict-resolution.md](06-conflict-resolution.md)).

### Open questions raised with the client
| # | Question | Status | Resolution |
|---|---|---|---|
| Q1 | Assignment specified **Pytest**, but the mandated stack is JavaScript. Which governs? | **Resolved** | Client chose a single-language JS suite. Jest + Supertest implements the equivalent scope; the deviation is recorded explicitly in [11-test-report.md](11-test-report.md) §7. |
| Q2 | Is the chatbot a separate product or the KYC/AML front door? | **Resolved** | One unified platform (§1). |
| Q3 | Is FX normalisation needed for threshold rules in v1? | Deferred | Assumption A4; raised as a v2 backlog item. |
| Q4 | Who owns SAR narrative sign-off — analyst or compliance officer? | **Resolved** | Compliance officer, per REQ-AML-414. |

---

*Baselined 29 July 2026. Changes after this point follow the change-control note in [07-sprint-review-and-adjustment.md](07-sprint-review-and-adjustment.md).*

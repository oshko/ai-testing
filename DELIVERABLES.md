# Project Deliverables
## TechSpark Solutions — KYC & AML Platform with Conversational Assistant

**Generative AI in Software Testing — combined submission document**

| Field | Value |
|---|---|
| Stack | Node.js · Express · PostgreSQL · Jest + Supertest |
| Requirements | 49 (36 automated) |
| Automated tests | 91 — all passing |
| Traceability coverage | 36 / 36 automated requirements, 0 gaps |
| Documents combined | 6 |

> **Generated file — do not edit by hand.**
> Built by `scripts/build-deliverables.js` from the six documents in `docs/`.
> Section 4 (the traceability matrix) is itself generated from a real test run,
> so regenerate after any test change:
>
> ```bash
> npm run test:report && npm run rtm && npm run deliverables
> ```

---

## Contents

1. [Requirements Specification](#1-requirements-specification)
2. [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints)
3. [Test Scenarios & Test Cases](#3-test-scenarios-test-cases)
4. [Requirements Traceability Matrix](#4-requirements-traceability-matrix)
5. [Test Execution Report](#5-test-execution-report)
6. [Generative AI in the Testing Process](#6-generative-ai-in-the-testing-process)

---

## Rubric criteria — where each is evidenced

| Criterion | Section |
|---|---|
| Requirements Gathering | [Requirements Specification](#1-requirements-specification) |
| Epic and User Story Creation | [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints) |
| Story Point Estimation and Prioritization | [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints) |
| Sprint Planning | [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints) |
| Sprint Execution and Progress Monitoring | [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints) |
| Conflict Resolution | [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints) |
| Sprint Plan Review and Adjustment | [Agile Plan — Epics, Stories, Estimation, Sprints](#2-agile-plan-epics-stories-estimation-sprints) |

The remaining sections provide the supporting test engineering evidence: documented test cases, the generated traceability matrix, execution results with defects found, and a critical analysis of using generative AI throughout.


---

# 1. Requirements Specification

> Source: `docs/01-requirements.md`

**Project:** TechSpark Solutions — KYC & AML Platform with Conversational Assistant
**Doc:** TSS-KYC-SRS-v1.0 · **Date:** 29 Jul 2026 · **Status:** Baselined
**Produced with:** Generative AI (prompts in [06-genai-report.md](#6-generative-ai-in-the-testing-process) §2)

---

### 1. Scope

One platform combining a **KYC/AML compliance engine** with a **conversational assistant** as its interface. The assistant serves customers (onboarding, documents, status) and compliance analysts (natural-language alert queries).

**In scope:** REST API (Node.js, Express, PostgreSQL), chatbot intents/entities, KYC onboarding and risk scoring, document verification, watchlist screening, AML transaction monitoring, alert lifecycle.

**Out of scope:** front-end UI, ML model training, live regulator filing, infrastructure.

#### Deliberate simplifications

| # | Simplification | Reason |
|---|---|---|
| S1 | Auth is an `x-user-role` header, not a signed JWT | Role rules stay testable without an auth stack |
| S2 | Watchlist screening uses exact name match on a local table | Stands in for a commercial provider |
| S3 | NLP is a deterministic rule/lexicon classifier, not an LLM | A non-deterministic oracle makes an RTM meaningless |
| S4 | Performance requirements specified but **not executed** | No load harness — reported *Not Executed*, never *passed* |
| S5 | Fictional jurisdictions use reserved ISO codes (`XA`,`XB`,`QM`,`XP`,`ZZ`) | Avoids labelling a real country "prohibited" in a fixture |

**Verification methods:** `AUTO` = automated Jest/Supertest · `PERF` = needs load harness · `INSP` = inspection/review · `DEFERRED` = specified for a later release, not implemented in v1

#### Coverage of the mandated requirement topics

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

### 2. Requirements

#### Chatbot — `REQ-CHT`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-CHT-01 | Conversational endpoint returning a structured reply | `POST /api/chat` → `200` with `reply`, `intent`, `confidence`, `entities`, `session_id`; empty message → `400` | Must | AUTO |
| REQ-CHT-02 | Answers KYC status queries; never invents a status | Resolvable customer → reply states `kyc_status` + `risk_rating`; unresolvable → asks for email, states no status | Must | AUTO |
| REQ-CHT-03 | States acceptable document types on request | `upload_document` reply enumerates accepted types | Must | AUTO |
| REQ-CHT-04 | Analysts query alerts in natural language; customers cannot | `ANALYST` → filtered alerts returned; `CUSTOMER` → refusal, no alert payload | Must | AUTO |
| REQ-CHT-05 | Escalates on explicit request or low confidence | `escalated: true` with `escalation_reason` of `USER_REQUESTED` / `LOW_CONFIDENCE` | Must | AUTO |
| REQ-CHT-06 | Persists full transcript with intent + confidence | One `chat_messages` row per turn; multi-turn shares `session_id` | Must | AUTO |

#### NLP — `REQ-NLP`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-NLP-01 | Single-intent classification from a published catalogue: `greeting`, `onboarding_start`, `upload_document`, `check_kyc_status`, `query_alerts`, `human_handoff`, `unknown` | Each intent's representative utterance resolves with `confidence >= 0.70`; `GET /api/intents` lists the catalogue | Must | AUTO |
| REQ-NLP-02 | Case / punctuation / whitespace insensitive | `"check my status"`, `"CHECK MY STATUS!!!"`, `"  check  my  status  "` all → `check_kyc_status` | Must | AUTO |
| REQ-NLP-03 | Typed entities: `PERSON_NAME`, `EMAIL`, `COUNTRY`, `DOCUMENT_TYPE`, `MONEY_AMOUNT`, `ALERT_SEVERITY`; amounts normalised to value + ISO-4217 | `"$9,500"` → `{9500, USD}`; `"12k EUR"` → `{12000, EUR}`; `"15 alerts"` → **not** money; lowercase words not read as ISO codes | Must | AUTO |
| REQ-NLP-04 | Below threshold (default `0.60`) → `unknown`, not the nearest guess; pre-threshold guess exposed | Out-of-domain → `unknown` + `candidate_intent`; fallback asserts no compliance outcome | Must | AUTO |
| REQ-NLP-05 | Negation handling | `"I do not want to upload a document"` ≠ `upload_document`; affirmative form still matches | Should | AUTO |
| REQ-NLP-06 | Message length limit (1,000 chars) | 1,001 chars → `400 MESSAGE_TOO_LONG` | Should | AUTO |

#### KYC — `REQ-KYC`

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

#### AML — `REQ-AML`

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
| REQ-AML-09 | **AML-R05** rapid layering (large credit, 90%+ out within 24h) → `CRITICAL` | Descoped in the sprint re-plan — see [04-agile-plan.md](#2-agile-plan-epics-stories-estimation-sprints) §6 | Could | DESCOPED |

#### Integration — `REQ-INT`

| ID | Requirement | Acceptance criteria | Pri | Verify |
|---|---|---|---|---|
| REQ-INT-01 | Screen applicants against a sanctions/PEP watchlist and act on the result | Sanctions match → `PROHIBITED`/`REJECTED`; PEP match sets `is_pep` even when the request omits it | Must | AUTO |
| REQ-INT-02 | Credentials from environment config, never source control | `.env` git-ignored; no secret literals in source | Must | INSP |
| REQ-INT-03 | Integrate with the **core banking system** to retrieve account and balance data | Adapter returns account records for a customer; an unavailable provider degrades per REQ-INT-06 rather than failing onboarding | Should | DEFERRED |
| REQ-INT-04 | Integrate with a **document OCR / identity-verification provider** returning extracted fields and an authenticity score | Provider response populates document fields; authenticity below threshold sets document status `FAILED` | Should | DEFERRED |
| REQ-INT-05 | Integrate with a **case management system**, attaching an external case reference to escalated alerts | Escalating an alert populates `details.external_case_ref` | Could | DEFERRED |
| REQ-INT-06 | Every outbound integration shall apply a timeout, bounded retry with exponential backoff, and a circuit breaker; an unavailable **non-critical** provider shall degrade gracefully rather than fail the request | Simulated outage: critical call → `503 PROVIDER_UNAVAILABLE`; non-critical call → success with a `degraded: true` flag; retries capped and observable | Must | DEFERRED |

#### Non-functional — `REQ-NFR`

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

### 3. Summary

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

### 4. Assumptions · Constraints · Open questions

**Assumptions** — A1 watchlist simulates a commercial provider · A2 single-currency thresholds, FX deferred · A3 high-risk/prohibited lists are fictional test data, not a determination about any real country.

**Constraints** — C1 stack fixed (Node/Express/PostgreSQL) · C2 PostgreSQL 14, avoid PG15+ SQL · C3 5 two-week sprints, team of 6 reduced to 4 mid-project.

| # | Open question | Status | Resolution |
|---|---|---|---|
| Q1 | Brief specified **Pytest** but the stack is JavaScript | Resolved | Client chose a single-language JS suite; Jest+Supertest covers the equivalent scope. Deviation recorded in [05-test-report.md](#5-test-execution-report) §5 |
| Q2 | Is the chatbot separate, or the KYC/AML front door? | Resolved | One unified platform |
| Q3 | FX normalisation for thresholds in v1? | Deferred | Assumption A2; v2 backlog |


---

# 2. Agile Plan — Epics, Stories, Estimation, Sprints

> Source: `docs/04-agile-plan.md`

**Project:** TechSpark Solutions KYC/AML Platform
**Team:** 6 → 4 people (see §5) · **Cadence:** 5 × 2-week sprints · **Baseline velocity:** 30 pts/sprint

---

### 1. Epics

| Epic | Title | Requirements | Points |
|---|---|---|---|
| **E1** | Customer Onboarding & KYC | REQ-KYC-01, 02, 03, 09, 11 | 26 |
| **E2** | Risk Scoring & Screening | REQ-KYC-06, 07, 08, REQ-INT-01, 02 | 29 |
| **E3** | Document Verification | REQ-KYC-04, 05, 10 | 21 |
| **E4** | AML Transaction Monitoring | REQ-AML-01…06 | 42 |
| **E5** | Alert Management | REQ-AML-07, 08 | 13 |
| **E6** | Conversational Assistant | REQ-CHT-01…06, REQ-NLP-01…06 | 34 |
| **E7** | Platform Quality & Security | REQ-NFR-01…04, 06, 08 | 21 |
| | | **Total** | **186** |

The 186 points cover the v1 scope only. Ten further requirements — integration adapters (REQ-INT-03…06), scalability features (REQ-NFR-09, 10) and performance verification (REQ-NFR-05, 07, 11) — are specified in the SRS and sit in the **v2 backlog**; they are deliberately excluded from these estimates so delivered velocity is not overstated.

---

### 2. User stories with estimates

Estimated by **planning poker** on a modified Fibonacci scale (1, 2, 3, 5, 8, 13). Priority uses **MoSCoW**; ordering within a sprint uses risk-first — the stories that could invalidate the architecture go earliest.

| ID | Epic | Story | Pts | Pri |
|---|---|---|---|---|
| US-01 | E1 | As a **customer** I can submit my details to start a KYC application, so I can open an account. | 5 | Must |
| US-02 | E1 | As a **compliance officer** I want incomplete applications rejected with every error listed, so applicants can fix the form in one pass. | 5 | Must |
| US-03 | E1 | As a **compliance officer** I want under-18 applicants rejected automatically, so we never onboard a minor. | 3 | Must |
| US-04 | E1 | As a **compliance officer** I want duplicate applications blocked by email, so one person has one record. | 5 | Must |
| US-05 | E1 | As an **analyst** I want a customer's record, documents and alert count in one view, so triage does not need three screens. | 8 | Should |
| US-06 | E2 | As a **compliance officer** I want a 0–100 risk score from itemised factors, so any rating can be explained to a regulator. | 13 | Must |
| US-07 | E2 | As a **compliance officer** I want scores mapped to LOW/MEDIUM/HIGH/PROHIBITED bands, so treatment is consistent. | 3 | Must |
| US-08 | E2 | As a **compliance officer** I want HIGH-risk customers routed to EDD, so they are never auto-approved. | 5 | Must |
| US-09 | E2 | As a **compliance officer** I want applicants screened against sanctions/PEP lists at onboarding, so we block prohibited persons. | 8 | Must |
| US-10 | E3 | As a **customer** I can upload identity and address documents, so my identity can be verified. | 8 | Must |
| US-11 | E3 | As a **compliance officer** I want document numbers format-checked and expiry enforced, so forged or stale documents are caught. | 8 | Must |
| US-12 | E3 | As a **compliance officer** I want VERIFIED to require both an identity **and** an address document, so CDD is complete. | 5 | Must |
| US-13 | E4 | As the **platform** I ingest transactions and screen each one synchronously, so nothing enters unmonitored. | 8 | Must |
| US-14 | E4 | As an **analyst** I want large cash transactions flagged, so reportable activity is not missed. | 5 | Must |
| US-15 | E4 | As an **analyst** I want structuring detected across a 72h window, so split deposits are caught. | 13 | Must |
| US-16 | E4 | As an **analyst** I want abnormal transaction velocity flagged, so account takeover is visible. | 8 | Must |
| US-17 | E4 | As an **analyst** I want high-risk and prohibited jurisdictions flagged with escalating severity, so geographic exposure surfaces. | 8 | Must |
| US-18 | E5 | As an **analyst** I want an enforced alert lifecycle, so no alert is closed without review. | 8 | Must |
| US-19 | E5 | As an **analyst** I want to filter the alert queue by severity and status, so I can work the critical ones first. | 5 | Should |
| US-20 | E6 | As a **customer** I can ask the assistant questions in plain language, so I do not need to learn a form. | 8 | Must |
| US-21 | E6 | As a **customer** I can ask about my KYC status and get my real status, never a guess. | 5 | Must |
| US-22 | E6 | As an **analyst** I can query the alert queue in natural language, so triage is faster. | 8 | Should |
| US-23 | E6 | As a **customer** I am handed to a human when the assistant is unsure, so I am not stuck in a loop. | 5 | Must |
| US-24 | E6 | As a **compliance officer** I want every conversation transcribed with detected intent, so interactions are auditable. | 8 | Must |
| US-25 | E7 | As a **consumer** I want one consistent response envelope, so error handling is uniform. | 5 | Must |
| US-26 | E7 | As a **security officer** I want compliance data role-gated, so customers cannot read alerts. | 8 | Must |
| US-27 | E7 | As a **security officer** I want parameterised SQL and no internal detail in errors, so the platform is not exploitable. | 5 | Must |
| US-28 | E7 | As **operations** I want liveness/readiness endpoints, so orchestration can manage instances. | 3 | Must |
| | | **Total** | **186** | |

**Estimation notes.** US-06 (risk scoring) and US-15 (structuring) both took 13 — not because there is much code, but because both encode judgement that has to be *right*: the PROHIBITED-as-gate decision and the structuring band definition each needed a compliance conversation before an estimate was meaningful. Complexity here is regulatory, not technical, and points reflect that.

---

### 3. Sprint plan (original)

| Sprint | Dates | Stories | Pts | Goal |
|---|---|---|---|---|
| **S1** | 4–15 May | US-01, 02, 03, 25, 28, 13 | 29 | Onboarding skeleton + API contract + ingest |
| **S2** | 18–29 May | US-06, 07, 08, 04 | 26 | Risk engine and banding |
| **S3** | 1–12 Jun | US-09, 10, 11, 12 | 29 | Screening and document verification |
| **S4** | 15–26 Jun | US-14, 15, 16, 17 | 34 | AML rule engine |
| **S5** | 29 Jun–10 Jul | US-18, 20, 21, 23, 26, 27 | 39 | Alerts, assistant, security |
| *Backlog* | — | US-05, 19, 22, 24, AML-R05 | 42 | Deferred |

Risk-first sequencing put the response envelope (US-25) in Sprint 1 deliberately: it is cheap early and expensive to retrofit across 12 endpoints later.

---

### 4. Execution & progress monitoring

| Mechanism | Cadence | Purpose |
|---|---|---|
| Daily stand-up | Daily, 15 min | Blockers only |
| Burndown chart | Daily | Points remaining vs ideal |
| CI test run | Every push | 91 tests must stay green |
| RTM regeneration | Every sprint end | Coverage gaps become visible immediately |
| Sprint review + retro | Sprint end | Demo to compliance officer; process adjustment |

**Definition of Done:** code merged · requirement tagged in a passing test · RTM shows the requirement covered · no regression in the 91-test suite.

#### Velocity actuals

| Sprint | Planned | Completed | Note |
|---|---|---|---|
| S1 | 29 | 29 | On plan |
| S2 | 26 | 26 | On plan |
| S3 | 29 | 21 | **Two team members resigned mid-sprint** (§5) |
| S4 | 34 | 24 | Re-planned capacity (§6) |
| S5 | 39 | 24 | Re-planned capacity (§6) |
| | **157** | **124** | 79% of original plan |

Velocity fell from 29 to ~24/sprint on a 33% smaller team — a 17% throughput drop, not 33%, because the two who left were the least familiar with the compliance domain and a chunk of their time had been going into rework.

---

### 5. Conflict resolution — team attrition

**Event.** During Sprint 3 (day 4), two of six engineers resigned with two weeks' notice: the developer owning the **AML rule engine** and the QA engineer owning **test automation**.

**Immediate impact.**

| Issue | Consequence |
|---|---|
| Capacity | 6 → 4 people; velocity 29 → ~24 |
| Knowledge concentration | AML rule logic understood by one person only |
| Ownership gap | No dedicated QA engineer for the automated suite |
| Morale | Remaining team anxious about scope being held constant |
| Timeline | 42 points of committed work now unachievable |

**Resolution actions.**

| # | Action | Outcome |
|---|---|---|
| 1 | **Knowledge transfer first.** Reassigned the departing AML developer from new features to documenting the rule engine and pairing for their remaining 8 days. | Rule design, threshold rationale and window semantics captured in code comments and `src/aml.js` header — the single highest-value use of a leaver's notice period. |
| 2 | **Rule registry refactor.** Restructured the engine so each rule is an independent function in a `RULES` array. | A new rule is one function plus one registry entry, so onboarding a replacement no longer means understanding all rules at once. |
| 3 | **Testing became a shared responsibility.** Removed the dedicated-QA model; each developer writes tests for their own story, with the Test Manager reviewing traceability. | Test count kept growing (91 by S5) with no QA specialist. |
| 4 | **Automated the RTM.** Replaced the hand-maintained matrix with `scripts/generate-rtm.js` parsing Jest output. | Removed the task most likely to be dropped by a stretched team, and made coverage gaps impossible to hide. |
| 5 | **Renegotiated scope, not quality.** Took a descope proposal to the compliance officer rather than silently slipping. | AML-R05 and three Should stories deferred; **zero Must requirements dropped**. |
| 6 | **Held the Definition of Done.** Explicitly refused to relax the "requirement tagged in a passing test" rule. | Quality bar constant; the 91-test suite stayed green throughout. |

**Principle applied.** With fixed time and reduced capacity, the variable had to be *scope*, not *quality*. In a compliance platform, shipping an untested AML rule is worse than shipping one fewer rule: the first creates false assurance a regulator will eventually test for you.

---

### 6. Sprint plan review & adjustment

Re-planned at the Sprint 3 review with capacity at 24 points/sprint.

| Sprint | Original | Revised | Change |
|---|---|---|---|
| **S3** | US-09, 10, 11, 12 (29) | US-09, 10, 11 (21) | US-12 → S4 |
| **S4** | US-14, 15, 16, 17 (34) | US-12, 14, 15 (26 → 24 delivered) | US-16, 17 → S5 |
| **S5** | US-18, 20, 21, 23, 26, 27 (39) | US-16, 17, 18, 26, 27 (34 → 24 delivered) | US-20, 21, 23 → S6 |
| **S6** *(added)* | — | US-20, 21, 23, 05, 19, 22, 24 | New sprint |
| *Descoped* | — | **AML-R05** (REQ-AML-09) | Formally removed from v1 |

**Prioritisation decisions at the re-plan:**

1. **AML rules before the chatbot.** The monitoring rules are the regulatory obligation; the assistant is a convenience. When capacity is short, keep the obligation.
2. **Security stories stayed in S5.** US-26/27 were never candidates for deferral — a platform holding KYC PII cannot ship with access control "coming next sprint."
3. **AML-R05 descoped rather than rushed.** Layering detection needs a pass-through ratio calibrated against real transaction data the team did not have. A miscalibrated rule generates false positives that erode analyst trust in *every* alert, so shipping it badly was worse than not shipping it.
4. **US-05, 19, 22, 24 deferred as convenience features.** All improve analyst efficiency; none is a control.

**Outcome:** all 33 Must requirements delivered and verified. 36 of 40 requirements automated, 91/91 tests passing, one requirement formally descoped with the compliance officer's agreement, one requiring a load harness not available in this release.


---

# 3. Test Scenarios & Test Cases

> Source: `docs/02-test-cases.md`

**Project:** TechSpark Solutions KYC/AML Platform · **Date:** 29 Jul 2026
**Total automated cases:** 91 across 4 suites · **Results:** [03-rtm.md](#4-requirements-traceability-matrix) · **Summary:** [05-test-report.md](#5-test-execution-report)

---

### 1. Approach

| Aspect | Decision |
|---|---|
| Level | API / integration — tests drive real HTTP endpoints against a real PostgreSQL database |
| Environment | Separate `kyc_aml_test` database, truncated before every test |
| Oracle | Synthetic fixtures in `data/synthetic-dataset.json` carry an `expected` field, so the data *is* the oracle |
| Traceability | Every test is named `TC-<AREA>-<NN> [REQ-<AREA>-<NN>] description`; the RTM is parsed from these IDs |
| Determinism | Seeded data generator + rule-based NLP — no random or model-dependent output |

**Design bias — boundaries over happy paths.** For every threshold rule there is a paired test at the boundary and one unit outside it (10,000 vs 9,999 cash; 11 vs 10 transactions; age 18 vs 17). Threshold-adjacent errors are the defects that actually escape to production in compliance systems, because the happy path is what everyone tests by hand.

---

### 2. Test scenarios

| Scenario | Area | Cases | Requirements |
|---|---|---|---|
| TS-01 Customer onboarding — valid data, persistence | KYC | TC-KYC-01 | REQ-KYC-01 |
| TS-02 Input validation — missing, malformed, multi-field | KYC | TC-KYC-02, 03 | REQ-KYC-02 |
| TS-03 Age eligibility boundary | KYC | TC-KYC-04, 05 | REQ-KYC-03 |
| TS-04 Duplicate detection incl. case-insensitivity | KYC | TC-KYC-06, 07 | REQ-KYC-09 |
| TS-05 Risk scoring — itemisation, determinism, fail-closed, hard gate | KYC | TC-KYC-08, 09, 14, 15 | REQ-KYC-06 |
| TS-06 Risk banding and EDD routing | KYC | TC-KYC-10, 11 | REQ-KYC-07, 08 |
| TS-07 Prohibited jurisdiction and sanctions rejection | KYC | TC-KYC-12, 13 | REQ-KYC-05, REQ-INT-01 |
| TS-08 Document verification — format, expiry, unsupported type, severity order | KYC | TC-KYC-16–22 | REQ-KYC-04, 05 |
| TS-09 Verification gate — identity + address required | KYC | TC-KYC-23, 24 | REQ-KYC-10 |
| TS-10 Consolidated profile retrieval | KYC | TC-KYC-25, 26 | REQ-KYC-11 |
| TS-11 Transaction ingest and validation | AML | TC-AML-01–03 | REQ-AML-01 |
| TS-12 AML-R01 cash threshold, inclusive boundary | AML | TC-AML-04–07 | REQ-AML-02 |
| TS-13 AML-R02 structuring, band limits, suppression | AML | TC-AML-08–12 | REQ-AML-03 |
| TS-14 AML-R03 velocity, rolling window | AML | TC-AML-13–15 | REQ-AML-04 |
| TS-15 AML-R04 geography, severity escalation | AML | TC-AML-16–20 | REQ-AML-05 |
| TS-16 Threshold configurability | AML | TC-AML-21, 22 | REQ-AML-06 |
| TS-17 Alert lifecycle and invalid transitions | AML | TC-AML-23–26 | REQ-AML-07 |
| TS-18 Alert access control and filtering | AML | TC-AML-27–29 | REQ-AML-08, REQ-NFR-02 |
| TS-19 Intent classification, thresholds, negation | Chatbot | TC-CHT-01–07 | REQ-CHT-01, REQ-NLP-01, 02, 04, 05 |
| TS-20 Entity extraction and normalisation | Chatbot | TC-CHT-08–13 | REQ-NLP-03 |
| TS-21 Dialogue behaviour and role scoping | Chatbot | TC-CHT-14–21 | REQ-CHT-02, 03, 04, 05 |
| TS-22 Transcript persistence and input limits | Chatbot | TC-CHT-22–25 | REQ-CHT-06, REQ-NLP-06 |
| TS-23 API contract and health | API | TC-NFR-01–06 | REQ-NFR-01, 04 |
| TS-24 Security — injection, error leakage, framework disclosure | API | TC-NFR-07–11 | REQ-NFR-02, 03 |

---

### 3. Representative detailed test cases

The full 91-case list with results is in [03-rtm.md](#4-requirements-traceability-matrix) §3. Ten cases are expanded here to show the level of detail applied throughout.

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| **TC-KYC-04** | REQ-KYC-03 | Empty database | `POST /api/customers` with `date_of_birth` = 2012-01-01 | `400`, `error.code = UNDERAGE_APPLICANT`, no customer row |
| **TC-KYC-05** | REQ-KYC-03 | Empty database | `POST /api/customers` with DOB exactly 18 years ago today | `201` — boundary is inclusive (`>= 18`, not `> 18`) |
| **TC-KYC-15** | REQ-KYC-06 | — | Score a customer with high-risk country + PEP + high-risk occupation + 2 failed + 1 expired document | `score <= 99`, `rating = HIGH`, `prohibited = false` — ordinary factors can never reach the PROHIBITED gate |
| **TC-KYC-20** | REQ-KYC-05 | — | Verify a passport that is both malformed **and** expired | `status = FAILED` — forgery signal outranks an expiry lapse |
| **TC-KYC-23** | REQ-KYC-10 | Low-risk customer, no documents | Upload valid passport, assert; then upload valid utility bill, assert | After passport: `documents_sufficient = false`, `IN_REVIEW`. After bill: `true`, `VERIFIED` |
| **TC-AML-05** | REQ-AML-02 | Verified customer | `POST /api/transactions` amount 9,999 channel CASH | No `AML-R01` — threshold is inclusive at 10,000, so 9,999 is clean |
| **TC-AML-08** | REQ-AML-03 | Verified customer | Post 6,000 CASH at −20h, −10h, then now | `AML-R02` `CRITICAL`, `transaction_count = 3`, `aggregate_amount = 18000`, 3 contributing refs |
| **TC-AML-12** | REQ-AML-03 | 3 in-band deposits already alerted | Post a 4th in-band 6,000 CASH deposit | `suppressed_rules` contains `AML-R02`; exactly **1** R02 alert in the database |
| **TC-AML-24** | REQ-AML-07 | One `OPEN` alert | `PATCH /api/alerts/:id` → `CLOSED_CONFIRMED` as ANALYST | `409 INVALID_TRANSITION`, `details.allowed = ["IN_REVIEW"]` |
| **TC-NFR-08** | REQ-NFR-03 | Empty database | `POST /api/customers` with `full_name` = `Robert'); DROP TABLE customers;--` | `201`; name stored verbatim; `customers` table still exists with 1 row |

---

### 4. Negative and edge coverage

Deliberately included, because these are where compliance logic fails in practice:

- **Boundaries both sides** — 10,000/9,999 cash; 11/10 transactions; 18/17 years; 3/2 structuring deposits
- **Below-band exclusion** — three 1,000 cash deposits are *not* structuring (not a plausible split of a reportable amount)
- **Window exclusion** — 12 transactions over 5 days do not breach a 24-hour velocity limit
- **Suppression** — a repeating pattern raises one alert, not one per subsequent transaction
- **Fail-closed** — an unknown country code scores *higher* than a known low-risk one
- **Negation** — "I do **not** want to upload a document" must not be an upload request
- **False-positive guard** — "15 alerts" is not `$15`; lowercase "in"/"us" are not India/United States
- **Silence on ignorance** — the bot never states a KYC status for a customer it cannot identify
- **Non-leakage** — a forced 500 returns no stack trace, SQL fragment, or framework header

---

### 5. Out of scope for this cycle

| Not tested | Why |
|---|---|
| Latency / throughput under load (REQ-NFR-05) | No load harness — reported *Not Executed* |
| Concurrency races on simultaneous ingest for one customer | Single-threaded suite; noted as residual risk |
| Fuzzy/phonetic name screening | Simplification S2 — exact match only |
| Real JWT signing and expiry | Simplification S1 — header-based role |


---

# 4. Requirements Traceability Matrix

> Source: `docs/03-rtm.md`

> **Generated file — do not edit by hand.**
> Produced by `scripts/generate-rtm.js` from `reports/jest-results.json`.
> Regenerate with: `npm run test:report && npm run rtm`

| Field | Value |
|---|---|
| Run started | 2026-07-30 00:35:54 UTC |
| Test suites | 4 |
| Tests executed | 91 |
| Passed | 91 |
| Failed | 0 |
| Requirements in baseline | 49 |
| Automated requirements | 36 |
| Automated requirements covered | 36 / 36 |
| Coverage gaps | 0 |

### 1. Requirement → Test Case → Result

| Requirement | Description | Pri | Method | Test cases | Pass | Fail | Status |
|---|---|---|---|---|---|---|---|
| REQ-CHT-01 | Conversational endpoint returns structured reply | Must | AUTO | TC-CHT-01, TC-CHT-24 | 2 | 0 | PASS |
| REQ-CHT-02 | Answers KYC status queries; never invents a status | Must | AUTO | TC-CHT-14, TC-CHT-15 | 2 | 0 | PASS |
| REQ-CHT-03 | States acceptable document types | Must | AUTO | TC-CHT-16 | 1 | 0 | PASS |
| REQ-CHT-04 | Analyst NL alert query; withheld from customers | Must | AUTO | TC-CHT-17, TC-CHT-18, TC-CHT-19 | 3 | 0 | PASS |
| REQ-CHT-05 | Escalates to human on request or low confidence | Must | AUTO | TC-CHT-20, TC-CHT-21 | 2 | 0 | PASS |
| REQ-CHT-06 | Persists full transcript with intent metadata | Must | AUTO | TC-CHT-22, TC-CHT-23 | 2 | 0 | PASS |
| REQ-NLP-01 | Intent classification from published catalogue | Must | AUTO | TC-CHT-02, TC-CHT-07 | 2 | 0 | PASS |
| REQ-NLP-02 | Case / punctuation / whitespace insensitive | Must | AUTO | TC-CHT-03 | 1 | 0 | PASS |
| REQ-NLP-03 | Typed entity extraction with amount normalisation | Must | AUTO | TC-CHT-08, TC-CHT-09, TC-CHT-10, TC-CHT-11, TC-CHT-12, TC-CHT-13 | 6 | 0 | PASS |
| REQ-NLP-04 | Below-threshold resolves to unknown, not a guess | Must | AUTO | TC-CHT-04, TC-CHT-06 | 2 | 0 | PASS |
| REQ-NLP-05 | Negation handling | Should | AUTO | TC-CHT-05 | 1 | 0 | PASS |
| REQ-NLP-06 | Message length limit | Should | AUTO | TC-CHT-25 | 1 | 0 | PASS |
| REQ-KYC-01 | Onboard customer with unique reference | Must | AUTO | TC-KYC-01 | 1 | 0 | PASS |
| REQ-KYC-02 | Validate all mandatory fields; no partial record | Must | AUTO | TC-KYC-02, TC-KYC-03 | 2 | 0 | PASS |
| REQ-KYC-03 | Reject under-18; accept exactly 18 | Must | AUTO | TC-KYC-04, TC-KYC-05 | 2 | 0 | PASS |
| REQ-KYC-04 | Document type and number-format validation | Must | AUTO | TC-KYC-16, TC-KYC-17, TC-KYC-18, TC-KYC-21, TC-KYC-22 | 5 | 0 | PASS |
| REQ-KYC-05 | Expired documents marked EXPIRED, do not verify | Must | AUTO | TC-KYC-12, TC-KYC-19, TC-KYC-20 | 3 | 0 | PASS |
| REQ-KYC-06 | Itemised deterministic risk score, fails closed | Must | AUTO | TC-KYC-08, TC-KYC-09, TC-KYC-14, TC-KYC-15 | 4 | 0 | PASS |
| REQ-KYC-07 | Score-to-rating band mapping | Must | AUTO | TC-KYC-10 | 1 | 0 | PASS |
| REQ-KYC-08 | HIGH risk routed to EDD, never auto-approved | Must | AUTO | TC-KYC-11 | 1 | 0 | PASS |
| REQ-KYC-09 | Duplicate prevention by case-insensitive email | Must | AUTO | TC-KYC-06, TC-KYC-07 | 2 | 0 | PASS |
| REQ-KYC-10 | VERIFIED needs identity + address document | Must | AUTO | TC-KYC-23, TC-KYC-24 | 2 | 0 | PASS |
| REQ-KYC-11 | Consolidated customer profile | Should | AUTO | TC-KYC-25, TC-KYC-26 | 2 | 0 | PASS |
| REQ-AML-01 | Synchronous transaction ingest and screening | Must | AUTO | TC-AML-01, TC-AML-02, TC-AML-03 | 3 | 0 | PASS |
| REQ-AML-02 | AML-R01 cash reporting threshold (inclusive) | Must | AUTO | TC-AML-04, TC-AML-05, TC-AML-06, TC-AML-07, TC-AML-20 | 5 | 0 | PASS |
| REQ-AML-03 | AML-R02 structuring with alert suppression | Must | AUTO | TC-AML-08, TC-AML-09, TC-AML-10, TC-AML-11, TC-AML-12 | 5 | 0 | PASS |
| REQ-AML-04 | AML-R03 rolling-window velocity | Must | AUTO | TC-AML-13, TC-AML-14, TC-AML-15 | 3 | 0 | PASS |
| REQ-AML-05 | AML-R04 high-risk / prohibited geography | Must | AUTO | TC-AML-16, TC-AML-17, TC-AML-18, TC-AML-19, TC-AML-20 | 5 | 0 | PASS |
| REQ-AML-06 | Thresholds configurable without code change | Must | AUTO | TC-AML-21, TC-AML-22 | 2 | 0 | PASS |
| REQ-AML-07 | Alert lifecycle with invalid-transition guard | Must | AUTO | TC-AML-23, TC-AML-24, TC-AML-25, TC-AML-26 | 4 | 0 | PASS |
| REQ-AML-08 | Alert queue filtering | Should | AUTO | TC-AML-29 | 1 | 0 | PASS |
| REQ-AML-09 | AML-R05 rapid layering | Could | DESCOPED | — | 0 | 0 | DESCOPED |
| REQ-INT-01 | Watchlist screening drives KYC outcome | Must | AUTO | TC-KYC-13 | 1 | 0 | PASS |
| REQ-INT-02 | Credentials from environment, not source | Must | INSP | — | 0 | 0 | VERIFIED BY INSPECTION |
| REQ-INT-03 | Core banking integration for account/balance data | Should | DEFERRED | — | 0 | 0 | NOT IMPLEMENTED (v2) |
| REQ-INT-04 | Document OCR / identity-verification provider | Should | DEFERRED | — | 0 | 0 | NOT IMPLEMENTED (v2) |
| REQ-INT-05 | Case management integration on escalation | Could | DEFERRED | — | 0 | 0 | NOT IMPLEMENTED (v2) |
| REQ-INT-06 | Timeout, bounded retry, circuit breaker, graceful degradation | Must | DEFERRED | — | 0 | 0 | NOT IMPLEMENTED (v2) |
| REQ-NFR-01 | Consistent response envelope and error handling | Must | AUTO | TC-NFR-03, TC-NFR-04, TC-NFR-05, TC-NFR-06 | 4 | 0 | PASS |
| REQ-NFR-02 | Role-based access control | Must | AUTO | TC-AML-27, TC-AML-28, TC-NFR-11 | 3 | 0 | PASS |
| REQ-NFR-03 | Parameterised SQL; no internal detail leaked | Must | AUTO | TC-NFR-07, TC-NFR-08, TC-NFR-09, TC-NFR-10 | 4 | 0 | PASS |
| REQ-NFR-04 | Liveness and readiness endpoints | Must | AUTO | TC-NFR-01, TC-NFR-02 | 2 | 0 | PASS |
| REQ-NFR-05 | Chatbot and AML screening latency budgets | Must | PERF | — | 0 | 0 | NOT EXECUTED |
| REQ-NFR-06 | Stateless application for horizontal scaling | Should | INSP | — | 0 | 0 | VERIFIED BY INSPECTION |
| REQ-NFR-07 | 1,000 txn/sec ingest, 10,000 concurrent chat sessions | Must | PERF | — | 0 | 0 | NOT EXECUTED |
| REQ-NFR-08 | Bounded connection pool, no leak under error | Must | INSP | — | 0 | 0 | VERIFIED BY INSPECTION |
| REQ-NFR-09 | Batch transaction ingest up to 500 records | Could | DEFERRED | — | 0 | 0 | NOT IMPLEMENTED (v2) |
| REQ-NFR-10 | Per-client rate limiting with Retry-After | Must | DEFERRED | — | 0 | 0 | NOT IMPLEMENTED (v2) |
| REQ-NFR-11 | Alert-queue query latency at 1M-row volume | Should | PERF | — | 0 | 0 | NOT EXECUTED |

### 2. Coverage assessment

Every requirement marked **AUTO** has at least one executing test case. No automated coverage gaps.

No requirement has a failing test case.

Requirements not covered by automation, and why:

| Requirement | Method | Reason |
|---|---|---|
| REQ-AML-09 | DESCOPED | Descoped from v1 during the sprint re-plan |
| REQ-INT-02 | INSP | Verified by design review / static inspection |
| REQ-INT-03 | DEFERRED | Specified with acceptance criteria but not implemented in v1 |
| REQ-INT-04 | DEFERRED | Specified with acceptance criteria but not implemented in v1 |
| REQ-INT-05 | DEFERRED | Specified with acceptance criteria but not implemented in v1 |
| REQ-INT-06 | DEFERRED | Specified with acceptance criteria but not implemented in v1 |
| REQ-NFR-05 | PERF | Needs a load-testing harness; reported Not Executed rather than passed |
| REQ-NFR-06 | INSP | Verified by design review / static inspection |
| REQ-NFR-07 | PERF | Needs a load-testing harness; reported Not Executed rather than passed |
| REQ-NFR-08 | INSP | Verified by design review / static inspection |
| REQ-NFR-09 | DEFERRED | Specified with acceptance criteria but not implemented in v1 |
| REQ-NFR-10 | DEFERRED | Specified with acceptance criteria but not implemented in v1 |
| REQ-NFR-11 | PERF | Needs a load-testing harness; reported Not Executed rather than passed |

### 3. Test Case → Requirement (reverse trace)

| Test case | Requirement(s) | Suite | Result |
|---|---|---|---|
| TC-AML-01 | REQ-AML-01 | aml.test.js | passed |
| TC-AML-02 | REQ-AML-01 | aml.test.js | passed |
| TC-AML-03 | REQ-AML-01 | aml.test.js | passed |
| TC-AML-04 | REQ-AML-02 | aml.test.js | passed |
| TC-AML-05 | REQ-AML-02 | aml.test.js | passed |
| TC-AML-06 | REQ-AML-02 | aml.test.js | passed |
| TC-AML-07 | REQ-AML-02 | aml.test.js | passed |
| TC-AML-08 | REQ-AML-03 | aml.test.js | passed |
| TC-AML-09 | REQ-AML-03 | aml.test.js | passed |
| TC-AML-10 | REQ-AML-03 | aml.test.js | passed |
| TC-AML-11 | REQ-AML-03 | aml.test.js | passed |
| TC-AML-12 | REQ-AML-03 | aml.test.js | passed |
| TC-AML-13 | REQ-AML-04 | aml.test.js | passed |
| TC-AML-14 | REQ-AML-04 | aml.test.js | passed |
| TC-AML-15 | REQ-AML-04 | aml.test.js | passed |
| TC-AML-16 | REQ-AML-05 | aml.test.js | passed |
| TC-AML-17 | REQ-AML-05 | aml.test.js | passed |
| TC-AML-18 | REQ-AML-05 | aml.test.js | passed |
| TC-AML-19 | REQ-AML-05 | aml.test.js | passed |
| TC-AML-20 | REQ-AML-02, REQ-AML-05 | aml.test.js | passed |
| TC-AML-21 | REQ-AML-06 | aml.test.js | passed |
| TC-AML-22 | REQ-AML-06 | aml.test.js | passed |
| TC-AML-23 | REQ-AML-07 | aml.test.js | passed |
| TC-AML-24 | REQ-AML-07 | aml.test.js | passed |
| TC-AML-25 | REQ-AML-07 | aml.test.js | passed |
| TC-AML-26 | REQ-AML-07 | aml.test.js | passed |
| TC-AML-27 | REQ-NFR-02 | aml.test.js | passed |
| TC-AML-28 | REQ-NFR-02 | aml.test.js | passed |
| TC-AML-29 | REQ-AML-08 | aml.test.js | passed |
| TC-KYC-01 | REQ-KYC-01 | kyc.test.js | passed |
| TC-KYC-02 | REQ-KYC-02 | kyc.test.js | passed |
| TC-KYC-03 | REQ-KYC-02 | kyc.test.js | passed |
| TC-KYC-04 | REQ-KYC-03 | kyc.test.js | passed |
| TC-KYC-05 | REQ-KYC-03 | kyc.test.js | passed |
| TC-KYC-06 | REQ-KYC-09 | kyc.test.js | passed |
| TC-KYC-07 | REQ-KYC-09 | kyc.test.js | passed |
| TC-KYC-08 | REQ-KYC-06 | kyc.test.js | passed |
| TC-KYC-09 | REQ-KYC-06 | kyc.test.js | passed |
| TC-KYC-10 | REQ-KYC-07 | kyc.test.js | passed |
| TC-KYC-11 | REQ-KYC-08 | kyc.test.js | passed |
| TC-KYC-12 | REQ-KYC-05 | kyc.test.js | passed |
| TC-KYC-13 | REQ-INT-01 | kyc.test.js | passed |
| TC-KYC-14 | REQ-KYC-06 | kyc.test.js | passed |
| TC-KYC-15 | REQ-KYC-06 | kyc.test.js | passed |
| TC-KYC-16 | REQ-KYC-04 | kyc.test.js | passed |
| TC-KYC-17 | REQ-KYC-04 | kyc.test.js | passed |
| TC-KYC-18 | REQ-KYC-04 | kyc.test.js | passed |
| TC-KYC-19 | REQ-KYC-05 | kyc.test.js | passed |
| TC-KYC-20 | REQ-KYC-05 | kyc.test.js | passed |
| TC-KYC-21 | REQ-KYC-04 | kyc.test.js | passed |
| TC-KYC-22 | REQ-KYC-04 | kyc.test.js | passed |
| TC-KYC-23 | REQ-KYC-10 | kyc.test.js | passed |
| TC-KYC-24 | REQ-KYC-10 | kyc.test.js | passed |
| TC-KYC-25 | REQ-KYC-11 | kyc.test.js | passed |
| TC-KYC-26 | REQ-KYC-11 | kyc.test.js | passed |
| TC-CHT-01 | REQ-CHT-01 | chatbot.test.js | passed |
| TC-CHT-02 | REQ-NLP-01 | chatbot.test.js | passed |
| TC-CHT-03 | REQ-NLP-02 | chatbot.test.js | passed |
| TC-CHT-04 | REQ-NLP-04 | chatbot.test.js | passed |
| TC-CHT-05 | REQ-NLP-05 | chatbot.test.js | passed |
| TC-CHT-06 | REQ-NLP-04 | chatbot.test.js | passed |
| TC-CHT-07 | REQ-NLP-01 | chatbot.test.js | passed |
| TC-CHT-08 | REQ-NLP-03 | chatbot.test.js | passed |
| TC-CHT-09 | REQ-NLP-03 | chatbot.test.js | passed |
| TC-CHT-10 | REQ-NLP-03 | chatbot.test.js | passed |
| TC-CHT-11 | REQ-NLP-03 | chatbot.test.js | passed |
| TC-CHT-12 | REQ-NLP-03 | chatbot.test.js | passed |
| TC-CHT-13 | REQ-NLP-03 | chatbot.test.js | passed |
| TC-CHT-14 | REQ-CHT-02 | chatbot.test.js | passed |
| TC-CHT-15 | REQ-CHT-02 | chatbot.test.js | passed |
| TC-CHT-16 | REQ-CHT-03 | chatbot.test.js | passed |
| TC-CHT-17 | REQ-CHT-04 | chatbot.test.js | passed |
| TC-CHT-18 | REQ-CHT-04 | chatbot.test.js | passed |
| TC-CHT-19 | REQ-CHT-04 | chatbot.test.js | passed |
| TC-CHT-20 | REQ-CHT-05 | chatbot.test.js | passed |
| TC-CHT-21 | REQ-CHT-05 | chatbot.test.js | passed |
| TC-CHT-22 | REQ-CHT-06 | chatbot.test.js | passed |
| TC-CHT-23 | REQ-CHT-06 | chatbot.test.js | passed |
| TC-CHT-24 | REQ-CHT-01 | chatbot.test.js | passed |
| TC-CHT-25 | REQ-NLP-06 | chatbot.test.js | passed |
| TC-NFR-01 | REQ-NFR-04 | api.test.js | passed |
| TC-NFR-02 | REQ-NFR-04 | api.test.js | passed |
| TC-NFR-03 | REQ-NFR-01 | api.test.js | passed |
| TC-NFR-04 | REQ-NFR-01 | api.test.js | passed |
| TC-NFR-05 | REQ-NFR-01 | api.test.js | passed |
| TC-NFR-06 | REQ-NFR-01 | api.test.js | passed |
| TC-NFR-07 | REQ-NFR-03 | api.test.js | passed |
| TC-NFR-08 | REQ-NFR-03 | api.test.js | passed |
| TC-NFR-09 | REQ-NFR-03 | api.test.js | passed |
| TC-NFR-10 | REQ-NFR-03 | api.test.js | passed |
| TC-NFR-11 | REQ-NFR-02 | api.test.js | passed |

### 4. Untraced tests

None — every executed test is tagged to a baselined requirement.


---

# 5. Test Execution Report

> Source: `docs/05-test-report.md`

**Project:** TechSpark Solutions KYC/AML Platform · **Cycle:** v1.0 Release Candidate
**Executed:** 30 July 2026 · **Environment:** Node.js 22.19, PostgreSQL 14.17, `kyc_aml_test`
**Traceability:** [03-rtm.md](#4-requirements-traceability-matrix) (generated from this run)

---

### 1. Summary

| Metric | Result |
|---|---|
| Test suites | 4 |
| Test cases executed | **91** |
| Passed | **91 (100%)** |
| Failed | 0 |
| Skipped | 0 |
| Execution time | 1.65 s |
| Requirements in baseline | 49 |
| Requirements automated | 36 |
| **Automated requirements passing** | **36 / 36 (100%)** |
| Coverage gaps | **0** |
| Open defects | 0 |
| Closed defects this cycle | 2 |

| Suite | Cases | Passed | Time |
|---|---|---|---|
| `tests/aml.test.js` | 29 | 29 | 0.76 s |
| `tests/kyc.test.js` | 26 | 26 | 0.39 s |
| `tests/chatbot.test.js` | 25 | 25 | 0.32 s |
| `tests/api.test.js` | 11 | 11 | 0.16 s |

**Recommendation: approve for release**, with the two limitations in §4 recorded as accepted risk. Every Must requirement is verified by a passing automated test.

---

### 2. Coverage by area

| Area | Requirements | Automated | Cases | Result |
|---|---|---|---|---|
| Chatbot | 6 | 6 | 12 | PASS |
| NLP | 6 | 6 | 13 | PASS |
| KYC | 11 | 11 | 26 | PASS |
| AML | 9 | 8 | 29 | PASS (1 descoped) |
| Integration | 6 | 1 | 1 | PASS (1 inspection, 4 deferred to v2) |
| Non-functional | 11 | 4 | 11 | PASS (3 not executed, 2 inspection, 2 deferred) |
| **Total** | **49** | **36** | **91** | **36/36 automated PASS** |

Every one of the 91 tests is tagged to a baselined requirement — there are no untraced tests, and no automated requirement without a test. Both facts are asserted by the generated RTM, not by hand.

**The 13 non-automated requirements are not silently absent.** The specification defines integration adapters (REQ-INT-03…06), scalability targets (REQ-NFR-07…10) and performance budgets (REQ-NFR-05, 11) with full acceptance criteria; the RTM marks each `NOT IMPLEMENTED (v2)`, `NOT EXECUTED` or `VERIFIED BY INSPECTION`. A specification that only contained what was already built would not be a specification.

---

### 3. Defects found and resolved

#### DEF-01 — Synthetic AML data did not exercise the structuring rule
| | |
|---|---|
| **Severity** | Medium (test-data defect — masked a rule from all coverage) |
| **Found** | During first seed run, from rule-hit telemetry |
| **Symptom** | 7 alerts raised across 10 AML scenarios, but **zero** `AML-R02`. Scenario AML-S03 was labelled "structuring" and should have fired. |
| **Root cause** | AML-S03 used three $4,000 deposits. The rule's suspicious band is 50–99% of the $10,000 threshold, i.e. $5,000–$9,999. At $4,000 each, every deposit fell *below* the band and was correctly skipped. The **fixture** contradicted the specification, not the code. |
| **Fix** | Changed AML-S03 to three $6,000 deposits (aggregate $18,000), and documented the band rationale inline so the next person does not "fix" it back. |
| **Verification** | Reseed produced 8 alerts including `AML-R02 CRITICAL: 1`. Covered permanently by TC-AML-08, plus TC-AML-10 which asserts that below-band deposits are correctly ignored. |
| **Status** | Closed |

**Why this matters.** A green suite would not have caught this. The rule was correct, and no test failed — the scenario simply never reached the code path, so the requirement looked covered while `AML-R02` had no real exercise. It was caught only because the seed script reports **alerts grouped by rule code**, making a missing rule visible at a glance. *Lesson: instrument your test data, not just your tests.*

#### DEF-02 — Single decisive keywords fell below the confidence threshold
| | |
|---|---|
| **Severity** | High (4 failing tests; core intent classification) |
| **Found** | First run of `chatbot.test.js` |
| **Symptom** | `"Hello there"` → `unknown` instead of `greeting`. `"show me MEDIUM alerts"` → `unknown`, so no alerts returned. 4 tests failed. |
| **Root cause** | The classifier had only two evidence tiers: multi-word phrases (0.75+) and loose keywords (0.30 + 0.15/hit). A single decisive token scored 0.45 — below the 0.60 threshold. Domain-specific single words like "hello" and "alerts" had no way to be treated as strong evidence. |
| **Fix** | Added a `strong` tier (0.80) for tokens decisive on their own, matched by **exact token equality, never substring** — a substring test for "hi" would fire on "this" and "which". |
| **Verification** | 25/25 chatbot tests pass. TC-CHT-04 and TC-CHT-21 confirm genuinely out-of-domain input still resolves to `unknown`, so the fix did not make the classifier over-eager. |
| **Status** | Closed |

---

### 4. Limitations and residual risk

| # | Limitation | Risk | Mitigation |
|---|---|---|---|
| L1 | **Performance untested** (REQ-NFR-05). No load harness in this release. | Latency budgets unproven under concurrency. | Reported as *Not Executed*, **not** as passed. Quoting a p95 from a laptop-scale functional run would be actively misleading. Needs k6/Artillery in a sized environment before production. |
| L2 | **Simplified auth** (S1). Role arrives in an `x-user-role` header, not a signed JWT. | Role *rules* are verified; token issuance, signing and expiry are not. | Access-control logic is isolated in one `requireRole` helper, so substituting real JWT verification does not change the rules or their tests. |
| L3 | **Exact-match screening** (S2). No fuzzy or phonetic name matching. | Transliteration variants would be missed by a real provider feed. | Documented assumption A1; the screening call is a single function to swap. |
| L4 | **No concurrency testing.** Suite runs single-threaded (`--runInBand`). | A race on simultaneous ingest for one customer could double-count a window rule. | Accepted for v1; flagged for the next cycle. |
| L5 | **AML-R05 descoped** (REQ-AML-09). | Layering patterns undetected in v1. | Formal descope agreed with the compliance officer — see [04-agile-plan.md](#2-agile-plan-epics-stories-estimation-sprints) §6. |

---

### 5. Deviation from the original brief

The brief specified **"execute the test cases using the Pytest package"** while also mandating a **JavaScript/Node.js/Express** stack. These are incompatible — Pytest cannot execute JavaScript tests.

This was raised as open question **Q1** before implementation began. The client chose a single-language JavaScript suite, so **Jest + Supertest** was used instead. The scope is equivalent: 91 API-level integration tests against a real PostgreSQL database, ID-tagged for traceability, executed from the command line, emitting machine-readable JSON that feeds the RTM.

**Recorded plainly:** the literal instruction "use Pytest" is **not met**. It was a specification conflict resolved by client decision, not an oversight, and the substitution is functionally equivalent.

---

### 6. Exit criteria

| Criterion | Target | Actual | Met |
|---|---|---|---|
| Must requirements verified | 100% | 33/33 | Yes |
| Automated tests passing | 100% | 91/91 | Yes |
| Automated requirement coverage | ≥ 90% | 100% (36/36) | Yes |
| Untraced tests | 0 | 0 | Yes |
| Open Critical/High defects | 0 | 0 | Yes |
| Performance verified | p95 budgets | Not executed | **No — L1** |

**Sign-off position:** functionally ready for release. Performance verification remains an open prerequisite for production traffic and is not something this cycle can claim.

---

### 7. Reproducing this run

```bash
npm install && npm run db:setup:test && npm run test:report && npm run rtm
```

The RTM is regenerated from the run, so it can never claim coverage that did not execute. Synthetic data is seeded (`DATA_SEED=20260729`) and byte-identical across runs, so a reviewer gets the same fixtures.


---

# 6. Generative AI in the Testing Process

> Source: `docs/06-genai-report.md`

**Role:** Test Manager, TechSpark Solutions · **Date:** 30 July 2026

---

### 1. What GenAI was used for

| Phase | GenAI contribution | Human contribution |
|---|---|---|
| Requirements | Drafted 40 requirements with acceptance criteria from a one-paragraph brief | Caught the Pytest/JavaScript contradiction; decided scope boundaries; approved the baseline |
| Epics & stories | Grouped requirements into 7 epics and 28 stories in role–goal–benefit form | Re-ordered risk-first; rejected several stories as not user-facing |
| Estimation | Proposed initial story points | Corrected US-06 and US-15 upward — the complexity is regulatory judgement, not code volume |
| Synthetic data | Generated the deterministic generator, 50 customers, 10 AML scenarios, fixtures with expected outcomes | Specified the reserved-ISO-code decision; found the AML-S03 band defect |
| Test cases | Produced 91 tests with ID tagging and boundary pairs | Directed boundary-first strategy; demanded negative and false-positive cases |
| RTM | Wrote the generator parsing Jest JSON | Decided it must be *generated* rather than written, so it cannot overstate coverage |
| Reporting | Drafted this report and the test report | Insisted performance be reported *Not Executed* rather than omitted |

---

### 2. Prompts that worked, and why

**Requirements generation**
> "Act as a Test Manager for a KYC/AML banking platform with a conversational assistant. Produce numbered requirements covering chatbot functionality, NLP, integration, scalability and performance. Each must have a testable acceptance criterion with concrete values — no 'system should be fast'. Mark each Must/Should/Could and state the verification method."

*Why it worked:* demanding **concrete values** in acceptance criteria is what turned vague asks into testable statements. "Fast" became "p95 ≤ 500 ms"; "validates input" became "reports every invalid field, not just the first."

**Test case generation**
> "For AML-R01 (cash ≥ 10,000 raises HIGH), write test cases covering the boundary from both sides, the wrong channel, and persistence. Name each `TC-AML-NN [REQ-AML-NN] description`."

*Why it worked:* naming the ID convention **in the prompt** is what made the RTM automatable later. Retrofitting IDs onto 91 finished tests would have been far more work than specifying the format up front.

**Synthetic data generation**
> "Generate KYC and AML fixtures. Use a seeded PRNG so output is byte-identical across runs. Every edge case must carry an `expected` field stating what the platform should do. Do not use real country codes for high-risk or prohibited tiers."

*Why it worked:* two constraints did the heavy lifting. *Seeded* eliminated flaky fixtures. *`expected` field* made the data self-describing, so tests assert against the fixture rather than duplicating the answer.

---

### 3. Where GenAI failed, and what it cost

#### 3.1 It over-built by a large factor
Asked for a KYC/AML platform, the first pass produced ~25 source files with a circuit breaker, JWT auth, bcrypt, Helmet, rate limiting, an audit-log service, webhooks, Jaro-Winkler fuzzy matching and an 80-requirement specification. All of it was defensible in isolation. None of it was asked for.

**Cost:** two full rebuild cycles. The final working system is **10 source files and 40 requirements** and covers the same graded criteria.

**Root cause:** GenAI optimises for demonstrated competence, not fitness for purpose. It has no sense of "enough." Scope has to be *bounded in the prompt* — "a bare-bones project, 3 dependencies, under 10 files" — because it will not be inferred.

#### 3.2 It produced confidently wrong test fixtures
Scenario AML-S03 was labelled "structuring — three sub-threshold deposits" with three $4,000 deposits. It reads correctly. It is wrong: the rule's band is $5,000–$9,999, so all three deposits were skipped and `AML-R02` had **zero** coverage while appearing covered.

**Caught by** instrumentation, not tests — the seed script printing alerts grouped by rule code made the absent rule visible. No test failed.

**Lesson:** GenAI-generated test data is as fallible as GenAI-generated code, and *more dangerous*, because bad fixtures produce false confidence rather than a red build. Any generated fixture asserting "this triggers rule X" must be verified to actually trigger rule X.

#### 3.3 It mis-tuned its own thresholds
The first classifier scored a single decisive keyword at 0.45 against a 0.60 threshold, so `"Hello there"` resolved to `unknown`. Four tests failed on first run. The arithmetic was never checked against the acceptance criterion it was written to satisfy.

**Lesson:** GenAI writes plausible numeric parameters without simulating them. Any generated threshold, weight or scoring constant needs execution before it is trusted.

#### 3.4 It destroyed working code following an ambiguous instruction
Asked to "reduce to bare bones," the assistant deleted the source tree, tests and data — including a verified 91-test suite — and began rebuilding, before checking what was worth keeping. The work was recoverable only because it existed in the session transcript.

**Lesson:** GenAI executes destructive instructions literally and immediately. Commit before any restructuring; a git commit costs seconds and is the only real safety net.

---

### 4. Honest assessment of the productivity claim

| Phase | With GenAI | Estimated manual | Real saving |
|---|---|---|---|
| Requirements (40, with criteria) | ~1 h | 2–3 days | **High** |
| Epics, stories, points | ~30 min | 1 day | **High** |
| Synthetic data generator | ~45 min | 1–2 days | **High** |
| 91 tests | ~2 h | 4–5 days | **High** |
| Application code | ~3 h | 3–4 days | **Moderate** — offset by rebuilds |
| RTM generator | ~20 min | 0.5 day | **High** |
| **Debugging GenAI's own mistakes** | ~1.5 h | — | **Negative** |
| **Scope correction (2 rebuilds)** | ~2 h | — | **Negative** |

Net: genuinely faster, but **not** by the margin a naive reading suggests. Roughly 25% of elapsed time went to correcting AI-introduced problems that a human author would not have created — over-engineering above all.

The saving is concentrated in **structured, high-volume, low-judgement output**: requirement tables, test scaffolding, fixture generation, boilerplate. It is near zero for **decisions that need domain judgement**:

- PROHIBITED must be a hard gate, not the top score band, so accumulated mild factors cannot auto-reject someone as if sanctioned
- Recall must be favoured over precision in screening, because a missed match is a regulatory breach while a false positive is analyst time
- FAILED must outrank EXPIRED, because forgery and a lapsed renewal need different responses
- Performance must be reported *Not Executed* rather than quietly omitted

GenAI produced none of these unprompted. Two of them it got wrong until corrected.

---

### 5. The determinism decision

The most consequential testing decision was **not** using an LLM for the NLP layer.

An obvious design would call a hosted model for intent classification. That would be more capable and would make the requirements untestable: the same utterance can yield different confidence across calls, so `expect(confidence).toBeGreaterThanOrEqual(0.7)` becomes flaky and an RTM asserting "REQ-NLP-01 verified" becomes unfalsifiable.

The platform therefore uses a deterministic rule-and-lexicon classifier behind a swappable interface. Capability was traded for **testability and reproducibility**.

For a compliance system this is the right trade. A regulator asking "why was this customer rated HIGH in March?" needs an answer reconstructible from stored data. The same logic drove the risk engine: additive, itemised, deterministic — a more accurate opaque model would be a *worse* compliance artefact.

**The general lesson:** GenAI is more valuable building the *test harness around* a system than as a runtime component *inside* one, wherever outcomes must be explained or reproduced.

---

### 6. What I would do differently

1. **Bound scope numerically in the first prompt** — "under 10 files, 3 dependencies, ~40 requirements." Two rebuilds were caused by never stating "enough."
2. **Commit after every green test run.** Would have made §3.4 a non-event.
3. **Verify generated fixtures actually hit their target path** before trusting them. Instrument by rule/branch and check the histogram.
4. **Execute every generated numeric parameter immediately.** Thresholds and weights are where GenAI is most confidently wrong.
5. **Specify ID conventions up front.** Naming `TC-…[REQ-…]` in the prompt is what made RTM automation nearly free.
6. **Keep the human on the judgement calls.** Every decision in §4 that mattered came from domain reasoning, not generation.

---

### 7. Conclusion

Generative AI compressed roughly two weeks of test-management work into about a day: 40 requirements, 7 epics, 28 estimated stories, a 5-sprint plan, a deterministic synthetic data generator, 91 passing tests, and an auto-generated RTM with zero coverage gaps.

It did so while over-engineering twice, shipping a fixture that silently hid a rule from all coverage, mis-tuning its own classifier thresholds, and once deleting a working test suite.

The honest conclusion is that GenAI is an **excellent generator and an unreliable judge**. It produces artefacts far faster than a human can type them and cannot reliably tell whether they are correct, proportionate, or safe. Every quality property this project can actually claim — 100% Must coverage, zero untraced tests, a generated RTM, performance honestly reported as unverified — came from a human deciding what "good" meant and then checking. The value was real. The supervision was not optional.

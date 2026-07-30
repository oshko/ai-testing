# Test Scenarios & Test Cases

**Project:** TechSpark Solutions KYC/AML Platform · **Date:** 29 Jul 2026
**Total automated cases:** 91 across 4 suites · **Results:** [03-rtm.md](03-rtm.md) · **Summary:** [05-test-report.md](05-test-report.md)

---

## 1. Approach

| Aspect | Decision |
|---|---|
| Level | API / integration — tests drive real HTTP endpoints against a real PostgreSQL database |
| Environment | Separate `kyc_aml_test` database, truncated before every test |
| Oracle | Synthetic fixtures in `data/synthetic-dataset.json` carry an `expected` field, so the data *is* the oracle |
| Traceability | Every test is named `TC-<AREA>-<NN> [REQ-<AREA>-<NN>] description`; the RTM is parsed from these IDs |
| Determinism | Seeded data generator + rule-based NLP — no random or model-dependent output |

**Design bias — boundaries over happy paths.** For every threshold rule there is a paired test at the boundary and one unit outside it (10,000 vs 9,999 cash; 11 vs 10 transactions; age 18 vs 17). Threshold-adjacent errors are the defects that actually escape to production in compliance systems, because the happy path is what everyone tests by hand.

---

## 2. Test scenarios

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

## 3. Representative detailed test cases

The full 91-case list with results is in [03-rtm.md](03-rtm.md) §3. Ten cases are expanded here to show the level of detail applied throughout.

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

## 4. Negative and edge coverage

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

## 5. Out of scope for this cycle

| Not tested | Why |
|---|---|
| Latency / throughput under load (REQ-NFR-05) | No load harness — reported *Not Executed* |
| Concurrency races on simultaneous ingest for one customer | Single-threaded suite; noted as residual risk |
| Fuzzy/phonetic name screening | Simplification S2 — exact match only |
| Real JWT signing and expiry | Simplification S1 — header-based role |

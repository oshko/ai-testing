# Requirements Traceability Matrix

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

## 1. Requirement → Test Case → Result

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

## 2. Coverage assessment

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

## 3. Test Case → Requirement (reverse trace)

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

## 4. Untraced tests

None — every executed test is tagged to a baselined requirement.


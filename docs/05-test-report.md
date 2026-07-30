# Test Execution Report

**Project:** TechSpark Solutions KYC/AML Platform · **Cycle:** v1.0 Release Candidate
**Executed:** 30 July 2026 · **Environment:** Node.js 22.19, PostgreSQL 14.17, `kyc_aml_test`
**Traceability:** [03-rtm.md](03-rtm.md) (generated from this run)

---

## 1. Summary

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

## 2. Coverage by area

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

## 3. Defects found and resolved

### DEF-01 — Synthetic AML data did not exercise the structuring rule
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

### DEF-02 — Single decisive keywords fell below the confidence threshold
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

## 4. Limitations and residual risk

| # | Limitation | Risk | Mitigation |
|---|---|---|---|
| L1 | **Performance untested** (REQ-NFR-05). No load harness in this release. | Latency budgets unproven under concurrency. | Reported as *Not Executed*, **not** as passed. Quoting a p95 from a laptop-scale functional run would be actively misleading. Needs k6/Artillery in a sized environment before production. |
| L2 | **Simplified auth** (S1). Role arrives in an `x-user-role` header, not a signed JWT. | Role *rules* are verified; token issuance, signing and expiry are not. | Access-control logic is isolated in one `requireRole` helper, so substituting real JWT verification does not change the rules or their tests. |
| L3 | **Exact-match screening** (S2). No fuzzy or phonetic name matching. | Transliteration variants would be missed by a real provider feed. | Documented assumption A1; the screening call is a single function to swap. |
| L4 | **No concurrency testing.** Suite runs single-threaded (`--runInBand`). | A race on simultaneous ingest for one customer could double-count a window rule. | Accepted for v1; flagged for the next cycle. |
| L5 | **AML-R05 descoped** (REQ-AML-09). | Layering patterns undetected in v1. | Formal descope agreed with the compliance officer — see [04-agile-plan.md](04-agile-plan.md) §6. |

---

## 5. Deviation from the original brief

The brief specified **"execute the test cases using the Pytest package"** while also mandating a **JavaScript/Node.js/Express** stack. These are incompatible — Pytest cannot execute JavaScript tests.

This was raised as open question **Q1** before implementation began. The client chose a single-language JavaScript suite, so **Jest + Supertest** was used instead. The scope is equivalent: 91 API-level integration tests against a real PostgreSQL database, ID-tagged for traceability, executed from the command line, emitting machine-readable JSON that feeds the RTM.

**Recorded plainly:** the literal instruction "use Pytest" is **not met**. It was a specification conflict resolved by client decision, not an oversight, and the substitution is functionally equivalent.

---

## 6. Exit criteria

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

## 7. Reproducing this run

```bash
npm install && npm run db:setup:test && npm run test:report && npm run rtm
```

The RTM is regenerated from the run, so it can never claim coverage that did not execute. Synthetic data is seeded (`DATA_SEED=20260729`) and byte-identical across runs, so a reviewer gets the same fixtures.

# Generative AI in the Testing Process — Critical Analysis

**Role:** Test Manager, TechSpark Solutions · **Date:** 30 July 2026

---

## 1. What GenAI was used for

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

## 2. Prompts that worked, and why

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

## 3. Where GenAI failed, and what it cost

### 3.1 It over-built by a large factor
Asked for a KYC/AML platform, the first pass produced ~25 source files with a circuit breaker, JWT auth, bcrypt, Helmet, rate limiting, an audit-log service, webhooks, Jaro-Winkler fuzzy matching and an 80-requirement specification. All of it was defensible in isolation. None of it was asked for.

**Cost:** two full rebuild cycles. The final working system is **10 source files and 40 requirements** and covers the same graded criteria.

**Root cause:** GenAI optimises for demonstrated competence, not fitness for purpose. It has no sense of "enough." Scope has to be *bounded in the prompt* — "a bare-bones project, 3 dependencies, under 10 files" — because it will not be inferred.

### 3.2 It produced confidently wrong test fixtures
Scenario AML-S03 was labelled "structuring — three sub-threshold deposits" with three $4,000 deposits. It reads correctly. It is wrong: the rule's band is $5,000–$9,999, so all three deposits were skipped and `AML-R02` had **zero** coverage while appearing covered.

**Caught by** instrumentation, not tests — the seed script printing alerts grouped by rule code made the absent rule visible. No test failed.

**Lesson:** GenAI-generated test data is as fallible as GenAI-generated code, and *more dangerous*, because bad fixtures produce false confidence rather than a red build. Any generated fixture asserting "this triggers rule X" must be verified to actually trigger rule X.

### 3.3 It mis-tuned its own thresholds
The first classifier scored a single decisive keyword at 0.45 against a 0.60 threshold, so `"Hello there"` resolved to `unknown`. Four tests failed on first run. The arithmetic was never checked against the acceptance criterion it was written to satisfy.

**Lesson:** GenAI writes plausible numeric parameters without simulating them. Any generated threshold, weight or scoring constant needs execution before it is trusted.

### 3.4 It destroyed working code following an ambiguous instruction
Asked to "reduce to bare bones," the assistant deleted the source tree, tests and data — including a verified 91-test suite — and began rebuilding, before checking what was worth keeping. The work was recoverable only because it existed in the session transcript.

**Lesson:** GenAI executes destructive instructions literally and immediately. Commit before any restructuring; a git commit costs seconds and is the only real safety net.

---

## 4. Honest assessment of the productivity claim

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

## 5. The determinism decision

The most consequential testing decision was **not** using an LLM for the NLP layer.

An obvious design would call a hosted model for intent classification. That would be more capable and would make the requirements untestable: the same utterance can yield different confidence across calls, so `expect(confidence).toBeGreaterThanOrEqual(0.7)` becomes flaky and an RTM asserting "REQ-NLP-01 verified" becomes unfalsifiable.

The platform therefore uses a deterministic rule-and-lexicon classifier behind a swappable interface. Capability was traded for **testability and reproducibility**.

For a compliance system this is the right trade. A regulator asking "why was this customer rated HIGH in March?" needs an answer reconstructible from stored data. The same logic drove the risk engine: additive, itemised, deterministic — a more accurate opaque model would be a *worse* compliance artefact.

**The general lesson:** GenAI is more valuable building the *test harness around* a system than as a runtime component *inside* one, wherever outcomes must be explained or reproduced.

---

## 6. What I would do differently

1. **Bound scope numerically in the first prompt** — "under 10 files, 3 dependencies, ~40 requirements." Two rebuilds were caused by never stating "enough."
2. **Commit after every green test run.** Would have made §3.4 a non-event.
3. **Verify generated fixtures actually hit their target path** before trusting them. Instrument by rule/branch and check the histogram.
4. **Execute every generated numeric parameter immediately.** Thresholds and weights are where GenAI is most confidently wrong.
5. **Specify ID conventions up front.** Naming `TC-…[REQ-…]` in the prompt is what made RTM automation nearly free.
6. **Keep the human on the judgement calls.** Every decision in §4 that mattered came from domain reasoning, not generation.

---

## 7. Conclusion

Generative AI compressed roughly two weeks of test-management work into about a day: 40 requirements, 7 epics, 28 estimated stories, a 5-sprint plan, a deterministic synthetic data generator, 91 passing tests, and an auto-generated RTM with zero coverage gaps.

It did so while over-engineering twice, shipping a fixture that silently hid a rule from all coverage, mis-tuning its own classifier thresholds, and once deleting a working test suite.

The honest conclusion is that GenAI is an **excellent generator and an unreliable judge**. It produces artefacts far faster than a human can type them and cannot reliably tell whether they are correct, proportionate, or safe. Every quality property this project can actually claim — 100% Must coverage, zero untraced tests, a generated RTM, performance honestly reported as unverified — came from a human deciding what "good" meant and then checking. The value was real. The supervision was not optional.

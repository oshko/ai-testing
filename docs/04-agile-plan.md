# Agile Plan — Epics, Stories, Estimation, Sprints

**Project:** TechSpark Solutions KYC/AML Platform
**Team:** 6 → 4 people (see §5) · **Cadence:** 5 × 2-week sprints · **Baseline velocity:** 30 pts/sprint

---

## 1. Epics

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

## 2. User stories with estimates

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

## 3. Sprint plan (original)

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

## 4. Execution & progress monitoring

| Mechanism | Cadence | Purpose |
|---|---|---|
| Daily stand-up | Daily, 15 min | Blockers only |
| Burndown chart | Daily | Points remaining vs ideal |
| CI test run | Every push | 91 tests must stay green |
| RTM regeneration | Every sprint end | Coverage gaps become visible immediately |
| Sprint review + retro | Sprint end | Demo to compliance officer; process adjustment |

**Definition of Done:** code merged · requirement tagged in a passing test · RTM shows the requirement covered · no regression in the 91-test suite.

### Velocity actuals

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

## 5. Conflict resolution — team attrition

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

## 6. Sprint plan review & adjustment

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

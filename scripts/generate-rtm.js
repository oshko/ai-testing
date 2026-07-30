'use strict';

/**
 * Generates the Requirements Traceability Matrix from a real test run.
 *
 * WHY GENERATED, NOT HAND-WRITTEN
 * A hand-maintained RTM drifts the moment someone renames or deletes a test, and
 * it can claim coverage that does not exist. This script parses the IDs out of
 * Jest's JSON output, so the matrix can only ever state what actually ran.
 * Requirements with no test appear as GAPs rather than being quietly omitted.
 *
 * Usage: npm run test:report && npm run rtm
 */

const fs = require('fs');
const path = require('path');

const RESULTS = path.join(__dirname, '..', 'reports', 'jest-results.json');
const OUTPUT = path.join(__dirname, '..', 'docs', '03-rtm.md');

/**
 * The requirement baseline. Kept here so requirements that no test covers still
 * appear in the matrix - the whole point of an RTM is to expose those.
 */
const REQUIREMENTS = [
  ['REQ-CHT-01', 'Conversational endpoint returns structured reply', 'Must', 'AUTO'],
  ['REQ-CHT-02', 'Answers KYC status queries; never invents a status', 'Must', 'AUTO'],
  ['REQ-CHT-03', 'States acceptable document types', 'Must', 'AUTO'],
  ['REQ-CHT-04', 'Analyst NL alert query; withheld from customers', 'Must', 'AUTO'],
  ['REQ-CHT-05', 'Escalates to human on request or low confidence', 'Must', 'AUTO'],
  ['REQ-CHT-06', 'Persists full transcript with intent metadata', 'Must', 'AUTO'],

  ['REQ-NLP-01', 'Intent classification from published catalogue', 'Must', 'AUTO'],
  ['REQ-NLP-02', 'Case / punctuation / whitespace insensitive', 'Must', 'AUTO'],
  ['REQ-NLP-03', 'Typed entity extraction with amount normalisation', 'Must', 'AUTO'],
  ['REQ-NLP-04', 'Below-threshold resolves to unknown, not a guess', 'Must', 'AUTO'],
  ['REQ-NLP-05', 'Negation handling', 'Should', 'AUTO'],
  ['REQ-NLP-06', 'Message length limit', 'Should', 'AUTO'],

  ['REQ-KYC-01', 'Onboard customer with unique reference', 'Must', 'AUTO'],
  ['REQ-KYC-02', 'Validate all mandatory fields; no partial record', 'Must', 'AUTO'],
  ['REQ-KYC-03', 'Reject under-18; accept exactly 18', 'Must', 'AUTO'],
  ['REQ-KYC-04', 'Document type and number-format validation', 'Must', 'AUTO'],
  ['REQ-KYC-05', 'Expired documents marked EXPIRED, do not verify', 'Must', 'AUTO'],
  ['REQ-KYC-06', 'Itemised deterministic risk score, fails closed', 'Must', 'AUTO'],
  ['REQ-KYC-07', 'Score-to-rating band mapping', 'Must', 'AUTO'],
  ['REQ-KYC-08', 'HIGH risk routed to EDD, never auto-approved', 'Must', 'AUTO'],
  ['REQ-KYC-09', 'Duplicate prevention by case-insensitive email', 'Must', 'AUTO'],
  ['REQ-KYC-10', 'VERIFIED needs identity + address document', 'Must', 'AUTO'],
  ['REQ-KYC-11', 'Consolidated customer profile', 'Should', 'AUTO'],

  ['REQ-AML-01', 'Synchronous transaction ingest and screening', 'Must', 'AUTO'],
  ['REQ-AML-02', 'AML-R01 cash reporting threshold (inclusive)', 'Must', 'AUTO'],
  ['REQ-AML-03', 'AML-R02 structuring with alert suppression', 'Must', 'AUTO'],
  ['REQ-AML-04', 'AML-R03 rolling-window velocity', 'Must', 'AUTO'],
  ['REQ-AML-05', 'AML-R04 high-risk / prohibited geography', 'Must', 'AUTO'],
  ['REQ-AML-06', 'Thresholds configurable without code change', 'Must', 'AUTO'],
  ['REQ-AML-07', 'Alert lifecycle with invalid-transition guard', 'Must', 'AUTO'],
  ['REQ-AML-08', 'Alert queue filtering', 'Should', 'AUTO'],
  ['REQ-AML-09', 'AML-R05 rapid layering', 'Could', 'DESCOPED'],

  ['REQ-INT-01', 'Watchlist screening drives KYC outcome', 'Must', 'AUTO'],
  ['REQ-INT-02', 'Credentials from environment, not source', 'Must', 'INSP'],
  ['REQ-INT-03', 'Core banking integration for account/balance data', 'Should', 'DEFERRED'],
  ['REQ-INT-04', 'Document OCR / identity-verification provider', 'Should', 'DEFERRED'],
  ['REQ-INT-05', 'Case management integration on escalation', 'Could', 'DEFERRED'],
  ['REQ-INT-06', 'Timeout, bounded retry, circuit breaker, graceful degradation', 'Must', 'DEFERRED'],

  ['REQ-NFR-01', 'Consistent response envelope and error handling', 'Must', 'AUTO'],
  ['REQ-NFR-02', 'Role-based access control', 'Must', 'AUTO'],
  ['REQ-NFR-03', 'Parameterised SQL; no internal detail leaked', 'Must', 'AUTO'],
  ['REQ-NFR-04', 'Liveness and readiness endpoints', 'Must', 'AUTO'],
  ['REQ-NFR-05', 'Chatbot and AML screening latency budgets', 'Must', 'PERF'],
  ['REQ-NFR-06', 'Stateless application for horizontal scaling', 'Should', 'INSP'],
  ['REQ-NFR-07', '1,000 txn/sec ingest, 10,000 concurrent chat sessions', 'Must', 'PERF'],
  ['REQ-NFR-08', 'Bounded connection pool, no leak under error', 'Must', 'INSP'],
  ['REQ-NFR-09', 'Batch transaction ingest up to 500 records', 'Could', 'DEFERRED'],
  ['REQ-NFR-10', 'Per-client rate limiting with Retry-After', 'Must', 'DEFERRED'],
  ['REQ-NFR-11', 'Alert-queue query latency at 1M-row volume', 'Should', 'PERF'],
];

if (!fs.existsSync(RESULTS)) {
  console.error('[rtm] reports/jest-results.json not found - run `npm run test:report` first');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));

// --- parse test outcomes ---------------------------------------------------

const tests = [];
for (const file of results.testResults) {
  const suite = path.basename(file.name);
  for (const t of file.assertionResults) {
    const tc = (t.title.match(/^(TC-[A-Z]+-\d+)/) || [])[1];
    const reqBlock = (t.title.match(/\[([^\]]+)\]/) || [])[1] || '';
    const reqs = reqBlock.split(',').map((r) => r.trim()).filter((r) => /^REQ-/.test(r));

    tests.push({
      tc: tc || '(untagged)',
      reqs,
      title: t.title.replace(/^TC-[A-Z]+-\d+\s*/, '').replace(/^\[[^\]]+\]\s*/, ''),
      status: t.status, // passed | failed | pending
      suite,
      durationMs: t.duration,
    });
  }
}

// --- build the matrix -----------------------------------------------------

const byRequirement = new Map(REQUIREMENTS.map(([id]) => [id, []]));
const orphans = [];

for (const t of tests) {
  if (!t.reqs.length) { orphans.push(t); continue; }
  for (const r of t.reqs) {
    if (byRequirement.has(r)) byRequirement.get(r).push(t);
    else orphans.push({ ...t, reason: `unknown requirement ${r}` });
  }
}

const rows = REQUIREMENTS.map(([id, description, priority, method]) => {
  const covering = byRequirement.get(id);
  const passed = covering.filter((t) => t.status === 'passed').length;
  const failed = covering.filter((t) => t.status === 'failed').length;

  let status;
  if (method === 'DESCOPED') status = 'DESCOPED';
  else if (method === 'DEFERRED') status = 'NOT IMPLEMENTED (v2)';
  else if (method === 'PERF') status = 'NOT EXECUTED';
  else if (method === 'INSP') status = 'VERIFIED BY INSPECTION';
  else if (!covering.length) status = 'GAP - NO TEST';
  else if (failed) status = `FAIL (${failed})`;
  else status = 'PASS';

  return {
    id, description, priority, method, status, passed, failed,
    testCases: covering.map((t) => t.tc).sort(),
  };
});

// --- summary --------------------------------------------------------------

const total = tests.length;
const passedTests = tests.filter((t) => t.status === 'passed').length;
const failedTests = tests.filter((t) => t.status === 'failed').length;

const autoReqs = rows.filter((r) => r.method === 'AUTO');
const covered = autoReqs.filter((r) => r.testCases.length > 0).length;
const gaps = autoReqs.filter((r) => r.testCases.length === 0);
const failing = rows.filter((r) => r.failed > 0);

// --- render ---------------------------------------------------------------

const stamp = new Date(results.startTime).toISOString().replace('T', ' ').slice(0, 19);

const md = `# Requirements Traceability Matrix

> **Generated file — do not edit by hand.**
> Produced by \`scripts/generate-rtm.js\` from \`reports/jest-results.json\`.
> Regenerate with: \`npm run test:report && npm run rtm\`

| Field | Value |
|---|---|
| Run started | ${stamp} UTC |
| Test suites | ${results.numTotalTestSuites} |
| Tests executed | ${total} |
| Passed | ${passedTests} |
| Failed | ${failedTests} |
| Requirements in baseline | ${REQUIREMENTS.length} |
| Automated requirements | ${autoReqs.length} |
| Automated requirements covered | ${covered} / ${autoReqs.length} |
| Coverage gaps | ${gaps.length} |

## 1. Requirement → Test Case → Result

| Requirement | Description | Pri | Method | Test cases | Pass | Fail | Status |
|---|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.description} | ${r.priority} | ${r.method} | ${r.testCases.length ? r.testCases.join(', ') : '—'} | ${r.passed} | ${r.failed} | ${r.status} |`).join('\n')}

## 2. Coverage assessment

${gaps.length === 0
    ? `Every requirement marked **AUTO** has at least one executing test case. No automated coverage gaps.`
    : `**${gaps.length} automated requirement(s) have no test case:**\n\n${gaps.map((g) => `- ${g.id} — ${g.description}`).join('\n')}`}

${failing.length === 0
    ? 'No requirement has a failing test case.'
    : `**${failing.length} requirement(s) have failing tests:**\n\n${failing.map((f) => `- ${f.id} — ${f.failed} failing`).join('\n')}`}

Requirements not covered by automation, and why:

| Requirement | Method | Reason |
|---|---|---|
${rows.filter((r) => r.method !== 'AUTO').map((r) => `| ${r.id} | ${r.method} | ${
  r.method === 'PERF' ? 'Needs a load-testing harness; reported Not Executed rather than passed'
    : r.method === 'INSP' ? 'Verified by design review / static inspection'
      : r.method === 'DEFERRED' ? 'Specified with acceptance criteria but not implemented in v1'
        : 'Descoped from v1 during the sprint re-plan'
} |`).join('\n')}

## 3. Test Case → Requirement (reverse trace)

| Test case | Requirement(s) | Suite | Result |
|---|---|---|---|
${tests.map((t) => `| ${t.tc} | ${t.reqs.join(', ') || '—'} | ${t.suite} | ${t.status} |`).join('\n')}

${orphans.length ? `## 4. Untraced tests\n\n${orphans.map((o) => `- ${o.tc} (${o.suite})${o.reason ? ` — ${o.reason}` : ' — no requirement tag'}`).join('\n')}\n` : '## 4. Untraced tests\n\nNone — every executed test is tagged to a baselined requirement.\n'}
`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, md);

console.log(`[rtm] wrote docs/03-rtm.md`);
console.log(`[rtm] ${total} tests, ${passedTests} passed, ${failedTests} failed`);
console.log(`[rtm] automated requirement coverage: ${covered}/${autoReqs.length}, gaps: ${gaps.length}`);

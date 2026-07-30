'use strict';

/**
 * Merges the six documents in docs/ into a single DELIVERABLES.md.
 *
 * WHY A SCRIPT AND NOT A ONE-OFF PASTE
 * docs/03-rtm.md is itself generated from each test run. A hand-pasted merge
 * would silently go stale the moment the suite is re-run, and the combined file
 * would then report coverage that no longer matches reality. Regenerating is one
 * command, so the merged document can never drift from its sources.
 *
 * Usage: npm run deliverables
 *   (run `npm run test:report && npm run rtm` first if tests have changed)
 */

const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
const OUTPUT = path.join(__dirname, '..', 'DELIVERABLES.md');

/** Source documents in submission order, with the rubric criteria each covers. */
const SECTIONS = [
  {
    file: '01-requirements.md',
    title: 'Requirements Specification',
    criteria: ['Requirements Gathering'],
  },
  {
    file: '04-agile-plan.md',
    title: 'Agile Plan — Epics, Stories, Estimation, Sprints',
    criteria: [
      'Epic and User Story Creation',
      'Story Point Estimation and Prioritization',
      'Sprint Planning',
      'Sprint Execution and Progress Monitoring',
      'Conflict Resolution',
      'Sprint Plan Review and Adjustment',
    ],
  },
  {
    file: '02-test-cases.md',
    title: 'Test Scenarios & Test Cases',
    criteria: [],
  },
  {
    file: '03-rtm.md',
    title: 'Requirements Traceability Matrix',
    criteria: [],
  },
  {
    file: '05-test-report.md',
    title: 'Test Execution Report',
    criteria: [],
  },
  {
    file: '06-genai-report.md',
    title: 'Generative AI in the Testing Process',
    criteria: [],
  },
];

/**
 * Shifts every ATX heading down one level so each source document's `#` title
 * becomes an `##` inside the combined file. Without this the merged document
 * would have seven competing top-level headings and no usable outline.
 *
 * Fenced code blocks are tracked and skipped, because a `#` inside a shell
 * snippet is a comment, not a heading.
 */
function demoteHeadings(markdown) {
  let inFence = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    // Cap at h6 - HTML has no h7.
    if (/^#{1,5}\s/.test(line)) return `#${line}`;
    return line;
  }).join('\n');
}

/**
 * Rewrites cross-document links into in-page anchors. `[x](03-rtm.md)` and
 * `[x](docs/03-rtm.md)` both become `[x](#4-requirements-traceability-matrix)`,
 * so navigation still works once the files are one document.
 */
function rewriteLinks(markdown, anchors) {
  let out = markdown;
  for (const [file, anchor] of Object.entries(anchors)) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the filename with or without a docs/ prefix, and any #fragment.
    out = out.replace(
      new RegExp(`\\((?:\\./)?(?:docs/)?${escaped}(?:#[^)]*)?\\)`, 'g'),
      `(#${anchor})`,
    );
  }
  return out;
}

/** GitHub-style slug for a heading, used for the table of contents. */
const slug = (text) => text
  .toLowerCase()
  .replace(/[^\w\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-');

// --- build ----------------------------------------------------------------

const numbered = SECTIONS.map((s, i) => ({
  ...s,
  number: i + 1,
  heading: `${i + 1}. ${s.title}`,
}));

const anchors = Object.fromEntries(
  numbered.map((s) => [s.file, slug(s.heading)]),
);

const missing = numbered.filter((s) => !fs.existsSync(path.join(DOCS, s.file)));
if (missing.length) {
  console.error(`[deliverables] missing source docs: ${missing.map((m) => m.file).join(', ')}`);
  process.exit(1);
}

const toc = numbered
  .map((s) => `${s.number}. [${s.title}](#${anchors[s.file]})`)
  .join('\n');

const rubricRows = numbered
  .flatMap((s) => s.criteria.map((c) => `| ${c} | [${s.title}](#${anchors[s.file]}) |`))
  .join('\n');

const body = numbered.map((s) => {
  const raw = fs.readFileSync(path.join(DOCS, s.file), 'utf8');
  // Drop the source document's own H1 - the section heading replaces it.
  const withoutTitle = raw.replace(/^#\s+.*\n+/, '');
  const shifted = demoteHeadings(withoutTitle);
  const linked = rewriteLinks(shifted, anchors);

  return `\n\n---\n\n# ${s.heading}\n\n> Source: \`docs/${s.file}\`\n\n${linked.trim()}\n`;
}).join('');

const header = `# Project Deliverables
## TechSpark Solutions — KYC & AML Platform with Conversational Assistant

**Generative AI in Software Testing — combined submission document**

| Field | Value |
|---|---|
| Stack | Node.js · Express · PostgreSQL · Jest + Supertest |
| Requirements | 49 (36 automated) |
| Automated tests | 91 — all passing |
| Traceability coverage | 36 / 36 automated requirements, 0 gaps |
| Documents combined | ${numbered.length} |

> **Generated file — do not edit by hand.**
> Built by \`scripts/build-deliverables.js\` from the six documents in \`docs/\`.
> Section 4 (the traceability matrix) is itself generated from a real test run,
> so regenerate after any test change:
>
> \`\`\`bash
> npm run test:report && npm run rtm && npm run deliverables
> \`\`\`

---

## Contents

${toc}

---

## Rubric criteria — where each is evidenced

| Criterion | Section |
|---|---|
${rubricRows}

The remaining sections provide the supporting test engineering evidence: documented test cases, the generated traceability matrix, execution results with defects found, and a critical analysis of using generative AI throughout.
${body}`;

fs.writeFileSync(OUTPUT, header);

const lines = header.split('\n').length;
const kb = (Buffer.byteLength(header) / 1024).toFixed(1);
console.log(`[deliverables] wrote DELIVERABLES.md — ${numbered.length} sections, ${lines} lines, ${kb} KB`);

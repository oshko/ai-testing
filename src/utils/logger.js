'use strict';

const config = require('../config');

/**
 * PII redaction for log output (REQ-NFR-615, REQ-NLP-210).
 *
 * The platform stores PII in the database — it must, that is the point of KYC —
 * but logs are replicated to aggregators, shipped off-host and retained on
 * different schedules, so they are the highest-risk leak surface. Redaction
 * therefore happens at the *formatter*, not at call sites: a developer cannot
 * accidentally bypass it by forgetting to sanitise an argument.
 *
 * Ordering matters. Email is redacted before the generic digit-run rule so that
 * an address like `user1234567@x.com` is masked as a whole rather than having
 * only its digits chewed out.
 */
const REDACTION_RULES = [
  // Email addresses
  { name: 'EMAIL', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  // Passport / national-ID style: 1-2 letters followed by 6-9 digits
  { name: 'DOC_NUMBER', pattern: /\b[A-Z]{1,2}\d{6,9}\b/g },
  // International phone numbers
  { name: 'PHONE', pattern: /\+\d[\d\s-]{7,16}\d/g },
  // Bare digit runs of 9+ (account numbers, tax IDs, card numbers)
  { name: 'LONG_DIGITS', pattern: /\b\d{9,}\b/g },
];

const REDACTED = '[REDACTED]';

/** Replaces PII in a string with the redaction marker. */
function redactString(input) {
  let output = input;
  for (const rule of REDACTION_RULES) {
    output = output.replace(rule.pattern, REDACTED);
  }
  return output;
}

/**
 * Recursively redacts a value of any shape. Cycles are guarded with a seen-set
 * because request/response objects are frequently self-referential.
 */
function redact(value, seen = new WeakSet()) {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    // Credential-bearing keys are dropped wholesale rather than pattern-matched:
    // a password or token has no safe partial representation.
    if (/^(password|token|authorization|secret|jwt|apiKey)$/i.test(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v, seen);
    }
  }
  return out;
}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = config.isTest ? LEVELS.error : LEVELS.info;

// A swappable sink lets tests capture formatted output and assert that PII never
// reaches it, without monkey-patching console globally.
let sink = (line) => process.stdout.write(`${line}\n`);

function setSink(fn) {
  sink = fn;
}

function format(level, message, meta) {
  const record = {
    level,
    msg: redactString(String(message)),
    ...(meta ? { meta: redact(meta) } : {}),
  };
  return JSON.stringify(record);
}

function log(level, message, meta) {
  if (LEVELS[level] > activeLevel) return;
  sink(format(level, message, meta));
}

module.exports = {
  error: (m, meta) => log('error', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  info: (m, meta) => log('info', m, meta),
  debug: (m, meta) => log('debug', m, meta),
  redact,
  redactString,
  format,
  setSink,
  REDACTED,
};

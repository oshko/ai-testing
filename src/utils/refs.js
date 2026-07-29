'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — avoids transcription errors

function randomToken(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Builds a human-quotable business reference, e.g. `ALT-3K9QW2XP`.
 *
 * These are generated in-process rather than from a database sequence so that a
 * reference can be allocated before the row is written (needed inside the
 * transaction that creates an alert and its audit record together), and so the
 * platform stays horizontally scalable with no shared counter (REQ-NFR-606).
 * Collision probability is negligible at 32^8 per prefix, and the unique
 * constraint in the schema is the backstop.
 */
function makeRef(prefix) {
  return `${prefix}-${randomToken(8)}`;
}

module.exports = {
  customerRef: () => makeRef('CUST'),
  accountRef: () => makeRef('ACCT'),
  transactionRef: () => makeRef('TXN'),
  alertRef: () => makeRef('ALT'),
  sarRef: () => makeRef('SAR'),
  sessionRef: () => makeRef('SESS'),
  makeRef,
  randomToken,
};

'use strict';

const config = require('./config');
const { isHighRisk, isProhibited } = require('./kyc');

/**
 * AML transaction-monitoring rules (REQ-AML-02 … REQ-AML-05).
 *
 * Each rule is a small async function taking `{ txn, thresholds }` plus a query
 * runner, returning an alert candidate or null. Adding a rule means adding one
 * function and one RULES entry - no existing rule is touched.
 *
 * Thresholds are *passed in* rather than imported so a test can override the
 * structuring window without mutating process.env and leaking state into other
 * tests (REQ-AML-06).
 */

function defaultThresholds() {
  return {
    cashThreshold: config.aml.cashThreshold,
    structuringWindowHours: config.aml.structuringWindowHours,
    structuringMinCount: config.aml.structuringMinCount,
    velocityWindowHours: config.aml.velocityWindowHours,
    velocityMaxCount: config.aml.velocityMaxCount,
  };
}

/** ISO timestamp `hours` before `from`. */
const hoursBefore = (from, hours) => new Date(new Date(from).getTime() - hours * 3600000).toISOString();

const num = (v) => Number.parseFloat(v);

// --- AML-R01: single cash transaction at or above the threshold (REQ-AML-02) ---
async function ruleThreshold({ txn, thresholds }) {
  if (txn.channel !== 'CASH') return null;
  // Boundary is inclusive: a transaction *at* the threshold is reportable.
  if (num(txn.amount) < thresholds.cashThreshold) return null;

  return {
    rule_code: 'AML-R01',
    rule_name: 'Cash transaction at or above reporting threshold',
    severity: 'HIGH',
    details: { amount: num(txn.amount), threshold: thresholds.cashThreshold },
  };
}

// --- AML-R02: structuring (REQ-AML-03) ---
async function ruleStructuring({ txn, thresholds, query }) {
  if (txn.channel !== 'CASH') return null;

  const lower = thresholds.cashThreshold * 0.5;
  const upper = thresholds.cashThreshold;

  // The transaction being evaluated must itself sit in the suspicious band,
  // otherwise an unrelated small payment would re-trigger the whole pattern.
  const amount = num(txn.amount);
  if (amount < lower || amount >= upper) return null;

  const { rows } = await query(
    `SELECT transaction_ref, amount FROM transactions
      WHERE customer_id = $1 AND channel = 'CASH'
        AND amount >= $2 AND amount < $3
        AND occurred_at > $4 AND occurred_at <= $5
      ORDER BY occurred_at`,
    [txn.customer_id, lower, upper,
      hoursBefore(txn.occurred_at, thresholds.structuringWindowHours), txn.occurred_at],
  );

  if (rows.length < thresholds.structuringMinCount) return null;

  const total = rows.reduce((sum, r) => sum + num(r.amount), 0);
  // Three small deposits are not structuring - the aggregate must reach what a
  // single reportable transaction would have.
  if (total < thresholds.cashThreshold) return null;

  return {
    rule_code: 'AML-R02',
    rule_name: 'Potential structuring - multiple sub-threshold cash transactions',
    severity: 'CRITICAL',
    suppressWindowHours: thresholds.structuringWindowHours,
    details: {
      transaction_count: rows.length,
      aggregate_amount: Math.round(total * 100) / 100,
      window_hours: thresholds.structuringWindowHours,
      contributing: rows.map((r) => r.transaction_ref),
    },
  };
}

// --- AML-R03: velocity (REQ-AML-04) ---
async function ruleVelocity({ txn, thresholds, query }) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM transactions
      WHERE customer_id = $1 AND occurred_at > $2 AND occurred_at <= $3`,
    [txn.customer_id, hoursBefore(txn.occurred_at, thresholds.velocityWindowHours), txn.occurred_at],
  );

  const count = rows[0].count;
  // Strictly greater than - the limit itself is allowed, so the (max+1)th
  // transaction is the first to breach.
  if (count <= thresholds.velocityMaxCount) return null;

  return {
    rule_code: 'AML-R03',
    rule_name: 'Transaction velocity exceeds expected profile',
    severity: 'MEDIUM',
    suppressWindowHours: thresholds.velocityWindowHours,
    details: {
      transaction_count: count,
      limit: thresholds.velocityMaxCount,
      window_hours: thresholds.velocityWindowHours,
    },
  };
}

// --- AML-R04: high-risk counterparty geography (REQ-AML-05) ---
async function ruleGeography({ txn, thresholds }) {
  const country = txn.counterparty_country;
  if (!country || !isHighRisk(country)) return null;

  const amount = num(txn.amount);
  const escalateAbove = thresholds.cashThreshold * 0.5;
  // Prohibited jurisdictions are always CRITICAL - the exposure itself is the
  // violation, regardless of amount.
  const severity = isProhibited(country) || amount > escalateAbove ? 'CRITICAL' : 'MEDIUM';

  return {
    rule_code: 'AML-R04',
    rule_name: isProhibited(country)
      ? 'Transaction involving prohibited jurisdiction'
      : 'Transaction involving high-risk jurisdiction',
    severity,
    details: { counterparty_country: country, amount, escalate_above: escalateAbove },
  };
}

const RULES = [
  { code: 'AML-R01', requirement: 'REQ-AML-02', fn: ruleThreshold },
  { code: 'AML-R02', requirement: 'REQ-AML-03', fn: ruleStructuring },
  { code: 'AML-R03', requirement: 'REQ-AML-04', fn: ruleVelocity },
  { code: 'AML-R04', requirement: 'REQ-AML-05', fn: ruleGeography },
];

/**
 * Aggregate rules fire on a *pattern*, so without suppression they raise a fresh
 * alert on every later transaction in the window - an alert storm that buries
 * the finding. If a matching alert already exists in the window, skip it.
 */
async function isSuppressed(candidate, { txn, query }) {
  if (!candidate.suppressWindowHours) return false;
  const { rows } = await query(
    `SELECT 1 FROM aml_alerts
      WHERE customer_id = $1 AND rule_code = $2 AND triggered_at > $3 LIMIT 1`,
    [txn.customer_id, candidate.rule_code,
      hoursBefore(txn.occurred_at, candidate.suppressWindowHours)],
  );
  return rows.length > 0;
}

/**
 * Evaluates all rules against one transaction.
 *
 * Rules run sequentially, not with Promise.all: they share one database
 * connection so the just-inserted transaction is visible, and a single pg client
 * cannot multiplex concurrent queries.
 */
async function evaluate(txn, { query, thresholds: overrides = {} } = {}) {
  const thresholds = { ...defaultThresholds(), ...overrides };
  const ctx = { txn, thresholds, query };

  const alerts = [];
  const suppressed = [];

  for (const rule of RULES) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design, see above
    const candidate = await rule.fn(ctx);
    if (!candidate) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isSuppressed(candidate, ctx)) {
      suppressed.push(candidate.rule_code);
      continue;
    }
    alerts.push({ ...candidate, requirement: rule.requirement });
  }

  return { alerts, suppressed, thresholds };
}

module.exports = {
  evaluate,
  defaultThresholds,
  hoursBefore,
  RULES,
  ruleThreshold,
  ruleStructuring,
  ruleVelocity,
  ruleGeography,
};

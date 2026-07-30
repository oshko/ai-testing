'use strict';

const express = require('express');
const db = require('./db');
const kyc = require('./kyc');
const aml = require('./aml');
const bot = require('./chatbot');

const router = express.Router();

// --- helpers ---------------------------------------------------------------

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data, error: null });
const fail = (res, status, code, message, details) => res.status(status).json({
  success: false, data: null, error: { code, message, ...(details ? { details } : {}) },
});

/** Wraps an async handler so a rejected promise reaches the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ref = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/**
 * Simplified auth (REQ-NFR-02): the caller's role arrives in the `x-user-role`
 * header. A production system would use a signed JWT - this project keeps a
 * header so the role-based access rules can still be specified and tested
 * without an auth stack. The limitation is recorded in the test report.
 */
function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.get('x-user-role');
    if (!role) return fail(res, 401, 'UNAUTHENTICATED', 'x-user-role header is required');
    if (!allowed.includes(role)) {
      return fail(res, 403, 'FORBIDDEN', `Role ${role} may not perform this action`, { required: allowed });
    }
    req.role = role;
    return next();
  };
}

// --- health (REQ-NFR-04) ---------------------------------------------------

router.get('/health', (req, res) => ok(res, { status: 'ok' }));

router.get('/health/ready', wrap(async (req, res) => {
  try {
    await db.query('SELECT 1');
    return ok(res, { status: 'ready', database: 'up' });
  } catch (err) {
    return fail(res, 503, 'NOT_READY', 'Database unavailable');
  }
}));

// --- customers / KYC ------------------------------------------------------

/** POST /api/customers - onboard a customer (REQ-KYC-01 … REQ-KYC-09) */
router.post('/api/customers', wrap(async (req, res) => {
  const errors = kyc.validateCustomer(req.body);
  if (errors.length) {
    // Surface the age-specific code when that is the reason, so the client can
    // show a meaningful message rather than a generic validation failure.
    const underage = errors.find((e) => e.code === 'UNDERAGE_APPLICANT');
    return fail(res, 400, underage ? 'UNDERAGE_APPLICANT' : 'VALIDATION_ERROR',
      'Customer data is invalid', errors);
  }

  const {
    full_name: fullName, date_of_birth: dob, email, country,
    occupation = null, annual_income: income = null, is_pep: pepFlag = false,
  } = req.body;

  const dup = await db.query('SELECT id FROM customers WHERE lower(email) = lower($1)', [email]);
  if (dup.rows.length) {
    return fail(res, 409, 'DUPLICATE_CUSTOMER', 'A customer with this email already exists');
  }

  // Screening against the watchlist (REQ-INT-01). Exact name match keeps the
  // simulation simple; a real provider would do fuzzy matching.
  const hits = await db.query('SELECT list_type FROM watchlist WHERE lower(full_name) = lower($1)', [fullName]);
  const sanctionsMatch = hits.rows.some((r) => r.list_type === 'SANCTIONS');
  const isPep = Boolean(pepFlag) || hits.rows.some((r) => r.list_type === 'PEP');

  const risk = kyc.computeRisk({
    country, is_pep: isPep, occupation, annual_income: income, sanctions_match: sanctionsMatch,
  });

  // Prohibited customers are rejected outright; HIGH risk goes to Enhanced Due
  // Diligence rather than auto-approval (REQ-KYC-08).
  let status = 'PENDING';
  if (risk.prohibited) status = 'REJECTED';
  else if (risk.rating === 'HIGH') status = 'IN_REVIEW';

  const { rows } = await db.query(
    `INSERT INTO customers
       (customer_ref, full_name, date_of_birth, email, country, occupation,
        annual_income, is_pep, kyc_status, risk_score, risk_rating, risk_factors)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [ref('CUST'), fullName, dob, email, String(country).toUpperCase(), occupation,
      income, isPep, status, risk.score, risk.rating, JSON.stringify(risk.factors)],
  );

  return ok(res, {
    customer: rows[0],
    risk_assessment: risk,
    screening: { sanctions_match: sanctionsMatch, is_pep: isPep },
  }, 201);
}));

/** GET /api/customers/:id - profile with documents and alert count (REQ-KYC-11) */
router.get('/api/customers/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'INVALID_ID', 'Customer id must be an integer');

  const { rows } = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
  if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'Customer not found');

  const docs = await db.query('SELECT * FROM kyc_documents WHERE customer_id = $1 ORDER BY id', [id]);
  const alerts = await db.query('SELECT COUNT(*)::int AS count FROM aml_alerts WHERE customer_id = $1', [id]);

  return ok(res, {
    customer: rows[0],
    documents: docs.rows,
    alert_count: alerts.rows[0].count,
  });
}));

router.get('/api/customers', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM customers ORDER BY id LIMIT 100');
  return ok(res, { customers: rows, count: rows.length });
}));

/** POST /api/customers/:id/documents - upload and verify (REQ-KYC-04, 05, 10) */
router.post('/api/customers/:id/documents', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const customer = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
  if (!customer.rows.length) return fail(res, 404, 'NOT_FOUND', 'Customer not found');

  const type = String(req.body.document_type || '').toUpperCase();
  if (!kyc.DOCUMENT_TYPES.includes(type)) {
    return fail(res, 400, 'UNSUPPORTED_DOCUMENT_TYPE',
      `document_type must be one of ${kyc.DOCUMENT_TYPES.join(', ')}`);
  }
  if (!req.body.document_number) {
    return fail(res, 400, 'VALIDATION_ERROR', 'document_number is required');
  }

  const verdict = kyc.verifyDocument({ ...req.body, document_type: type });

  const inserted = await db.query(
    `INSERT INTO kyc_documents
       (customer_id, document_type, document_number, expiry_date, status, failure_reason)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, type, req.body.document_number, req.body.expiry_date || null,
      verdict.status, verdict.failure_reason],
  );

  // Re-score with the full document set - document integrity feeds the score.
  const allDocs = await db.query('SELECT * FROM kyc_documents WHERE customer_id = $1', [id]);
  const c = customer.rows[0];
  const risk = kyc.computeRisk({
    country: c.country,
    is_pep: c.is_pep,
    occupation: c.occupation,
    annual_income: c.annual_income,
    documents: allDocs.rows,
    sanctions_match: c.risk_rating === 'PROHIBITED',
  });

  const sufficient = kyc.documentsSufficient(allDocs.rows);
  let status = c.kyc_status;
  if (status !== 'REJECTED') {
    if (sufficient && risk.rating !== 'HIGH' && !risk.prohibited) status = 'VERIFIED';
    else status = 'IN_REVIEW';
  }

  const updated = await db.query(
    `UPDATE customers SET kyc_status=$2, risk_score=$3, risk_rating=$4, risk_factors=$5
      WHERE id=$1 RETURNING *`,
    [id, status, risk.score, risk.rating, JSON.stringify(risk.factors)],
  );

  return ok(res, {
    document: inserted.rows[0],
    customer: updated.rows[0],
    documents_sufficient: sufficient,
    risk_assessment: risk,
  }, 201);
}));

// --- transactions and AML -------------------------------------------------

/** POST /api/transactions - ingest and screen synchronously (REQ-AML-01) */
router.post('/api/transactions', wrap(async (req, res) => {
  const {
    customer_id: customerId, amount, direction = 'CREDIT', channel,
    counterparty_country: cpCountry = null, occurred_at: occurredAt,
  } = req.body;

  if (!customerId || amount === undefined || !channel) {
    return fail(res, 400, 'VALIDATION_ERROR', 'customer_id, amount and channel are required');
  }
  if (Number(amount) <= 0) {
    return fail(res, 400, 'VALIDATION_ERROR', 'amount must be greater than zero');
  }

  const customer = await db.query('SELECT id FROM customers WHERE id = $1', [customerId]);
  if (!customer.rows.length) return fail(res, 404, 'NOT_FOUND', 'Customer not found');

  const inserted = await db.query(
    `INSERT INTO transactions
       (transaction_ref, customer_id, direction, amount, channel, counterparty_country, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, now())) RETURNING *`,
    [ref('TXN'), customerId, direction, amount, String(channel).toUpperCase(),
      cpCountry ? String(cpCountry).toUpperCase() : null, occurredAt || null],
  );
  const txn = inserted.rows[0];

  // Rules run against committed data, so the new row is visible to them.
  const { alerts, suppressed } = await aml.evaluate(txn, { query: db.query });

  const saved = [];
  for (const a of alerts) {
    // eslint-disable-next-line no-await-in-loop
    const row = await db.query(
      `INSERT INTO aml_alerts
         (alert_ref, customer_id, transaction_id, rule_code, rule_name, severity, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ref('ALT'), customerId, txn.id, a.rule_code, a.rule_name, a.severity,
        JSON.stringify(a.details)],
    );
    saved.push(row.rows[0]);
  }

  return ok(res, { transaction: txn, alerts: saved, suppressed_rules: suppressed }, 201);
}));

/** GET /api/alerts - analyst alert queue (REQ-AML-08) */
router.get('/api/alerts', requireRole('ANALYST', 'COMPLIANCE_OFFICER'), wrap(async (req, res) => {
  const { status, severity, customer_id: customerId } = req.query;

  // Filters are appended as bound parameters - never string-interpolated.
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (severity) { params.push(severity); clauses.push(`severity = $${params.length}`); }
  if (customerId) { params.push(Number(customerId)); clauses.push(`customer_id = $${params.length}`); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM aml_alerts ${where} ORDER BY triggered_at DESC LIMIT 200`, params,
  );
  return ok(res, { alerts: rows, count: rows.length });
}));

/**
 * Alert lifecycle: OPEN -> IN_REVIEW -> CLOSED_* (REQ-AML-07).
 * Closing straight from OPEN is rejected - an alert must be reviewed before it
 * can be dispositioned, which is the control the audit depends on.
 */
const ALLOWED_TRANSITIONS = {
  OPEN: ['IN_REVIEW'],
  IN_REVIEW: ['CLOSED_FALSE_POSITIVE', 'CLOSED_CONFIRMED'],
  CLOSED_FALSE_POSITIVE: [],
  CLOSED_CONFIRMED: [],
};

router.patch('/api/alerts/:id', requireRole('ANALYST', 'COMPLIANCE_OFFICER'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const next = String(req.body.status || '').toUpperCase();

  const found = await db.query('SELECT * FROM aml_alerts WHERE id = $1', [id]);
  if (!found.rows.length) return fail(res, 404, 'NOT_FOUND', 'Alert not found');

  const current = found.rows[0].status;
  if (!(ALLOWED_TRANSITIONS[current] || []).includes(next)) {
    return fail(res, 409, 'INVALID_TRANSITION',
      `Cannot move alert from ${current} to ${next}`,
      { from: current, to: next, allowed: ALLOWED_TRANSITIONS[current] });
  }

  const { rows } = await db.query(
    'UPDATE aml_alerts SET status = $2 WHERE id = $1 RETURNING *', [id, next],
  );
  return ok(res, { alert: rows[0] });
}));

// --- chatbot --------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 1000;

/** POST /api/chat - one conversational turn (REQ-CHT-01 … REQ-CHT-06) */
router.post('/api/chat', wrap(async (req, res) => {
  const sessionId = req.body.session_id || ref('SESS');
  const message = req.body.message;

  if (!message || !String(message).trim()) {
    return fail(res, 400, 'VALIDATION_ERROR', 'message is required');
  }
  // Bound the processing cost of a single turn (REQ-NLP-06).
  if (String(message).length > MAX_MESSAGE_LENGTH) {
    return fail(res, 400, 'MESSAGE_TOO_LONG',
      `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
  }

  const role = req.get('x-user-role') || 'CUSTOMER';
  const { intent, confidence, candidate_intent: candidate } = bot.classifyIntent(message);
  const entities = bot.extractEntities(message);

  // Resolve only the context the detected intent actually needs.
  const context = { role };

  if (intent === 'check_kyc_status') {
    const email = entities.EMAIL || req.body.email;
    if (email) {
      const found = await db.query(
        'SELECT * FROM customers WHERE lower(email) = lower($1)', [email],
      );
      context.customer = found.rows[0] || null;
    }
  }

  if (intent === 'query_alerts' && (role === 'ANALYST' || role === 'COMPLIANCE_OFFICER')) {
    const params = [];
    let where = "WHERE status = 'OPEN'";
    if (entities.ALERT_SEVERITY) {
      params.push(entities.ALERT_SEVERITY);
      where += ` AND severity = $${params.length}`;
    }
    const found = await db.query(
      `SELECT * FROM aml_alerts ${where} ORDER BY triggered_at DESC LIMIT 50`, params,
    );
    context.alerts = found.rows;
  }

  const { reply, escalated, escalation_reason: reason } = bot.buildReply(intent, entities, context);

  // Persist both turns so the transcript is auditable (REQ-CHT-06).
  await db.query(
    `INSERT INTO chat_messages (session_id, sender, message, intent, confidence, entities, escalated)
     VALUES ($1,'USER',$2,$3,$4,$5,$6)`,
    [sessionId, message, intent, confidence, JSON.stringify(entities), Boolean(escalated)],
  );
  await db.query(
    "INSERT INTO chat_messages (session_id, sender, message) VALUES ($1,'BOT',$2)",
    [sessionId, reply],
  );

  return ok(res, {
    session_id: sessionId,
    intent,
    confidence,
    candidate_intent: candidate,
    entities,
    reply,
    escalated: Boolean(escalated),
    ...(reason ? { escalation_reason: reason } : {}),
    ...(intent === 'query_alerts' && context.alerts ? { alerts: context.alerts } : {}),
  });
}));

/** GET /api/chat/:sessionId - full transcript */
router.get('/api/chat/:sessionId', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at, id',
    [req.params.sessionId],
  );
  return ok(res, { session_id: req.params.sessionId, messages: rows, count: rows.length });
}));

/** GET /api/intents - the published intent catalogue (REQ-NLP-01) */
router.get('/api/intents', (req, res) => ok(res, {
  intents: bot.INTENT_NAMES,
  confidence_threshold: bot.CONFIDENCE_THRESHOLD,
}));

module.exports = router;

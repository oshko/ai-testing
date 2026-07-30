'use strict';

const {
  app, db, request, resetDb, createCustomer, postTransaction, ruleCodes,
} = require('./helpers');
const aml = require('../src/aml');

let customerId;

beforeEach(async () => {
  await resetDb();
  const { customer } = await createCustomer();
  customerId = customer.id;
});

afterAll(() => db.close());

/** Finds an alert by rule code in a transaction response. */
const alertFor = (res, code) => res.body.data.alerts.find((a) => a.rule_code === code);

// ===========================================================================
// Ingest
// ===========================================================================

describe('Transaction ingest', () => {
  test('TC-AML-01 [REQ-AML-01] ingests a transaction and screens it synchronously', async () => {
    const res = await postTransaction(customerId, { amount: 500, channel: 'ACH' });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction.transaction_ref).toMatch(/^TXN-/);
    // The alerts array must always be present, even when empty, so callers can
    // rely on its shape rather than checking for undefined.
    expect(Array.isArray(res.body.data.alerts)).toBe(true);
  });

  test('TC-AML-02 [REQ-AML-01] rejects a transaction with a non-positive amount', async () => {
    const res = await postTransaction(customerId, { amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-AML-03 [REQ-AML-01] rejects a transaction for a customer that does not exist', async () => {
    const res = await postTransaction(999999, { amount: 100 });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// AML-R01 threshold
// ===========================================================================

describe('AML-R01 cash reporting threshold', () => {
  test('TC-AML-04 [REQ-AML-02] raises a HIGH alert on a cash transaction at the threshold', async () => {
    const res = await postTransaction(customerId, { amount: 10000, channel: 'CASH' });

    expect(ruleCodes(res)).toContain('AML-R01');
    expect(alertFor(res, 'AML-R01').severity).toBe('HIGH');
  });

  test('TC-AML-05 [REQ-AML-02] does not alert one unit below the threshold', async () => {
    // Boundary check: the threshold is inclusive, so 9,999 must stay clean.
    const res = await postTransaction(customerId, { amount: 9999, channel: 'CASH' });
    expect(ruleCodes(res)).not.toContain('AML-R01');
  });

  test('TC-AML-06 [REQ-AML-02] does not apply the cash rule to non-cash channels', async () => {
    const res = await postTransaction(customerId, { amount: 50000, channel: 'WIRE' });
    expect(ruleCodes(res)).not.toContain('AML-R01');
  });

  test('TC-AML-07 [REQ-AML-02] persists the alert against the customer and transaction', async () => {
    const res = await postTransaction(customerId, { amount: 12000, channel: 'CASH' });

    const rows = await db.query('SELECT * FROM aml_alerts WHERE customer_id = $1', [customerId]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].rule_code).toBe('AML-R01');
    expect(rows.rows[0].transaction_id).toBe(res.body.data.transaction.id);
    expect(rows.rows[0].status).toBe('OPEN');
  });
});

// ===========================================================================
// AML-R02 structuring
// ===========================================================================

describe('AML-R02 structuring', () => {
  test('TC-AML-08 [REQ-AML-03] raises CRITICAL on three sub-threshold cash deposits in the window', async () => {
    await postTransaction(customerId, { amount: 6000, channel: 'CASH', hoursAgo: 20 });
    await postTransaction(customerId, { amount: 6000, channel: 'CASH', hoursAgo: 10 });
    const res = await postTransaction(customerId, { amount: 6000, channel: 'CASH' });

    expect(ruleCodes(res)).toContain('AML-R02');
    const alert = alertFor(res, 'AML-R02');
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.details.transaction_count).toBe(3);
    expect(alert.details.aggregate_amount).toBe(18000);
    // The contributing transactions must be listed so an investigator can
    // reconstruct the pattern without re-running the query.
    expect(alert.details.contributing).toHaveLength(3);
  });

  test('TC-AML-09 [REQ-AML-03] does not alert on only two deposits', async () => {
    await postTransaction(customerId, { amount: 6000, channel: 'CASH', hoursAgo: 5 });
    const res = await postTransaction(customerId, { amount: 6000, channel: 'CASH' });

    expect(ruleCodes(res)).not.toContain('AML-R02');
  });

  test('TC-AML-10 [REQ-AML-03] ignores deposits below the 50% band', async () => {
    // 1,000 each is not a plausible split of a 10,000 reportable amount.
    await postTransaction(customerId, { amount: 1000, channel: 'CASH', hoursAgo: 20 });
    await postTransaction(customerId, { amount: 1000, channel: 'CASH', hoursAgo: 10 });
    const res = await postTransaction(customerId, { amount: 1000, channel: 'CASH' });

    expect(ruleCodes(res)).not.toContain('AML-R02');
  });

  test('TC-AML-11 [REQ-AML-03] does not alert when the aggregate stays below the threshold', async () => {
    // Three in-band deposits always sum past the threshold by construction
    // (3 x 50% = 150%), so this guard is unreachable through the HTTP API.
    // It is exercised directly at the rule level with a raised threshold, which
    // is the only way to cover the branch.
    const result = await aml.evaluate(
      {
        customer_id: customerId, amount: 5000, channel: 'CASH',
        direction: 'CREDIT', occurred_at: new Date().toISOString(),
      },
      { query: db.query, thresholds: { cashThreshold: 100000 } },
    );
    expect(result.alerts.map((a) => a.rule_code)).not.toContain('AML-R02');
  });

  test('TC-AML-12 [REQ-AML-03] suppresses duplicate structuring alerts inside the window', async () => {
    await postTransaction(customerId, { amount: 6000, channel: 'CASH', hoursAgo: 20 });
    await postTransaction(customerId, { amount: 6000, channel: 'CASH', hoursAgo: 10 });
    await postTransaction(customerId, { amount: 6000, channel: 'CASH', hoursAgo: 5 });

    // A fourth in-band deposit re-matches the pattern but must not raise a
    // second alert - otherwise the queue fills with duplicates of one finding.
    const res = await postTransaction(customerId, { amount: 6000, channel: 'CASH' });

    expect(res.body.data.suppressed_rules).toContain('AML-R02');
    const rows = await db.query(
      "SELECT COUNT(*)::int AS n FROM aml_alerts WHERE rule_code = 'AML-R02'",
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

// ===========================================================================
// AML-R03 velocity
// ===========================================================================

describe('AML-R03 velocity', () => {
  test('TC-AML-13 [REQ-AML-04] raises MEDIUM when the transaction count exceeds the limit', async () => {
    // The limit is 10, so the 11th transaction inside 24h is the first breach.
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await postTransaction(customerId, { amount: 250, channel: 'CARD', hoursAgo: 20 - i });
    }
    const res = await postTransaction(customerId, { amount: 250, channel: 'CARD' });

    expect(ruleCodes(res)).toContain('AML-R03');
    const alert = alertFor(res, 'AML-R03');
    expect(alert.severity).toBe('MEDIUM');
    expect(alert.details.transaction_count).toBe(11);
  });

  test('TC-AML-14 [REQ-AML-04] does not alert at exactly the limit', async () => {
    for (let i = 0; i < 9; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await postTransaction(customerId, { amount: 250, channel: 'CARD', hoursAgo: 20 - i });
    }
    const res = await postTransaction(customerId, { amount: 250, channel: 'CARD' });

    expect(ruleCodes(res)).not.toContain('AML-R03');
  });

  test('TC-AML-15 [REQ-AML-04] ignores transactions outside the rolling window', async () => {
    // 12 transactions, but spread over 5 days - none inside a single 24h window.
    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await postTransaction(customerId, { amount: 250, channel: 'CARD', hoursAgo: 30 + i * 10 });
    }
    const res = await postTransaction(customerId, { amount: 250, channel: 'CARD' });

    expect(ruleCodes(res)).not.toContain('AML-R03');
  });
});

// ===========================================================================
// AML-R04 geography
// ===========================================================================

describe('AML-R04 high-risk geography', () => {
  test('TC-AML-16 [REQ-AML-05] escalates to CRITICAL above 50% of the threshold', async () => {
    const res = await postTransaction(customerId, {
      amount: 7500, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'XA',
    });

    expect(ruleCodes(res)).toContain('AML-R04');
    expect(alertFor(res, 'AML-R04').severity).toBe('CRITICAL');
  });

  test('TC-AML-17 [REQ-AML-05] raises MEDIUM for a small high-risk transfer', async () => {
    const res = await postTransaction(customerId, {
      amount: 900, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'XB',
    });

    expect(alertFor(res, 'AML-R04').severity).toBe('MEDIUM');
  });

  test('TC-AML-18 [REQ-AML-05] always raises CRITICAL for a prohibited jurisdiction', async () => {
    // Amount is irrelevant here - the exposure itself is the violation.
    const res = await postTransaction(customerId, {
      amount: 150, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'ZZ',
    });

    expect(alertFor(res, 'AML-R04').severity).toBe('CRITICAL');
    expect(alertFor(res, 'AML-R04').rule_name).toMatch(/prohibited/i);
  });

  test('TC-AML-19 [REQ-AML-05] does not alert for a standard-risk counterparty country', async () => {
    const res = await postTransaction(customerId, {
      amount: 5000, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'DE',
    });
    expect(ruleCodes(res)).not.toContain('AML-R04');
  });

  test('TC-AML-20 [REQ-AML-02, REQ-AML-05] raises both rules when a transaction breaches two', async () => {
    const res = await postTransaction(customerId, {
      amount: 25000, channel: 'CASH', counterparty_country: 'QM',
    });

    expect(ruleCodes(res)).toEqual(['AML-R01', 'AML-R04']);
  });
});

// ===========================================================================
// Configurable thresholds
// ===========================================================================

describe('Configurable thresholds', () => {
  test('TC-AML-21 [REQ-AML-06] honours a threshold override without any code change', async () => {
    const txn = {
      customer_id: customerId, amount: 3000, channel: 'CASH',
      direction: 'CREDIT', occurred_at: new Date().toISOString(),
    };

    // At the default 10,000 threshold, 3,000 is unremarkable.
    const atDefault = await aml.evaluate(txn, { query: db.query });
    expect(atDefault.alerts.map((a) => a.rule_code)).not.toContain('AML-R01');

    // Lower the threshold to 2,000 and the same transaction is reportable.
    const lowered = await aml.evaluate(txn, {
      query: db.query, thresholds: { cashThreshold: 2000 },
    });
    expect(lowered.alerts.map((a) => a.rule_code)).toContain('AML-R01');
  });

  test('TC-AML-22 [REQ-AML-06] exposes the thresholds actually applied', async () => {
    const result = await aml.evaluate(
      {
        customer_id: customerId, amount: 100, channel: 'ACH',
        direction: 'CREDIT', occurred_at: new Date().toISOString(),
      },
      { query: db.query, thresholds: { velocityMaxCount: 3 } },
    );
    expect(result.thresholds.velocityMaxCount).toBe(3);
    expect(result.thresholds.cashThreshold).toBe(10000); // untouched default
  });
});

// ===========================================================================
// Alert lifecycle and access control
// ===========================================================================

describe('Alert lifecycle', () => {
  async function openAlert() {
    const res = await postTransaction(customerId, { amount: 15000, channel: 'CASH' });
    return res.body.data.alerts[0];
  }

  test('TC-AML-23 [REQ-AML-07] allows OPEN -> IN_REVIEW', async () => {
    const alert = await openAlert();

    const res = await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'ANALYST').send({ status: 'IN_REVIEW' });

    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('IN_REVIEW');
  });

  test('TC-AML-24 [REQ-AML-07] rejects closing an alert straight from OPEN', async () => {
    // An alert must be reviewed before disposition - this is the control the
    // compliance audit depends on.
    const alert = await openAlert();

    const res = await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'ANALYST').send({ status: 'CLOSED_CONFIRMED' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(res.body.error.details.allowed).toEqual(['IN_REVIEW']);
  });

  test('TC-AML-25 [REQ-AML-07] allows IN_REVIEW -> CLOSED_CONFIRMED', async () => {
    const alert = await openAlert();
    await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'ANALYST').send({ status: 'IN_REVIEW' });

    const res = await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'COMPLIANCE_OFFICER').send({ status: 'CLOSED_CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('CLOSED_CONFIRMED');
  });

  test('TC-AML-26 [REQ-AML-07] rejects any transition out of a closed state', async () => {
    const alert = await openAlert();
    await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'ANALYST').send({ status: 'IN_REVIEW' });
    await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'ANALYST').send({ status: 'CLOSED_FALSE_POSITIVE' });

    const res = await request(app).patch(`/api/alerts/${alert.id}`)
      .set('x-user-role', 'ANALYST').send({ status: 'IN_REVIEW' });

    expect(res.status).toBe(409);
  });

  test('TC-AML-27 [REQ-NFR-02] requires a role to read the alert queue', async () => {
    await openAlert();
    const res = await request(app).get('/api/alerts');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('TC-AML-28 [REQ-NFR-02] denies a CUSTOMER role access to the alert queue', async () => {
    await openAlert();
    const res = await request(app).get('/api/alerts').set('x-user-role', 'CUSTOMER');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('TC-AML-29 [REQ-AML-08] filters the alert queue by severity and status', async () => {
    await postTransaction(customerId, { amount: 15000, channel: 'CASH' });
    await postTransaction(customerId, {
      amount: 200, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'XB',
    });

    const filtered = await request(app).get('/api/alerts?severity=MEDIUM&status=OPEN')
      .set('x-user-role', 'ANALYST');

    expect(filtered.status).toBe(200);
    expect(filtered.body.data.alerts.length).toBeGreaterThan(0);
    filtered.body.data.alerts.forEach((a) => {
      expect(a.severity).toBe('MEDIUM');
      expect(a.status).toBe('OPEN');
    });
  });
});

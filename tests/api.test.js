'use strict';

const {
  app, db, request, resetDb, customerPayload, createCustomer,
} = require('./helpers');

beforeEach(resetDb);
afterAll(() => db.close());

// ===========================================================================
// Health and contract
// ===========================================================================

describe('Health and API contract', () => {
  test('TC-NFR-01 [REQ-NFR-04] liveness endpoint responds 200', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  test('TC-NFR-02 [REQ-NFR-04] readiness endpoint confirms database connectivity', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('up');
  });

  test('TC-NFR-03 [REQ-NFR-01] every success response uses the standard envelope', async () => {
    const res = await request(app).post('/api/customers').send(customerPayload());

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
  });

  test('TC-NFR-04 [REQ-NFR-01] every error response uses the same envelope shape', async () => {
    const res = await request(app).post('/api/customers').send({});

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });

  test('TC-NFR-05 [REQ-NFR-01] an unknown route returns a structured 404', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('TC-NFR-06 [REQ-NFR-01] a malformed JSON body is a client error, not a crash', async () => {
    const res = await request(app).post('/api/customers')
      .set('content-type', 'application/json')
      .send('{"full_name": broken');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
});

// ===========================================================================
// Security
// ===========================================================================

describe('Security', () => {
  test('TC-NFR-07 [REQ-NFR-03] does not advertise the server framework', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('TC-NFR-08 [REQ-NFR-03] treats a SQL injection payload in a body field as inert data', async () => {
    const payload = "Robert'); DROP TABLE customers;--";

    const res = await request(app).post('/api/customers')
      .send(customerPayload({ full_name: payload }));

    expect(res.status).toBe(201);
    // Stored verbatim as a string - proof it was bound, not executed.
    expect(res.body.data.customer.full_name).toBe(payload);

    // The table must still exist and hold the row.
    const rows = await db.query('SELECT full_name FROM customers');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].full_name).toBe(payload);
  });

  test('TC-NFR-09 [REQ-NFR-03] treats a SQL injection payload in a query string as inert', async () => {
    await createCustomer();

    const res = await request(app)
      .get("/api/alerts?status=' OR 1=1--")
      .set('x-user-role', 'ANALYST');

    // The filter matches no status, so the result is simply empty - the
    // injected clause is never evaluated as SQL.
    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(0);
  });

  test('TC-NFR-10 [REQ-NFR-03] does not leak a stack trace or SQL detail on an internal error', async () => {
    // A numeric id far beyond PostgreSQL's integer range triggers a driver-level
    // error, which is the simplest way to exercise the 500 path.
    const res = await request(app).get('/api/customers/999999999999999999999');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+/); // no stack frames
    expect(res.body.error).not.toHaveProperty('stack');
  });

  test('TC-NFR-11 [REQ-NFR-02] enforces the role gate on alert mutation', async () => {
    const res = await request(app).patch('/api/alerts/1').send({ status: 'IN_REVIEW' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

'use strict';

const {
  app, db, request, resetDb, customerPayload, createCustomer,
} = require('./helpers');
const kyc = require('../src/kyc');

beforeEach(resetDb);
afterAll(() => db.close());

// ===========================================================================
// Customer onboarding and validation
// ===========================================================================

describe('KYC onboarding', () => {
  test('TC-KYC-01 [REQ-KYC-01] onboards a valid low-risk applicant and persists the record', async () => {
    const res = await request(app).post('/api/customers').send(customerPayload());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.customer_ref).toMatch(/^CUST-/);
    expect(res.body.data.customer.risk_rating).toBe('LOW');
    expect(res.body.data.customer.kyc_status).toBe('PENDING');

    const row = await db.query('SELECT * FROM customers WHERE id = $1',
      [res.body.data.customer.id]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].full_name).toBe('Alice Morgan');
  });

  test('TC-KYC-02 [REQ-KYC-02] rejects a payload missing the mandatory country field', async () => {
    const res = await request(app).post('/api/customers')
      .send(customerPayload({ country: '' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('country');

    // No partial record may be created by a rejected submission.
    const count = await db.query('SELECT COUNT(*)::int AS n FROM customers');
    expect(count.rows[0].n).toBe(0);
  });

  test('TC-KYC-03 [REQ-KYC-02] reports every invalid field, not just the first', async () => {
    const res = await request(app).post('/api/customers')
      .send({ full_name: '', email: 'not-an-email', date_of_birth: 'nonsense', country: '' });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toContain('full_name');
    expect(fields).toContain('email');
    expect(fields).toContain('country');
    expect(fields).toContain('date_of_birth');
  });

  test('TC-KYC-04 [REQ-KYC-03] rejects an applicant under 18 with a specific error code', async () => {
    const res = await request(app).post('/api/customers')
      .send(customerPayload({ date_of_birth: '2012-01-01' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNDERAGE_APPLICANT');
  });

  test('TC-KYC-05 [REQ-KYC-03] accepts an applicant who is exactly 18 today', async () => {
    // Boundary: 18 must be allowed, so the check is >= 18 and not > 18.
    const today = new Date();
    const dob = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
    const res = await request(app).post('/api/customers')
      .send(customerPayload({ date_of_birth: dob.toISOString().slice(0, 10) }));

    expect(res.status).toBe(201);
  });

  test('TC-KYC-06 [REQ-KYC-09] rejects a duplicate email with 409', async () => {
    const first = customerPayload({ email: 'duplicate.check@example.com' });
    await request(app).post('/api/customers').send(first).expect(201);

    const res = await request(app).post('/api/customers')
      .send({ ...first, full_name: 'Someone Else' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_CUSTOMER');
  });

  test('TC-KYC-07 [REQ-KYC-09] treats email matching as case-insensitive', async () => {
    await request(app).post('/api/customers')
      .send(customerPayload({ email: 'MixedCase@Example.com' })).expect(201);

    const res = await request(app).post('/api/customers')
      .send(customerPayload({ email: 'mixedcase@example.com' }));

    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// Risk scoring
// ===========================================================================

describe('KYC risk scoring', () => {
  test('TC-KYC-08 [REQ-KYC-06] itemises every factor contributing to the score', async () => {
    const data = await createCustomer({ occupation: 'ENGINEER', country: 'GB' });

    const codes = data.risk_assessment.factors.map((f) => f.code);
    expect(codes).toContain('COUNTRY');
    expect(codes).toContain('OCCUPATION');
    // The itemised points must reconcile with the headline score.
    const sum = data.risk_assessment.factors.reduce((n, f) => n + f.points, 0);
    expect(data.risk_assessment.score).toBe(sum);
  });

  test('TC-KYC-09 [REQ-KYC-06] is deterministic for identical input', async () => {
    const a = kyc.computeRisk({ country: 'US', occupation: 'LAWYER', annual_income: 120000 });
    const b = kyc.computeRisk({ country: 'US', occupation: 'LAWYER', annual_income: 120000 });
    expect(a.score).toBe(b.score);
    expect(a.rating).toBe(b.rating);
  });

  test('TC-KYC-10 [REQ-KYC-07] rates a high-risk occupation as MEDIUM', async () => {
    const data = await createCustomer({ country: 'US', occupation: 'MONEY SERVICE BUSINESS' });
    expect(data.customer.risk_rating).toBe('MEDIUM');
  });

  test('TC-KYC-11 [REQ-KYC-08] routes a HIGH-risk PEP to review rather than auto-approving', async () => {
    const data = await createCustomer({
      full_name: 'Helena Brandt', country: 'XB', occupation: 'GOVERNMENT OFFICIAL',
    });

    expect(data.customer.risk_rating).toBe('HIGH');
    expect(data.customer.kyc_status).toBe('IN_REVIEW');
    expect(data.risk_assessment.edd_required).toBe(true);
    // The PEP flag is derived from the watchlist, not only from client input.
    expect(data.screening.is_pep).toBe(true);
  });

  test('TC-KYC-12 [REQ-KYC-05] rejects an applicant from a prohibited jurisdiction', async () => {
    const data = await createCustomer({ country: 'ZZ' });

    expect(data.customer.risk_rating).toBe('PROHIBITED');
    expect(data.customer.kyc_status).toBe('REJECTED');
    expect(data.risk_assessment.prohibited_reasons.length).toBeGreaterThan(0);
  });

  test('TC-KYC-13 [REQ-INT-01] rejects an applicant matching a sanctions list entry', async () => {
    const data = await createCustomer({ full_name: 'Viktor Kessler', country: 'DE' });

    expect(data.screening.sanctions_match).toBe(true);
    expect(data.customer.risk_rating).toBe('PROHIBITED');
    expect(data.customer.kyc_status).toBe('REJECTED');
  });

  test('TC-KYC-14 [REQ-KYC-06] fails closed on an unrecognised country code', async () => {
    // An unknown jurisdiction must never be scored as though it were low risk.
    const known = kyc.computeRisk({ country: 'GB', occupation: 'ENGINEER', annual_income: 1 });
    const unknown = kyc.computeRisk({ country: 'QQ', occupation: 'ENGINEER', annual_income: 1 });
    expect(unknown.score).toBeGreaterThan(known.score);
  });

  test('TC-KYC-15 [REQ-KYC-06] never lets accumulated ordinary factors reach PROHIBITED', async () => {
    // PROHIBITED is a hard gate, not the top score band: a pile-up of mild
    // factors must cap at 99/HIGH rather than auto-rejecting the customer.
    const worst = kyc.computeRisk({
      country: 'QM', is_pep: true, occupation: 'MONEY SERVICE BUSINESS',
      documents: [
        { document_type: 'PASSPORT', status: 'FAILED' },
        { document_type: 'PASSPORT', status: 'FAILED' },
        { document_type: 'UTILITY_BILL', status: 'EXPIRED' },
      ],
    });

    expect(worst.score).toBeLessThanOrEqual(99);
    expect(worst.rating).toBe('HIGH');
    expect(worst.prohibited).toBe(false);
  });
});

// ===========================================================================
// Document verification
// ===========================================================================

describe('KYC document verification', () => {
  test('TC-KYC-16 [REQ-KYC-04] accepts a valid passport as VERIFIED', async () => {
    const { customer } = await createCustomer();

    const res = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'PASSPORT', document_number: 'AB123456', expiry_date: '2030-01-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.document.status).toBe('VERIFIED');
  });

  test('TC-KYC-17 [REQ-KYC-04] rejects an unsupported document type', async () => {
    const { customer } = await createCustomer();

    const res = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'LIBRARY_CARD', document_number: 'LC-0001',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_DOCUMENT_TYPE');
  });

  test('TC-KYC-18 [REQ-KYC-04] marks a badly formatted document number as FAILED', async () => {
    const { customer } = await createCustomer();

    const res = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'PASSPORT', document_number: '12', expiry_date: '2030-01-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.document.status).toBe('FAILED');
    expect(res.body.data.document.failure_reason).toMatch(/format/i);
  });

  test('TC-KYC-19 [REQ-KYC-05] marks an out-of-date document as EXPIRED', async () => {
    const { customer } = await createCustomer();

    const res = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'PASSPORT', document_number: 'CD987654', expiry_date: '2020-01-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.document.status).toBe('EXPIRED');
    // An expired document must not satisfy the verification requirement.
    expect(res.body.data.customer.kyc_status).not.toBe('VERIFIED');
  });

  test('TC-KYC-20 [REQ-KYC-05] reports FAILED ahead of EXPIRED when a document is both', async () => {
    // Severity ordering: a malformed number suggests forgery (investigate),
    // which outranks an ordinary expiry lapse (renew).
    const verdict = kyc.verifyDocument({
      document_type: 'PASSPORT', document_number: 'BAD!', expiry_date: '2020-01-01',
    });
    expect(verdict.status).toBe('FAILED');
  });

  test('TC-KYC-21 [REQ-KYC-04] requires an expiry date where the document type demands one', async () => {
    const verdict = kyc.verifyDocument({
      document_type: 'PASSPORT', document_number: 'EF456789', expiry_date: null,
    });
    expect(verdict.status).toBe('FAILED');
    expect(verdict.failure_reason).toMatch(/expiry/i);
  });

  test('TC-KYC-22 [REQ-KYC-04] verifies an address document without an expiry date', async () => {
    const verdict = kyc.verifyDocument({
      document_type: 'UTILITY_BILL', document_number: 'UTIL-99213',
    });
    expect(verdict.status).toBe('VERIFIED');
  });
});

// ===========================================================================
// Verification gate and profile retrieval
// ===========================================================================

describe('KYC verification gate', () => {
  test('TC-KYC-23 [REQ-KYC-10] reaches VERIFIED only with both an identity and an address document', async () => {
    const { customer } = await createCustomer();

    // Identity alone is not sufficient.
    const idOnly = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'PASSPORT', document_number: 'AB123456', expiry_date: '2030-01-01',
    });
    expect(idOnly.body.data.documents_sufficient).toBe(false);
    expect(idOnly.body.data.customer.kyc_status).toBe('IN_REVIEW');

    // Adding proof of address completes the requirement.
    const withAddress = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'UTILITY_BILL', document_number: 'UTIL-77321',
    });
    expect(withAddress.body.data.documents_sufficient).toBe(true);
    expect(withAddress.body.data.customer.kyc_status).toBe('VERIFIED');
  });

  test('TC-KYC-24 [REQ-KYC-10] never verifies a customer already REJECTED', async () => {
    const { customer } = await createCustomer({ country: 'ZZ' });
    expect(customer.kyc_status).toBe('REJECTED');

    await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'PASSPORT', document_number: 'AB123456', expiry_date: '2030-01-01',
    });
    const res = await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'UTILITY_BILL', document_number: 'UTIL-77321',
    });

    expect(res.body.data.customer.kyc_status).toBe('REJECTED');
  });

  test('TC-KYC-25 [REQ-KYC-11] returns a consolidated profile with documents and alert count', async () => {
    const { customer } = await createCustomer();
    await request(app).post(`/api/customers/${customer.id}/documents`).send({
      document_type: 'PASSPORT', document_number: 'AB123456', expiry_date: '2030-01-01',
    });

    const res = await request(app).get(`/api/customers/${customer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer.id).toBe(customer.id);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.alert_count).toBe(0);
  });

  test('TC-KYC-26 [REQ-KYC-11] returns 404 for a customer that does not exist', async () => {
    const res = await request(app).get('/api/customers/999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

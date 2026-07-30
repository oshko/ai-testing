'use strict';

/**
 * Shared test helpers.
 *
 * Test names follow the convention:
 *     TC-<AREA>-<NN> [REQ-<AREA>-<NN>] description
 *
 * That is not cosmetic - scripts/generate-rtm.js parses these IDs out of Jest's
 * JSON output to build the Requirements Traceability Matrix. The RTM is
 * therefore generated from a real execution rather than maintained by hand,
 * so it cannot silently drift out of date.
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

/** Watchlist entries every suite can rely on. */
const WATCHLIST = [
  { list_type: 'SANCTIONS', full_name: 'Viktor Kessler', country: 'ZZ' },
  { list_type: 'PEP', full_name: 'Helena Brandt', country: 'XB' },
];

/** Truncates every table and reloads the watchlist. Call in beforeEach. */
async function resetDb() {
  await db.truncateAll();
  for (const w of WATCHLIST) {
    // eslint-disable-next-line no-await-in-loop
    await db.query('INSERT INTO watchlist (list_type, full_name, country) VALUES ($1,$2,$3)',
      [w.list_type, w.full_name, w.country]);
  }
}

let emailSeq = 0;

/** A valid low-risk onboarding payload; override any field. */
function customerPayload(overrides = {}) {
  emailSeq += 1;
  return {
    full_name: 'Alice Morgan',
    date_of_birth: '1990-04-12',
    email: `test.customer.${emailSeq}@example.com`,
    country: 'GB',
    occupation: 'ENGINEER',
    annual_income: 85000,
    ...overrides,
  };
}

/** Onboards a customer and returns the response body's `data`. Throws on failure. */
async function createCustomer(overrides = {}) {
  const res = await request(app).post('/api/customers').send(customerPayload(overrides));
  if (res.status !== 201) {
    throw new Error(`createCustomer expected 201, got ${res.status}: ${JSON.stringify(res.body.error)}`);
  }
  return res.body.data;
}

/** Posts a transaction. `hoursAgo` positions it in the past for window rules. */
function postTransaction(customerId, overrides = {}) {
  const { hoursAgo = 0, ...rest } = overrides;
  return request(app).post('/api/transactions').send({
    customer_id: customerId,
    amount: 100,
    channel: 'ACH',
    direction: 'CREDIT',
    occurred_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
    ...rest,
  });
}

const ruleCodes = (res) => (res.body.data.alerts || []).map((a) => a.rule_code).sort();

module.exports = {
  app,
  db,
  request,
  resetDb,
  customerPayload,
  createCustomer,
  postTransaction,
  ruleCodes,
  WATCHLIST,
};

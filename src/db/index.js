'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

// A pool-level error handler is mandatory: without it, an idle client dropped
// by the server (network blip, Postgres restart) emits an unhandled 'error'
// event and takes the whole Node process down.
pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] unexpected idle client error:', err.message);
});

/**
 * Runs a parameterised query. All callers must pass values via `params` —
 * string interpolation into SQL is forbidden (REQ-NFR-612, SQL injection).
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Executes `fn` inside a transaction, committing on success and rolling back on
 * any thrown error. Used by flows that must be atomic, e.g. onboarding writes a
 * customer + risk assessment + audit row that must never be partially applied.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Applies schema.sql, dropping and recreating every table. */
async function runSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

/** Truncates all data tables but leaves the schema intact — used between suites. */
async function truncateAll() {
  await pool.query(`
    TRUNCATE audit_log, chat_messages, chat_sessions, sar_reports, aml_alerts,
             transactions, accounts, screening_results, watchlist_entries,
             risk_assessments, kyc_documents, customers, users
    RESTART IDENTITY CASCADE
  `);
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, runSchema, truncateAll, close };

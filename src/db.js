'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

// Without this handler, an idle client dropped by the server would emit an
// unhandled 'error' event and kill the Node process.
pool.on('error', (err) => console.error('[db] idle client error:', err.message));

/** Runs a parameterised query. Never interpolate values into SQL (REQ-NFR-03). */
const query = (text, params) => pool.query(text, params);

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

async function truncateAll() {
  await pool.query(`
    TRUNCATE chat_messages, aml_alerts, transactions, kyc_documents, watchlist, customers
    RESTART IDENTITY CASCADE
  `);
}

const close = () => pool.end();

module.exports = { pool, query, runSchema, truncateAll, close };

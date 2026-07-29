'use strict';

require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

/**
 * Reads an integer from the environment, falling back to a default when the
 * variable is absent or not numeric. Keeps AML thresholds tunable per
 * environment (REQ-AML-406) without scattering parseInt calls through the
 * rule engine.
 */
function intFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// In test runs we deliberately point at a separate physical database so that
// destructive fixture setup can never touch development data.
const database = env === 'test'
  ? process.env.TEST_PGDATABASE || 'kyc_aml_test'
  : process.env.PGDATABASE || 'kyc_aml_dev';

const config = {
  env,
  isTest: env === 'test',
  port: intFromEnv('PORT', 3000),

  db: {
    host: process.env.PGHOST || 'localhost',
    port: intFromEnv('PGPORT', 5432),
    user: process.env.PGUSER || 'postgres',
    // An empty string is a legitimate password for trust-auth local installs,
    // so only coerce undefined to undefined — never to ''.
    password: process.env.PGPASSWORD === undefined ? undefined : process.env.PGPASSWORD,
    database,
    max: env === 'test' ? 5 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'insecure-development-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  rateLimit: {
    windowMs: intFromEnv('RATE_LIMIT_WINDOW_MS', 60000),
    max: intFromEnv('RATE_LIMIT_MAX_REQUESTS', 100),
    // Rate limiting is disabled under test so that functional suites are not
    // throttled; a dedicated test re-enables it to verify REQ-NFR-605.
    enabled: env !== 'test',
  },

  synthetic: {
    seed: intFromEnv('SYNTHETIC_DATA_SEED', 20260729),
  },

  aml: {
    cashReportingThreshold: intFromEnv('AML_CASH_REPORTING_THRESHOLD', 10000),
    structuringWindowHours: intFromEnv('AML_STRUCTURING_WINDOW_HOURS', 72),
    structuringMinTxns: intFromEnv('AML_STRUCTURING_MIN_TXNS', 3),
    velocityWindowHours: intFromEnv('AML_VELOCITY_WINDOW_HOURS', 24),
    velocityMaxTxns: intFromEnv('AML_VELOCITY_MAX_TXNS', 15),
  },
};

module.exports = config;

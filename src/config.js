'use strict';

require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

// Tests point at a separate database so fixture cleanup can never touch dev data.
const database = env === 'test'
  ? (process.env.TEST_PGDATABASE || 'kyc_aml_test')
  : (process.env.PGDATABASE || 'kyc_aml_dev');

module.exports = {
  env,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 3000,

  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || undefined,
    database,
  },

  // AML thresholds live in config, not in the rule code, so they can be tuned
  // per environment without a code change (REQ-AML-06).
  aml: {
    cashThreshold: Number(process.env.AML_CASH_THRESHOLD) || 10000,
    structuringWindowHours: 72,
    structuringMinCount: 3,
    velocityWindowHours: 24,
    velocityMaxCount: 10,
  },

  seed: Number(process.env.DATA_SEED) || 20260729,
};

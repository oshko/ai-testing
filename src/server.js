'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');

const server = app.listen(config.port, () => {
  console.log(`[server] KYC/AML API listening on http://localhost:${config.port}`);
  console.log(`[server] database: ${config.db.database} (${config.env})`);
});

// Close the HTTP listener before the pool so in-flight requests can finish.
const shutdown = (signal) => {
  console.log(`\n[server] ${signal} received, shutting down`);
  server.close(async () => {
    await db.close().catch(() => {});
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

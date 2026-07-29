'use strict';

/**
 * Applies the schema to the configured database.
 *
 * Usage:
 *   npm run db:migrate         # development database
 *   npm run db:migrate:test    # test database (NODE_ENV=test)
 *
 * schema.sql is written to be idempotent (DROP ... IF EXISTS first), so this is
 * safe to re-run; `--reset` exists only as an explicit, self-documenting flag.
 */

const db = require('./index');
const config = require('../config');

async function main() {
  const target = `${config.db.database} @ ${config.db.host}:${config.db.port}`;
  console.log(`[migrate] applying schema to ${target} (NODE_ENV=${config.env})`);

  await db.runSchema();

  const { rows } = await db.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name
  `);

  console.log(`[migrate] done — ${rows.length} tables present:`);
  console.log(`[migrate]   ${rows.map((r) => r.table_name).join(', ')}`);
  await db.close();
}

main().catch(async (err) => {
  console.error('[migrate] FAILED:', err.message);
  await db.close().catch(() => {});
  process.exit(1);
});

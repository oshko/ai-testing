'use strict';

const db = require('./db');
const config = require('./config');

(async () => {
  console.log(`[setup] applying schema to "${config.db.database}"`);
  await db.runSchema();
  const { rows } = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  );
  console.log(`[setup] done - ${rows.length} tables: ${rows.map((r) => r.table_name).join(', ')}`);
  await db.close();
})().catch(async (err) => {
  console.error('[setup] FAILED:', err.message);
  await db.close().catch(() => {});
  process.exit(1);
});

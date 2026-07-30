'use strict';

/**
 * Loads the generated synthetic dataset into PostgreSQL.
 *
 * Only *valid* customers are seeded. The invalid fixtures (underage, malformed
 * email, duplicate) exist to be POSTed at the API so it can reject them - if we
 * inserted them directly we would bypass the very validation under test.
 *
 * Usage: npm run db:seed
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const config = require('../src/config');
const kyc = require('../src/kyc');
const aml = require('../src/aml');

const datasetPath = path.join(__dirname, '..', 'data', 'synthetic-dataset.json');
const ref = (prefix, n) => `${prefix}-${String(n).padStart(6, '0')}`;

async function seed() {
  if (!fs.existsSync(datasetPath)) {
    throw new Error('data/synthetic-dataset.json not found - run `npm run data:generate` first');
  }
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log(`[seed] target database: ${config.db.database}`);
  await db.truncateAll();

  for (const w of data.watchlist) {
    // eslint-disable-next-line no-await-in-loop
    await db.query('INSERT INTO watchlist (list_type, full_name, country) VALUES ($1,$2,$3)',
      [w.list_type, w.full_name, w.country]);
  }
  console.log(`[seed] watchlist: ${data.watchlist.length}`);

  const valid = data.kyc_customers.filter((c) => !c.expected || c.expected.valid !== false);
  let seq = 0;
  const inserted = [];

  for (const c of valid) {
    seq += 1;
    // eslint-disable-next-line no-await-in-loop
    const hits = await db.query(
      'SELECT list_type FROM watchlist WHERE lower(full_name) = lower($1)', [c.full_name],
    );
    const sanctionsMatch = hits.rows.some((r) => r.list_type === 'SANCTIONS');
    const isPep = Boolean(c.is_pep) || hits.rows.some((r) => r.list_type === 'PEP');

    const risk = kyc.computeRisk({
      country: c.country,
      is_pep: isPep,
      occupation: c.occupation,
      annual_income: c.annual_income,
      sanctions_match: sanctionsMatch,
    });

    let status = 'PENDING';
    if (risk.prohibited) status = 'REJECTED';
    else if (risk.rating === 'HIGH') status = 'IN_REVIEW';

    // eslint-disable-next-line no-await-in-loop
    const row = await db.query(
      `INSERT INTO customers
         (customer_ref, full_name, date_of_birth, email, country, occupation,
          annual_income, is_pep, kyc_status, risk_score, risk_rating, risk_factors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, risk_rating`,
      [ref('CUST', seq), c.full_name, c.date_of_birth, c.email,
        String(c.country || 'QQ').toUpperCase(), c.occupation, c.annual_income,
        isPep, status, risk.score, risk.rating, JSON.stringify(risk.factors)],
    );
    inserted.push(row.rows[0]);
  }

  const distribution = inserted.reduce((acc, r) => {
    acc[r.risk_rating] = (acc[r.risk_rating] || 0) + 1;
    return acc;
  }, {});
  console.log(`[seed] customers: ${inserted.length} - risk distribution:`, distribution);

  // One dedicated customer per AML scenario. Isolating them is what keeps the
  // expected outcomes clean: velocity and structuring both aggregate per
  // customer, so sharing one would let scenarios contaminate each other.
  let txnSeq = 0;
  let alertCount = 0;
  const now = Date.now();

  for (const scenario of data.aml_scenarios) {
    seq += 1;
    // eslint-disable-next-line no-await-in-loop
    const cust = await db.query(
      `INSERT INTO customers
         (customer_ref, full_name, date_of_birth, email, country, occupation,
          annual_income, kyc_status, risk_score, risk_rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'VERIFIED',10,'LOW') RETURNING id`,
      [ref('CUST', seq), `Scenario ${scenario.id} Holder`, '1985-01-01',
        `${scenario.id.toLowerCase()}@example.com`, 'US', 'ENGINEER', 90000],
    );
    const customerId = cust.rows[0].id;

    for (const t of scenario.transactions) {
      txnSeq += 1;
      const occurredAt = new Date(now + t.offset_hours * 3600000).toISOString();

      // eslint-disable-next-line no-await-in-loop
      const txn = await db.query(
        `INSERT INTO transactions
           (transaction_ref, customer_id, direction, amount, channel, counterparty_country, occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [ref('TXN', txnSeq), customerId, t.direction, t.amount, t.channel,
          t.counterparty_country || null, occurredAt],
      );

      // eslint-disable-next-line no-await-in-loop
      const { alerts } = await aml.evaluate(txn.rows[0], { query: db.query });
      for (const a of alerts) {
        alertCount += 1;
        // eslint-disable-next-line no-await-in-loop
        await db.query(
          `INSERT INTO aml_alerts
             (alert_ref, customer_id, transaction_id, rule_code, rule_name, severity, details)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ref('ALT', alertCount), customerId, txn.rows[0].id,
            a.rule_code, a.rule_name, a.severity, JSON.stringify(a.details)],
        );
      }
    }
  }

  console.log(`[seed] aml scenarios: ${data.aml_scenarios.length}, transactions: ${txnSeq}, alerts: ${alertCount}`);

  const byRule = await db.query(
    'SELECT rule_code, severity, COUNT(*)::int AS n FROM aml_alerts GROUP BY 1,2 ORDER BY 1,2',
  );
  console.log('[seed] alerts by rule:');
  byRule.rows.forEach((r) => console.log(`         ${r.rule_code} ${r.severity}: ${r.n}`));
  console.log('[seed] done');
}

seed()
  .then(() => db.close())
  .catch(async (err) => {
    console.error('[seed] FAILED:', err.message);
    await db.close().catch(() => {});
    process.exit(1);
  });

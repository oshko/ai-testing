# TechSpark Solutions — KYC & AML Platform

A KYC/AML compliance API with a conversational assistant, built as a **GenAI-assisted test engineering** project. Node.js · Express · PostgreSQL · Jest.

**Status:** 91/91 tests passing · 36/36 automated requirements covered · 0 coverage gaps

---

## Quick start

Requires Node.js 18+ and a running PostgreSQL 13+.

```bash
npm install
```

Create the databases and edit `.env` with your PostgreSQL user:

```bash
createdb kyc_aml_dev && createdb kyc_aml_test
```

Apply the schema, generate synthetic data, and seed:

```bash
npm run db:setup && npm run data:generate && npm run db:seed
```

Run the test suite:

```bash
npm test
```

Start the API:

```bash
npm start
```

---

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Start the API on `http://localhost:3000` |
| `npm run db:setup` | Apply schema to the dev database |
| `npm run db:setup:test` | Apply schema to the test database |
| `npm run data:generate` | Write deterministic synthetic data to `data/` |
| `npm run db:seed` | Load synthetic data into the dev database |
| `npm test` | Run all 91 tests |
| `npm run test:report` | Run tests, emit `reports/jest-results.json` |
| `npm run rtm` | Regenerate `docs/03-rtm.md` from the last run |

---

## Try it

```bash
curl -s localhost:3000/health
```

Onboard a low-risk customer:

```bash
curl -s -X POST localhost:3000/api/customers -H 'content-type: application/json' -d '{"full_name":"Alice Morgan","date_of_birth":"1990-04-12","email":"alice@example.com","country":"GB","occupation":"ENGINEER","annual_income":85000}'
```

Trigger an AML alert — a cash transaction at the reporting threshold:

```bash
curl -s -X POST localhost:3000/api/transactions -H 'content-type: application/json' -d '{"customer_id":1,"amount":10000,"channel":"CASH","direction":"CREDIT"}'
```

Ask the assistant a question:

```bash
curl -s -X POST localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"what is my kyc status? alice@example.com"}'
```

View the analyst alert queue (role-gated):

```bash
curl -s localhost:3000/api/alerts -H 'x-user-role: ANALYST'
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health`, `/health/ready` | Liveness / readiness |
| `POST` | `/api/customers` | Onboard a customer (validates, screens, scores) |
| `GET` | `/api/customers/:id` | Profile with documents and alert count |
| `POST` | `/api/customers/:id/documents` | Upload and verify a document |
| `POST` | `/api/transactions` | Ingest a transaction and run AML rules |
| `GET` | `/api/alerts` | Alert queue — needs `x-user-role` |
| `PATCH` | `/api/alerts/:id` | Change alert status — needs `x-user-role` |
| `POST` | `/api/chat` | One conversational turn |
| `GET` | `/api/chat/:sessionId` | Conversation transcript |
| `GET` | `/api/intents` | Published intent catalogue |

---

## Layout

```
src/
  config.js     environment + AML thresholds
  db.js         connection pool, schema runner
  schema.sql    6 tables
  migrate.js    applies the schema
  kyc.js        validation, document verification, risk scoring
  aml.js        4 AML rules + suppression
  chatbot.js    intent classification, entity extraction, replies
  routes.js     all endpoints
  app.js        Express app, error handling
  server.js     listener + graceful shutdown
scripts/
  generate-data.js   deterministic synthetic data
  seed.js            loads it into PostgreSQL
  generate-rtm.js    builds the RTM from Jest output
tests/            91 tests in 4 suites
docs/             requirements, test cases, RTM, agile plan, reports
data/             generated fixtures (JSON + CSV)
```

---

## Documentation

| Doc | Contents |
|---|---|
| [01-requirements.md](docs/01-requirements.md) | 49 requirements with acceptance criteria |
| [02-test-cases.md](docs/02-test-cases.md) | 24 test scenarios, detailed cases, edge coverage |
| [03-rtm.md](docs/03-rtm.md) | **Generated** traceability matrix |
| [04-agile-plan.md](docs/04-agile-plan.md) | Epics, 28 stories, points, sprints, conflict resolution, re-plan |
| [05-test-report.md](docs/05-test-report.md) | Execution results, 2 defects, limitations |
| [06-genai-report.md](docs/06-genai-report.md) | Critical analysis of GenAI in the process |

---

## Notes

- **The RTM is generated, not written.** `scripts/generate-rtm.js` parses `TC-…[REQ-…]` IDs out of Jest's JSON output, so the matrix can only report coverage that actually executed.
- **Synthetic data is deterministic.** A seeded PRNG means identical fixtures on every run, so results are reproducible by a reviewer.
- **Fictional jurisdictions.** High-risk and prohibited countries use ISO 3166-1 *reserved* codes (`XA`, `XB`, `QM`, `XP`, `ZZ`) that will never belong to a real nation. Real codes appear only in the neutral standard tier — a test fixture should not embed a political claim.
- **Simplified auth.** Roles arrive via an `x-user-role` header rather than a signed JWT, so access-control rules stay testable without an auth stack. See [05-test-report.md](docs/05-test-report.md) §4.
- **Performance is not verified.** REQ-NFR-05 needs a load harness and is reported *Not Executed*, never as passed.

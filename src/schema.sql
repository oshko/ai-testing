-- TechSpark Solutions - KYC & AML Platform schema (PostgreSQL)
-- Idempotent: safe to re-run via `npm run db:setup`.

DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS aml_alerts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS kyc_documents CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Customers (KYC subject record)
CREATE TABLE customers (
  id            SERIAL PRIMARY KEY,
  customer_ref  TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  country       TEXT NOT NULL,
  occupation    TEXT,
  annual_income NUMERIC(14,2),
  is_pep        BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_status    TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (kyc_status IN ('PENDING','IN_REVIEW','VERIFIED','REJECTED')),
  risk_score    INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_rating   TEXT NOT NULL DEFAULT 'UNRATED'
                  CHECK (risk_rating IN ('UNRATED','LOW','MEDIUM','HIGH','PROHIBITED')),
  risk_factors  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identity / address documents
CREATE TABLE kyc_documents (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN
                    ('PASSPORT','NATIONAL_ID','DRIVERS_LICENSE','UTILITY_BILL','BANK_STATEMENT')),
  document_number TEXT NOT NULL,
  expiry_date     DATE,
  status          TEXT NOT NULL CHECK (status IN ('VERIFIED','FAILED','EXPIRED')),
  failure_reason  TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sanctions / PEP watchlist (stands in for an external screening provider)
CREATE TABLE watchlist (
  id        SERIAL PRIMARY KEY,
  list_type TEXT NOT NULL CHECK (list_type IN ('SANCTIONS','PEP')),
  full_name TEXT NOT NULL,
  country   TEXT
);

-- Transactions monitored by the AML rules
CREATE TABLE transactions (
  id                   SERIAL PRIMARY KEY,
  transaction_ref      TEXT NOT NULL UNIQUE,
  customer_id          INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  direction            TEXT NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  amount               NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  channel              TEXT NOT NULL CHECK (channel IN ('WIRE','ACH','CASH','CARD','CRYPTO')),
  counterparty_country TEXT,
  occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The AML rules aggregate by customer over a time window, so this is the
-- index that keeps rule evaluation fast.
CREATE INDEX idx_txn_customer_time ON transactions (customer_id, occurred_at DESC);

-- Alerts raised by the rule engine
CREATE TABLE aml_alerts (
  id             SERIAL PRIMARY KEY,
  alert_ref      TEXT NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  rule_code      TEXT NOT NULL,
  rule_name      TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status         TEXT NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN','IN_REVIEW','CLOSED_FALSE_POSITIVE','CLOSED_CONFIRMED')),
  details        JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_customer ON aml_alerts (customer_id);

-- Chatbot transcript
CREATE TABLE chat_messages (
  id         SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender     TEXT NOT NULL CHECK (sender IN ('USER','BOT')),
  message    TEXT NOT NULL,
  intent     TEXT,
  confidence NUMERIC(4,3),
  entities   JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalated  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_session ON chat_messages (session_id, created_at);

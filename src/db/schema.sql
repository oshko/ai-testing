-- ===========================================================================
-- TechSpark Solutions — Conversational KYC & AML Compliance Platform
-- PostgreSQL schema (targets PostgreSQL 13+; gen_random_uuid() is core from 13)
--
-- CHECK constraints are used deliberately rather than relying only on
-- application-layer validation: several test cases (TC-KYC-*) assert that
-- invalid enum values are rejected at the persistence boundary too, giving
-- defence in depth against a bypassed service layer.
-- ===========================================================================

-- Dropped in dependency order so `npm run db:reset` is idempotent.
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS sar_reports CASCADE;
DROP TABLE IF EXISTS aml_alerts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS screening_results CASCADE;
DROP TABLE IF EXISTS watchlist_entries CASCADE;
DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS kyc_documents CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ---------------------------------------------------------------------------
-- users — platform operators and authenticated customers (REQ-NFR-611)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN (
                   'CUSTOMER','ANALYST','SENIOR_ANALYST','COMPLIANCE_OFFICER','ADMIN')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- customers — the KYC subject record (REQ-KYC-301..)
-- ---------------------------------------------------------------------------
CREATE TABLE customers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_ref       TEXT NOT NULL UNIQUE,
  customer_type      TEXT NOT NULL DEFAULT 'INDIVIDUAL'
                       CHECK (customer_type IN ('INDIVIDUAL','BUSINESS')),
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  date_of_birth      DATE,
  nationality        TEXT,
  email              TEXT NOT NULL,
  phone              TEXT,
  address_line1      TEXT,
  city               TEXT,
  postal_code        TEXT,
  country            TEXT NOT NULL,
  occupation         TEXT,
  annual_income_usd  NUMERIC(14,2),
  source_of_funds    TEXT,
  kyc_status         TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (kyc_status IN ('PENDING','IN_REVIEW','VERIFIED','REJECTED','EXPIRED')),
  risk_rating        TEXT NOT NULL DEFAULT 'UNRATED'
                       CHECK (risk_rating IN ('UNRATED','LOW','MEDIUM','HIGH','PROHIBITED')),
  risk_score         INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  is_pep             BOOLEAN NOT NULL DEFAULT FALSE,
  onboarded_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_kyc_status  ON customers (kyc_status);
CREATE INDEX idx_customers_risk_rating ON customers (risk_rating);
CREATE INDEX idx_customers_country     ON customers (country);
-- Case-insensitive lookup supports the chatbot resolving a customer by email.
CREATE UNIQUE INDEX idx_customers_email_lower ON customers (lower(email));

-- ---------------------------------------------------------------------------
-- kyc_documents — identity/address evidence (REQ-KYC-304, REQ-KYC-305)
-- ---------------------------------------------------------------------------
CREATE TABLE kyc_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  document_type       TEXT NOT NULL CHECK (document_type IN (
                        'PASSPORT','NATIONAL_ID','DRIVERS_LICENSE','UTILITY_BILL','BANK_STATEMENT')),
  document_number     TEXT NOT NULL,
  issuing_country     TEXT NOT NULL,
  issue_date          DATE,
  expiry_date         DATE,
  verification_status TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('PENDING','VERIFIED','FAILED','EXPIRED')),
  failure_reason      TEXT,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_documents_customer ON kyc_documents (customer_id);

-- ---------------------------------------------------------------------------
-- risk_assessments — immutable history of scoring runs (REQ-KYC-309)
-- ---------------------------------------------------------------------------
CREATE TABLE risk_assessments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  risk_score   INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_rating  TEXT NOT NULL CHECK (risk_rating IN ('LOW','MEDIUM','HIGH','PROHIBITED')),
  factors      JSONB NOT NULL DEFAULT '[]'::jsonb,
  assessed_by  TEXT NOT NULL DEFAULT 'SYSTEM',
  assessed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_assessments_customer ON risk_assessments (customer_id, assessed_at DESC);

-- ---------------------------------------------------------------------------
-- watchlist_entries — sanctions / PEP / adverse-media reference data
-- Simulates the external screening provider (REQ-INT-503)
-- ---------------------------------------------------------------------------
CREATE TABLE watchlist_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_type     TEXT NOT NULL CHECK (list_type IN (
                  'SANCTIONS','PEP','ADVERSE_MEDIA','INTERNAL_BLACKLIST')),
  full_name     TEXT NOT NULL,
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  date_of_birth DATE,
  nationality   TEXT,
  program       TEXT,
  source        TEXT NOT NULL DEFAULT 'SIMULATED',
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_watchlist_name_lower ON watchlist_entries (lower(full_name));
CREATE INDEX idx_watchlist_list_type  ON watchlist_entries (list_type);

-- ---------------------------------------------------------------------------
-- screening_results — outcome of screening a customer against the watchlists
-- ---------------------------------------------------------------------------
CREATE TABLE screening_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  watchlist_entry_id UUID REFERENCES watchlist_entries(id) ON DELETE SET NULL,
  list_type         TEXT,
  matched_name      TEXT,
  match_score       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (match_score BETWEEN 0 AND 100),
  match_type        TEXT NOT NULL CHECK (match_type IN ('NONE','FUZZY','EXACT')),
  status            TEXT NOT NULL CHECK (status IN (
                      'CLEAR','POTENTIAL_MATCH','CONFIRMED_MATCH','FALSE_POSITIVE')),
  review_notes      TEXT,
  reviewed_by       TEXT,
  screened_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_screening_customer ON screening_results (customer_id, screened_at DESC);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  account_type   TEXT NOT NULL CHECK (account_type IN ('CHECKING','SAVINGS','BUSINESS','CRYPTO')),
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  balance        NUMERIC(18,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','FROZEN','CLOSED')),
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_customer ON accounts (customer_id);

-- ---------------------------------------------------------------------------
-- transactions — the AML monitoring input stream (REQ-AML-401..)
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_ref      TEXT NOT NULL UNIQUE,
  account_id           UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- customer_id is denormalised on purpose: every AML rule aggregates by
  -- customer over a time window, and avoiding the accounts join keeps those
  -- window queries inside the REQ-NFR-602 latency budget.
  customer_id          UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  direction            TEXT NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  amount               NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency             CHAR(3) NOT NULL DEFAULT 'USD',
  channel              TEXT NOT NULL CHECK (channel IN (
                         'WIRE','ACH','CASH','CARD','CRYPTO','CHEQUE','MOBILE')),
  counterparty_name    TEXT,
  counterparty_account TEXT,
  counterparty_country TEXT,
  description          TEXT,
  is_flagged           BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index ordered (customer, time) — the exact access path used by the
-- structuring and velocity rules.
CREATE INDEX idx_transactions_customer_time ON transactions (customer_id, occurred_at DESC);
CREATE INDEX idx_transactions_amount        ON transactions (amount);
CREATE INDEX idx_transactions_channel       ON transactions (channel);
CREATE INDEX idx_transactions_cp_country    ON transactions (counterparty_country);

-- ---------------------------------------------------------------------------
-- aml_alerts — rule engine output (REQ-AML-402)
-- ---------------------------------------------------------------------------
CREATE TABLE aml_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_ref        TEXT NOT NULL UNIQUE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id   UUID REFERENCES transactions(id) ON DELETE SET NULL,
  rule_code        TEXT NOT NULL,
  rule_name        TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  risk_score       INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                     'OPEN','IN_REVIEW','ESCALATED','CLOSED_FALSE_POSITIVE','CLOSED_CONFIRMED')),
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to      TEXT,
  resolution_notes TEXT,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_alerts_customer ON aml_alerts (customer_id, triggered_at DESC);
CREATE INDEX idx_alerts_status   ON aml_alerts (status);
CREATE INDEX idx_alerts_severity ON aml_alerts (severity);
CREATE INDEX idx_alerts_rule     ON aml_alerts (rule_code);

-- ---------------------------------------------------------------------------
-- sar_reports — Suspicious Activity Reports (REQ-AML-412)
-- ---------------------------------------------------------------------------
CREATE TABLE sar_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sar_ref      TEXT NOT NULL UNIQUE,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alert_ids    UUID[] NOT NULL DEFAULT '{}',
  narrative    TEXT NOT NULL,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT','SUBMITTED','ACKNOWLEDGED')),
  filed_by     TEXT,
  filed_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sar_customer ON sar_reports (customer_id);

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages — conversational layer (REQ-CHT-*, REQ-NLP-*)
-- ---------------------------------------------------------------------------
CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_ref TEXT NOT NULL UNIQUE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL DEFAULT 'WEB'
                CHECK (channel IN ('WEB','MOBILE','WHATSAPP','SMS','VOICE')),
  language    TEXT NOT NULL DEFAULT 'en',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

CREATE TABLE chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender           TEXT NOT NULL CHECK (sender IN ('USER','BOT')),
  message          TEXT NOT NULL,
  detected_intent  TEXT,
  intent_confidence NUMERIC(4,3) CHECK (intent_confidence BETWEEN 0 AND 1),
  entities         JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_time_ms INTEGER,
  escalated        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_messages_intent  ON chat_messages (detected_intent);

-- ---------------------------------------------------------------------------
-- audit_log — immutable compliance trail (REQ-NFR-618)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  before_state JSONB,
  after_state  JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_time   ON audit_log (created_at DESC);

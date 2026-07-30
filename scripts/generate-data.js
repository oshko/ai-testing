'use strict';

/**
 * Synthetic data generator for KYC and AML use cases.
 *
 * TWO PROPERTIES THAT MAKE THIS DATA USEFUL FOR TESTING
 *
 * 1. DETERMINISTIC. A seeded PRNG (mulberry32) replaces Math.random, so the same
 *    seed always produces byte-identical files. Random fixtures produce tests
 *    that pass on one run and fail on the next, and a test report generated from
 *    them cannot be reproduced by a reviewer.
 *
 * 2. SELF-DESCRIBING. Every edge-case record carries an `expected` field stating
 *    what the platform should do with it. The data therefore doubles as the test
 *    oracle - a test asserts against `expected` rather than hard-coding the
 *    answer in a second place where it can drift.
 *
 * ALL DATA IS FICTIONAL. High-risk and prohibited jurisdictions use ISO 3166-1
 * reserved codes (XA, XB, QM, XP, ZZ) that will never belong to a real country.
 *
 * Usage: npm run data:generate
 */

const fs = require('fs');
const path = require('path');
const config = require('../src/config');

// --- deterministic PRNG ----------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(config.seed);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const intBetween = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// --- fictional name pools --------------------------------------------------

const FIRST_NAMES = ['Alice', 'Bruno', 'Carmen', 'Dmitri', 'Elena', 'Farid', 'Greta', 'Hassan',
  'Ingrid', 'Jonas', 'Karin', 'Lucas', 'Mira', 'Nadia', 'Omar', 'Petra', 'Quentin', 'Rosa',
  'Samir', 'Tanya', 'Ugo', 'Vera', 'Wesley', 'Yusuf', 'Zara'];

const LAST_NAMES = ['Adeyemi', 'Borisov', 'Castellano', 'Duarte', 'Eriksen', 'Fontaine',
  'Grimaldi', 'Haddad', 'Ivanov', 'Jansen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura',
  'Okonkwo', 'Pereira', 'Rahman', 'Silva', 'Tremblay', 'Ustinov', 'Varga', 'Whitfield'];

const STANDARD_COUNTRIES = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'SG', 'IN', 'BR', 'ZA'];
const HIGH_RISK_COUNTRIES = ['XA', 'XB', 'QM'];
const PROHIBITED_COUNTRIES = ['XP', 'ZZ'];

const LOW_RISK_OCCUPATIONS = ['ENGINEER', 'TEACHER', 'DOCTOR', 'RETIRED'];
const HIGH_RISK_OCCUPATIONS = ['CASH INTENSIVE BUSINESS', 'MONEY SERVICE BUSINESS',
  'CRYPTO TRADER', 'GOVERNMENT OFFICIAL'];

let emailCounter = 0;
function makeEmail(fullName) {
  emailCounter += 1;
  const slug = fullName.toLowerCase().replace(/[^a-z]+/g, '.');
  return `${slug}.${emailCounter}@example.com`;
}

const makeName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

/** ISO date `years` before 2026-07-29, jittered by up to 364 days. */
function birthDate(years) {
  const base = Date.UTC(2026 - years, 6, 29);
  return new Date(base - intBetween(0, 364) * 86400000).toISOString().slice(0, 10);
}

const isoDate = (offsetDays) => new Date(Date.UTC(2026, 6, 29) + offsetDays * 86400000)
  .toISOString().slice(0, 10);

// --- watchlist -------------------------------------------------------------

const WATCHLIST = [
  { list_type: 'SANCTIONS', full_name: 'Viktor Kessler', country: 'ZZ' },
  { list_type: 'SANCTIONS', full_name: 'Dana Okonkwo', country: 'XP' },
  { list_type: 'SANCTIONS', full_name: 'Marcus Vane', country: 'XA' },
  { list_type: 'PEP', full_name: 'Helena Brandt', country: 'XB' },
  { list_type: 'PEP', full_name: 'Yusuf Rahman', country: 'QM' },
  { list_type: 'PEP', full_name: 'Clara Nunes', country: 'BR' },
];

// --- KYC customers ---------------------------------------------------------

/** Hand-authored edge cases, each stating its expected outcome. */
const KYC_EDGE_CASES = [
  {
    id: 'KYC-LOW-01', scenario: 'Standard low-risk applicant, complete data',
    full_name: 'Alice Morgan', date_of_birth: '1990-04-12',
    email: 'alice.morgan@example.com', country: 'GB',
    occupation: 'ENGINEER', annual_income: 85000, is_pep: false,
    expected: { valid: true, rating: 'LOW', kyc_status: 'PENDING' },
  },
  {
    id: 'KYC-MED-01', scenario: 'Medium risk - high-risk occupation in a standard country',
    full_name: 'Bruno Castellano', date_of_birth: '1982-11-03',
    email: 'bruno.castellano@example.com', country: 'US',
    occupation: 'MONEY SERVICE BUSINESS', annual_income: 240000, is_pep: false,
    expected: { valid: true, rating: 'MEDIUM', kyc_status: 'PENDING' },
  },
  {
    id: 'KYC-HIGH-01', scenario: 'High risk - PEP in a high-risk jurisdiction, routed to EDD',
    full_name: 'Helena Brandt', date_of_birth: '1975-02-19',
    email: 'helena.brandt@example.com', country: 'XB',
    occupation: 'GOVERNMENT OFFICIAL', annual_income: 310000, is_pep: true,
    expected: { valid: true, rating: 'HIGH', kyc_status: 'IN_REVIEW', edd_required: true },
  },
  {
    id: 'KYC-PROH-01', scenario: 'Prohibited jurisdiction - rejected outright',
    full_name: 'Ingrid Lindqvist', date_of_birth: '1988-07-30',
    email: 'ingrid.lindqvist@example.com', country: 'ZZ',
    occupation: 'BUSINESS OWNER', annual_income: 95000, is_pep: false,
    expected: { valid: true, rating: 'PROHIBITED', kyc_status: 'REJECTED' },
  },
  {
    id: 'KYC-SANC-01', scenario: 'Name matches a sanctions list entry - rejected',
    full_name: 'Viktor Kessler', date_of_birth: '1970-01-15',
    email: 'viktor.kessler@example.com', country: 'DE',
    occupation: 'BUSINESS OWNER', annual_income: 500000, is_pep: false,
    expected: { valid: true, rating: 'PROHIBITED', kyc_status: 'REJECTED', sanctions_match: true },
  },
  {
    id: 'KYC-INV-01', scenario: 'Underage applicant - must be rejected',
    full_name: 'Timo Jansen', date_of_birth: '2012-01-01',
    email: 'timo.jansen@example.com', country: 'US',
    occupation: 'STUDENT', annual_income: 0, is_pep: false,
    expected: { valid: false, error_code: 'UNDERAGE_APPLICANT' },
  },
  {
    id: 'KYC-INV-02', scenario: 'Missing mandatory country field',
    full_name: 'Petra Varga', date_of_birth: '1991-09-09',
    email: 'petra.varga@example.com', country: '',
    occupation: 'TEACHER', annual_income: 52000, is_pep: false,
    expected: { valid: false, error_code: 'VALIDATION_ERROR', invalid_fields: ['country'] },
  },
  {
    id: 'KYC-INV-03', scenario: 'Malformed email address',
    full_name: 'Omar Haddad', date_of_birth: '1986-03-22',
    email: 'omar.haddad-at-example.com', country: 'FR',
    occupation: 'DOCTOR', annual_income: 180000, is_pep: false,
    expected: { valid: false, error_code: 'VALIDATION_ERROR', invalid_fields: ['email'] },
  },
  {
    id: 'KYC-INV-04', scenario: 'Duplicate email of KYC-LOW-01',
    full_name: 'Alice Morgan Duplicate', date_of_birth: '1990-04-12',
    email: 'alice.morgan@example.com', country: 'GB',
    occupation: 'ENGINEER', annual_income: 85000, is_pep: false,
    expected: { valid: false, error_code: 'DUPLICATE_CUSTOMER' },
  },
  {
    id: 'KYC-UNK-01', scenario: 'Unrecognised country code - fails closed to elevated risk',
    full_name: 'Wesley Tremblay', date_of_birth: '1979-12-05',
    email: 'wesley.tremblay@example.com', country: 'QQ',
    occupation: null, annual_income: null, is_pep: false,
    expected: { valid: true, rating: 'MEDIUM' },
  },
];

/** Document fixtures with expected verification verdicts. */
const DOCUMENT_CASES = [
  {
    id: 'DOC-OK-ID', scenario: 'Valid passport',
    document_type: 'PASSPORT', document_number: 'AB123456', expiry_date: isoDate(900),
    expected: { status: 'VERIFIED' },
  },
  {
    id: 'DOC-OK-ADDR', scenario: 'Valid utility bill (address proof)',
    document_type: 'UTILITY_BILL', document_number: 'UTIL-99213', expiry_date: null,
    expected: { status: 'VERIFIED' },
  },
  {
    id: 'DOC-EXPIRED', scenario: 'Passport expired last year',
    document_type: 'PASSPORT', document_number: 'CD987654', expiry_date: isoDate(-200),
    expected: { status: 'EXPIRED' },
  },
  {
    id: 'DOC-BADFORMAT', scenario: 'Passport number fails the format rule',
    document_type: 'PASSPORT', document_number: '12', expiry_date: isoDate(900),
    expected: { status: 'FAILED', failure_reason_contains: 'format' },
  },
  {
    id: 'DOC-NOEXPIRY', scenario: 'Passport supplied without an expiry date',
    document_type: 'PASSPORT', document_number: 'EF456789', expiry_date: null,
    expected: { status: 'FAILED', failure_reason_contains: 'Expiry' },
  },
  {
    id: 'DOC-UNSUPPORTED', scenario: 'Document type not accepted',
    document_type: 'LIBRARY_CARD', document_number: 'LC-0001', expiry_date: null,
    expected: { rejected_with: 'UNSUPPORTED_DOCUMENT_TYPE' },
  },
];

/** Bulk population so risk-band distribution can be reported. */
function generateBulkCustomers(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    // Roughly 70% standard, 20% high-risk, 10% prohibited jurisdictions.
    const roll = rand();
    let country;
    if (roll < 0.7) country = pick(STANDARD_COUNTRIES);
    else if (roll < 0.9) country = pick(HIGH_RISK_COUNTRIES);
    else country = pick(PROHIBITED_COUNTRIES);

    const fullName = makeName();
    out.push({
      id: `KYC-BULK-${String(i + 1).padStart(3, '0')}`,
      scenario: 'Bulk generated applicant',
      full_name: fullName,
      date_of_birth: birthDate(intBetween(19, 78)),
      email: makeEmail(fullName),
      country,
      occupation: rand() < 0.25 ? pick(HIGH_RISK_OCCUPATIONS) : pick(LOW_RISK_OCCUPATIONS),
      annual_income: intBetween(25, 400) * 1000,
      is_pep: rand() < 0.08,
    });
  }
  return out;
}

// --- AML transaction scenarios --------------------------------------------

/**
 * AML scenarios. `offset_hours` is relative to ingest time so a scenario can lay
 * a pattern across a window. `expected_rules` is the oracle the AML tests assert
 * against.
 */
const AML_SCENARIOS = [
  {
    id: 'AML-S01',
    scenario: 'Cash deposit exactly at the reporting threshold (inclusive boundary)',
    expected_rules: ['AML-R01'],
    transactions: [{ amount: 10000, channel: 'CASH', direction: 'CREDIT', offset_hours: 0 }],
  },
  {
    id: 'AML-S02',
    scenario: 'Cash deposit one unit below the threshold - must NOT alert',
    expected_rules: [],
    transactions: [{ amount: 9999, channel: 'CASH', direction: 'CREDIT', offset_hours: 0 }],
  },
  {
    id: 'AML-S03',
    scenario: 'Structuring - three cash deposits in the 50-99% band inside 24h, summing to 18,000',
    // Each deposit must sit in [5,000 , 10,000) to count toward the pattern:
    // below 5,000 it is not a plausible split of a reportable amount, and at or
    // above 10,000 it would be reportable on its own via AML-R01.
    expected_rules: ['AML-R02'],
    transactions: [
      { amount: 6000, channel: 'CASH', direction: 'CREDIT', offset_hours: -20 },
      { amount: 6000, channel: 'CASH', direction: 'CREDIT', offset_hours: -10 },
      { amount: 6000, channel: 'CASH', direction: 'CREDIT', offset_hours: 0 },
    ],
  },
  {
    id: 'AML-S04',
    scenario: 'Two sub-threshold deposits only - below the minimum count, must NOT alert',
    expected_rules: [],
    transactions: [
      { amount: 6000, channel: 'CASH', direction: 'CREDIT', offset_hours: -5 },
      { amount: 6000, channel: 'CASH', direction: 'CREDIT', offset_hours: 0 },
    ],
  },
  {
    id: 'AML-S05',
    scenario: 'Velocity - 11 transactions in 24h breaches the limit of 10',
    expected_rules: ['AML-R03'],
    transactions: Array.from({ length: 11 }, (unused, i) => ({
      amount: 250, channel: 'CARD', direction: 'DEBIT', offset_hours: -22 + i * 2,
    })),
  },
  {
    id: 'AML-S06',
    scenario: 'Wire to a high-risk jurisdiction above 50% of threshold - escalates to CRITICAL',
    expected_rules: ['AML-R04'], expected_severity: 'CRITICAL',
    transactions: [{
      amount: 7500, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'XA', offset_hours: 0,
    }],
  },
  {
    id: 'AML-S07',
    scenario: 'Small wire to a high-risk jurisdiction - MEDIUM severity',
    expected_rules: ['AML-R04'], expected_severity: 'MEDIUM',
    transactions: [{
      amount: 900, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'XB', offset_hours: 0,
    }],
  },
  {
    id: 'AML-S08',
    scenario: 'Any-amount transfer to a prohibited jurisdiction - always CRITICAL',
    expected_rules: ['AML-R04'], expected_severity: 'CRITICAL',
    transactions: [{
      amount: 150, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'ZZ', offset_hours: 0,
    }],
  },
  {
    id: 'AML-S09',
    scenario: 'Large cash deposit to a high-risk country - two rules fire together',
    expected_rules: ['AML-R01', 'AML-R04'],
    transactions: [{
      amount: 25000, channel: 'CASH', direction: 'CREDIT', counterparty_country: 'QM', offset_hours: 0,
    }],
  },
  {
    id: 'AML-S10',
    scenario: 'Ordinary salary credit - clean baseline, no alerts',
    expected_rules: [],
    transactions: [{ amount: 4200, channel: 'ACH', direction: 'CREDIT', offset_hours: 0 }],
  },
];

/** Chatbot utterances with the intent each must resolve to (REQ-NLP-01). */
const CHAT_UTTERANCES = [
  { id: 'NLP-01', message: 'Hello there', expected_intent: 'greeting' },
  { id: 'NLP-02', message: 'I want to open an account', expected_intent: 'onboarding_start' },
  { id: 'NLP-03', message: 'Which documents do you need from me?', expected_intent: 'upload_document' },
  { id: 'NLP-04', message: 'What is my kyc status?', expected_intent: 'check_kyc_status' },
  { id: 'NLP-05', message: 'CHECK MY STATUS!!!', expected_intent: 'check_kyc_status', note: 'case and punctuation insensitive' },
  { id: 'NLP-06', message: 'Show me open critical alerts', expected_intent: 'query_alerts', expected_entities: { ALERT_SEVERITY: 'CRITICAL' } },
  { id: 'NLP-07', message: 'I need to speak to a human', expected_intent: 'human_handoff', expected_escalation: true },
  { id: 'NLP-08', message: 'What is the weather in Paris tomorrow?', expected_intent: 'unknown', expected_escalation: true },
  { id: 'NLP-09', message: 'I do not want to upload a document', expected_intent: 'unknown', note: 'negation suppresses upload_document' },
  { id: 'NLP-10', message: 'My name is Elena Fontaine and my email is elena.f@example.com', expected_entities: { PERSON_NAME: 'Elena Fontaine', EMAIL: 'elena.f@example.com' } },
  { id: 'NLP-11', message: 'I deposited $9,500 in cash', expected_entities: { MONEY_AMOUNT: { amount: 9500, currency: 'USD' } } },
  { id: 'NLP-12', message: 'I transferred 12k EUR', expected_entities: { MONEY_AMOUNT: { amount: 12000, currency: 'EUR' } } },
];

// --- write output ---------------------------------------------------------

function toCsv(rows, columns) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
}

const outDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

const customers = [...KYC_EDGE_CASES, ...generateBulkCustomers(40)];

const dataset = {
  meta: {
    generated_for: 'TechSpark Solutions KYC/AML platform',
    seed: config.seed,
    note: 'All data is fictional. High-risk/prohibited jurisdictions use reserved ISO codes.',
    counts: {
      customers: customers.length,
      edge_case_customers: KYC_EDGE_CASES.length,
      documents: DOCUMENT_CASES.length,
      watchlist: WATCHLIST.length,
      aml_scenarios: AML_SCENARIOS.length,
      aml_transactions: AML_SCENARIOS.reduce((n, s) => n + s.transactions.length, 0),
      chat_utterances: CHAT_UTTERANCES.length,
    },
  },
  watchlist: WATCHLIST,
  kyc_customers: customers,
  kyc_documents: DOCUMENT_CASES,
  aml_scenarios: AML_SCENARIOS,
  chat_utterances: CHAT_UTTERANCES,
};

const write = (name, content) => {
  fs.writeFileSync(path.join(outDir, name), content);
  console.log(`  data/${name}`);
};

console.log(`[data] seed=${config.seed} - writing to data/`);
write('synthetic-dataset.json', `${JSON.stringify(dataset, null, 2)}\n`);
write('kyc-customers.csv', toCsv(customers,
  ['id', 'scenario', 'full_name', 'date_of_birth', 'email', 'country', 'occupation', 'annual_income', 'is_pep']));
write('aml-scenarios.csv', toCsv(
  AML_SCENARIOS.flatMap((s) => s.transactions.map((t, i) => ({
    scenario_id: s.id, scenario: s.scenario, seq: i + 1,
    amount: t.amount, channel: t.channel, direction: t.direction,
    counterparty_country: t.counterparty_country || '', offset_hours: t.offset_hours,
    expected_rules: s.expected_rules.join('|'),
  }))),
  ['scenario_id', 'scenario', 'seq', 'amount', 'channel', 'direction', 'counterparty_country', 'offset_hours', 'expected_rules'],
));
write('watchlist.csv', toCsv(WATCHLIST, ['list_type', 'full_name', 'country']));

console.log('[data] done:', JSON.stringify(dataset.meta.counts));

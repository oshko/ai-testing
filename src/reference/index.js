'use strict';

/**
 * Static reference data driving risk scoring and AML rules.
 *
 * ── IMPORTANT: FICTIONAL JURISDICTIONS ────────────────────────────────────────
 * Elevated-, high- and prohibited-risk jurisdictions in this table use ISO 3166-1
 * **user-assigned reserved codes** (`AA`, `QM`–`QZ`, `XA`–`XZ`, `ZZ`). Those code
 * points are permanently reserved for private use and will never be allocated to
 * a real country, so the fictional jurisdictions here cannot be confused with
 * any actual nation.
 *
 * This is a conscious design decision, not an oversight. A test fixture that
 * labels a real country "prohibited" bakes a political assertion into source
 * control and into every report generated from it. Real ISO codes appear only in
 * the STANDARD tier, which is the neutral default and carries no adverse
 * designation. See assumption A5 in docs/01-requirements-specification.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RISK_TIER = {
  STANDARD: 'STANDARD',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
  PROHIBITED: 'PROHIBITED',
};

const COUNTRIES = {
  // ---- Standard risk: real jurisdictions, neutral default tier ----
  US: { name: 'United States', tier: RISK_TIER.STANDARD, score: 5 },
  GB: { name: 'United Kingdom', tier: RISK_TIER.STANDARD, score: 5 },
  DE: { name: 'Germany', tier: RISK_TIER.STANDARD, score: 5 },
  FR: { name: 'France', tier: RISK_TIER.STANDARD, score: 5 },
  CA: { name: 'Canada', tier: RISK_TIER.STANDARD, score: 5 },
  AU: { name: 'Australia', tier: RISK_TIER.STANDARD, score: 5 },
  JP: { name: 'Japan', tier: RISK_TIER.STANDARD, score: 5 },
  SG: { name: 'Singapore', tier: RISK_TIER.STANDARD, score: 8 },
  NL: { name: 'Netherlands', tier: RISK_TIER.STANDARD, score: 5 },
  SE: { name: 'Sweden', tier: RISK_TIER.STANDARD, score: 5 },
  CH: { name: 'Switzerland', tier: RISK_TIER.STANDARD, score: 8 },
  IE: { name: 'Ireland', tier: RISK_TIER.STANDARD, score: 5 },
  NZ: { name: 'New Zealand', tier: RISK_TIER.STANDARD, score: 5 },
  ES: { name: 'Spain', tier: RISK_TIER.STANDARD, score: 6 },
  IT: { name: 'Italy', tier: RISK_TIER.STANDARD, score: 6 },
  BR: { name: 'Brazil', tier: RISK_TIER.STANDARD, score: 10 },
  IN: { name: 'India', tier: RISK_TIER.STANDARD, score: 10 },
  MX: { name: 'Mexico', tier: RISK_TIER.STANDARD, score: 10 },
  ZA: { name: 'South Africa', tier: RISK_TIER.STANDARD, score: 10 },
  PL: { name: 'Poland', tier: RISK_TIER.STANDARD, score: 6 },

  // ---- Fictional jurisdictions (reserved ISO codes) ----
  XM: { name: 'Montaigne Republic', tier: RISK_TIER.ELEVATED, score: 20, fictional: true },
  XN: { name: 'Novaria', tier: RISK_TIER.ELEVATED, score: 20, fictional: true },
  QN: { name: 'Quorland', tier: RISK_TIER.ELEVATED, score: 22, fictional: true },
  XA: { name: 'Arvane', tier: RISK_TIER.HIGH, score: 35, fictional: true },
  XB: { name: 'Borduria', tier: RISK_TIER.HIGH, score: 35, fictional: true },
  XC: { name: 'Caldoria', tier: RISK_TIER.HIGH, score: 38, fictional: true },
  QM: { name: 'Meridonia', tier: RISK_TIER.HIGH, score: 40, fictional: true },
  XP: { name: 'Pellucia', tier: RISK_TIER.PROHIBITED, score: 100, fictional: true },
  ZZ: { name: 'Zanterra', tier: RISK_TIER.PROHIBITED, score: 100, fictional: true },
};

const HIGH_RISK_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, v]) => v.tier === RISK_TIER.HIGH || v.tier === RISK_TIER.PROHIBITED)
  .map(([code]) => code);

const PROHIBITED_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, v]) => v.tier === RISK_TIER.PROHIBITED)
  .map(([code]) => code);

/** Unknown country codes are treated as ELEVATED, never as safe (fail-closed). */
function countryRisk(code) {
  const entry = COUNTRIES[String(code || '').toUpperCase()];
  if (!entry) return { name: 'Unknown', tier: RISK_TIER.ELEVATED, score: 25, unknown: true };
  return entry;
}

function isHighRisk(code) {
  return HIGH_RISK_COUNTRIES.includes(String(code || '').toUpperCase());
}

function isProhibited(code) {
  return PROHIBITED_COUNTRIES.includes(String(code || '').toUpperCase());
}

/**
 * Occupation risk weights. Cash-intensive and gatekeeper professions score
 * higher because they are recognised laundering conduits, not as a judgement of
 * the individuals in them.
 */
const OCCUPATION_RISK = {
  'CASH INTENSIVE BUSINESS': 18,
  'MONEY SERVICE BUSINESS': 22,
  'CASINO OPERATOR': 22,
  'PRECIOUS METALS DEALER': 18,
  'ART DEALER': 16,
  'REAL ESTATE AGENT': 14,
  'CRYPTO TRADER': 16,
  LAWYER: 12,
  ACCOUNTANT: 12,
  'GOVERNMENT OFFICIAL': 20,
  'POLITICALLY EXPOSED': 25,
  'BUSINESS OWNER': 8,
  CONSULTANT: 8,
  ENGINEER: 2,
  TEACHER: 2,
  NURSE: 2,
  DOCTOR: 3,
  'SOFTWARE DEVELOPER': 2,
  RETIRED: 3,
  STUDENT: 5,
  UNEMPLOYED: 8,
};

function occupationRisk(occupation) {
  if (!occupation) return 10; // unstated occupation is a CDD gap, not neutral
  return OCCUPATION_RISK[String(occupation).toUpperCase()] ?? 6;
}

const SOURCE_OF_FUNDS_RISK = {
  SALARY: 2,
  PENSION: 2,
  SAVINGS: 3,
  INVESTMENT_RETURNS: 6,
  BUSINESS_REVENUE: 8,
  PROPERTY_SALE: 8,
  INHERITANCE: 10,
  GIFT: 14,
  LOTTERY_WINNINGS: 16,
  CRYPTO_PROCEEDS: 18,
  UNKNOWN: 20,
};

function sourceOfFundsRisk(source) {
  if (!source) return 15;
  return SOURCE_OF_FUNDS_RISK[String(source).toUpperCase()] ?? 12;
}

/**
 * Document rules. `category` drives REQ-KYC-307: reaching VERIFIED requires one
 * IDENTITY document and one ADDRESS document, so the categorisation here is
 * load-bearing, not decorative.
 */
const DOCUMENT_RULES = {
  PASSPORT: {
    category: 'IDENTITY',
    // 1-2 letters then 6-8 digits, e.g. `P1234567` / `AB123456`
    pattern: /^[A-Z]{1,2}\d{6,8}$/,
    description: '1-2 uppercase letters followed by 6-8 digits',
    requiresExpiry: true,
  },
  NATIONAL_ID: {
    category: 'IDENTITY',
    pattern: /^[A-Z0-9]{8,14}$/,
    description: '8-14 alphanumeric characters',
    requiresExpiry: false,
  },
  DRIVERS_LICENSE: {
    category: 'IDENTITY',
    pattern: /^[A-Z]{1,2}\d{5,12}$/,
    description: '1-2 uppercase letters followed by 5-12 digits',
    requiresExpiry: true,
  },
  UTILITY_BILL: {
    category: 'ADDRESS',
    pattern: /^[A-Z0-9-]{6,20}$/,
    description: '6-20 alphanumeric characters or hyphens',
    requiresExpiry: false,
  },
  BANK_STATEMENT: {
    category: 'ADDRESS',
    pattern: /^[A-Z0-9-]{6,20}$/,
    description: '6-20 alphanumeric characters or hyphens',
    requiresExpiry: false,
  },
};

const DOCUMENT_TYPES = Object.keys(DOCUMENT_RULES);
const IDENTITY_DOCUMENTS = DOCUMENT_TYPES.filter((t) => DOCUMENT_RULES[t].category === 'IDENTITY');
const ADDRESS_DOCUMENTS = DOCUMENT_TYPES.filter((t) => DOCUMENT_RULES[t].category === 'ADDRESS');

/**
 * Accepted document types per jurisdiction (REQ-CHT-107). Countries absent from
 * this map fall back to the global default.
 */
const ACCEPTED_DOCUMENTS_BY_COUNTRY = {
  US: ['PASSPORT', 'DRIVERS_LICENSE', 'UTILITY_BILL', 'BANK_STATEMENT'],
  GB: ['PASSPORT', 'DRIVERS_LICENSE', 'UTILITY_BILL', 'BANK_STATEMENT'],
  DE: ['PASSPORT', 'NATIONAL_ID', 'UTILITY_BILL', 'BANK_STATEMENT'],
  FR: ['PASSPORT', 'NATIONAL_ID', 'UTILITY_BILL', 'BANK_STATEMENT'],
  SG: ['PASSPORT', 'NATIONAL_ID', 'UTILITY_BILL'],
  IN: ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'BANK_STATEMENT'],
};

const DEFAULT_ACCEPTED_DOCUMENTS = ['PASSPORT', 'NATIONAL_ID', 'UTILITY_BILL', 'BANK_STATEMENT'];

function acceptedDocuments(countryCode) {
  return ACCEPTED_DOCUMENTS_BY_COUNTRY[String(countryCode || '').toUpperCase()]
    || DEFAULT_ACCEPTED_DOCUMENTS;
}

/** Screening decision bands. Tuned above the ~59 floor unrelated names produce. */
const SCREENING_THRESHOLDS = {
  EXACT: 97, // treat as an exact hit — requires analyst confirmation
  POTENTIAL: 85, // review queue
};

/** Risk-rating bands derived from the 0-100 composite score (REQ-KYC-308). */
const RISK_BANDS = [
  { rating: 'LOW', min: 0, max: 24, reviewYears: 3 },
  { rating: 'MEDIUM', min: 25, max: 49, reviewYears: 2 },
  { rating: 'HIGH', min: 50, max: 99, reviewYears: 1 },
  { rating: 'PROHIBITED', min: 100, max: 100, reviewYears: 0 },
];

const CHANNELS = ['WIRE', 'ACH', 'CASH', 'CARD', 'CRYPTO', 'CHEQUE', 'MOBILE'];
const CHAT_CHANNELS = ['WEB', 'MOBILE', 'WHATSAPP', 'SMS', 'VOICE'];
const ROLES = ['CUSTOMER', 'ANALYST', 'SENIOR_ANALYST', 'COMPLIANCE_OFFICER', 'ADMIN'];

module.exports = {
  RISK_TIER,
  COUNTRIES,
  HIGH_RISK_COUNTRIES,
  PROHIBITED_COUNTRIES,
  countryRisk,
  isHighRisk,
  isProhibited,
  OCCUPATION_RISK,
  occupationRisk,
  SOURCE_OF_FUNDS_RISK,
  sourceOfFundsRisk,
  DOCUMENT_RULES,
  DOCUMENT_TYPES,
  IDENTITY_DOCUMENTS,
  ADDRESS_DOCUMENTS,
  acceptedDocuments,
  SCREENING_THRESHOLDS,
  RISK_BANDS,
  CHANNELS,
  CHAT_CHANNELS,
  ROLES,
};

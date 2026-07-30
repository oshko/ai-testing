'use strict';

/**
 * KYC logic: input validation, document verification and risk scoring.
 *
 * NOTE ON COUNTRIES: the HIGH and PROHIBITED tiers use ISO 3166-1 *reserved*
 * codes (XA, XB, QM, XP, ZZ) which will never be assigned to a real country.
 * Labelling a real nation "prohibited" in a test fixture would bake a political
 * claim into the repo, so real codes appear only in the neutral standard tier.
 */

const COUNTRY_RISK = {
  US: 5, GB: 5, DE: 5, FR: 5, CA: 5, AU: 5, SG: 8, IN: 10, BR: 10, ZA: 10,
  XA: 35, XB: 35, QM: 40, // fictional high-risk
  XP: 100, ZZ: 100, // fictional prohibited
};

const HIGH_RISK_COUNTRIES = ['XA', 'XB', 'QM', 'XP', 'ZZ'];
const PROHIBITED_COUNTRIES = ['XP', 'ZZ'];

const OCCUPATION_RISK = {
  'CASH INTENSIVE BUSINESS': 18,
  'MONEY SERVICE BUSINESS': 22,
  'CRYPTO TRADER': 16,
  'GOVERNMENT OFFICIAL': 20,
  'REAL ESTATE AGENT': 14,
  LAWYER: 12,
  'BUSINESS OWNER': 8,
  ENGINEER: 2,
  TEACHER: 2,
  DOCTOR: 3,
  RETIRED: 3,
  STUDENT: 5,
  UNEMPLOYED: 8,
};

const DOCUMENT_RULES = {
  PASSPORT: { category: 'IDENTITY', pattern: /^[A-Z]{1,2}\d{6,8}$/, needsExpiry: true },
  NATIONAL_ID: { category: 'IDENTITY', pattern: /^[A-Z0-9]{8,14}$/, needsExpiry: false },
  DRIVERS_LICENSE: { category: 'IDENTITY', pattern: /^[A-Z]{1,2}\d{5,12}$/, needsExpiry: true },
  UTILITY_BILL: { category: 'ADDRESS', pattern: /^[A-Z0-9-]{6,20}$/, needsExpiry: false },
  BANK_STATEMENT: { category: 'ADDRESS', pattern: /^[A-Z0-9-]{6,20}$/, needsExpiry: false },
};

const DOCUMENT_TYPES = Object.keys(DOCUMENT_RULES);

const isHighRisk = (c) => HIGH_RISK_COUNTRIES.includes(String(c || '').toUpperCase());
const isProhibited = (c) => PROHIBITED_COUNTRIES.includes(String(c || '').toUpperCase());

/** Unknown countries score 25 - we fail closed rather than treating them as safe. */
const countryRisk = (c) => COUNTRY_RISK[String(c || '').toUpperCase()] ?? 25;

function occupationRisk(occupation) {
  if (!occupation) return 10; // an unanswered CDD question is itself a risk signal
  return OCCUPATION_RISK[String(occupation).toUpperCase()] ?? 6;
}

/** Whole years between a date of birth and `asOf`. */
function ageOn(dateOfBirth, asOf = new Date()) {
  const dob = new Date(dateOfBirth);
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

/**
 * Validates an onboarding payload (REQ-KYC-02, REQ-KYC-03).
 * Returns every problem found, not just the first, so a client can fix the
 * whole form in one pass.
 */
function validateCustomer(body = {}, asOf = new Date()) {
  const errors = [];
  const req = (field, label) => {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
      errors.push({ field, message: `${label} is required` });
      return false;
    }
    return true;
  };

  req('full_name', 'Full name');
  req('country', 'Country');

  if (req('email', 'Email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: 'email', message: 'Email format is invalid' });
  }

  if (req('date_of_birth', 'Date of birth')) {
    const dob = new Date(body.date_of_birth);
    if (Number.isNaN(dob.getTime())) {
      errors.push({ field: 'date_of_birth', message: 'Date of birth is not a valid date' });
    } else if (ageOn(dob, asOf) < 18) {
      // Distinct code so the client can show an age-specific message (REQ-KYC-03).
      errors.push({ field: 'date_of_birth', message: 'Applicant must be at least 18', code: 'UNDERAGE_APPLICANT' });
    }
  }

  if (body.annual_income !== undefined && body.annual_income !== null
      && (Number.isNaN(Number(body.annual_income)) || Number(body.annual_income) < 0)) {
    errors.push({ field: 'annual_income', message: 'Annual income must be a non-negative number' });
  }

  return errors;
}

/**
 * Verifies one document (REQ-KYC-04, REQ-KYC-05).
 *
 * Format is checked before expiry: a malformed number suggests a forged
 * document (FAILED - investigate), while an expired one is an ordinary lapse
 * (EXPIRED - ask the customer to renew). The more serious finding wins.
 */
function verifyDocument(doc = {}, asOf = new Date()) {
  const type = String(doc.document_type || '').toUpperCase();
  const number = String(doc.document_number || '').trim().toUpperCase();
  const rules = DOCUMENT_RULES[type];

  if (!rules) return { status: 'FAILED', failure_reason: 'Unsupported document type' };
  if (!rules.pattern.test(number)) {
    return { status: 'FAILED', failure_reason: 'Document number format is invalid' };
  }

  const expiry = doc.expiry_date ? new Date(doc.expiry_date) : null;
  if (rules.needsExpiry && !expiry) {
    return { status: 'FAILED', failure_reason: 'Expiry date is required for this document type' };
  }
  if (expiry && expiry.getTime() < asOf.getTime()) {
    return { status: 'EXPIRED', failure_reason: `Document expired on ${doc.expiry_date}` };
  }

  return { status: 'VERIFIED', failure_reason: null };
}

/**
 * A customer may only be VERIFIED with one verified IDENTITY document and one
 * verified ADDRESS document (REQ-KYC-10).
 */
function documentsSufficient(documents = []) {
  const categories = documents
    .filter((d) => d.status === 'VERIFIED')
    .map((d) => (DOCUMENT_RULES[d.document_type] || {}).category);
  return categories.includes('IDENTITY') && categories.includes('ADDRESS');
}

/**
 * Computes a 0-100 risk score with an itemised factor breakdown
 * (REQ-KYC-06, REQ-KYC-07, REQ-KYC-08).
 *
 * Two design points:
 *  - The score is an additive sum of *named* factors, all returned to the
 *    caller. A regulator asking "why was this customer rated HIGH?" must get an
 *    answer reconstructible from stored data.
 *  - PROHIBITED is a hard gate, not a score band. Ordinary customers are clamped
 *    to 99, so no pile-up of mild factors can ever auto-reject someone as if
 *    they were sanctioned. Only a prohibited jurisdiction or a confirmed
 *    sanctions match sets 100.
 */
function computeRisk(input = {}) {
  const {
    country, is_pep: isPep = false, occupation,
    annual_income: annualIncome, documents = [], sanctions_match: sanctionsMatch = false,
  } = input;

  const factors = [];
  const add = (code, label, points) => {
    if (points > 0) factors.push({ code, label, points });
  };

  const prohibitedReasons = [];
  if (isProhibited(country)) prohibitedReasons.push(`Prohibited jurisdiction: ${country}`);
  if (sanctionsMatch) prohibitedReasons.push('Confirmed sanctions match');

  add('COUNTRY', `Country risk (${country})`, countryRisk(country));
  if (isPep) add('PEP', 'Politically Exposed Person', 25);
  add('OCCUPATION', `Occupation risk (${occupation || 'not stated'})`, occupationRisk(occupation));
  if (annualIncome === undefined || annualIncome === null) {
    add('INCOME_UNSTATED', 'Annual income not provided', 5);
  }

  const failed = documents.filter((d) => d.status === 'FAILED').length;
  const expired = documents.filter((d) => d.status === 'EXPIRED').length;
  if (failed) add('DOC_FAILED', 'Failed document verification', 15 * failed);
  if (expired) add('DOC_EXPIRED', 'Expired document on file', 8 * expired);
  if (documents.length && !documentsSufficient(documents)) {
    add('DOC_INSUFFICIENT', 'Missing verified identity or address document', 10);
  }

  const raw = factors.reduce((sum, f) => sum + f.points, 0);

  if (prohibitedReasons.length) {
    return {
      score: 100, rating: 'PROHIBITED', prohibited: true, prohibited_reasons: prohibitedReasons, factors,
    };
  }

  const score = Math.min(99, raw); // clamp - see design note above
  let rating = 'LOW';
  if (score >= 50) rating = 'HIGH';
  else if (score >= 25) rating = 'MEDIUM';

  return {
    score,
    rating,
    prohibited: false,
    prohibited_reasons: [],
    // HIGH-risk customers go to Enhanced Due Diligence, never auto-approval.
    edd_required: rating === 'HIGH',
    factors,
  };
}

module.exports = {
  COUNTRY_RISK,
  HIGH_RISK_COUNTRIES,
  PROHIBITED_COUNTRIES,
  DOCUMENT_RULES,
  DOCUMENT_TYPES,
  isHighRisk,
  isProhibited,
  countryRisk,
  occupationRisk,
  ageOn,
  validateCustomer,
  verifyDocument,
  documentsSufficient,
  computeRisk,
};

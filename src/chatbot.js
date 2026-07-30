'use strict';

const { DOCUMENT_TYPES, COUNTRY_RISK } = require('./kyc');

/**
 * Chatbot NLP: intent classification and entity extraction.
 *
 * WHY THIS IS RULE-BASED, NOT AN LLM CALL
 * A hosted model returns slightly different output run to run, which makes test
 * assertions flaky and makes a traceability matrix meaningless - you cannot
 * evidence "requirement verified" against a non-deterministic oracle. The
 * classifier is therefore deterministic, and lives behind a small interface so a
 * real NLU service can replace it later without the requirements changing.
 */

const CONFIDENCE_THRESHOLD = 0.6; // below this the intent becomes `unknown`

/**
 * Intent catalogue (REQ-NLP-01).
 *  phrases  - distinctive multi-word signals; a hit alone clears 0.70
 *  strong   - single tokens that are decisive on their own ("hello", "alerts").
 *             Matched by exact token equality, never substring: a substring test
 *             for "hi" would fire on "this" and "which".
 *  keywords - single tokens; weaker, they accumulate
 *  negatable - whether a negation cue should suppress this intent (REQ-NLP-05).
 *              `check_kyc_status` is deliberately NOT negatable: "I don't know
 *              my KYC status" is still a status query, whereas "I don't want to
 *              upload a document" is not an upload request.
 */
const INTENTS = {
  greeting: {
    phrases: ['good morning', 'good afternoon', 'good evening'],
    strong: ['hello', 'hi', 'hey', 'greetings'],
    keywords: ['hello', 'hi', 'hey', 'greetings'],
    negatable: false,
  },
  onboarding_start: {
    phrases: ['open an account', 'start onboarding', 'become a customer', 'sign up',
      'new account', 'start my application', 'complete my kyc', 'start kyc', 'onboard me'],
    keywords: ['onboard', 'onboarding', 'register', 'signup', 'apply'],
    negatable: true,
  },
  upload_document: {
    phrases: ['upload a document', 'upload my document', 'upload documents',
      'submit my passport', 'which documents', 'what documents', 'documents do you need',
      'proof of address', 'verify my identity', 'submit a document'],
    keywords: ['upload', 'passport', 'document', 'documents'],
    negatable: true,
  },
  check_kyc_status: {
    phrases: ['my kyc status', 'kyc status', 'application status', 'am i verified',
      'check my status', 'verification status', 'status of my application'],
    keywords: ['status', 'verified', 'approved', 'pending'],
    negatable: false,
  },
  query_alerts: {
    phrases: ['show me alerts', 'show alerts', 'list alerts', 'open alerts',
      'critical alerts', 'any alerts', 'aml alerts', 'show me the alerts'],
    // "alerts" is domain-specific enough to be decisive on its own, which is
    // what lets "show me MEDIUM alerts from last week" classify correctly
    // without enumerating every possible modifier as a phrase.
    strong: ['alerts', 'alert'],
    keywords: ['alerts', 'alert', 'flagged'],
    negatable: false,
    analystOnly: true,
  },
  human_handoff: {
    phrases: ['speak to a human', 'talk to a human', 'speak to an agent',
      'talk to an agent', 'real person', 'human agent', 'escalate this',
      'speak to someone', 'talk to support'],
    keywords: ['human', 'agent', 'representative', 'escalate'],
    negatable: true,
  },
};

const INTENT_NAMES = [...Object.keys(INTENTS), 'unknown'];

const NEGATION_CUES = ["don't", 'dont', 'do not', 'not', 'never', "doesn't", 'cannot', "can't", 'rather not'];

/**
 * Function words excluded from keyword matching. Without this they inflate every
 * intent's score toward the threshold and the classifier loses its ability to
 * answer `unknown`.
 */
const STOPWORDS = new Set(['a', 'an', 'the', 'is', 'are', 'i', 'me', 'my', 'you', 'your', 'to',
  'of', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'do', 'does', 'did', 'have', 'has',
  'can', 'could', 'will', 'would', 'want', 'need', 'please', 'show', 'what', 'when', 'how',
  'am', 'be', 'it', 'this', 'that', 'from', 'about']);

/** Lowercase, strip punctuation, collapse whitespace (REQ-NLP-02). */
const normalize = (text) => String(text || '')
  .toLowerCase()
  .replace(/[^a-z0-9@.\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Classifies a message into one intent with a confidence score (REQ-NLP-01).
 *
 * A distinctive phrase is strong evidence and scores high on its own. Loose
 * keywords only accumulate toward the threshold, which is what lets genuinely
 * out-of-domain text fall through to `unknown` (REQ-NLP-04) instead of being
 * forced into the nearest guess.
 */
function classifyIntent(message) {
  const text = normalize(message);
  const tokens = text.split(' ').filter((t) => t && !STOPWORDS.has(t));
  const hasNegation = NEGATION_CUES.some((cue) => text.includes(cue));

  const scores = [];

  for (const [name, def] of Object.entries(INTENTS)) {
    const phraseHit = def.phrases.some((p) => text.includes(p));
    const strongHit = (def.strong || []).some((s) => tokens.includes(s));
    const keywordHits = def.keywords.filter((k) => tokens.includes(k)).length;

    let confidence = 0;
    if (phraseHit) confidence = Math.min(0.95, 0.75 + 0.05 * keywordHits);
    else if (strongHit) confidence = 0.8;
    else if (keywordHits) confidence = Math.min(0.95, 0.3 + 0.15 * keywordHits);

    // A negated request is not a request. Suppress hard rather than nudging, so
    // the intent lands below the threshold and becomes `unknown`.
    if (confidence > 0 && hasNegation && def.negatable) confidence *= 0.4;

    if (confidence > 0) scores.push({ intent: name, confidence: Math.round(confidence * 1000) / 1000 });
  }

  scores.sort((a, b) => b.confidence - a.confidence);
  const best = scores[0];

  if (!best || best.confidence < CONFIDENCE_THRESHOLD) {
    return {
      intent: 'unknown',
      confidence: best ? best.confidence : 0,
      // The pre-threshold guess is exposed so thresholds can be tuned from real
      // traffic rather than guesswork.
      candidate_intent: best ? best.intent : null,
    };
  }

  return { intent: best.intent, confidence: best.confidence, candidate_intent: null };
}

const MONEY = /([$€£])\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([km])?|(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([km])?\s*(usd|eur|gbp|dollars?)/gi;
const SYMBOL_CURRENCY = { $: 'USD', '€': 'EUR', '£': 'GBP' };
const WORD_CURRENCY = { usd: 'USD', dollar: 'USD', dollars: 'USD', eur: 'EUR', gbp: 'GBP' };

const DOC_PHRASES = [
  [/\bpass\s?ports?\b/i, 'PASSPORT'],
  [/\bnational\s+id\b|\bid\s+card\b/i, 'NATIONAL_ID'],
  [/\bdriv(?:er|ing)'?s?\s+licen[cs]e\b/i, 'DRIVERS_LICENSE'],
  [/\butility\s+bills?\b/i, 'UTILITY_BILL'],
  [/\bbank\s+statements?\b/i, 'BANK_STATEMENT'],
];

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Words that disqualify a capture from being read as a person's name. */
const NAME_STOPWORDS = new Set(['not', 'sure', 'here', 'looking', 'trying', 'from', 'a', 'an',
  'the', 'interested', 'just', 'unable', 'having', 'and', 'but', 'to', 'in', 'on', 'at', 'want']);

/**
 * Extracts typed entities (REQ-NLP-03).
 * Money is normalised to `{ amount, currency }`, handling symbols, thousands
 * separators and k/m suffixes.
 */
function extractEntities(message) {
  const text = String(message || '');
  const entities = {};

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) entities.EMAIL = email[0].toLowerCase();

  const name = text.match(/\b(?:my name is|i am|i'm|this is)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3})/i);
  if (name) {
    const kept = [];
    for (const token of name[1].trim().split(/\s+/)) {
      if (NAME_STOPWORDS.has(token.toLowerCase())) break;
      kept.push(token);
    }
    if (kept.length) {
      entities.PERSON_NAME = kept
        .map((t) => t[0].toUpperCase() + t.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // ISO codes are matched only in uppercase form - case-insensitive matching
  // would turn the word "in" into India and "us" into the United States.
  const code = text.match(/\b([A-Z]{2})\b/);
  if (code && COUNTRY_RISK[code[1]] !== undefined) entities.COUNTRY = code[1];

  for (const [pattern, value] of DOC_PHRASES) {
    if (pattern.test(text)) { entities.DOCUMENT_TYPE = value; break; }
  }

  const severity = SEVERITIES.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(text));
  if (severity) entities.ALERT_SEVERITY = severity;

  const money = [...text.matchAll(MONEY)][0];
  if (money) {
    const digits = money[2] || money[4];
    const suffix = money[3] || money[5];
    let amount = Number.parseFloat(String(digits).replace(/,/g, ''));
    if (suffix) amount *= suffix.toLowerCase() === 'k' ? 1000 : 1000000;
    const currency = SYMBOL_CURRENCY[money[1]]
      || WORD_CURRENCY[String(money[6] || '').toLowerCase().replace(/s$/, '')]
      || 'USD';
    entities.MONEY_AMOUNT = { amount: Math.round(amount * 100) / 100, currency };
  }

  return entities;
}

/**
 * Builds the bot reply for a classified message (REQ-CHT-01 … REQ-CHT-05).
 * `context` may carry `{ customer, alerts, role }` resolved by the route.
 */
function buildReply(intent, entities, context = {}) {
  const { customer, alerts, role } = context;

  switch (intent) {
    case 'greeting':
      return { reply: 'Hello, I am the TechSpark compliance assistant. I can help you open an account, upload documents, or check your KYC status.', escalated: false };

    case 'onboarding_start':
      return { reply: 'I can start your KYC application. Please provide your full name, date of birth, email, and country of residence.', escalated: false };

    case 'upload_document':
      return {
        reply: `Please upload one identity document and one proof of address. Accepted types: ${DOCUMENT_TYPES.join(', ')}.`,
        escalated: false,
      };

    case 'check_kyc_status':
      if (!customer) {
        return { reply: 'I could not find your customer record. Please give me the email address on your application.', escalated: false };
      }
      return {
        reply: `Your KYC status is ${customer.kyc_status} and your risk rating is ${customer.risk_rating}.`,
        escalated: false,
      };

    case 'query_alerts':
      // Data-bearing analyst responses are role-gated (REQ-CHT-04).
      if (role !== 'ANALYST' && role !== 'COMPLIANCE_OFFICER') {
        return { reply: 'Alert information is only available to compliance staff.', escalated: false };
      }
      return {
        reply: `I found ${alerts ? alerts.length : 0} matching alert(s).`,
        escalated: false,
      };

    case 'human_handoff':
      return { reply: 'I am transferring you to a human compliance agent now.', escalated: true, escalation_reason: 'USER_REQUESTED' };

    default:
      // Never invent compliance guidance for out-of-domain input (REQ-CHT-05).
      return {
        reply: 'I am not sure I understood that. I can help with account opening, document upload, or KYC status. Would you like to speak to a human agent?',
        escalated: true,
        escalation_reason: 'LOW_CONFIDENCE',
      };
  }
}

module.exports = {
  INTENTS,
  INTENT_NAMES,
  CONFIDENCE_THRESHOLD,
  normalize,
  classifyIntent,
  extractEntities,
  buildReply,
};

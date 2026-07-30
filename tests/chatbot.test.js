'use strict';

const {
  app, db, request, resetDb, createCustomer, postTransaction,
} = require('./helpers');
const bot = require('../src/chatbot');

beforeEach(resetDb);
afterAll(() => db.close());

/** Sends one chat turn and returns the response `data`. */
async function chat(message, { role, sessionId, email } = {}) {
  const req = request(app).post('/api/chat');
  if (role) req.set('x-user-role', role);
  const res = await req.send({
    message,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(email ? { email } : {}),
  });
  return { status: res.status, body: res.body, data: res.body.data };
}

// ===========================================================================
// Intent classification
// ===========================================================================

describe('NLP intent classification', () => {
  test('TC-CHT-01 [REQ-CHT-01] returns a structured reply with intent and confidence', async () => {
    const { status, data } = await chat('Hello there');

    expect(status).toBe(200);
    expect(data.intent).toBe('greeting');
    expect(data.confidence).toBeGreaterThan(0);
    expect(typeof data.reply).toBe('string');
    expect(data.entities).toBeDefined();
    expect(data.session_id).toMatch(/^SESS-/);
  });

  test('TC-CHT-02 [REQ-NLP-01] classifies each catalogued intent above the 0.70 bar', async () => {
    const cases = [
      ['Hello there', 'greeting'],
      ['I want to open an account', 'onboarding_start'],
      ['Which documents do you need?', 'upload_document'],
      ['What is my kyc status?', 'check_kyc_status'],
      ['Show me open alerts', 'query_alerts'],
      ['I need to speak to a human', 'human_handoff'],
    ];

    for (const [message, expected] of cases) {
      // eslint-disable-next-line no-await-in-loop
      const { data } = await chat(message, { role: 'ANALYST' });
      expect(data.intent).toBe(expected);
      expect(data.confidence).toBeGreaterThanOrEqual(0.7);
    }
  });

  test('TC-CHT-03 [REQ-NLP-02] is insensitive to case, punctuation and extra whitespace', async () => {
    const variants = ['check my status', 'CHECK MY STATUS!!!', '   check   my   status   '];

    for (const v of variants) {
      // eslint-disable-next-line no-await-in-loop
      const { data } = await chat(v);
      expect(data.intent).toBe('check_kyc_status');
    }
  });

  test('TC-CHT-04 [REQ-NLP-04] resolves out-of-domain input to unknown rather than guessing', async () => {
    const { data } = await chat('What is the weather in Paris tomorrow?');

    expect(data.intent).toBe('unknown');
    // The fallback must not assert any compliance outcome.
    expect(data.reply).not.toMatch(/verified|approved|rejected|high risk/i);
    expect(data.escalated).toBe(true);
  });

  test('TC-CHT-05 [REQ-NLP-05] suppresses an intent that is negated', async () => {
    const { data } = await chat('I do not want to upload a document');

    expect(data.intent).toBe('unknown');
    // The pre-threshold guess is still reported so thresholds can be tuned.
    expect(data.candidate_intent).toBe('upload_document');
    expect(data.confidence).toBeLessThan(bot.CONFIDENCE_THRESHOLD);
  });

  test('TC-CHT-06 [REQ-NLP-04] classifies an affirmative upload request normally', async () => {
    // Control for TC-CHT-05: without the negation the same phrase must match.
    const { data } = await chat('I want to upload a document');
    expect(data.intent).toBe('upload_document');
  });

  test('TC-CHT-07 [REQ-NLP-01] publishes the intent catalogue', async () => {
    const res = await request(app).get('/api/intents');

    expect(res.status).toBe(200);
    expect(res.body.data.intents).toContain('unknown');
    expect(res.body.data.intents).toContain('check_kyc_status');
    expect(res.body.data.confidence_threshold).toBe(bot.CONFIDENCE_THRESHOLD);
  });
});

// ===========================================================================
// Entity extraction
// ===========================================================================

describe('NLP entity extraction', () => {
  test('TC-CHT-08 [REQ-NLP-03] extracts a person name and an email address', async () => {
    const { data } = await chat('My name is Elena Fontaine and my email is elena.f@example.com');

    expect(data.entities.PERSON_NAME).toBe('Elena Fontaine');
    expect(data.entities.EMAIL).toBe('elena.f@example.com');
  });

  test('TC-CHT-09 [REQ-NLP-03] normalises a symbol amount with thousands separators', async () => {
    const { data } = await chat('I deposited $9,500 in cash');

    expect(data.entities.MONEY_AMOUNT).toEqual({ amount: 9500, currency: 'USD' });
  });

  test('TC-CHT-10 [REQ-NLP-03] normalises a k-suffixed amount with an explicit currency', async () => {
    const { data } = await chat('I transferred 12k EUR');

    expect(data.entities.MONEY_AMOUNT).toEqual({ amount: 12000, currency: 'EUR' });
  });

  test('TC-CHT-11 [REQ-NLP-03] does not read a bare count as a monetary amount', async () => {
    // "15" here is a quantity, not money. Treating it as an amount would let it
    // flow into threshold comparisons as if it were currency.
    const entities = bot.extractEntities('show me 15 alerts');
    expect(entities.MONEY_AMOUNT).toBeUndefined();
  });

  test('TC-CHT-12 [REQ-NLP-03] extracts document type, country and severity', async () => {
    expect(bot.extractEntities('I will send my passport').DOCUMENT_TYPE).toBe('PASSPORT');
    expect(bot.extractEntities('here is a utility bill').DOCUMENT_TYPE).toBe('UTILITY_BILL');
    expect(bot.extractEntities('I live in GB now').COUNTRY).toBe('GB');
    expect(bot.extractEntities('show critical alerts').ALERT_SEVERITY).toBe('CRITICAL');
  });

  test('TC-CHT-13 [REQ-NLP-03] does not mistake lowercase words for ISO country codes', async () => {
    // Case-insensitive code matching would turn "in" into India and "us" into
    // the United States on almost every English sentence.
    expect(bot.extractEntities('please tell us what is in the form').COUNTRY).toBeUndefined();
  });
});

// ===========================================================================
// Dialogue behaviour
// ===========================================================================

describe('Chatbot dialogue', () => {
  test('TC-CHT-14 [REQ-CHT-02] answers a KYC status query for a resolvable customer', async () => {
    const { customer } = await createCustomer({ email: 'status.check@example.com' });

    const { data } = await chat('what is my kyc status? status.check@example.com');

    expect(data.intent).toBe('check_kyc_status');
    expect(data.reply).toContain(customer.kyc_status);
    expect(data.reply).toContain(customer.risk_rating);
  });

  test('TC-CHT-15 [REQ-CHT-02] asks for identification when the customer cannot be resolved', async () => {
    const { data } = await chat('what is my kyc status?');

    expect(data.intent).toBe('check_kyc_status');
    expect(data.reply).toMatch(/email/i);
    // It must not invent a status for an unknown customer.
    expect(data.reply).not.toMatch(/VERIFIED|PENDING|REJECTED/);
  });

  test('TC-CHT-16 [REQ-CHT-03] lists the accepted document types on request', async () => {
    const { data } = await chat('Which documents do you need?');

    expect(data.intent).toBe('upload_document');
    expect(data.reply).toContain('PASSPORT');
    expect(data.reply).toContain('UTILITY_BILL');
  });

  test('TC-CHT-17 [REQ-CHT-04] lets an analyst query the alert queue in natural language', async () => {
    const { customer } = await createCustomer();
    await postTransaction(customer.id, { amount: 15000, channel: 'CASH' });

    const { data } = await chat('Show me open alerts', { role: 'ANALYST' });

    expect(data.intent).toBe('query_alerts');
    expect(data.alerts.length).toBeGreaterThan(0);
    expect(data.reply).toMatch(/1 matching alert/);
  });

  test('TC-CHT-18 [REQ-CHT-04] filters an analyst alert query by extracted severity', async () => {
    const { customer } = await createCustomer();
    await postTransaction(customer.id, { amount: 15000, channel: 'CASH' }); // HIGH
    await postTransaction(customer.id, {
      amount: 200, channel: 'WIRE', direction: 'DEBIT', counterparty_country: 'XB',
    }); // MEDIUM

    const { data } = await chat('show me MEDIUM alerts', { role: 'ANALYST' });

    expect(data.entities.ALERT_SEVERITY).toBe('MEDIUM');
    expect(data.alerts.every((a) => a.severity === 'MEDIUM')).toBe(true);
  });

  test('TC-CHT-19 [REQ-CHT-04] withholds alert data from a customer role', async () => {
    const { customer } = await createCustomer();
    await postTransaction(customer.id, { amount: 15000, channel: 'CASH' });

    const { data } = await chat('Show me open alerts', { role: 'CUSTOMER' });

    expect(data.intent).toBe('query_alerts');
    expect(data.reply).toMatch(/only available to compliance staff/i);
    expect(data.alerts).toBeUndefined();
  });

  test('TC-CHT-20 [REQ-CHT-05] escalates to a human on explicit request', async () => {
    const { data } = await chat('I need to speak to a human');

    expect(data.intent).toBe('human_handoff');
    expect(data.escalated).toBe(true);
    expect(data.escalation_reason).toBe('USER_REQUESTED');
  });

  test('TC-CHT-21 [REQ-CHT-05] escalates when confidence is too low', async () => {
    const { data } = await chat('asdkjh qwe zxcvbn');

    expect(data.intent).toBe('unknown');
    expect(data.escalated).toBe(true);
    expect(data.escalation_reason).toBe('LOW_CONFIDENCE');
  });
});

// ===========================================================================
// Transcript and input limits
// ===========================================================================

describe('Chatbot transcript and limits', () => {
  test('TC-CHT-22 [REQ-CHT-06] persists both turns of the conversation with intent metadata', async () => {
    const { data } = await chat('Hello there');

    const res = await request(app).get(`/api/chat/${data.session_id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    const [user, botTurn] = res.body.data.messages;
    expect(user.sender).toBe('USER');
    expect(user.intent).toBe('greeting');
    expect(Number(user.confidence)).toBeGreaterThan(0);
    expect(botTurn.sender).toBe('BOT');
  });

  test('TC-CHT-23 [REQ-CHT-06] keeps multiple turns under one session id', async () => {
    const first = await chat('Hello there');
    await chat('Which documents do you need?', { sessionId: first.data.session_id });

    const res = await request(app).get(`/api/chat/${first.data.session_id}`);

    // Two turns x two messages each.
    expect(res.body.data.count).toBe(4);
  });

  test('TC-CHT-24 [REQ-CHT-01] rejects an empty message', async () => {
    const { status, body } = await chat('   ');

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-CHT-25 [REQ-NLP-06] rejects a message beyond the length limit', async () => {
    const { status, body } = await chat('x'.repeat(1001));

    expect(status).toBe(400);
    expect(body.error.code).toBe('MESSAGE_TOO_LONG');
  });
});

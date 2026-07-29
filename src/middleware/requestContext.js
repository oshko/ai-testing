'use strict';

const crypto = require('crypto');

/**
 * Attaches a correlation id and high-resolution start time to every request,
 * and installs the standard response envelope helpers (REQ-INT-509).
 *
 * A single envelope shape for both success and failure is what lets downstream
 * consumers — and the test suite — branch on one field instead of guessing at
 * the body shape per endpoint. `requestId` is echoed on errors so a user can
 * quote it to support without the server having to leak internals
 * (REQ-NFR-616).
 */
module.exports = function requestContext(req, res, next) {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  req.startTime = process.hrtime.bigint();

  res.set('X-Request-Id', req.id);

  /** Elapsed wall-clock milliseconds since the request entered the app. */
  res.elapsedMs = () => Number(process.hrtime.bigint() - req.startTime) / 1e6;

  /** Success envelope. */
  res.ok = (data, { status = 200, meta = {} } = {}) => res.status(status).json({
    success: true,
    data,
    error: null,
    meta: {
      requestId: req.id,
      // Exposed so REQ-NFR-602 can be observed per request rather than only in
      // an external load-test report.
      processingTimeMs: Math.round(res.elapsedMs() * 100) / 100,
      ...meta,
    },
  });

  /** Failure envelope — used by the error handler, and directly where handy. */
  res.fail = (status, code, message, details = null) => res.status(status).json({
    success: false,
    data: null,
    error: { code, message, ...(details ? { details } : {}) },
    meta: {
      requestId: req.id,
      processingTimeMs: Math.round(res.elapsedMs() * 100) / 100,
    },
  });

  next();
};

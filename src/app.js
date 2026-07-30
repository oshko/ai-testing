'use strict';

const express = require('express');
const config = require('./config');
const routes = require('./routes');

const app = express();

// Don't advertise the framework version (REQ-NFR-03).
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

app.use(routes);

// Unmatched route
app.use((req, res) => res.status(404).json({
  success: false,
  data: null,
  error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
}));

/**
 * Central error handler. Client errors carry their code; anything unexpected
 * becomes a generic 500 - stack traces and SQL fragments are never returned
 * outside development (REQ-NFR-03).
 */
// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument form
app.use((err, req, res, next) => {
  // A malformed JSON body is a client error, not a server fault.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' },
    });
  }

  if (!config.isTest) console.error('[error]', err.message);

  return res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      ...(config.env === 'development' ? { detail: err.message } : {}),
    },
  });
});

module.exports = app;

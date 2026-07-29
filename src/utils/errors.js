'use strict';

/**
 * Domain error taxonomy.
 *
 * Every error carries a stable machine-readable `code` in addition to the HTTP
 * status. Test cases assert on `code`, never on the human-readable message, so
 * message wording can be improved (or localised) without breaking the suite —
 * an important property when the RTM depends on stable assertions.
 */
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details = null, code = 'VALIDATION_ERROR') {
    super(message, { status: 400, code, details });
  }
}

class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { status: 401, code: 'UNAUTHENTICATED' });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', details = null) {
    super(message, { status: 403, code: 'FORBIDDEN', details });
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, { status: 404, code: 'NOT_FOUND' });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicting state', code = 'CONFLICT', details = null) {
    super(message, { status: 409, code, details });
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, { status: 429, code: 'RATE_LIMIT_EXCEEDED' });
  }
}

/** Raised when a simulated external provider is unavailable (REQ-INT-507). */
class ProviderUnavailableError extends AppError {
  constructor(provider) {
    super(`Upstream provider unavailable: ${provider}`, {
      status: 503,
      code: 'PROVIDER_UNAVAILABLE',
      details: { provider },
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ProviderUnavailableError,
};

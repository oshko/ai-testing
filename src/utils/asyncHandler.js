'use strict';

/**
 * Wraps an async route handler so a rejected promise is forwarded to Express's
 * error middleware instead of becoming an unhandled rejection.
 *
 * Express 4 does not understand returned promises. Without this wrapper an
 * `await` that throws inside a handler produces a silent hung request — the
 * client waits until timeout and no error is logged. Express 5 forwards
 * rejections natively; this indirection is what makes that upgrade a one-line
 * change here rather than an audit of every route.
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

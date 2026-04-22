/**
 * middleware/errorMiddleware.js
 * Centralised error handler — always last middleware in the chain.
 */

const logger = require('../config/logger');
const { AppError } = require('../helpers/errors');

// ── Prisma error codes → HTTP ────────────────────────────────────────────────
const PRISMA_MAP = {
  P2002: { status: 409, message: 'A record with this value already exists.',     code: 'DUPLICATE' },
  P2025: { status: 404, message: 'Record not found.',                             code: 'NOT_FOUND' },
  P2003: { status: 400, message: 'Related record not found.',                     code: 'FK_VIOLATION' },
  P2034: { status: 503, message: 'Database transaction conflict, please retry.', code: 'TX_CONFLICT' },
  P2024: { status: 503, message: 'Database connection timed out.',                code: 'DB_TIMEOUT' },
};

function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isProd = process.env.NODE_ENV === 'production';

  // ── Prisma known errors ──────────────────────────────────────────────────
  if (err.code && PRISMA_MAP[err.code]) {
    const mapped = PRISMA_MAP[err.code];
    return res.status(mapped.status).json({
      success: false,
      code: mapped.code,
      message: mapped.message,
      requestId: req.requestId,
    });
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token expired.' });
  }

  // ── Multer errors ─────────────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, code: 'FILE_TOO_LARGE', message: 'File exceeds the 5 MB limit.' });
  }

  // ── Operational (AppError) ────────────────────────────────────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      requestId: req.requestId,
    });
  }

  // ── Programmer / unexpected errors ────────────────────────────────────────
  logger.error({
    message: err.message,
    stack:   err.stack,
    path:    req.originalUrl,
    method:  req.method,
    requestId: req.requestId,
    userId:  req.user?.id,
  });

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: isProd ? 'An unexpected error occurred.' : err.message,
    requestId: req.requestId,
    ...(!isProd && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
/**
 * helpers/errors.js
 * Centralised error types and async route handler.
 */

class AppError extends Error {
    /**
     * @param {string} message
     * @param {number} statusCode
     * @param {string} [code]  machine-readable code for the client
     */
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }

    static notFound(msg = 'Resource not found') { return new AppError(msg, 404, 'NOT_FOUND'); }
    static forbidden(msg = 'Forbidden') { return new AppError(msg, 403, 'FORBIDDEN'); }
    static unauthorized(msg = 'Unauthorized') { return new AppError(msg, 401, 'UNAUTHORIZED'); }
    static badRequest(msg = 'Bad request') { return new AppError(msg, 400, 'BAD_REQUEST'); }
    static conflict(msg = 'Conflict') { return new AppError(msg, 409, 'CONFLICT'); }
    static unprocessable(msg = 'Validation error') { return new AppError(msg, 422, 'VALIDATION_ERROR'); }
}

/**
 * Wraps an async Express route handler and forwards errors to next().
 * Eliminates try/catch boilerplate in every controller.
 * @param {Function} fn  async (req, res, next) => ...
 * @returns {Function}
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { AppError, asyncHandler };

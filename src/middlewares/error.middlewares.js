import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { ErrorCodes } from "../utils/constants.js";

/** Fallback for URLs that match no route. */
export const notFoundHandler = (req, _res, next) => {
    next(
        new ApiError(
            404,
            `Route not found: ${req.method} ${req.originalUrl}`,
            [],
            ErrorCodes.NOT_FOUND,
        ),
    );
};

/**
 * Converts ANY thrown error (our ApiError, Mongoose, JWT, body-parser, or a
 * plain bug) into a consistent JSON response. Without this, Express returns an
 * HTML error page and may leak stack traces.
 */
const normalizeError = (err) => {
    if (err instanceof ApiError) return err;

    // Malformed JSON body
    if (err.type === "entity.parse.failed") {
        return new ApiError(
            400,
            "Malformed JSON in request body",
            [],
            ErrorCodes.BAD_REQUEST,
        );
    }
    // Body bigger than the configured limit
    if (err.type === "entity.too.large") {
        return new ApiError(
            413,
            "Request body is too large",
            [],
            ErrorCodes.PAYLOAD_TOO_LARGE,
        );
    }
    // Mongoose schema validation
    if (err.name === "ValidationError" && err.errors) {
        const details = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
        return new ApiError(
            422,
            "Validation failed",
            details,
            ErrorCodes.VALIDATION_ERROR,
        );
    }
    // Invalid ObjectId etc.
    if (err.name === "CastError") {
        return new ApiError(
            400,
            `Invalid value for "${err.path}"`,
            [],
            ErrorCodes.BAD_REQUEST,
        );
    }
    // Duplicate key (unique index) - also covers the race where two identical registrations run in parallel
    if (err.code === 11000) {
        const field =
            Object.keys(err.keyPattern || err.keyValue || {})[0] || "value";
        return new ApiError(
            409,
            `This ${field} is already in use`,
            [{ field, message: "already in use" }],
            ErrorCodes.CONFLICT,
        );
    }
    // JWT errors that were not handled closer to the source
    if (err.name === "TokenExpiredError") {
        return new ApiError(401, "Token expired", [], ErrorCodes.TOKEN_EXPIRED);
    }
    if (err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
        return new ApiError(401, "Invalid token", [], ErrorCodes.TOKEN_INVALID);
    }
    // Other 4xx coming from Express / body-parser (http-errors)
    if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
        return new ApiError(
            err.status,
            err.message,
            [],
            ErrorCodes.BAD_REQUEST,
        );
    }

    // Unknown => a bug. Never expose internals in production.
    const unexpected = new ApiError(
        500,
        env.isProd
            ? "Internal server error"
            : err.message || "Internal server error",
        [],
        ErrorCodes.INTERNAL_ERROR,
    );
    unexpected.stack = err.stack;
    return unexpected;
};

// Express recognises error middleware by its 4 arguments - do not remove `_next`.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
    const error = normalizeError(err);

    if (error.statusCode >= 500 && !env.isTest) {
        console.error(`[error] ${req.method} ${req.originalUrl}\n`, err);
    }

    res.status(error.statusCode).json({
        statusCode: error.statusCode,
        data: null,
        message: error.message,
        success: false,
        code: error.code,
        errors: error.errors,
        ...(env.isDev && { stack: error.stack }),
    });
};

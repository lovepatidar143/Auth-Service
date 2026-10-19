import { ErrorCodes } from "./constants.js";

/**
 * Operational error: something we EXPECT can go wrong (bad input, wrong
 * password, missing resource). The global error handler turns it into a clean
 * JSON response. Anything that is not an ApiError is treated as a bug (500).
 *
 * @example throw new ApiError(404, "User not found", [], ErrorCodes.NOT_FOUND);
 */
export class ApiError extends Error {
    /**
     * @param {number} statusCode HTTP status code
     * @param {string} message    Human readable message (safe to show to users)
     * @param {Array}  errors     Optional detail list, e.g. per-field validation errors
     * @param {string} code       Machine readable code from ErrorCodes
     */
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        code = ErrorCodes.BAD_REQUEST,
    ) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.message = message;
        this.errors = errors;
        this.code = code;
        this.data = null;
        this.success = false;
        Error.captureStackTrace(this, this.constructor);
    }
}

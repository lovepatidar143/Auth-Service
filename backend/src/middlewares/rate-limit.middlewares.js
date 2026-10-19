import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { ErrorCodes } from "../utils/constants.js";

/**
 * Factory for rate limiters. Limits are counted per client IP.
 *
 * NOTE: the default store is in-memory, which is fine for one server process.
 * With several instances / containers use a shared store (e.g. `rate-limit-redis`),
 * otherwise every instance keeps its own counter.
 *
 * @param {object}   opts
 * @param {number}   opts.windowMs                Time window in ms
 * @param {number}   opts.limit                   Max requests per window per IP
 * @param {string}   opts.message                 Message returned when the limit is hit
 * @param {boolean}  [opts.skipSuccessfulRequests] Count only failed (>= 400) responses
 * @param {Function} [opts.skip]                  Custom skip function (defaults to the RATE_LIMIT_ENABLED flag)
 */
export const createRateLimiter = ({
    windowMs,
    limit,
    message = "Too many requests, please try again later.",
    skipSuccessfulRequests = false,
    skip = () => !env.RATE_LIMIT_ENABLED,
}) =>
    rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-7", // sends RateLimit + Retry-After headers
        legacyHeaders: false,
        skipSuccessfulRequests,
        skip,
        // Hand over to the global error handler so the JSON shape matches every other error.
        handler: (_req, _res, next) =>
            next(new ApiError(429, message, [], ErrorCodes.RATE_LIMITED)),
    });

const MINUTE = 60 * 1000;

/** Safety net for the whole API. */
export const globalLimiter = createRateLimiter({
    windowMs: 15 * MINUTE,
    limit: 300,
    message:
        "Too many requests from this IP, please try again after 15 minutes.",
});

/** Stops mass account creation. */
export const registerLimiter = createRateLimiter({
    windowMs: 60 * MINUTE,
    limit: 10,
    message:
        "Too many accounts created from this IP, please try again after an hour.",
});

/** Only FAILED logins count, so normal users are never blocked. Complements per-account lockout. */
export const loginLimiter = createRateLimiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    message:
        "Too many failed login attempts from this IP, please try again after 15 minutes.",
});

/** Forgot-password / resend-verification: prevents using the API to spam someone's inbox. */
export const emailLimiter = createRateLimiter({
    windowMs: 15 * MINUTE,
    limit: 5,
    message: "Too many email requests, please try again after 15 minutes.",
});

/** Reset / change password endpoints. */
export const passwordLimiter = createRateLimiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    message: "Too many password attempts, please try again after 15 minutes.",
});

/** Refresh endpoint is called automatically by clients, so the limit is more generous. */
export const refreshLimiter = createRateLimiter({
    windowMs: 15 * MINUTE,
    limit: 60,
    message: "Too many token refresh requests, please try again later.",
});

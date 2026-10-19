/** Roles available in the system. Add more here (e.g. MODERATOR) as your project grows. */
export const UserRolesEnum = Object.freeze({
    USER: "user",
    ADMIN: "admin",
});
export const AvailableUserRoles = Object.values(UserRolesEnum);

/** Lifetime of the one-time tokens that are emailed to users. */
export const TOKEN_TTL_MS = Object.freeze({
    EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
    PASSWORD_RESET: 15 * 60 * 1000, // 15 minutes
});

export const AUTH_COOKIE = Object.freeze({
    ACCESS: "accessToken",
    REFRESH: "refreshToken",
    // The refresh cookie is only sent to /auth routes -> it is exposed to far fewer requests.
    REFRESH_PATH: "/api/v1/auth",
});

/**
 * Machine readable error codes. Frontends should branch on `code`, never on
 * the human readable `message` (messages may be reworded at any time).
 */
export const ErrorCodes = Object.freeze({
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
    ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
    EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
    TOKEN_MISSING: "TOKEN_MISSING",
    TOKEN_INVALID: "TOKEN_INVALID",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",
    TOKEN_RECENTLY_ROTATED: "TOKEN_RECENTLY_ROTATED",
    SESSION_REVOKED: "SESSION_REVOKED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
    BAD_REQUEST: "BAD_REQUEST",
    INTERNAL_ERROR: "INTERNAL_ERROR",
});

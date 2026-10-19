import crypto from "node:crypto";

/** SHA-256 hex digest. Used to store tokens at rest (a DB leak must not leak usable tokens). */
export const sha256 = (value) =>
    crypto.createHash("sha256").update(value).digest("hex");

/**
 * Create a one-time token (email verification / password reset).
 *  - `unHashedToken` is sent to the user by email and never stored.
 *  - `hashedToken`   is what we store in the database.
 * 32 random bytes = 256 bits of entropy => infeasible to guess.
 */
export const generateTemporaryToken = (ttlMs) => {
    const unHashedToken = crypto.randomBytes(32).toString("hex");
    return {
        unHashedToken,
        hashedToken: sha256(unHashedToken),
        tokenExpiry: new Date(Date.now() + ttlMs),
    };
};

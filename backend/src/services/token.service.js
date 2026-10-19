import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ALGORITHM = "HS256";

/**
 * Access token  : short-lived (default 15m), sent on every request, proves "who you are".
 * Refresh token : long-lived (default 7d), only used to get a new access token.
 *
 * Both only carry `sub` (user id) and `sid` (session id). No role/email inside:
 * the role is always read fresh from the database, so a demoted admin loses
 * access immediately instead of when the token expires.
 */
export const signAccessToken = ({ userId, sessionId }) => {
    const token = jwt.sign(
        { sid: String(sessionId) },
        env.ACCESS_TOKEN_SECRET,
        {
            subject: String(userId),
            issuer: env.JWT_ISSUER,
            expiresIn: env.ACCESS_TOKEN_EXPIRY,
            algorithm: ALGORITHM,
        },
    );
    return { token, expiresAt: getExpiry(token) };
};

export const signRefreshToken = ({ userId, sessionId }) => {
    const token = jwt.sign(
        { sid: String(sessionId) },
        env.REFRESH_TOKEN_SECRET,
        {
            subject: String(userId),
            issuer: env.JWT_ISSUER,
            expiresIn: env.REFRESH_TOKEN_EXPIRY,
            algorithm: ALGORITHM,
            // Unique id: guarantees two refresh tokens issued within the same second are still different,
            // which rotation + reuse detection relies on.
            jwtid: crypto.randomUUID(),
        },
    );
    return { token, expiresAt: getExpiry(token) };
};

// Pinning `algorithms` prevents "alg: none" / algorithm-confusion attacks.
export const verifyAccessToken = (token) =>
    jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
        algorithms: [ALGORITHM],
        issuer: env.JWT_ISSUER,
    });

export const verifyRefreshToken = (token) =>
    jwt.verify(token, env.REFRESH_TOKEN_SECRET, {
        algorithms: [ALGORITHM],
        issuer: env.JWT_ISSUER,
    });

/** Reads the `exp` claim (seconds) and returns it as a Date. */
const getExpiry = (token) => new Date(jwt.decode(token).exp * 1000);

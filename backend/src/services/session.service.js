import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Session } from "../models/session.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { ErrorCodes } from "../utils/constants.js";
import { sha256 } from "../utils/crypto.js";
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} from "./token.service.js";

/** Extracts device info from the request so users can recognise their sessions. */
const getClientInfo = (req) => ({
    userAgent: (req.get("user-agent") || "unknown").slice(0, 512),
    ip: req.ip || "unknown",
});

/**
 * Creates a new session (= one login on one device) and returns the tokens.
 * Called by login.
 */
export const createSession = async (user, req) => {
    // Generate the id first, because the refresh token must contain the session id.
    const sessionId = new mongoose.Types.ObjectId();
    const refresh = signRefreshToken({ userId: user._id, sessionId });
    const access = signAccessToken({ userId: user._id, sessionId });

    await Session.create({
        _id: sessionId,
        user: user._id,
        refreshTokenHash: sha256(refresh.token),
        lastUsedAt: new Date(),
        expiresAt: refresh.expiresAt,
        ...getClientInfo(req),
    });

    await enforceSessionLimit(user._id);

    return {
        sessionId,
        accessToken: access.token,
        refreshToken: refresh.token,
        accessExpiresAt: access.expiresAt,
        refreshExpiresAt: refresh.expiresAt,
    };
};

/** Keeps at most MAX_SESSIONS_PER_USER sessions per user by evicting the least recently used ones. */
const enforceSessionLimit = async (userId) => {
    const surplus = await Session.find({ user: userId })
        .sort({ lastUsedAt: -1 })
        .skip(env.MAX_SESSIONS_PER_USER)
        .select("_id")
        .lean();
    if (surplus.length > 0) {
        await Session.deleteMany({ _id: { $in: surplus.map((s) => s._id) } });
    }
};

/**
 * REFRESH TOKEN ROTATION with REUSE DETECTION.
 *
 * Every refresh call swaps the refresh token for a brand-new one and the old one
 * becomes invalid. If an OLD token is presented again, either the legitimate
 * user or an attacker is replaying a stolen token. We cannot know which, so the
 * whole session is revoked and the user must log in again.
 *
 * Exception (grace window): if the old token was rotated only a few seconds ago, the
 * most likely cause is the same client sending two refresh requests at once (two tabs,
 * a retry). That request gets a retryable 409 and the session is left alone.
 *
 * The swap is a single atomic findOneAndUpdate (filter includes the old token's
 * hash), so two concurrent requests cannot both succeed with the same token.
 */
export const rotateSession = async (incomingRefreshToken, req) => {
    let payload;
    try {
        payload = verifyRefreshToken(incomingRefreshToken);
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new ApiError(
                401,
                "Refresh token expired. Please log in again.",
                [],
                ErrorCodes.TOKEN_EXPIRED,
            );
        }
        throw new ApiError(
            401,
            "Invalid refresh token. Please log in again.",
            [],
            ErrorCodes.TOKEN_INVALID,
        );
    }

    const now = new Date();
    const incomingHash = sha256(incomingRefreshToken);
    const next = signRefreshToken({
        userId: payload.sub,
        sessionId: payload.sid,
    });

    const session = await Session.findOneAndUpdate(
        { _id: payload.sid, user: payload.sub, refreshTokenHash: incomingHash },
        {
            $set: {
                refreshTokenHash: sha256(next.token),
                previousRefreshTokenHash: incomingHash,
                rotatedAt: now,
                lastUsedAt: now,
                expiresAt: next.expiresAt,
                ...getClientInfo(req),
            },
        },
        { returnDocument: "after" },
    );

    if (!session) {
        // The token is cryptographically valid but is not the current one for this session.
        const existing = await Session.findOne({
            _id: payload.sid,
            user: payload.sub,
        }).select("+previousRefreshTokenHash");
        if (!existing) {
            throw new ApiError(
                401,
                "This session is no longer valid. Please log in again.",
                [],
                ErrorCodes.SESSION_REVOKED,
            );
        }

        const rotatedRecently =
            existing.previousRefreshTokenHash === incomingHash &&
            existing.rotatedAt &&
            now - existing.rotatedAt < env.REFRESH_REUSE_GRACE_SECONDS * 1000;
        if (rotatedRecently) {
            throw new ApiError(
                409,
                "This refresh token was just rotated by another request. Retry using the latest token.",
                [],
                ErrorCodes.TOKEN_RECENTLY_ROTATED,
            );
        }

        await Session.deleteOne({ _id: existing._id });
        console.warn(
            `[security] Refresh token reuse detected. Session ${payload.sid} (user ${payload.sub}) revoked.`,
        );
        throw new ApiError(
            401,
            "Refresh token reuse detected. This session was revoked for your safety, please log in again.",
            [],
            ErrorCodes.TOKEN_REUSE_DETECTED,
        );
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
        await Session.deleteOne({ _id: session._id });
        throw new ApiError(
            401,
            "Account is unavailable. Please contact support.",
            [],
            ErrorCodes.ACCOUNT_DISABLED,
        );
    }

    const access = signAccessToken({
        userId: user._id,
        sessionId: session._id,
    });
    return {
        user,
        sessionId: session._id,
        accessToken: access.token,
        refreshToken: next.token,
        accessExpiresAt: access.expiresAt,
        refreshExpiresAt: next.expiresAt,
    };
};

/** Logs out ONE device. */
export const revokeSession = (sessionId) =>
    Session.deleteOne({ _id: sessionId });

/**
 * Logs out EVERY device of a user. Pass `exceptSessionId` to keep the current
 * device signed in (used after a password change).
 * @returns {Promise<number>} number of sessions revoked
 */
export const revokeAllSessions = async (userId, { exceptSessionId } = {}) => {
    const filter = { user: userId };
    if (exceptSessionId) filter._id = { $ne: exceptSessionId };
    const { deletedCount } = await Session.deleteMany(filter);
    return deletedCount;
};

import jwt from "jsonwebtoken";
import { Session } from "../models/session.models.js";
import { verifyAccessToken } from "../services/token.service.js";
import { ApiError } from "../utils/api-error.js";
import { AUTH_COOKIE, ErrorCodes } from "../utils/constants.js";
import { asyncHandler } from "../utils/async-handler.js";
     
/** Token can come from the Authorization header (mobile / Postman) or the httpOnly cookie (browsers). */
const extractAccessToken = (req) => {
    const header = req.header("Authorization");
    if (header?.startsWith("Bearer ")) return header.slice(7).trim();
    return req.cookies?.[AUTH_COOKIE.ACCESS];
};

/**
 * Protects a route. After it runs successfully:
 *   req.user      -> the authenticated user document (without secrets)
 *   req.sessionId -> id of the session (device) making the request
 *
 * Besides checking the JWT signature we also check that the SESSION STILL EXISTS.
 * That is what makes "logout" and "logout from all devices" take effect
 * immediately, instead of the stolen access token staying valid until it expires.
 */
export const verifyJWT = asyncHandler(async (req, _res, next) => {
    const token = extractAccessToken(req);
    if (!token) {
        throw new ApiError(
            401,
            "Authentication required. Please log in.",
            [],
            ErrorCodes.TOKEN_MISSING,
        );
    }

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new ApiError(
                401,
                "Access token expired. Please refresh your session.",
                [],
                ErrorCodes.TOKEN_EXPIRED,
            );
        }
        throw new ApiError(
            401,
            "Invalid access token.",
            [],
            ErrorCodes.TOKEN_INVALID,
        );
    }

    const session = await Session.findById(payload.sid).populate("user");
    const sessionIsValid =
        session &&
        session.expiresAt > new Date() &&
        session.user &&
        String(session.user._id) === payload.sub;
    if (!sessionIsValid) {
        throw new ApiError(
            401,
            "Session is no longer valid. Please log in again.",
            [],
            ErrorCodes.SESSION_REVOKED,
        );
    }
    if (!session.user.isActive) {
        throw new ApiError(
            403,
            "Your account has been deactivated.",
            [],
            ErrorCodes.ACCOUNT_DISABLED,
        );
    }

    req.user = session.user;
    req.sessionId = session._id;
    next();
});

/**
 * Role-based access control. Use AFTER verifyJWT.
 * @example router.get("/admin/users", verifyJWT, authorizeRoles(UserRolesEnum.ADMIN), handler)
 */
export const authorizeRoles =
    (...allowedRoles) =>
    (req, _res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            throw new ApiError(
                403,
                "You do not have permission to perform this action.",
                [],
                ErrorCodes.FORBIDDEN,
            );
        }
        next();
    };

/** Use AFTER verifyJWT on routes that must only be available to users with a verified email. */
export const requireVerifiedEmail = (req, _res, next) => {
    if (!req.user?.isEmailVerified) {
        throw new ApiError(
            403,
            "Please verify your email address to use this feature.",
            [],
            ErrorCodes.EMAIL_NOT_VERIFIED,
        );
    }
    next();
};

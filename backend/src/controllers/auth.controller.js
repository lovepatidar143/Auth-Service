import { env } from "../config/env.js";
import { Session } from "../models/session.models.js";
import { User } from "../models/user.models.js";
import {
    createSession,
    revokeAllSessions,
    revokeSession,
    rotateSession,
} from "../services/session.service.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AUTH_COOKIE, ErrorCodes } from "../utils/constants.js";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies.js";
import { sha256 } from "../utils/crypto.js";
import {
    emailVerificationMailgenContent,
    forgotPasswordMailgenContent,
    passwordChangedMailgenContent,
    sendMail,
} from "../utils/mail.js";
import { fakePasswordCompare } from "../utils/password.js";

/** Same message for "no such user" and "wrong password" -> attackers cannot discover which emails exist. */
const invalidCredentials = () =>
    new ApiError(
        401,
        "Invalid email/username or password",
        [],
        ErrorCodes.INVALID_CREDENTIALS,
    );

const buildVerificationUrl = (rawToken) =>
    `${env.APP_BASE_URL}/api/v1/auth/verify-email/${rawToken}`;

// ---------------------------------------------------------------------------
// Registration & email verification
// ---------------------------------------------------------------------------

export const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password, fullName } = req.body;

    const existingUser = await User.findOne({
        $or: [{ username }, { email }],
    }).select("username email");
    if (existingUser) {
        const field = existingUser.email === email ? "email" : "username";
        throw new ApiError(
            409,
            `A user with this ${field} already exists`,
            [{ field, message: "already in use" }],
            ErrorCodes.CONFLICT,
        );
    }

    // `role` is deliberately NOT read from the body: otherwise anyone could register as an admin (mass assignment).
    const user = new User({ username, email, password, fullName });
    const rawToken = user.setEmailVerificationToken();
    await user.save(); // password is hashed by the pre-save hook

    await sendMail({
        email: user.email,
        subject: "Please verify your email",
        mailgenContent: emailVerificationMailgenContent(
            user.username,
            buildVerificationUrl(rawToken),
        ),
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { user },
                "Registration successful. Please check your email to verify your account.",
            ),
        );
});

export const verifyEmail = asyncHandler(async (req, res) => {
    const { verificationToken } = req.params;

    // We only stored the hash, so hash what the user sent and compare.
    const user = await User.findOne({
        emailVerificationToken: sha256(verificationToken),
        emailVerificationExpiry: { $gt: new Date() },
    });
    if (!user) {
        throw new ApiError(
            400,
            "Verification link is invalid or has expired",
            [],
            ErrorCodes.TOKEN_INVALID,
        );
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined; // single use
    user.emailVerificationExpiry = undefined;
    await user.save();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isEmailVerified: true },
                "Email verified successfully. You can now log in.",
            ),
        );
});

export const resendEmailVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user && !user.isEmailVerified && user.isActive) {
        const rawToken = user.setEmailVerificationToken();
        await user.save();
        // Not awaited on purpose: response time must be the same whether or not the account exists.
        void sendMail({
            email: user.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                buildVerificationUrl(rawToken),
            ),
        });
    }

    // Always the same answer (no user enumeration).
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "If an unverified account exists for this email, a new verification link has been sent.",
            ),
        );
});

// ---------------------------------------------------------------------------
// Login / logout / token refresh
// ---------------------------------------------------------------------------

export const login = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    const user = await User.findOne(
        email ? { email } : { username: username.toLowerCase() },
    ).select("+password");

    if (!user) {
        await fakePasswordCompare(password); // keep response time similar to the "wrong password" path
        throw invalidCredentials();
    }

    if (user.isLocked) {
        const minutesLeft = Math.ceil(
            (user.lockUntil.getTime() - Date.now()) / 60000,
        );
        throw new ApiError(
            423,
            `Account temporarily locked because of too many failed login attempts. Try again in ${minutesLeft} minute(s).`,
            [],
            ErrorCodes.ACCOUNT_LOCKED,
        );
    }

    if (!(await user.isPasswordCorrect(password))) {
        const justLocked = await user.registerFailedLogin();
        if (justLocked) {
            throw new ApiError(
                423,
                `Too many failed login attempts. Account locked for ${env.LOCK_TIME_MINUTES} minutes.`,
                [],
                ErrorCodes.ACCOUNT_LOCKED,
            );
        }
        throw invalidCredentials();
    }

    // These checks come AFTER the password check, so only the real owner learns the account state.
    if (!user.isActive) {
        throw new ApiError(
            403,
            "Your account has been deactivated. Please contact support.",
            [],
            ErrorCodes.ACCOUNT_DISABLED,
        );
    }
    if (env.REQUIRE_EMAIL_VERIFICATION && !user.isEmailVerified) {
        throw new ApiError(
            403,
            "Please verify your email before logging in.",
            [],
            ErrorCodes.EMAIL_NOT_VERIFIED,
        );
    }

    await user.registerSuccessfulLogin();
    const tokens = await createSession(user, req);
    setAuthCookies(res, tokens);

    // Tokens are also returned in the body for non-browser clients (mobile apps, Postman).
    // Browser apps should rely on the httpOnly cookies and ignore these fields.
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    user,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                },
                "Logged in successfully",
            ),
        );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.[AUTH_COOKIE.REFRESH] || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(
            401,
            "Refresh token is missing. Please log in again.",
            [],
            ErrorCodes.TOKEN_MISSING,
        );
    }

    try {
        const tokens = await rotateSession(incomingRefreshToken, req);
        setAuthCookies(res, tokens);
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                    },
                    "Access token refreshed",
                ),
            );
    } catch (error) {
        // A refresh token that cannot be used any more must not stay in the browser.
        // (Not for the retryable 409: the other request already stored the fresh cookie.)
        if (error instanceof ApiError && error.statusCode !== 409)
            clearAuthCookies(res);
        throw error;
    }
});

/** Logs out the CURRENT device only. */
export const logoutUser = asyncHandler(async (req, res) => {
    await revokeSession(req.sessionId);
    clearAuthCookies(res);
    return res
        .status(200)
        .json(new ApiResponse(200, null, "Logged out successfully"));
});

/** Logs out ALL devices. With { "keepCurrent": true } the current device stays signed in. */
export const logoutAllDevices = asyncHandler(async (req, res) => {
    const keepCurrent = req.body.keepCurrent === true;
    const revokedSessions = await revokeAllSessions(req.user._id, {
        exceptSessionId: keepCurrent ? req.sessionId : undefined,
    });
    if (!keepCurrent) clearAuthCookies(res);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { revokedSessions },
                keepCurrent
                    ? "Logged out from all other devices"
                    : "Logged out from all devices",
            ),
        );
});

// ---------------------------------------------------------------------------
// Password management
// ---------------------------------------------------------------------------

export const forgotPasswordRequest = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user && user.isActive) {
        const rawToken = user.setPasswordResetToken();
        await user.save();
        void sendMail({
            email: user.email,
            subject: "Reset your password",
            mailgenContent: forgotPasswordMailgenContent(
                user.username,
                `${env.FORGOT_PASSWORD_REDIRECT_URL}/${rawToken}`,
            ),
        });
    }

    // Identical response whether or not the email exists (no user enumeration).
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "If an account exists for this email, a password reset link has been sent.",
            ),
        );
});

export const resetForgotPassword = asyncHandler(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({
        passwordResetToken: sha256(resetToken),
        passwordResetExpiry: { $gt: new Date() },
    });
    if (!user) {
        throw new ApiError(
            400,
            "Password reset link is invalid or has expired",
            [],
            ErrorCodes.TOKEN_INVALID,
        );
    }

    user.password = newPassword; // hashed by the pre-save hook
    user.passwordResetToken = undefined; // single use
    user.passwordResetExpiry = undefined;
    user.failedLoginAttempts = 0; // a reset also unlocks the account
    user.lockUntil = undefined;
    await user.save();

    // If the password was compromised, every existing session must die.
    await revokeAllSessions(user._id);

    void sendMail({
        email: user.email,
        subject: "Your password was changed",
        mailgenContent: passwordChangedMailgenContent(user.username),
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "Password reset successful. Please log in with your new password.",
            ),
        );
});

export const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.isPasswordCorrect(currentPassword))) {
        throw new ApiError(
            401,
            "Current password is incorrect",
            [],
            ErrorCodes.INVALID_CREDENTIALS,
        );
    }

    user.password = newPassword;
    await user.save();

    // Sign out every OTHER device; the device that made the change stays logged in.
    const revokedSessions = await revokeAllSessions(user._id, {
        exceptSessionId: req.sessionId,
    });

    void sendMail({
        email: user.email,
        subject: "Your password was changed",
        mailgenContent: passwordChangedMailgenContent(user.username),
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { revokedSessions },
                "Password changed successfully. Other devices were logged out.",
            ),
        );
});

// ---------------------------------------------------------------------------
// Session (device) management
// ---------------------------------------------------------------------------

export const getActiveSessions = asyncHandler(async (req, res) => {
    const sessions = await Session.find({
        user: req.user._id,
        expiresAt: { $gt: new Date() },
    })
        .sort({ lastUsedAt: -1 })
        .lean();

    const data = sessions.map((s) => ({
        id: s._id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
        isCurrent: String(s._id) === String(req.sessionId),
    }));

    return res
        .status(200)
        .json(
            new ApiResponse(200, { sessions: data }, "Active sessions fetched"),
        );
});

export const revokeSessionById = asyncHandler(async (req, res) => {
    // Filtering by `user` guarantees a user can only revoke THEIR OWN sessions.
    const session = await Session.findOneAndDelete({
        _id: req.params.sessionId,
        user: req.user._id,
    });
    if (!session) {
        throw new ApiError(404, "Session not found", [], ErrorCodes.NOT_FOUND);
    }

    const wasCurrent = String(session._id) === String(req.sessionId);
    if (wasCurrent) clearAuthCookies(res);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { loggedOutCurrentDevice: wasCurrent },
                "Session revoked",
            ),
        );
});

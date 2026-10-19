import { Router } from "express";
import {
    changeCurrentPassword,
    forgotPasswordRequest,
    getActiveSessions,
    login,
    logoutAllDevices,
    logoutUser,
    refreshAccessToken,
    registerUser,
    resendEmailVerification,
    resetForgotPassword,
    revokeSessionById,
    verifyEmail,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    emailLimiter,
    loginLimiter,
    passwordLimiter,
    refreshLimiter,
    registerLimiter,
} from "../middlewares/rate-limit.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import {
    changePasswordValidator,
    forgotPasswordValidator,
    loginValidator,
    logoutAllValidator,
    refreshTokenValidator,
    registerValidator,
    resendVerificationValidator,
    resetPasswordValidator,
    sessionIdValidator,
    verifyEmailValidator,
} from "../validators/auth.validators.js";

const router = Router();

// Per route the order is always: rate limiter -> validation rules -> validate() -> (auth) -> controller

// ----- Public routes -----
router.post(
    "/register",
    registerLimiter,
    registerValidator,
    validate,
    registerUser,
);
router.post("/login", loginLimiter, loginValidator, validate, login);
router.post(
    "/refresh-token",
    refreshLimiter,
    refreshTokenValidator,
    validate,
    refreshAccessToken,
);
router.get(
    "/verify-email/:verificationToken",
    verifyEmailValidator,
    validate,
    verifyEmail,
);
router.post(
    "/resend-email-verification",
    emailLimiter,
    resendVerificationValidator,
    validate,
    resendEmailVerification,
);
router.post(
    "/forgot-password",
    emailLimiter,
    forgotPasswordValidator,
    validate,
    forgotPasswordRequest,
);
router.post(
    "/reset-password/:resetToken",
    passwordLimiter,
    resetPasswordValidator,
    validate,
    resetForgotPassword,
);

// ----- Protected routes (valid access token required) -----
router.post("/logout", verifyJWT, logoutUser);
router.post(
    "/logout-all",
    verifyJWT,
    logoutAllValidator,
    validate,
    logoutAllDevices,
);
router.post(
    "/change-password",
    verifyJWT,
    passwordLimiter,
    changePasswordValidator,
    validate,
    changeCurrentPassword,
);
router.get("/sessions", verifyJWT, getActiveSessions);
router.delete(
    "/sessions/:sessionId",
    verifyJWT,
    sessionIdValidator,
    validate,
    revokeSessionById,
);

export default router;

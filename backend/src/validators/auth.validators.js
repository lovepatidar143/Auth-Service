import { body } from "express-validator";
import {
    emailRule,
    fullNameRule,
    strongPassword,
    tokenParam,
    usernameRule,
    mongoIdParam,
} from "./common.validators.js";

export const registerValidator = [
    emailRule(),
    usernameRule(),
    strongPassword("password"),
    fullNameRule(),
];

export const loginValidator = [
    // Either email or username must be provided.
    body("email").custom((value, { req }) => {
        if (!value && !req.body.username)
            throw new Error("Email or username is required");
        return true;
    }),
    body("email")
        .if(body("email").exists())
        .isString()
        .withMessage("Email must be a string")
        .bail()
        .trim()
        .isEmail()
        .withMessage("Please provide a valid email address")
        .customSanitizer((value) => value.toLowerCase()),
    body("username")
        .if(body("username").exists())
        .isString()
        .withMessage("Username must be a string")
        .bail()
        .trim()
        .notEmpty()
        .withMessage("Username cannot be empty"),
    // No password-strength check on login: users with older/weaker passwords must still be able to log in.
    body("password")
        .isString()
        .withMessage("Password is required")
        .bail()
        .notEmpty()
        .withMessage("Password is required"),
];

export const refreshTokenValidator = [
    body("refreshToken")
        .optional()
        .isString()
        .withMessage("refreshToken must be a string"),
];

export const resendVerificationValidator = [emailRule()];
export const forgotPasswordValidator = [emailRule()];
export const verifyEmailValidator = [tokenParam("verificationToken")];

export const resetPasswordValidator = [
    tokenParam("resetToken"),
    strongPassword("newPassword", "New password"),
];

export const changePasswordValidator = [
    body("currentPassword")
        .isString()
        .withMessage("Current password is required")
        .bail()
        .notEmpty()
        .withMessage("Current password is required"),
    strongPassword("newPassword", "New password")
        .bail()
        .custom((value, { req }) => value !== req.body.currentPassword)
        .withMessage(
            "New password must be different from the current password",
        ),
];

export const logoutAllValidator = [
    body("keepCurrent")
        .optional()
        .isBoolean({ strict: true })
        .withMessage("keepCurrent must be true or false"),
];

export const sessionIdValidator = [mongoIdParam("sessionId")];

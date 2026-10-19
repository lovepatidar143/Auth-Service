import { body, param } from "express-validator";

/**
 * Password policy: 8-64 chars with a lowercase letter, an uppercase letter and a digit.
 * Max 64 because bcrypt only uses the first 72 bytes - longer inputs give a false sense of security.
 * NOTE: passwords are intentionally NOT trimmed; spaces may be part of the password.
 */
export const strongPassword = (field = "password", label = "Password") =>
    body(field)
        .isString()
        .withMessage(`${label} is required`)
        .bail()
        .isLength({ min: 8, max: 64 })
        .withMessage(`${label} must be between 8 and 64 characters long`)
        .bail()
        .matches(/[a-z]/)
        .withMessage(`${label} must contain at least one lowercase letter`)
        .bail()
        .matches(/[A-Z]/)
        .withMessage(`${label} must contain at least one uppercase letter`)
        .bail()
        .matches(/\d/)
        .withMessage(`${label} must contain at least one number`);

export const emailRule = (field = "email") =>
    body(field)
        .isString()
        .withMessage("Email is required")
        .bail()
        .trim()
        .isEmail()
        .withMessage("Please provide a valid email address")
        .bail()
        .isLength({ max: 254 })
        .withMessage("Email is too long")
        .customSanitizer((value) => value.toLowerCase());

export const usernameRule = (field = "username") =>
    body(field)
        .isString()
        .withMessage("Username is required")
        .bail()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage("Username must be between 3 and 30 characters long")
        .bail()
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage(
            "Username can only contain letters, numbers and underscores",
        )
        .customSanitizer((value) => value.toLowerCase());

export const fullNameRule = (field = "fullName") =>
    body(field)
        .optional()
        .isString()
        .withMessage("Full name must be a string")
        .bail()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Full name can be at most 100 characters long");

/** One-time tokens are 32 random bytes => 64 hex characters. Rejecting anything else avoids pointless DB queries. */
export const tokenParam = (field = "token") =>
    param(field)
        .isString()
        .isHexadecimal()
        .isLength({ min: 64, max: 64 })
        .withMessage("Token is malformed");

export const mongoIdParam = (field) =>
    param(field).isMongoId().withMessage(`${field} is not a valid id`);

import { body } from "express-validator";
import { fullNameRule, usernameRule } from "./common.validators.js";

export const updateProfileValidator = [
    fullNameRule(),
    usernameRule().optional(),
    body("avatarUrl")
        .optional()
        .isString()
        .bail()
        .isURL({ protocols: ["http", "https"], require_protocol: true })
        .withMessage("avatarUrl must be a valid http(s) URL"),
    body().custom((value) => {
        if (
            !value ||
            !["fullName", "username", "avatarUrl"].some((key) => key in value)
        ) {
            throw new Error(
                "Provide at least one field to update: fullName, username or avatarUrl",
            );
        }
        return true;
    }),
];

export const deleteAccountValidator = [
    body("password")
        .isString()
        .withMessage("Password is required to delete your account")
        .bail()
        .notEmpty()
        .withMessage("Password is required to delete your account"),
];

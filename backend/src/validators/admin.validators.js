import { body, query } from "express-validator";
import { AvailableUserRoles } from "../utils/constants.js";
import { mongoIdParam } from "./common.validators.js";

// NOTE: no sanitizers on `query` - in Express 5 `req.query` is read-only, so values are parsed in the controller.
export const listUsersValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("limit must be between 1 and 100"),
    query("search")
        .optional()
        .isString()
        .withMessage("search must be a string")
        .bail()
        .isLength({ max: 50 })
        .withMessage("search can be at most 50 characters"),
    query("role")
        .optional()
        .isIn(AvailableUserRoles)
        .withMessage(`role must be one of: ${AvailableUserRoles.join(", ")}`),
];

export const updateRoleValidator = [
    mongoIdParam("userId"),
    body("role")
        .isIn(AvailableUserRoles)
        .withMessage(`role must be one of: ${AvailableUserRoles.join(", ")}`),
];

export const updateStatusValidator = [
    mongoIdParam("userId"),
    body("isActive")
        .isBoolean({ strict: true })
        .withMessage("isActive must be true or false"),
];

import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-error.js";
import { ErrorCodes } from "../utils/constants.js";

/**
 * Runs after the express-validator rule arrays. If any rule failed, responds with
 * 422 and ONE message per field. Only the message is returned, never the submitted
 * value, so passwords can't end up in responses or logs.
 */
export const validate = (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result.array({ onlyFirstError: true }).map((e) => ({
        field: e.path,
        message: e.msg,
    }));
    throw new ApiError(
        422,
        "Validation failed",
        errors,
        ErrorCodes.VALIDATION_ERROR,
    );
};

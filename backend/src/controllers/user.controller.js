import { User } from "../models/user.models.js";
import { revokeAllSessions } from "../services/session.service.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ErrorCodes } from "../utils/constants.js";
import { clearAuthCookies } from "../utils/cookies.js";

export const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, { user: req.user }, "Current user fetched"));
});

/** Only whitelisted fields are copied from the body, so nobody can sneak in `role`, `isActive`, etc. */
export const updateProfile = asyncHandler(async (req, res) => {
    const { fullName, username, avatarUrl } = req.body;

    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (username !== undefined) updates.username = username;
    if (avatarUrl !== undefined) updates["avatar.url"] = avatarUrl;

    // Friendly pre-check for a clear error message. The unique index remains the real guarantee:
    // if two requests race past this check, the loser gets a 409 from the global error handler.
    if (username !== undefined) {
        const taken = await User.exists({
            username,
            _id: { $ne: req.user._id },
        });
        if (taken) {
            throw new ApiError(
                409,
                "This username is already taken",
                [{ field: "username", message: "already in use" }],
                ErrorCodes.CONFLICT,
            );
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { returnDocument: "after", runValidators: true },
    );

    return res
        .status(200)
        .json(new ApiResponse(200, { user }, "Profile updated successfully"));
});

/** Permanently deletes the account after re-confirming the password. */
export const deleteAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.isPasswordCorrect(req.body.password))) {
        throw new ApiError(
            401,
            "Incorrect password. Account was not deleted.",
            [],
            ErrorCodes.INVALID_CREDENTIALS,
        );
    }

    await revokeAllSessions(user._id);
    await User.deleteOne({ _id: user._id });
    clearAuthCookies(res);

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Your account has been deleted"));
});

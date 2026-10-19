import { User } from "../models/user.models.js";
import { revokeAllSessions } from "../services/session.service.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ErrorCodes } from "../utils/constants.js";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /admin/users?page=1&limit=10&search=love&role=user */
export const listUsers = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const { search, role } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
        // Escape user input so it cannot be abused as a regex (ReDoS / wildcard injection).
        const pattern = new RegExp(escapeRegex(search), "i");
        filter.$or = [
            { username: pattern },
            { email: pattern },
            { fullName: pattern },
        ];
    }

    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        User.countDocuments(filter),
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    users,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
                "Users fetched successfully",
            ),
        );
});

export const updateUserRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (String(userId) === String(req.user._id)) {
        throw new ApiError(
            400,
            "You cannot change your own role",
            [],
            ErrorCodes.BAD_REQUEST,
        );
    }

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: { role: req.body.role } },
        { returnDocument: "after", runValidators: true },
    );
    if (!user)
        throw new ApiError(404, "User not found", [], ErrorCodes.NOT_FOUND);

    // No token refresh needed: the role is read from the database on every request.
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user },
                `User role updated to "${user.role}"`,
            ),
        );
});

export const updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body;
    if (String(userId) === String(req.user._id)) {
        throw new ApiError(
            400,
            "You cannot change your own account status",
            [],
            ErrorCodes.BAD_REQUEST,
        );
    }

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: { isActive } },
        { returnDocument: "after" },
    );
    if (!user)
        throw new ApiError(404, "User not found", [], ErrorCodes.NOT_FOUND);

    // Deactivating must kick the user out of every device immediately.
    if (!isActive) await revokeAllSessions(user._id);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user },
                isActive
                    ? "User activated"
                    : "User deactivated and logged out everywhere",
            ),
        );
});

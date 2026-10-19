import mongoose, { Schema } from "mongoose";

/**
 * One document = one logged-in DEVICE / browser.
 *
 * Storing sessions server-side (instead of a single `refreshToken` string on
 * the user) is what makes these features possible:
 *   - log in on many devices at once
 *   - "log out from all devices" / "log out other devices"
 *   - list active sessions and revoke any single one
 *   - refresh-token rotation with reuse detection
 */
const sessionSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // sha256 of the CURRENT refresh token. The raw token is never stored.
        refreshTokenHash: { type: String, required: true, select: false },
        // Hash of the token that was valid BEFORE the last rotation + when that happened.
        // Lets us tell "two tabs refreshed at the same time" apart from "a stolen old token is being replayed".
        previousRefreshTokenHash: { type: String, select: false },
        rotatedAt: { type: Date },
        userAgent: { type: String, default: "unknown", maxlength: 512 },
        ip: { type: String, default: "unknown" },
        lastUsedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true },
);

// MongoDB's TTL monitor automatically deletes expired sessions (runs about once a minute).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model("Session", sessionSchema);

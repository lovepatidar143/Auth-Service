import mongoose, { Schema } from "mongoose";
import { env } from "../config/env.js";
import {
    AvailableUserRoles,
    TOKEN_TTL_MS,
    UserRolesEnum,
} from "../utils/constants.js";
import { generateTemporaryToken } from "../utils/crypto.js";
import { comparePassword, hashPassword } from "../utils/password.js";

const userSchema = new Schema(
    {
        // Reserved for the future avatar-upload feature (e.g. multer + Cloudinary).
        avatar: {
            url: { type: String, default: "" },
            localpath: { type: String, default: "" },
        },
        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true, // `unique` already creates the index
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 30,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            trim: true,
            lowercase: true,
            maxlength: 254,
        },
        fullName: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        // `select: false` => the hash is NEVER returned unless explicitly requested with .select("+password")
        password: {
            type: String,
            required: [true, "Password is required"],
            select: false,
        },
        role: {
            type: String,
            enum: AvailableUserRoles,
            default: UserRolesEnum.USER,
        },
        isEmailVerified: { type: Boolean, default: false },
        // Admins can deactivate an account; deactivated users cannot log in or use existing tokens.
        isActive: { type: Boolean, default: true },

        // --- Brute-force protection ---
        failedLoginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date },

        lastLoginAt: { type: Date },
        passwordChangedAt: { type: Date },

        // One-time tokens are stored HASHED (sha256). The raw token only ever exists in the email.
        emailVerificationToken: { type: String, select: false },
        emailVerificationExpiry: { type: Date, select: false },
        passwordResetToken: { type: String, select: false },
        passwordResetExpiry: { type: Date, select: false },
    },
    {
        timestamps: true,
        toJSON: {
            // Defence in depth: even if a sensitive field is loaded by mistake, it is stripped from JSON output.
            transform(_doc, ret) {
                delete ret.password;
                delete ret.emailVerificationToken;
                delete ret.emailVerificationExpiry;
                delete ret.passwordResetToken;
                delete ret.passwordResetExpiry;
                delete ret.failedLoginAttempts;
                delete ret.lockUntil;
                delete ret.__v;
                return ret;
            },
        },
    },
);

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Hash the password whenever it is set or changed (never on unrelated saves). */
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await hashPassword(this.password);
    if (!this.isNew) this.passwordChangedAt = new Date();
});

// ---------------------------------------------------------------------------
// Virtuals & instance methods
// ---------------------------------------------------------------------------

/** True while the account is temporarily locked after too many failed logins. */
userSchema.virtual("isLocked").get(function () {
    return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

/** Compare a plain password with the stored hash. The document must be loaded with `+password`. */
userSchema.methods.isPasswordCorrect = function (password) {
    return comparePassword(password, this.password);
};

/** Generates an email-verification token, stores its hash on the document and returns the raw token. */
userSchema.methods.setEmailVerificationToken = function () {
    const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken(
        TOKEN_TTL_MS.EMAIL_VERIFICATION,
    );
    this.emailVerificationToken = hashedToken;
    this.emailVerificationExpiry = tokenExpiry;
    return unHashedToken;
};

/** Generates a password-reset token, stores its hash on the document and returns the raw token. */
userSchema.methods.setPasswordResetToken = function () {
    const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken(
        TOKEN_TTL_MS.PASSWORD_RESET,
    );
    this.passwordResetToken = hashedToken;
    this.passwordResetExpiry = tokenExpiry;
    return unHashedToken;
};

/**
 * Records a failed login. Uses an atomic $inc so two parallel wrong-password
 * requests cannot both read the same counter value and under-count attempts.
 * @returns {Promise<boolean>} true if this failure caused the account to be locked
 */
userSchema.methods.registerFailedLogin = async function () {
    const User = this.constructor;
    const updated = await User.findByIdAndUpdate(
        this._id,
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: "after" },
    ).select("failedLoginAttempts");

    if (updated && updated.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
        await User.updateOne(
            { _id: this._id },
            {
                $set: {
                    lockUntil: new Date(
                        Date.now() + env.LOCK_TIME_MINUTES * 60 * 1000,
                    ),
                    failedLoginAttempts: 0,
                },
            },
        );
        return true;
    }
    return false;
};

/** Clears the failed-attempt counter / lock after a successful login. */
userSchema.methods.registerSuccessfulLogin = async function () {
    await this.constructor.updateOne(
        { _id: this._id },
        {
            $set: { failedLoginAttempts: 0, lastLoginAt: new Date() },
            $unset: { lockUntil: 1 },
        },
    );
};

export const User = mongoose.model("User", userSchema);

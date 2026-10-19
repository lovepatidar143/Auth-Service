/**
 * Centralised, validated environment configuration.
 *
 * Why this file exists:
 *  - `process.env` values are always strings and may be missing. Reading them
 *    all in ONE place means the rest of the app gets typed, trusted values.
 *  - The server FAILS FAST on startup with a clear message instead of crashing
 *    later (e.g. "jwt secret must be provided" on the first login request).
 *  - dotenv is loaded here, so any module importing `env` is guaranteed that
 *    the .env file has already been read (ES module imports are hoisted, so
 *    calling dotenv.config() inside index.js would run too late).
 */
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const errors = [];

/** Read a string variable. Missing + no fallback => recorded as an error. */
const str = (name, fallback) => {
    const value = process.env[name]?.trim();
    if (value) return value;
    if (fallback !== undefined) return fallback;
    errors.push(`${name} is required`);
    return "";
};

/** Read a numeric variable. */
const num = (name, fallback) => {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        errors.push(`${name} must be a number (received "${raw}")`);
        return fallback;
    }
    return value;
};

/** Read a boolean variable ("true" / "1" / "yes" => true). */
const bool = (name, fallback) => {
    const raw = process.env[name]?.trim().toLowerCase();
    if (!raw) return fallback;
    return ["true", "1", "yes"].includes(raw);
};

const NODE_ENV = str("NODE_ENV", "development");
const isProd = NODE_ENV === "production";
const isTest = NODE_ENV === "test";
const PORT = num("PORT", 8080);
const APP_NAME = str("APP_NAME", "Auth Service");

const ACCESS_TOKEN_SECRET = str("ACCESS_TOKEN_SECRET");
const REFRESH_TOKEN_SECRET = str("REFRESH_TOKEN_SECRET");

// Secrets must be long and different, otherwise a leaked/guessed access
// secret would also let an attacker forge refresh tokens.
for (const [name, secret] of [
    ["ACCESS_TOKEN_SECRET", ACCESS_TOKEN_SECRET],
    ["REFRESH_TOKEN_SECRET", REFRESH_TOKEN_SECRET],
]) {
    if (secret && secret.length < 32) {
        errors.push(`${name} must be at least 32 characters long`);
    }
}
if (ACCESS_TOKEN_SECRET && ACCESS_TOKEN_SECRET === REFRESH_TOKEN_SECRET) {
    errors.push(
        "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different",
    );
}

// CORS_ORIGIN is a comma separated allow-list: "http://localhost:5173,https://app.example.com"
const CORS_ORIGINS = str("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
if (CORS_ORIGINS.includes("*")) {
    // Browsers reject `Access-Control-Allow-Origin: *` together with cookies.
    errors.push(
        'CORS_ORIGIN cannot be "*" because cookies (credentials) are enabled. List explicit origins instead.',
    );
}

const COOKIE_SAMESITE = str("COOKIE_SAMESITE", "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(COOKIE_SAMESITE)) {
    errors.push('COOKIE_SAMESITE must be one of "lax", "strict" or "none"');
}

const SMTP = {
    host: process.env.MAILTRAP_SMTP_HOST?.trim() || "",
    port: num("MAILTRAP_SMTP_PORT", 2525),
    user: process.env.MAILTRAP_SMTP_USER?.trim() || "",
    pass: process.env.MAILTRAP_SMTP_PASS?.trim() || "",
};
if (isProd && !SMTP.host) {
    errors.push(
        "MAILTRAP_SMTP_HOST (SMTP settings) are required in production",
    );
}

if (errors.length > 0) {
    console.error(
        `\n❌ Invalid environment configuration:\n${errors.map((e) => `   - ${e}`).join("\n")}\n` +
            "   Copy .env.example to .env and fill in the values.\n",
    );
    process.exit(1);
}

export const env = Object.freeze({
    NODE_ENV,
    isProd,
    isTest,
    isDev: !isProd && !isTest,

    // --- Server ---
    PORT,
    APP_NAME,
    APP_BASE_URL: str("APP_BASE_URL", `http://localhost:${PORT}`),
    CORS_ORIGINS,
    // Number of reverse proxies in front of the app (so req.ip is the real client IP).
    TRUST_PROXY: num("TRUST_PROXY", 0),

    // --- Database ---
    MONGODB_URI: str("MONGODB_URI"),

    // --- Tokens ---
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: str("ACCESS_TOKEN_EXPIRY", "15m"),
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY: str("REFRESH_TOKEN_EXPIRY", "7d"),
    JWT_ISSUER: str("JWT_ISSUER", "auth-service"),

    // --- Cookies ---
    COOKIE_SAMESITE,
    COOKIE_SECURE: isProd || COOKIE_SAMESITE === "none",
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN?.trim() || undefined,

    // --- Security policy ---
    BCRYPT_SALT_ROUNDS: num("BCRYPT_SALT_ROUNDS", 12),
    REQUIRE_EMAIL_VERIFICATION: bool("REQUIRE_EMAIL_VERIFICATION", true),
    MAX_LOGIN_ATTEMPTS: num("MAX_LOGIN_ATTEMPTS", 5),
    LOCK_TIME_MINUTES: num("LOCK_TIME_MINUTES", 15),
    MAX_SESSIONS_PER_USER: num("MAX_SESSIONS_PER_USER", 10),
    // A refresh token that was rotated less than this many seconds ago is treated as a harmless
    // concurrent request (e.g. two browser tabs), not as token theft.
    REFRESH_REUSE_GRACE_SECONDS: num("REFRESH_REUSE_GRACE_SECONDS", 10),
    RATE_LIMIT_ENABLED: bool("RATE_LIMIT_ENABLED", true),

    // --- Email ---
    SMTP,
    MAIL_FROM: str("MAIL_FROM", `"${APP_NAME}" <no-reply@example.com>`),
    // Frontend page that shows the "enter new password" form. The reset token is appended: <url>/<token>
    FORGOT_PASSWORD_REDIRECT_URL: str(
        "FORGOT_PASSWORD_REDIRECT_URL",
        "http://localhost:5173/reset-password",
    ),
});

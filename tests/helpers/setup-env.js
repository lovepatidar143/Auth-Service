/**
 * Must be the FIRST import of every test file: src/config/env.js reads process.env
 * once at import time, so these values have to exist before the app is imported.
 */
process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/auth_test"; // placeholder, tests connect explicitly
process.env.ACCESS_TOKEN_SECRET = "test-access-secret-0123456789-abcdefghij";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-0123456789-klmnopqrst";
process.env.BCRYPT_SALT_ROUNDS = "4"; // fast hashing in tests
process.env.RATE_LIMIT_ENABLED = "false"; // rate limiting is tested separately with its own tiny app
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.MAX_LOGIN_ATTEMPTS = "3";
process.env.MAX_SESSIONS_PER_USER = "5";
process.env.REQUIRE_EMAIL_VERIFICATION = "true";

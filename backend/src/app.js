import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { globalLimiter } from "./middlewares/rate-limit.middlewares.js";
import {
    errorHandler,
    notFoundHandler,
} from "./middlewares/error.middlewares.js";
import { sanitizeRequest } from "./middlewares/sanitize.middlewares.js";
import adminRouter from "./routes/admin.routes.js";
import authRouter from "./routes/auth.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";
import userRouter from "./routes/user.routes.js";
import { ApiError } from "./utils/api-error.js";
import { ApiResponse } from "./utils/api-response.js";
import { ErrorCodes } from "./utils/constants.js";

const app = express();

// Behind Nginx / a load balancer / Render / Railway etc. this makes `req.ip` the real client IP
// (essential for rate limiting). Set TRUST_PROXY=1 when you have one proxy in front.
if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);

// ----- Security headers (HSTS, no-sniff, frameguard, ...) -----
app.use(helmet());

// ----- CORS: only the origins listed in CORS_ORIGIN may call the API from a browser -----
app.use(
    cors({
        origin(origin, callback) {
            // Requests without an Origin header (curl, Postman, mobile apps, server-to-server) are not browser CORS requests.
            if (!origin || env.CORS_ORIGINS.includes(origin))
                return callback(null, true);
            return callback(
                new ApiError(
                    403,
                    "Origin not allowed by CORS policy",
                    [],
                    ErrorCodes.FORBIDDEN,
                ),
            );
        },
        credentials: true, // allow cookies
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));

// Global limiter runs BEFORE body parsing so abusive clients are rejected cheaply.
app.use(globalLimiter);

// ----- Body parsing (small limits stop oversized-payload attacks) -----
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
// Express 5: req.body is `undefined` when a request has no body. Normalise it so `const { a } = req.body` never crashes.
app.use((req, _res, next) => {
    req.body ??= {};
    next();
});
app.use(sanitizeRequest);

// ----- Routes -----
app.get("/", (_req, res) => {
    res.status(200).json(
        new ApiResponse(
            200,
            { name: env.APP_NAME, version: "1.0.0", docs: "See README.md" },
            "Welcome to the Auth API",
        ),
    );
});
app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/admin", adminRouter);

// ----- Errors (must be registered LAST) -----
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

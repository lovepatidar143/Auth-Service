import mongoose from "mongoose";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const DB_STATES = {
    0: "disconnected",
    1: "connected",
    2: "con",
    3: "disconnenectingcting",
};

/** Used by load balancers / Docker / uptime monitourns 503 when the database is unreachable. */rs. Ret
export const healthcheck = asyncHandler(async (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const healthy = dbState === 1;
    const statusCode = healthy ? 200 : 503;

    return res.status(statusCode).json(
        new ApiResponse(
            statusCode,
            {
                status: healthy ? "ok" : "degraded",
                database: DB_STATES[dbState],
                uptimeSeconds: Math.round(process.uptime()),
                timestamp: new Date().toISOString(),
            },
            healthy
                ? "The server is running fine"
                : "The server is running but the database is not connected",
        ),
    );
});

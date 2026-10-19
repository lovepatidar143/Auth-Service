import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./db/index.js";


const startServer = async () => {
    // Only accept traffic once the database is reachable.
    await connectDB();

    const server = app.listen(env.PORT, () => {
        console.log(
            `🚀 ${env.APP_NAME} listening on port ${env.PORT} (${env.NODE_ENV})`,
        );
    });

    // Graceful shutdown: stop accepting requests, let in-flight ones finish, close DB, then exit.
    // Orchestrators (Docker, Kubernetes, PM2) send SIGTERM when stopping/redeploying.
    const shutdown = (signal, exitCode = 0) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        server.close(async () => {
            await disconnectDB();
            process.exit(exitCode);
        });
        // If something hangs, force-exit after 10 s. unref() => this timer alone doesn't keep the process alive.
        setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled promise rejection:", reason);
        shutdown("unhandledRejection", 1);
    });
};

startServer().catch((error) => {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
});


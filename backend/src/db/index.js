import mongoose from "mongoose";
import { env } from "../config/env.js";

/**
 * Connects to MongoDB. Throws on failure - the caller (index.js) decides to exit.
 * (Calling process.exit inside a helper makes it impossible to test or reuse.)
 */
export const connectDB = async (uri = env.MONGODB_URI) => {
    const connection = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
    });
    // Never log the full URI: it contains the database password.
    console.log(`✅ MongoDB connected (host: ${connection.connection.host})`);
    return connection;
};

export const disconnectDB = () => mongoose.disconnect();

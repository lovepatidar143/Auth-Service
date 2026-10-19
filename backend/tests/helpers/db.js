import mongoose from "mongoose";
import { Session } from "../../src/models/session.models.js";
import { User } from "../../src/models/user.models.js";

let memoryServer;

/**
 * Uses TEST_MONGODB_URI when provided (CI / a local mongod), otherwise spins up an
 * in-memory MongoDB with mongodb-memory-server (downloads a mongod binary on first run).
 */
export const connectTestDB = async () => {
    let uri = process.env.TEST_MONGODB_URI;
    if (!uri) {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        memoryServer = await MongoMemoryServer.create();
        uri = memoryServer.getUri();
    }
    await mongoose.connect(uri);
    // Make sure unique indexes exist before tests run (duplicate-key behaviour depends on them).
    await User.init();
    // The Session TTL index (auto-delete of expired sessions) is not supported by some Mongo-compatible
    // servers (e.g. FerretDB). No test depends on it, so ONLY that specific error is tolerated.
    await Session.init().catch((error) => {
        if (!/not implemented/i.test(error.message)) throw error;
    });
    await Promise.all([User.deleteMany({}), Session.deleteMany({})]);
};

export const disconnectTestDB = async () => {
    await mongoose.disconnect();
    await memoryServer?.stop();
};

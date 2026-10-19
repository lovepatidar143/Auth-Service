/**
 * Creates the first admin account (there is intentionally no public API to become admin).
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_USERNAME=admin ADMIN_PASSWORD='StrongPass123' npm run seed:admin
 *
 * If a user with that email already exists, they are promoted to admin instead.
 */
import { env } from "../config/env.js";
import { connectDB, disconnectDB } from "../db/index.js";
import { User } from "../models/user.models.js";
import { UserRolesEnum } from "../utils/constants.js";

const { ADMIN_EMAIL, ADMIN_USERNAME = "admin", ADMIN_PASSWORD } = process.env;

const run = async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD are required.");
        process.exit(1);
    }
    if (ADMIN_PASSWORD.length < 8) {
        console.error("❌ ADMIN_PASSWORD must be at least 8 characters long.");
        process.exit(1);
    }

    await connectDB(env.MONGODB_URI);

    const email = ADMIN_EMAIL.trim().toLowerCase();
    const existing = await User.findOne({ email });

    if (existing) {
        existing.role = UserRolesEnum.ADMIN;
        existing.isEmailVerified = true;
        await existing.save();
        console.log(`✅ Existing user ${email} promoted to admin.`);
    } else {
        await User.create({
            email,
            username: ADMIN_USERNAME.trim().toLowerCase(),
            password: ADMIN_PASSWORD,
            role: UserRolesEnum.ADMIN,
            isEmailVerified: true,
        });
        console.log(`✅ Admin ${email} created.`);
    }
};

run()
    .catch((error) => {
        console.error("❌ Seeding failed:", error.message);
        process.exitCode = 1;
    })
    .finally(disconnectDB);

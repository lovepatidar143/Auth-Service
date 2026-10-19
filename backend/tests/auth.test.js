import "./helpers/setup-env.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import { Session } from "../src/models/session.models.js";
import { User } from "../src/models/user.models.js";
import { mailOutbox } from "../src/utils/mail.js";
import { connectTestDB, disconnectTestDB } from "./helpers/db.js";
import {
    PASSWORD,
    api,
    bearer,
    createAdmin,
    createVerifiedUser,
    lastMailTo,
    login,
    newUserData,
    tokenFromMail,
} from "./helpers/utils.js";

before(connectTestDB);
after(disconnectTestDB);

describe("registration", () => {
    it("creates a user, hides secrets and sends a verification email", async () => {
        const data = newUserData();
        const res = await api()
            .post("/api/v1/auth/register")
            .send(data)
            .expect(201);

        assert.equal(res.body.success, true);
        assert.equal(res.body.data.user.email, data.email);
        assert.equal(res.body.data.user.isEmailVerified, false);
        for (const secret of [
            "password",
            "emailVerificationToken",
            "failedLoginAttempts",
        ]) {
            assert.equal(
                secret in res.body.data.user,
                false,
                `${secret} must not be returned`,
            );
        }
        assert.ok(lastMailTo(data.email), "verification email should be sent");

        const stored = await User.findOne({ email: data.email }).select(
            "+password",
        );
        assert.notEqual(
            stored.password,
            data.password,
            "password must be hashed in the DB",
        );
    });

    it("rejects a duplicate email with 409", async () => {
        const data = newUserData();
        await api().post("/api/v1/auth/register").send(data).expect(201);
        const res = await api()
            .post("/api/v1/auth/register")
            .send({ ...newUserData(), email: data.email })
            .expect(409);
        assert.equal(res.body.code, "CONFLICT");
    });

    it("returns per-field validation errors and never echoes the password", async () => {
        const res = await api()
            .post("/api/v1/auth/register")
            .send({ email: "nope", username: "a!", password: "weak" })
            .expect(422);
        assert.equal(res.body.code, "VALIDATION_ERROR");
        const fields = res.body.errors.map((e) => e.field).sort();
        assert.deepEqual(fields, ["email", "password", "username"]);
        assert.equal(JSON.stringify(res.body).includes("weak"), false);
    });

    it("ignores a `role` sent by the client (no mass assignment / self-promotion to admin)", async () => {
        const res = await api()
            .post("/api/v1/auth/register")
            .send({ ...newUserData(), role: "admin" })
            .expect(201);
        assert.equal(res.body.data.user.role, "user");
    });
});

describe("email verification", () => {
    it("blocks login until the email is verified, then allows it", async () => {
        const data = newUserData();
        await api().post("/api/v1/auth/register").send(data).expect(201);

        const blocked = await api()
            .post("/api/v1/auth/login")
            .send(data)
            .expect(403);
        assert.equal(blocked.body.code, "EMAIL_NOT_VERIFIED");

        await api()
            .get(
                `/api/v1/auth/verify-email/${tokenFromMail(lastMailTo(data.email))}`,
            )
            .expect(200);
        await api().post("/api/v1/auth/login").send(data).expect(200);
    });

    it("verification links are single-use and malformed tokens are rejected", async () => {
        const data = newUserData();
        await api().post("/api/v1/auth/register").send(data).expect(201);
        const token = tokenFromMail(lastMailTo(data.email));

        await api().get(`/api/v1/auth/verify-email/${token}`).expect(200);
        const again = await api()
            .get(`/api/v1/auth/verify-email/${token}`)
            .expect(400);
        assert.equal(again.body.code, "TOKEN_INVALID");
        await api().get("/api/v1/auth/verify-email/not-a-token").expect(422);
    });

    it("resend gives the same answer for unknown and known emails, and emails only unverified users", async () => {
        const data = newUserData();
        await api().post("/api/v1/auth/register").send(data).expect(201);
        const before = mailOutbox.length;

        const known = await api()
            .post("/api/v1/auth/resend-email-verification")
            .send({ email: data.email })
            .expect(200);
        const unknown = await api()
            .post("/api/v1/auth/resend-email-verification")
            .send({ email: "ghost@example.com" })
            .expect(200);

        assert.equal(known.body.message, unknown.body.message);
        assert.equal(
            mailOutbox.length,
            before + 1,
            "only the real, unverified account gets an email",
        );
    });
});

describe("login", () => {
    it("returns the same error for a wrong password and an unknown user (no user enumeration)", async () => {
        const user = await createVerifiedUser();
        const wrongPassword = await api()
            .post("/api/v1/auth/login")
            .send({ email: user.email, password: "Wrong1234" })
            .expect(401);
        const unknownUser = await api()
            .post("/api/v1/auth/login")
            .send({ email: "ghost@example.com", password: "Wrong1234" })
            .expect(401);

        assert.equal(wrongPassword.body.message, unknownUser.body.message);
        assert.equal(wrongPassword.body.code, "INVALID_CREDENTIALS");
    });

    it("accepts username instead of email and sets httpOnly auth cookies", async () => {
        const user = await createVerifiedUser();
        const res = await api()
            .post("/api/v1/auth/login")
            .send({ username: user.username.toUpperCase(), password: PASSWORD })
            .expect(200);

        const cookies = res.headers["set-cookie"];
        assert.equal(cookies.length, 2);
        assert.ok(cookies.every((c) => c.includes("HttpOnly")));
        assert.ok(
            cookies
                .find((c) => c.startsWith("refreshToken="))
                .includes("Path=/api/v1/auth"),
        );
    });

    it("treats the email as case-insensitive", async () => {
        const user = await createVerifiedUser();
        await api()
            .post("/api/v1/auth/login")
            .send({ email: user.email.toUpperCase(), password: PASSWORD })
            .expect(200);
    });

    it("rejects NoSQL operator injection", async () => {
        await createVerifiedUser();
        const res = await api()
            .post("/api/v1/auth/login")
            .send({ email: { $ne: null }, password: { $ne: null } });
        assert.equal(res.status, 422);
    });

    it("locks the account after too many failed attempts, even for the correct password", async () => {
        const user = await createVerifiedUser();
        const bad = { email: user.email, password: "Wrong1234" };

        await api().post("/api/v1/auth/login").send(bad).expect(401);
        await api().post("/api/v1/auth/login").send(bad).expect(401);
        const locking = await api()
            .post("/api/v1/auth/login")
            .send(bad)
            .expect(423); // MAX_LOGIN_ATTEMPTS=3
        assert.equal(locking.body.code, "ACCOUNT_LOCKED");

        const correctButLocked = await api()
            .post("/api/v1/auth/login")
            .send(user)
            .expect(423);
        assert.equal(correctButLocked.body.code, "ACCOUNT_LOCKED");

        // Simulate the lock expiring.
        await User.updateOne(
            { email: user.email },
            { $set: { lockUntil: new Date(Date.now() - 1000) } },
        );
        await api().post("/api/v1/auth/login").send(user).expect(200);
    });
});

describe("protected routes & access tokens", () => {
    it("returns the current user with a Bearer token", async () => {
        const user = await createVerifiedUser();
        const { accessToken } = await login(user);
        const res = await api()
            .get("/api/v1/users/me")
            .set(bearer(accessToken))
            .expect(200);
        assert.equal(res.body.data.user.email, user.email);
    });

    it("works with the httpOnly cookie too (browser flow)", async () => {
        const user = await createVerifiedUser();
        const agent = request.agent(app);
        await agent.post("/api/v1/auth/login").send(user).expect(200);
        const res = await agent.get("/api/v1/users/me").expect(200);
        assert.equal(res.body.data.user.email, user.email);
    });

    it("distinguishes missing, invalid and expired tokens with codes", async () => {
        const user = await createVerifiedUser();
        const { accessToken } = await login(user);
        const { sub, sid } = jwt.decode(accessToken);

        const missing = await api().get("/api/v1/users/me").expect(401);
        assert.equal(missing.body.code, "TOKEN_MISSING");

        const invalid = await api()
            .get("/api/v1/users/me")
            .set(bearer("garbage"))
            .expect(401);
        assert.equal(invalid.body.code, "TOKEN_INVALID");

        const expired = jwt.sign({ sid }, process.env.ACCESS_TOKEN_SECRET, {
            subject: sub,
            issuer: "auth-service",
            expiresIn: -10,
        });
        const expiredRes = await api()
            .get("/api/v1/users/me")
            .set(bearer(expired))
            .expect(401);
        assert.equal(expiredRes.body.code, "TOKEN_EXPIRED");

        // A refresh token must never be accepted as an access token (different secret).
        const { refreshToken } = await login(user);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(refreshToken))
            .expect(401);
    });
});

describe("refresh token rotation", () => {
    it("issues a new pair and invalidates the previous refresh token", async () => {
        const user = await createVerifiedUser();
        const first = await login(user);

        const res = await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: first.refreshToken })
            .expect(200);
        assert.notEqual(
            res.body.data.refreshToken,
            first.refreshToken,
            "refresh token must be rotated",
        );
        await api()
            .get("/api/v1/users/me")
            .set(bearer(res.body.data.accessToken))
            .expect(200);
    });

    it("detects reuse of an old refresh token and revokes the whole session", async () => {
        const user = await createVerifiedUser();
        const first = await login(user);
        const rotated = await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: first.refreshToken })
            .expect(200);

        // Pretend the rotation happened a minute ago, i.e. well outside the grace window.
        const stored = await User.findOne({ email: user.email });
        await Session.updateMany(
            { user: stored._id },
            { $set: { rotatedAt: new Date(Date.now() - 60_000) } },
        );

        // The attacker (or a buggy client) replays the OLD token:
        const replay = await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: first.refreshToken })
            .expect(401);
        assert.equal(replay.body.code, "TOKEN_REUSE_DETECTED");

        // Everything from that session is dead now - including the NEW tokens.
        const dead = await api()
            .get("/api/v1/users/me")
            .set(bearer(rotated.body.data.accessToken))
            .expect(401);
        assert.equal(dead.body.code, "SESSION_REVOKED");
        await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: rotated.body.data.refreshToken })
            .expect(401);
    });

    it("replaying a token that was rotated a moment ago is a retryable 409 and does NOT kill the session", async () => {
        const user = await createVerifiedUser();
        const first = await login(user);
        const rotated = await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: first.refreshToken })
            .expect(200);

        const replay = await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: first.refreshToken })
            .expect(409);
        assert.equal(replay.body.code, "TOKEN_RECENTLY_ROTATED");

        // The legitimate (newest) tokens keep working.
        await api()
            .get("/api/v1/users/me")
            .set(bearer(rotated.body.data.accessToken))
            .expect(200);
        await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: rotated.body.data.refreshToken })
            .expect(200);
    });

    it("parallel refreshes with the same token never revoke the session (multi-tab safety)", async () => {
        const user = await createVerifiedUser();
        const { refreshToken } = await login(user);
        const results = await Promise.all([
            api().post("/api/v1/auth/refresh-token").send({ refreshToken }),
            api().post("/api/v1/auth/refresh-token").send({ refreshToken }),
        ]);
        const statuses = results.map((r) => r.status);
        // With a real MongoDB the rotation is atomic: [200, 409]. Both must be non-fatal either way.
        assert.ok(
            statuses.every((status) => [200, 409].includes(status)),
            `unexpected statuses: ${statuses}`,
        );
        assert.ok(statuses.includes(200), "at least one request must succeed");

        const stored = await User.findOne({ email: user.email });
        assert.equal(
            await Session.countDocuments({ user: stored._id }),
            1,
            "the session must survive",
        );
    });

    it("rejects a missing or tampered refresh token", async () => {
        const missing = await api()
            .post("/api/v1/auth/refresh-token")
            .send({})
            .expect(401);
        assert.equal(missing.body.code, "TOKEN_MISSING");
        const tampered = await api()
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: "a.b.c" })
            .expect(401);
        assert.equal(tampered.body.code, "TOKEN_INVALID");
    });

    it("works through the path-scoped refresh cookie", async () => {
        const user = await createVerifiedUser();
        const agent = request.agent(app);
        await agent.post("/api/v1/auth/login").send(user).expect(200);
        await agent.post("/api/v1/auth/refresh-token").send({}).expect(200);
    });
});

describe("logout & multi-device sessions", () => {
    it("logout kills the access token immediately (not only after it expires)", async () => {
        const user = await createVerifiedUser();
        const { accessToken } = await login(user);
        await api()
            .post("/api/v1/auth/logout")
            .set(bearer(accessToken))
            .expect(200);
        const res = await api()
            .get("/api/v1/users/me")
            .set(bearer(accessToken))
            .expect(401);
        assert.equal(res.body.code, "SESSION_REVOKED");
    });

    it("logout-all signs out every device", async () => {
        const user = await createVerifiedUser();
        const phone = await login(user);
        const laptop = await login(user);
        const tablet = await login(user);

        const res = await api()
            .post("/api/v1/auth/logout-all")
            .set(bearer(phone.accessToken))
            .send({})
            .expect(200);
        assert.equal(res.body.data.revokedSessions, 3);
        for (const device of [phone, laptop, tablet]) {
            await api()
                .get("/api/v1/users/me")
                .set(bearer(device.accessToken))
                .expect(401);
        }
    });

    it("logout-all with keepCurrent only signs out the OTHER devices", async () => {
        const user = await createVerifiedUser();
        const phone = await login(user);
        const laptop = await login(user);

        const res = await api()
            .post("/api/v1/auth/logout-all")
            .set(bearer(phone.accessToken))
            .send({ keepCurrent: true })
            .expect(200);
        assert.equal(res.body.data.revokedSessions, 1);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(phone.accessToken))
            .expect(200);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(laptop.accessToken))
            .expect(401);
    });

    it("lists sessions, marks the current one and lets the user revoke another device", async () => {
        const user = await createVerifiedUser();
        const phone = await login(user);
        const laptop = await login(user);

        const list = await api()
            .get("/api/v1/auth/sessions")
            .set(bearer(phone.accessToken))
            .expect(200);
        const sessions = list.body.data.sessions;
        assert.equal(sessions.length, 2);
        assert.equal(sessions.filter((s) => s.isCurrent).length, 1);
        assert.equal(
            "refreshTokenHash" in sessions[0],
            false,
            "token hashes must never be exposed",
        );

        const other = sessions.find((s) => !s.isCurrent);
        await api()
            .delete(`/api/v1/auth/sessions/${other.id}`)
            .set(bearer(phone.accessToken))
            .expect(200);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(laptop.accessToken))
            .expect(401);
        await api()
            .delete(`/api/v1/auth/sessions/${other.id}`)
            .set(bearer(phone.accessToken))
            .expect(404);
    });

    it("a user can never revoke somebody else's session", async () => {
        const alice = await createVerifiedUser();
        const bob = await createVerifiedUser();
        const aliceLogin = await login(alice);
        const bobLogin = await login(bob);
        const bobSession = (
            await api()
                .get("/api/v1/auth/sessions")
                .set(bearer(bobLogin.accessToken))
        ).body.data.sessions[0];

        await api()
            .delete(`/api/v1/auth/sessions/${bobSession.id}`)
            .set(bearer(aliceLogin.accessToken))
            .expect(404);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(bobLogin.accessToken))
            .expect(200);
    });

    it("keeps at most MAX_SESSIONS_PER_USER sessions by evicting the oldest", async () => {
        const user = await createVerifiedUser();
        for (let i = 0; i < 7; i++) await login(user);
        const stored = await User.findOne({ email: user.email });
        assert.equal(await Session.countDocuments({ user: stored._id }), 5);
    });
});

describe("password management", () => {
    it("change-password: verifies the current password, logs out OTHER devices, keeps this one", async () => {
        const user = await createVerifiedUser();
        const phone = await login(user);
        const laptop = await login(user);

        const wrong = await api()
            .post("/api/v1/auth/change-password")
            .set(bearer(phone.accessToken))
            .send({ currentPassword: "Nope12345", newPassword: "NewPassw0rd" })
            .expect(401);
        assert.equal(wrong.body.code, "INVALID_CREDENTIALS");

        const same = await api()
            .post("/api/v1/auth/change-password")
            .set(bearer(phone.accessToken))
            .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
            .expect(422);
        assert.equal(same.body.errors[0].field, "newPassword");

        await api()
            .post("/api/v1/auth/change-password")
            .set(bearer(phone.accessToken))
            .send({ currentPassword: PASSWORD, newPassword: "NewPassw0rd" })
            .expect(200);

        await api()
            .get("/api/v1/users/me")
            .set(bearer(phone.accessToken))
            .expect(200);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(laptop.accessToken))
            .expect(401);
        await api().post("/api/v1/auth/login").send(user).expect(401); // old password
        await api()
            .post("/api/v1/auth/login")
            .send({ email: user.email, password: "NewPassw0rd" })
            .expect(200);
    });

    it("forgot-password responds identically for unknown emails and sends no email for them", async () => {
        const user = await createVerifiedUser();
        const before = mailOutbox.length;
        const known = await api()
            .post("/api/v1/auth/forgot-password")
            .send({ email: user.email })
            .expect(200);
        const unknown = await api()
            .post("/api/v1/auth/forgot-password")
            .send({ email: "ghost@example.com" })
            .expect(200);
        assert.equal(known.body.message, unknown.body.message);
        assert.equal(mailOutbox.length, before + 1);
    });

    it("full reset flow: token is single-use, all sessions die, the account is unlocked", async () => {
        const user = await createVerifiedUser();
        const device = await login(user);
        // Lock the account first to prove a reset unlocks it.
        for (let i = 0; i < 3; i++)
            await api()
                .post("/api/v1/auth/login")
                .send({ email: user.email, password: "Wrong1234" });

        await api()
            .post("/api/v1/auth/forgot-password")
            .send({ email: user.email })
            .expect(200);
        const token = tokenFromMail(lastMailTo(user.email));

        await api()
            .post(`/api/v1/auth/reset-password/${token}`)
            .send({ newPassword: "weak" })
            .expect(422);
        await api()
            .post(`/api/v1/auth/reset-password/${token}`)
            .send({ newPassword: "Brand3NewPass" })
            .expect(200);

        const reused = await api()
            .post(`/api/v1/auth/reset-password/${token}`)
            .send({ newPassword: "Another1Pass" })
            .expect(400);
        assert.equal(reused.body.code, "TOKEN_INVALID");

        await api()
            .get("/api/v1/users/me")
            .set(bearer(device.accessToken))
            .expect(401);
        await api()
            .post("/api/v1/auth/login")
            .send({ email: user.email, password: "Brand3NewPass" })
            .expect(200);
    });

    it("expired reset tokens are rejected", async () => {
        const user = await createVerifiedUser();
        await api()
            .post("/api/v1/auth/forgot-password")
            .send({ email: user.email })
            .expect(200);
        const token = tokenFromMail(lastMailTo(user.email));
        await User.updateOne(
            { email: user.email },
            { $set: { passwordResetExpiry: new Date(Date.now() - 1000) } },
        );
        await api()
            .post(`/api/v1/auth/reset-password/${token}`)
            .send({ newPassword: "Brand3NewPass" })
            .expect(400);
    });
});

describe("profile", () => {
    it("updates whitelisted fields only and handles duplicate usernames", async () => {
        const alice = await createVerifiedUser();
        const bob = await createVerifiedUser();
        const { accessToken } = await login(alice);

        const res = await api()
            .patch("/api/v1/users/me")
            .set(bearer(accessToken))
            .send({ fullName: "Alice Smith", role: "admin", isActive: false })
            .expect(200);
        assert.equal(res.body.data.user.fullName, "Alice Smith");
        assert.equal(
            res.body.data.user.role,
            "user",
            "role must not be changeable here",
        );

        await api()
            .patch("/api/v1/users/me")
            .set(bearer(accessToken))
            .send({})
            .expect(422);
        const dup = await api()
            .patch("/api/v1/users/me")
            .set(bearer(accessToken))
            .send({ username: bob.username })
            .expect(409);
        assert.equal(dup.body.code, "CONFLICT");
    });

    it("deleting the account needs the password and ends all sessions", async () => {
        const user = await createVerifiedUser();
        const { accessToken } = await login(user);

        await api()
            .delete("/api/v1/users/me")
            .set(bearer(accessToken))
            .send({ password: "Wrong1234" })
            .expect(401);
        await api()
            .delete("/api/v1/users/me")
            .set(bearer(accessToken))
            .send({ password: PASSWORD })
            .expect(200);

        await api()
            .get("/api/v1/users/me")
            .set(bearer(accessToken))
            .expect(401);
        assert.equal(await User.countDocuments({ email: user.email }), 0);
    });
});

describe("role based access control (admin)", () => {
    it("regular users get 403, unauthenticated get 401", async () => {
        const user = await createVerifiedUser();
        const { accessToken } = await login(user);
        const res = await api()
            .get("/api/v1/admin/users")
            .set(bearer(accessToken))
            .expect(403);
        assert.equal(res.body.code, "FORBIDDEN");
        await api().get("/api/v1/admin/users").expect(401);
    });

    it("admin can list (paginated + search), change roles and deactivate users", async () => {
        const admin = await createAdmin();
        const target = await createVerifiedUser({
            fullName: "Searchable Zebra",
        });
        const targetLogin = await login(target);

        const list = await api()
            .get("/api/v1/admin/users?limit=2&page=1")
            .set(bearer(admin.accessToken))
            .expect(200);
        assert.equal(list.body.data.users.length, 2);
        assert.ok(list.body.data.pagination.total >= 2);

        const search = await api()
            .get("/api/v1/admin/users?search=zebra")
            .set(bearer(admin.accessToken))
            .expect(200);
        assert.equal(search.body.data.users.length, 1);
        await api()
            .get("/api/v1/admin/users?limit=1000")
            .set(bearer(admin.accessToken))
            .expect(422);
        // regex characters in search are treated literally (no ReDoS / wildcard abuse)
        const literal = await api()
            .get("/api/v1/admin/users?search=.*")
            .set(bearer(admin.accessToken))
            .expect(200);
        assert.equal(literal.body.data.users.length, 0);

        const targetDoc = await User.findOne({ email: target.email });
        await api()
            .patch(`/api/v1/admin/users/${targetDoc._id}/role`)
            .set(bearer(admin.accessToken))
            .send({ role: "superuser" })
            .expect(422);
        await api()
            .patch(`/api/v1/admin/users/${targetDoc._id}/role`)
            .set(bearer(admin.accessToken))
            .send({ role: "admin" })
            .expect(200);
        // The new role applies immediately, no re-login needed.
        await api()
            .get("/api/v1/admin/users")
            .set(bearer(targetLogin.accessToken))
            .expect(200);

        // Admins cannot lock themselves out / demote themselves.
        const adminDoc = await User.findOne({ email: admin.credentials.email });
        await api()
            .patch(`/api/v1/admin/users/${adminDoc._id}/role`)
            .set(bearer(admin.accessToken))
            .send({ role: "user" })
            .expect(400);
        await api()
            .patch(`/api/v1/admin/users/${adminDoc._id}/status`)
            .set(bearer(admin.accessToken))
            .send({ isActive: false })
            .expect(400);

        await api()
            .patch(`/api/v1/admin/users/${targetDoc._id}/status`)
            .set(bearer(admin.accessToken))
            .send({ isActive: false })
            .expect(200);
        await api()
            .get("/api/v1/users/me")
            .set(bearer(targetLogin.accessToken))
            .expect(401); // sessions revoked
        const blocked = await api()
            .post("/api/v1/auth/login")
            .send(target)
            .expect(403);
        assert.equal(blocked.body.code, "ACCOUNT_DISABLED");

        await api()
            .patch(`/api/v1/admin/users/${new mongoose.Types.ObjectId()}/role`)
            .set(bearer(admin.accessToken))
            .send({ role: "user" })
            .expect(404);
    });
});

describe("platform behaviour", () => {
    it("returns JSON (not HTML) for unknown routes and malformed JSON", async () => {
        const notFound = await api().get("/api/v1/nope").expect(404);
        assert.equal(notFound.body.code, "NOT_FOUND");
        const badJson = await api()
            .post("/api/v1/auth/login")
            .set("Content-Type", "application/json")
            .send("{bad json")
            .expect(400);
        assert.equal(badJson.body.success, false);
    });

    it("rejects oversized bodies and survives requests without a body", async () => {
        const huge = await api()
            .post("/api/v1/auth/login")
            .send({ email: "a@b.co", password: "x".repeat(20000) })
            .expect(413);
        assert.equal(huge.body.code, "PAYLOAD_TOO_LARGE");
        await api().post("/api/v1/auth/login").expect(422); // req.body is undefined in Express 5 without a body
    });

    it("healthcheck reports the database state and helmet headers are present", async () => {
        const res = await api().get("/api/v1/healthcheck").expect(200);
        assert.equal(res.body.data.database, "connected");
        assert.equal(res.headers["x-content-type-options"], "nosniff");
        assert.equal(res.headers["x-powered-by"], undefined);
    });

    it("blocks browser requests from origins that are not allow-listed", async () => {
        await api()
            .get("/api/v1/healthcheck")
            .set("Origin", "http://evil.example")
            .expect(403);
        await api()
            .get("/api/v1/healthcheck")
            .set("Origin", "http://localhost:5173")
            .expect(200);
    });
});

import "./helpers/setup-env.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middlewares/error.middlewares.js";
import { createRateLimiter } from "../src/middlewares/rate-limit.middlewares.js";

// A tiny standalone app, so the limiter can be tested with a tiny limit without touching the real app.
const buildApp = (limiterOptions) => {
    const app = express();
    app.use(express.json());
    app.post(
        "/ping",
        createRateLimiter({
            windowMs: 60_000,
            skip: () => false,
            ...limiterOptions,
        }),
        (req, res) =>
            res
                .status(req.body.ok ? 200 : 401)
                .json({ ok: Boolean(req.body.ok) }),
    );
    app.use(errorHandler);
    return app;
};

describe("rate limiter", () => {
    it("blocks the request after the limit with a 429 in the standard error format", async () => {
        const app = buildApp({ limit: 2, message: "Slow down!" });
        await request(app).post("/ping").send({ ok: true }).expect(200);
        await request(app).post("/ping").send({ ok: true }).expect(200);

        const res = await request(app)
            .post("/ping")
            .send({ ok: true })
            .expect(429);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, "RATE_LIMITED");
        assert.equal(res.body.message, "Slow down!");
        assert.ok(
            res.headers["retry-after"],
            "Retry-After header should be present",
        );
    });

    it("with skipSuccessfulRequests only FAILED requests count (used for login)", async () => {
        const app = buildApp({ limit: 2, skipSuccessfulRequests: true });
        // Many successful requests never hit the limit...
        for (let i = 0; i < 5; i++)
            await request(app).post("/ping").send({ ok: true }).expect(200);
        // ...but failures do.
        await request(app).post("/ping").send({ ok: false }).expect(401);
        await request(app).post("/ping").send({ ok: false }).expect(401);
        await request(app).post("/ping").send({ ok: false }).expect(429);
    });

    it("is skipped when disabled via the RATE_LIMIT_ENABLED flag (default skip)", async () => {
        const app = express();
        app.use(express.json());
        // No custom `skip` => uses env.RATE_LIMIT_ENABLED, which is "false" in tests.
        app.post(
            "/ping",
            createRateLimiter({ windowMs: 60_000, limit: 1 }),
            (req, res) => res.json({ ok: true }),
        );
        app.use(errorHandler);
        for (let i = 0; i < 4; i++)
            await request(app).post("/ping").send({}).expect(200);
    });
});

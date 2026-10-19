import request from "supertest";
import app from "../../src/app.js";
import { User } from "../../src/models/user.models.js";
import { mailOutbox } from "../../src/utils/mail.js";
import { UserRolesEnum } from "../../src/utils/constants.js";

export const PASSWORD = "Passw0rdOK";
export const api = () => request(app);

let counter = 0;
/** Fresh, unique user payload so tests never collide with each other. */
export const newUserData = (overrides = {}) => {
    counter += 1;
    const id = `${Date.now().toString(36)}${counter}`;
    return {
        email: `user_${id}@example.com`,
        username: `user_${id}`,
        password: PASSWORD,
        fullName: "Test User",
        ...overrides,
    };
};

/** Newest email sent to an address (test mode stores emails in memory). */
export const lastMailTo = (email) =>
    [...mailOutbox].reverse().find((mail) => mail.to === email);

/** Extracts the 64-char hex token from the link inside an email. */
export const tokenFromMail = (mail) => mail.text.match(/[a-f0-9]{64}/)[0];

/** Register + verify email through the real endpoints. Returns the credentials. */
export const createVerifiedUser = async (overrides = {}) => {
    const data = newUserData(overrides);
    await api().post("/api/v1/auth/register").send(data).expect(201);
    const token = tokenFromMail(lastMailTo(data.email));
    await api().get(`/api/v1/auth/verify-email/${token}`).expect(200);
    return data;
};

/** Logs in and returns { accessToken, refreshToken, user }. */
export const login = async (credentials) => {
    const res = await api()
        .post("/api/v1/auth/login")
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);
    return res.body.data;
};

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** Creates an admin directly in the DB (there is deliberately no API for that) and logs in. */
export const createAdmin = async () => {
    const data = newUserData();
    await User.create({
        ...data,
        role: UserRolesEnum.ADMIN,
        isEmailVerified: true,
    });
    return { credentials: data, ...(await login(data)) };
};

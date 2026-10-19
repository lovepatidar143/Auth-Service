import { env } from "../config/env.js";
import { AUTH_COOKIE } from "./constants.js";

/**
 * httpOnly  -> JavaScript (and therefore XSS) cannot read the cookie.
 * secure    -> only sent over HTTPS (forced on in production).
 * sameSite  -> basic CSRF protection ("lax" blocks cross-site POSTs).
 */
const baseOptions = () => ({
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    ...(env.COOKIE_DOMAIN && { domain: env.COOKIE_DOMAIN }),
});

export const setAuthCookies = (
    res,
    { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt },
) => {
    res.cookie(AUTH_COOKIE.ACCESS, accessToken, {
        ...baseOptions(),
        path: "/",
        expires: accessExpiresAt,
    });
    res.cookie(AUTH_COOKIE.REFRESH, refreshToken, {
        ...baseOptions(),
        path: AUTH_COOKIE.REFRESH_PATH,
        expires: refreshExpiresAt,
    });
};

export const clearAuthCookies = (res) => {
    // The path/domain must match the ones used when the cookie was set, otherwise the browser keeps it.
    res.clearCookie(AUTH_COOKIE.ACCESS, { ...baseOptions(), path: "/" });
    res.clearCookie(AUTH_COOKIE.REFRESH, {
        ...baseOptions(),
        path: AUTH_COOKIE.REFRESH_PATH,
    });
};

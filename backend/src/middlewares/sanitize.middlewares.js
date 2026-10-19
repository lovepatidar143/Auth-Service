/**
 * NoSQL-injection guard.
 *
 * Attack: POST /login { "email": { "$ne": null }, "password": { "$ne": null } }
 * Mongo would read that as "any user whose email is not null".
 * We delete every key starting with "$" or containing "." from the body/params.
 * (The validators additionally require plain strings - two independent layers.)
 */
const strip = (value) => {
    if (Array.isArray(value)) {
        value.forEach(strip);
    } else if (value && typeof value === "object") {
        for (const key of Object.keys(value)) {
            if (key.startsWith("$") || key.includes(".")) {
                delete value[key];
            } else {
                strip(value[key]);
            }
        }
    }
    return value;
};

export const sanitizeRequest = (req, _res, next) => {
    strip(req.body);
    strip(req.params);
    next();
};

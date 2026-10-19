import bcrypt from "bcrypt";
import { env } from "../config/env.js";

export const hashPassword = (plain) =>
    bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// Pre-computed hash of a random string. Used to burn the same CPU time when the
// account does not exist, so response time does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync(
    "timing-attack-protection",
    env.BCRYPT_SALT_ROUNDS,
);
export const fakePasswordCompare = (plain) => bcrypt.compare(plain, DUMMY_HASH);

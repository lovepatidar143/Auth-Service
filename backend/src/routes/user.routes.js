import { Router } from "express";
import {
    deleteAccount,
    getCurrentUser,
    updateProfile,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { passwordLimiter } from "../middlewares/rate-limit.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import {
    deleteAccountValidator,
    updateProfileValidator,
} from "../validators/user.validators.js";

const router = Router();

// Every route in this file requires a logged-in user.
router.use(verifyJWT);

router.get("/me", getCurrentUser);
router.patch("/me", updateProfileValidator, validate, updateProfile);
router.delete(
    "/me",
    passwordLimiter,
    deleteAccountValidator,
    validate,
    deleteAccount,
);

export default router;

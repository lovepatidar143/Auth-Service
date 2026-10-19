import { Router } from "express";
import {
    listUsers,
    updateUserRole,
    updateUserStatus,
} from "../controllers/admin.controller.js";
import { authorizeRoles, verifyJWT } from "../middlewares/auth.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { UserRolesEnum } from "../utils/constants.js";
import {
    listUsersValidator,
    updateRoleValidator,
    updateStatusValidator,
} from "../validators/admin.validators.js";

const router = Router();

// Every route in this file requires a logged-in ADMIN.
router.use(verifyJWT, authorizeRoles(UserRolesEnum.ADMIN));

router.get("/users", listUsersValidator, validate, listUsers);
router.patch(
    "/users/:userId/role",
    updateRoleValidator,
    validate,
    updateUserRole,
);
router.patch(
    "/users/:userId/status",
    updateStatusValidator,
    validate,
    updateUserStatus,
);

export default router;

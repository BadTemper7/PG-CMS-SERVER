import express from "express";
import {
  createUser,
  login,
  getUsers,
  getUserById,
  deleteUser,
} from "../controllers/userController.js";

import {
  protect,
  adminOnly,
  superadminOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", createUser); // only superadmin can create users
router.post("/login", login);

router.get("/", getUsers); // admin/superadmin
router.get("/:id", protect, adminOnly, getUserById); // admin/superadmin

router.delete("/:id", protect, superadminOnly, deleteUser); // only superadmin

export default router;

import { Router } from "express";
import { register, login, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/auth/register  — create account + receive JWT
router.post("/register", register);

// POST /api/auth/login     — login + receive JWT
router.post("/login", login);

// GET  /api/auth/me        — return current user (protected)
router.get("/me", protect, getMe);

export default router;

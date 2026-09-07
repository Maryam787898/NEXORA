import { Router } from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

// ─── Public Routes (no auth required) ────────────────────────────────────────
// GET /api/products        — list all products
router.get("/", getAllProducts);

// GET /api/products/:id    — get single product
router.get("/:id", getProductById);

// ─── Admin-Only Routes (auth → role check → controller) ──────────────────────
// POST   /api/products        — create product
router.post("/", protect, authorizeRoles("admin"), createProduct);

// PUT    /api/products/:id    — update product
router.put("/:id", protect, authorizeRoles("admin"), updateProduct);

// DELETE /api/products/:id    — delete product
router.delete("/:id", protect, authorizeRoles("admin"), deleteProduct);

export default router;

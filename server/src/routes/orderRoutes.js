import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

// ─── All Order Routes Require Authentication ─────────────────────────────────
router.use(protect);

// ─── Admin Routes ────────────────────────────────────────────────────────────
// Note: Put admin routes before /:id routes to prevent 'admin' from being parsed as an id
router.get("/admin/all", authorizeRoles("admin"), getAllOrders);
router.patch("/admin/:id/status", authorizeRoles("admin"), updateOrderStatus);

// ─── User Routes ─────────────────────────────────────────────────────────────
router.route("/")
  .post(createOrder)
  .get(getMyOrders);

router.route("/:id")
  .get(getOrderById);

router.patch("/:id/cancel", cancelMyOrder);

export default router;

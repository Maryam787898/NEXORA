import { Router } from "express";
import {
  initiatePayment,
  confirmPayment,
  failPayment,
  getPaymentStatus,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// All payment routes require authentication — no public payment endpoints
router.use(protect);

// POST /api/payments/:orderId/initiate — start a simulated payment session
router.post("/:orderId/initiate", initiatePayment);

// POST /api/payments/:orderId/confirm  — simulate successful payment completion
router.post("/:orderId/confirm", confirmPayment);

// POST /api/payments/:orderId/fail     — simulate payment failure
router.post("/:orderId/fail", failPayment);

// GET  /api/payments/:orderId/status   — read current payment status
router.get("/:orderId/status", getPaymentStatus);

export default router;


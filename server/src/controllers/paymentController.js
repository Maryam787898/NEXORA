import mongoose from "mongoose";
import Order from "../models/Order.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Generate a safe, opaque mock payment reference.
 * Format:  NXPAY-<timestamp>-<random hex>
 * Never contains user data, order totals, or real payment credentials.
 */
const generatePaymentReference = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `NXPAY-${ts}-${rand}`;
};

// ─── POST /api/payments/:orderId/initiate ─────────────────────────────────────
/**
 * Begin the payment process for an eligible order.
 *
 * Security rules enforced here:
 *  - JWT authentication required (via `protect` middleware)
 *  - Order must belong to req.user._id  (IDOR protection)
 *  - Order must not already be paid
 *  - Order must not be cancelled
 *  - Amount is ALWAYS read from the stored Order — never from the request body
 */
export const initiatePayment = async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  try {
    // IDOR: include user filter so a user can never reach another user's order
    const order = await Order.findOne({ _id: orderId, user: req.user._id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorised to access it.",
      });
    }

    // Only online orders can be initiated through the payment API
    if (order.paymentMethod !== "online") {
      return res.status(400).json({
        success: false,
        message: "Payment initiation is only available for online payment orders.",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This order has already been paid.",
      });
    }

    if (!["pending", "failed"].includes(order.paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "This order is not eligible for payment retry.",
      });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot initiate payment for a cancelled order.",
      });
    }

    // A retry resets only the server-owned payment state; request fields are ignored.
    if (order.paymentStatus === "failed") {
      order.paymentStatus = "pending";
      await order.save();
    }

    // Amount comes strictly from the stored order total — client cannot influence this
    return res.status(200).json({
      success: true,
      message: "Payment initiated",
      payment: {
        orderId: order._id,
        amount: order.total,      // authoritative — from DB
        currency: "USD",
        paymentMethod: order.paymentMethod,
        status: order.paymentStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while initiating payment.",
    });
  }
};

// ─── POST /api/payments/:orderId/confirm ─────────────────────────────────────
/**
 * Confirm (simulate completing) payment for an order.
 *
 * Security rules enforced here:
 *  - JWT authentication required
 *  - Order must belong to req.user._id  (IDOR protection)
 *  - The backend sets paymentStatus, paidAt, paymentReference — client cannot supply these
 *  - Already-paid orders are rejected
 *  - Cancelled orders are rejected
 *  - No real payment gateway — this is a simulation
 */
export const confirmPayment = async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  try {
    // IDOR: scope to authenticated user
    const order = await Order.findOne({ _id: orderId, user: req.user._id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorised to access it.",
      });
    }

    if (order.paymentMethod !== "online") {
      return res.status(400).json({
        success: false,
        message: "Payment confirmation is only available for online payment orders.",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This order has already been paid.",
      });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot confirm payment for a cancelled order.",
      });
    }

    // Backend controls ALL payment state — nothing from req.body is trusted
    order.paymentStatus = "paid";
    order.paidAt = new Date();
    order.paymentReference = generatePaymentReference();

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment confirmed successfully.",
      payment: {
        orderId: order._id,
        amount: order.total,
        currency: "USD",
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
        paymentReference: order.paymentReference,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while confirming payment.",
    });
  }
};

// ─── POST /api/payments/:orderId/fail ────────────────────────────────────────
/**
 * Simulate a failed payment for an order.
 *
 * Security rules enforced here:
 *  - JWT authentication required
 *  - Order must belong to req.user._id  (IDOR protection)
 *  - Only pending payments can be failed
 *  - Cancelled orders are rejected
 *  - Online-only
 */
export const failPayment = async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  try {
    const order = await Order.findOne({ _id: orderId, user: req.user._id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorised to access it.",
      });
    }

    if (order.paymentMethod !== "online") {
      return res.status(400).json({
        success: false,
        message: "Payment failure simulation is only available for online payment orders.",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot fail an already paid order.",
      });
    }

    if (order.paymentStatus === "failed") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been marked as failed.",
      });
    }

    if (order.paymentStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending payments can be marked as failed.",
      });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot fail payment for a cancelled order.",
      });
    }

    // Backend controls the status transition
    order.paymentStatus = "failed";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment marked as failed.",
      payment: {
        orderId: order._id,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while failing payment.",
    });
  }
};

// ─── GET /api/payments/:orderId/status ───────────────────────────────────────
/**
 * Return the payment status for a specific order.
 *
 * Security rules enforced here:
 *  - JWT authentication required
 *  - IDOR: user can only see their own order's payment status
 */
export const getPaymentStatus = async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  try {
    // IDOR: include user filter
    const order = await Order.findOne(
      { _id: orderId, user: req.user._id },
      "paymentStatus paymentMethod paidAt paymentReference"  // include ref for paid display
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorised to access it.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
        // Include reference only when paid — never expose null/partial references
        ...(order.paymentStatus === "paid" && {
          paymentReference: order.paymentReference,
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while fetching payment status.",
    });
  }
};

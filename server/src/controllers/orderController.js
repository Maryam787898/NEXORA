import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// ─── USER CONTROLLERS ────────────────────────────────────────────────────────

/**
 * POST /api/orders
 * Create a new order from the user's cart
 */
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { shippingAddress, paymentMethod = "cod" } = req.body;

    // Validate paymentMethod — only "cod" and "online" are allowed
    const allowedPaymentMethods = ["cod", "online"];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      throw new Error(`Validation: Invalid payment method '${paymentMethod}'. Allowed values: cod, online.`);
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
      throw new Error("Validation: Missing required shipping address fields.");
    }

    // Load Cart
    const cart = await Cart.findOne({ user: req.user._id }).session(session);
    if (!cart || cart.items.length === 0) {
      throw new Error("Validation: Cart is empty.");
    }

    const orderItems = [];
    let subtotal = 0;

    // Process each item
    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);
      
      if (!product) {
        throw new Error(`Validation: Product ${item.product} no longer exists.`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Validation: Insufficient stock for ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}.`);
      }

      // Snapshot price and details
      const itemPrice = product.price;
      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price: itemPrice,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
      });

      subtotal += itemPrice * item.quantity;
      
      // Decrease stock
      product.stock -= item.quantity;
      await product.save({ session });
    }

    // ── Pricing rules (backend is the source of truth — never trust client values) ──
    // Mirror the same logic shown in Cart.jsx and Checkout.jsx so the stored
    // total always equals what the customer saw on screen.
    //   • Free shipping on orders ≥ $100
    //   • $9.99 shipping fee on orders < $100
    //   • 8% sales tax on subtotal (rounded to 2 decimal places)
    const shippingFee = subtotal >= 100 ? 0 : 9.99;
    const taxAmount   = Math.round(subtotal * 0.08 * 100) / 100;
    const total       = Math.round((subtotal + shippingFee + taxAmount) * 100) / 100;

    // Create Order — price is always taken from DB snapshots, never from the client
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      subtotal,
      shippingFee,
      taxAmount,
      total,
      paymentMethod,             // validated above
      paymentStatus: "pending",  // always starts as pending; payment API controls transitions
      orderStatus: "pending",
    });

    await order.save({ session });

    // Clear Cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    await session.abortTransaction();
    const isValidation = error.message.startsWith("Validation:");
    res.status(isValidation ? 400 : 500).json({ 
      success: false, 
      message: isValidation ? error.message.replace("Validation: ", "") : "Server error while creating order" 
    });
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/orders
 * Get current user's orders
 */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while fetching orders" });
  }
};

/**
 * GET /api/orders/:id
 * Get order by ID (only if it belongs to the user)
 */
export const getOrderById = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or unauthorized" });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while fetching order" });
  }
};

/**
 * PATCH /api/orders/:id/cancel
 * Cancel an order and restore stock (only for pending or confirmed orders)
 */
export const cancelMyOrder = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).session(session);
    
    if (!order) {
      throw new Error("Validation: Order not found or unauthorized.");
    }

    if (order.orderStatus === "cancelled") {
      throw new Error("Validation: Order is already cancelled.");
    }

    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      throw new Error(`Validation: Cannot cancel order in '${order.orderStatus}' status.`);
    }

    order.orderStatus = "cancelled";
    await order.save({ session });

    // Restore stock
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        product.stock += item.quantity;
        await product.save({ session });
      }
    }

    await session.commitTransaction();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    await session.abortTransaction();
    const isValidation = error.message.startsWith("Validation:");
    res.status(isValidation ? 400 : 500).json({ 
      success: false, 
      message: isValidation ? error.message.replace("Validation: ", "") : "Server error while cancelling order" 
    });
  } finally {
    session.endSession();
  }
};

// ─── ADMIN CONTROLLERS ───────────────────────────────────────────────────────

// ─── Valid Order Status Transition Map ────────────────────────────────────────
// Defines which statuses can transition to which. Terminal states (delivered,
// cancelled) have no outgoing transitions. This is exported so the frontend
// can mirror the same rules in the admin dropdown.
export const ORDER_STATUS_TRANSITIONS = {
  pending:    ["confirmed", "processing", "cancelled"],
  confirmed:  ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],   // terminal
  cancelled:  [],   // terminal
};

/**
 * GET /api/orders/admin/all
 * Get all orders (Admin only)
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).populate("user", "name email");
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while fetching all orders" });
  }
};

/**
 * PATCH /api/orders/admin/:id/status
 * Update order status (Admin only)
 *
 * Enforces valid transitions:
 *   pending    → confirmed, processing, cancelled
 *   confirmed  → processing, shipped, cancelled
 *   processing → shipped, cancelled
 *   shipped    → delivered
 *   delivered  → (none — terminal)
 *   cancelled  → (none — terminal)
 *
 * When transitioning to "cancelled", product stock is restored (same logic
 * as the user-facing cancelMyOrder).
 */
export const updateOrderStatus = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  const { orderStatus } = req.body;

  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(orderStatus)) {
    return res.status(400).json({ success: false, message: "Invalid order status." });
  }

  // Use a transaction when cancelling (stock restoration), plain save otherwise
  const isCancelling = orderStatus === "cancelled";

  if (isCancelling) {
    // ── Cancel path: restore stock inside a transaction ──────────────────
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Order not found." });
      }

      const allowed = ORDER_STATUS_TRANSITIONS[order.orderStatus] || [];
      if (!allowed.includes(orderStatus)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Cannot transition from '${order.orderStatus}' to '${orderStatus}'.`,
        });
      }

      order.orderStatus = "cancelled";
      await order.save({ session });

      // Restore stock for every item
      for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          product.stock += item.quantity;
          await product.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      // Re-populate user for consistent response shape
      await order.populate("user", "name email");
      return res.status(200).json({ success: true, data: order });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ success: false, message: "Server error while updating order status" });
    }
  }

  // ── Normal (non-cancel) path ──────────────────────────────────────────────
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const allowed = ORDER_STATUS_TRANSITIONS[order.orderStatus] || [];
    if (!allowed.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${order.orderStatus}' to '${orderStatus}'.`,
      });
    }

    order.orderStatus = orderStatus;
    await order.save();

    // Re-populate user for consistent response shape
    await order.populate("user", "name email");
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while updating order status" });
  }
};

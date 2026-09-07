import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Helper to get or create a cart for the user, automatically filtering deleted products
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate("items.product", "name price image stock");
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  } else if (cart.items.some((item) => item.product === null)) {
    // Purge orphaned cart items where the product has been deleted from DB
    cart.items = cart.items.filter((item) => item.product !== null);
    await cart.save();
  }
  return cart;
};

/**
 * GET /api/cart
 * Get the current user's cart
 */
export const getCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while fetching cart" });
  }
};

/**
 * POST /api/cart
 * Add an item to the cart
 */
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, size = "", color = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ── Variant validation ────────────────────────────────────────────────
    // If the product defines specific sizes/colors, the client must pick
    // a valid one. Products without variants accept any (or empty) value.
    if (size && product.sizes && product.sizes.length > 0) {
      if (!product.sizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: `Invalid size '${size}'. Available sizes: ${product.sizes.join(", ")}`,
        });
      }
    }
    if (color && product.colors && product.colors.length > 0) {
      if (!product.colors.includes(color)) {
        return res.status(400).json({
          success: false,
          message: `Invalid color '${color}'. Available colors: ${product.colors.join(", ")}`,
        });
      }
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if identical item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => 
        item.product.toString() === productId && 
        item.size === size && 
        item.color === color
    );

    if (existingItemIndex > -1) {
      // Item exists, update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + Number(quantity);
      if (newQuantity > product.stock) {
        return res.status(400).json({ success: false, message: "Cannot add more than available stock" });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // New item
      if (quantity > product.stock) {
        return res.status(400).json({ success: false, message: "Cannot add more than available stock" });
      }
      cart.items.push({ product: productId, quantity: Number(quantity), size, color });
    }

    await cart.save();
    
    // Return populated cart
    cart = await Cart.findById(cart._id).populate("items.product", "name price image stock");
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while adding to cart" });
  }
};

/**
 * PUT /api/cart/:itemId
 * Update cart item quantity
 */
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid cart item ID" });
    }

    if (quantity === undefined || quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    const product = await Product.findById(item.product);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product no longer exists" });
    }

    if (quantity > product.stock) {
      return res.status(400).json({ success: false, message: "Requested quantity exceeds available stock" });
    }

    item.quantity = Number(quantity);
    await cart.save();

    await cart.populate("items.product", "name price image stock");
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while updating cart item" });
  }
};

/**
 * DELETE /api/cart/:itemId
 * Remove an item from the cart
 */
export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid cart item ID" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    await cart.populate("items.product", "name price image stock");
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while removing cart item" });
  }
};

/**
 * DELETE /api/cart
 * Clear all items from the cart
 */
export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(200).json({ success: true, data: { items: [] } }); // Already clear effectively
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error while clearing cart" });
  }
};

import { Router } from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// ─── All Cart Routes Require Authentication ──────────────────────────────────
router.use(protect);

// GET    /api/cart         — get current user's cart
// POST   /api/cart         — add item to cart
// DELETE /api/cart         — clear entire cart
router.route("/")
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

// PUT    /api/cart/:itemId — update item quantity
// DELETE /api/cart/:itemId — remove specific item
router.route("/:itemId")
  .put(updateCartItem)
  .delete(removeFromCart);

export default router;

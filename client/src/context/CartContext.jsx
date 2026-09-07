import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

const LOCAL_STORAGE_KEY = "nexora_cart";

// Helper to safely load cart from localStorage for guest users
const getGuestCart = () => {
  try {
    const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!savedCart) return [];
    const parsed = JSON.parse(savedCart);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load cart from localStorage:", error);
    return [];
  }
};

// Helper to generate a unique composite ID for guest cart variants
export const createCartItemId = (productId, selectedSize, selectedColor) => {
  const sizeKey = selectedSize ? String(selectedSize).trim() : "default";
  const colorKey = selectedColor ? String(selectedColor).trim() : "default";
  return `${productId}_${sizeKey}_${colorKey}`;
};

export const CartProvider = ({ children }) => {
  const { token, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState(null);

  // Fetch cart from backend for authenticated user, or load guest cart
  const fetchBackendCart = useCallback(async () => {
    if (!token) return;
    try {
      setCartLoading(true);
      const { data } = await API.get("/cart");
      if (data.success && data.data) {
        setCartItems(data.data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch backend cart:", error);
      // If 401 or 404, reset cart
      if (error.response?.status === 401 || error.response?.status === 404) {
        setCartItems([]);
      }
    } finally {
      setCartLoading(false);
    }
  }, [token]);

  // Synchronize cart state whenever auth token changes
  useEffect(() => {
    if (authLoading) return;

    if (token) {
      // User is authenticated -> load from backend
      fetchBackendCart();
    } else {
      // Guest user -> load from localStorage
      setCartItems(getGuestCart());
    }
  }, [token, authLoading, fetchBackendCart]);

  // Sync to localStorage only when user is NOT authenticated (guest mode)
  useEffect(() => {
    if (!token && !authLoading) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
      } catch (error) {
        console.error("Failed to save guest cart to localStorage:", error);
      }
    }
  }, [cartItems, token, authLoading]);

  // Add product to cart
  const addToCart = async (product, quantity = 1, selectedSize = null, selectedColor = null) => {
    const productId = product?._id || product?.id || (typeof product === "string" ? product : null);
    if (!productId) return { success: false, message: "Invalid product" };

    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);
    const size = typeof selectedSize === "string" ? selectedSize : selectedSize?.name || "";
    const color = typeof selectedColor === "string" ? selectedColor : selectedColor?.name || "";

    setCartError(null);

    if (token) {
      try {
        setCartLoading(true);
        const { data } = await API.post("/cart", {
          productId,
          quantity: qtyToAdd,
          size,
          color,
        });

        if (data.success && data.data) {
          setCartItems(data.data.items || []);
          return { success: true, data: data.data };
        }
      } catch (error) {
        const message = error.response?.data?.message || "Failed to add item to cart";
        setCartError(message);
        alert(message);
        return { success: false, message };
      } finally {
        setCartLoading(false);
      }
    } else {
      // Guest local cart handling
      const cartItemId = createCartItemId(productId, size, color);

      setCartItems((prevItems) => {
        const existingIndex = prevItems.findIndex(
          (item) => (item.cartItemId || item._id) === cartItemId
        );

        if (existingIndex > -1) {
          const updated = [...prevItems];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + qtyToAdd,
          };
          return updated;
        }

        const newItem = {
          cartItemId,
          _id: cartItemId,
          product: typeof product === "object" ? product : { _id: productId, id: productId },
          quantity: qtyToAdd,
          size,
          color,
          selectedSize: size || null,
          selectedColor: color || null,
        };

        return [...prevItems, newItem];
      });

      return { success: true };
    }
  };

  // Remove single item from cart
  const removeFromCart = async (cartItemId) => {
    const item = cartItems.find((i) => (i._id || i.cartItemId) === cartItemId);
    const itemId = item?._id || cartItemId;

    setCartError(null);

    if (token) {
      try {
        setCartLoading(true);
        const { data } = await API.delete(`/cart/${itemId}`);
        if (data.success && data.data) {
          setCartItems(data.data.items || []);
          return { success: true };
        }
      } catch (error) {
        const message = error.response?.data?.message || "Failed to remove item from cart";
        setCartError(message);
        alert(message);
        return { success: false, message };
      } finally {
        setCartLoading(false);
      }
    } else {
      setCartItems((prevItems) =>
        prevItems.filter((i) => (i._id || i.cartItemId) !== cartItemId)
      );
      return { success: true };
    }
  };

  // Increase quantity of a cart item
  const increaseQuantity = async (cartItemId) => {
    const item = cartItems.find((i) => (i._id || i.cartItemId) === cartItemId);
    if (!item) return;
    const newQty = (item.quantity || 1) + 1;
    const itemId = item._id || cartItemId;

    setCartError(null);

    if (token) {
      try {
        const { data } = await API.put(`/cart/${itemId}`, { quantity: newQty });
        if (data.success && data.data) {
          setCartItems(data.data.items || []);
          return { success: true };
        }
      } catch (error) {
        const message = error.response?.data?.message || "Failed to update item quantity";
        setCartError(message);
        alert(message);
        return { success: false, message };
      }
    } else {
      setCartItems((prevItems) =>
        prevItems.map((i) =>
          (i._id || i.cartItemId) === cartItemId
            ? { ...i, quantity: newQty }
            : i
        )
      );
      return { success: true };
    }
  };

  // Decrease quantity of a cart item (minimum 1)
  const decreaseQuantity = async (cartItemId) => {
    const item = cartItems.find((i) => (i._id || i.cartItemId) === cartItemId);
    if (!item || item.quantity <= 1) return;
    const newQty = item.quantity - 1;
    const itemId = item._id || cartItemId;

    setCartError(null);

    if (token) {
      try {
        const { data } = await API.put(`/cart/${itemId}`, { quantity: newQty });
        if (data.success && data.data) {
          setCartItems(data.data.items || []);
          return { success: true };
        }
      } catch (error) {
        const message = error.response?.data?.message || "Failed to update item quantity";
        setCartError(message);
        alert(message);
        return { success: false, message };
      }
    } else {
      setCartItems((prevItems) =>
        prevItems.map((i) =>
          (i._id || i.cartItemId) === cartItemId
            ? { ...i, quantity: newQty }
            : i
        )
      );
      return { success: true };
    }
  };

  // Clear all cart items
  const clearCart = async () => {
    setCartError(null);
    if (token) {
      try {
        setCartLoading(true);
        const { data } = await API.delete("/cart");
        if (data.success) {
          setCartItems([]);
          return { success: true };
        }
      } catch (error) {
        const message = error.response?.data?.message || "Failed to clear cart";
        setCartError(message);
        console.error(message);
      } finally {
        setCartLoading(false);
      }
    } else {
      setCartItems([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return { success: true };
    }
  };

  // Derived Values — safely guard against null/deleted product references
  const validCartItems = cartItems.filter((item) => item && item.product);
  const cartItemCount = validCartItems.reduce((total, item) => total + (item.quantity || 0), 0);

  const rawSubtotal = validCartItems.reduce((sum, item) => {
    const itemPrice = item.product?.price || 0;
    return sum + itemPrice * (item.quantity || 0);
  }, 0);

  const cartSubtotal = Math.round(rawSubtotal * 100) / 100;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartItemCount,
        cartSubtotal,
        cartLoading,
        cartError,
        fetchBackendCart,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Custom Hook to consume cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export default CartContext;


import React, { createContext, useContext, useState, useEffect } from "react";

const WishlistContext = createContext();

const LOCAL_STORAGE_KEY = "nexora_wishlist";

// Helper to safely load wishlist from localStorage
const getInitialWishlist = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load wishlist from localStorage:", error);
    return [];
  }
};

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState(getInitialWishlist);

  // Sync to localStorage whenever wishlist changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wishlistItems));
    } catch (error) {
      console.error("Failed to save wishlist to localStorage:", error);
    }
  }, [wishlistItems]);

  // Check if product is in wishlist
  const isInWishlist = (productId) => {
    if (!productId) return false;
    return wishlistItems.some((item) => String(item._id || item.id) === String(productId));
  };

  // Add product to wishlist
  const addToWishlist = (product) => {
    const prodId = product?._id || product?.id;
    if (!prodId) return;
    setWishlistItems((prev) => {
      if (prev.some((item) => String(item._id || item.id) === String(prodId))) {
        return prev;
      }
      return [...prev, product];
    });
  };

  // Remove product from wishlist by ID
  const removeFromWishlist = (productId) => {
    if (!productId) return;
    setWishlistItems((prev) => prev.filter((item) => String(item._id || item.id) !== String(productId)));
  };

  // Toggle wishlist state
  const toggleWishlist = (product) => {
    const prodId = product?._id || product?.id;
    if (!prodId) return;
    if (isInWishlist(prodId)) {
      removeFromWishlist(prodId);
    } else {
      addToWishlist(product);
    }
  };

  // Derived Values
  const wishlistCount = wishlistItems.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistCount,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

// Custom Hook to consume wishlist context
export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

export default WishlistContext;

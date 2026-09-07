import React from "react";
import { Link } from "react-router-dom";
import { useWishlist } from "../../context/WishlistContext";
import ProductCard from "../../components/ProductCard/ProductCard";
import "./Wishlist.css";

const Wishlist = () => {
  const { wishlistItems, wishlistCount } = useWishlist();

  if (!wishlistItems || wishlistItems.length === 0) {
    return (
      <main className="wishlist-page">
        <div className="wishlist-container">
          <div className="wishlist-empty-state">
            <span className="empty-wishlist-icon" aria-hidden="true">❤️</span>
            <h2>Your Wishlist is Empty</h2>
            <p>
              Save your favorite items here while exploring our collection so you can easily find and purchase them later.
            </p>
            <Link to="/shop" className="btn-explore-shop">
              <span>Explore Products</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wishlist-page">
      <div className="wishlist-container">
        
        {/* Header */}
        <div className="wishlist-header">
          <div className="wishlist-title-row">
            <div>
              <span className="wishlist-eyebrow">SAVED ITEMS</span>
              <h1 className="wishlist-title">My Wishlist</h1>
            </div>
            <span className="wishlist-count-badge">
              {wishlistCount} {wishlistCount === 1 ? "Item Saved" : "Items Saved"}
            </span>
          </div>
          <div className="wishlist-title-underline" aria-hidden="true" />
        </div>

        {/* Saved Products Grid */}
        <div className="wishlist-grid">
          {wishlistItems.map((product) => (
            <ProductCard key={product._id || product.id} product={product} />
          ))}
        </div>

      </div>
    </main>
  );
};

export default Wishlist;

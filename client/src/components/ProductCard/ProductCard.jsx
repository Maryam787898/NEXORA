import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import "./ProductCard.css";

const ProductCard = ({ product }) => {
  const [imageError, setImageError] = useState(false);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  if (!product) return null;

  const {
    _id,
    id = _id, // fallback for mock data
    name,
    category,
    price,
    oldPrice,
    image,
    rating,
    reviewsCount,
    badge,
    color,
    icon,
  } = product;

  const isWishlisted = isInWishlist(id);

  const handleAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await addToCart(product, 1);
    if (res?.success !== false) {
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
      }, 1500);
    }
  };

  const handleToggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <article className="product-card">
      {/* Top Image / Media Section */}
      <div className="product-card-media">
        <Link to={`/product/${id}`} className="product-card-image-link" aria-label={`View details for ${name}`}>
          {!imageError && image ? (
            <img
              src={image}
              alt={name}
              className="product-card-image"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : null}

          {/* Fallback styled placeholder visual when image file is missing or fails */}
          <div
            className={`product-card-placeholder ${imageError || !image ? "active" : ""}`}
            style={{ background: color || "linear-gradient(135deg, #1e293b, #0f172a)" }}
          >
            <span className="product-placeholder-icon" aria-hidden="true">
              {icon || "🛍️"}
            </span>
            <span className="product-placeholder-category">{category}</span>
          </div>

          <div className="product-card-overlay" aria-hidden="true" />
        </Link>

        {/* Badge tag */}
        {badge && <span className="product-card-badge">{badge}</span>}

        {/* Wishlist Heart Button */}
        <button
          type="button"
          className={`product-card-wishlist-btn ${isWishlisted ? "active" : ""}`}
          aria-label={isWishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
          onClick={handleToggleWishlist}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isWishlisted ? "#ef4444" : "none"}
            stroke={isWishlisted ? "#ef4444" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Product Content Details */}
      <div className="product-card-content">
        <div className="product-card-meta">
          <span className="product-card-category">{category}</span>
          {rating && (
            <div className="product-card-rating" aria-label={`Rating: ${rating} out of 5 stars`}>
              <span className="star-icon">★</span>
              <span className="rating-score">{rating.toFixed(1)}</span>
              {reviewsCount && <span className="rating-count">({reviewsCount})</span>}
            </div>
          )}
        </div>

        <h3 className="product-card-title">
          <Link to={`/product/${id}`}>{name}</Link>
        </h3>

        <div className="product-card-footer">
          <div className="product-card-pricing">
            <span className="product-card-price">${price.toFixed(2)}</span>
            {oldPrice && (
              <span className="product-card-old-price">${oldPrice.toFixed(2)}</span>
            )}
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            className={`product-card-add-btn ${added ? "added" : ""}`}
            aria-label={`Add ${name} to cart`}
            onClick={handleAdd}
          >
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
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>{added ? "Added!" : "Add"}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

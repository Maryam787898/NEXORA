import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import ProductCard from "../../components/ProductCard/ProductCard";
import API from "../../api/axios";
import "./ProductDetails.css";

const SIZES_BY_CATEGORY = {
  Men: ["S", "M", "L", "XL", "XXL"],
  Women: ["XS", "S", "M", "L", "XL"],
  Kids: ["4Y", "6Y", "8Y", "10Y", "12Y"],
  Accessories: ["One Size"],
};

const COLORS_BY_CATEGORY = {
  Men: [
    { name: "Onyx Black", hex: "#121317" },
    { name: "Charcoal Slate", hex: "#334155" },
    { name: "Heather Gray", hex: "#64748b" },
  ],
  Women: [
    { name: "Midnight Navy", hex: "#1e1b4b" },
    { name: "Plum Velvet", hex: "#4a044e" },
    { name: "Cream White", hex: "#f8fafc" },
  ],
  Kids: [
    { name: "Forest Green", hex: "#065f46" },
    { name: "Denim Blue", hex: "#1e40af" },
    { name: "Sunset Orange", hex: "#c2410c" },
  ],
  Accessories: [
    { name: "Espresso Brown", hex: "#3e2723" },
    { name: "Obsidian", hex: "#0f172a" },
    { name: "Metallic Gold", hex: "#d97706" },
  ],
};

const ProductDetails = () => {
  const { productId } = useParams();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [imageError, setImageError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState(null);
  const [addedToCartToast, setAddedToCartToast] = useState(false);

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch product from API
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const { data } = await API.get(`/products/${productId}`);
        if (data.success) {
          setProduct(data.data);
        }
        
        // Also fetch a few products for the "Related Products" section
        const relatedRes = await API.get("/products");
        if (relatedRes.data.success) {
          setRelatedProducts(relatedRes.data.data.filter(p => p._id !== productId).slice(0, 4));
        }
      } catch (error) {
        console.error("Error fetching product details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  const isWishlisted = product ? isInWishlist(product._id || product.id) : false;

  // Reset local state when productId changes
  useEffect(() => {
    setImageError(false);
    setQuantity(1);
    setAddedToCartToast(false);

    if (product) {
      const sizes = SIZES_BY_CATEGORY[product.category] || ["S", "M", "L", "XL"];
      const colors = COLORS_BY_CATEGORY[product.category] || [
        { name: "Default", hex: "#1e293b" },
      ];
      setSelectedSize(sizes[0]);
      setSelectedColor(colors[0]);
    }
    // Scroll smoothly to top on page load
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [productId, product]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading...</div>;
  }

  // Handle Product Not Found
  if (!product) {
    return (
      <main className="product-details-page">
        <div className="product-details-container">
          <nav className="breadcrumb" aria-label="Breadcrumb navigation">
            <Link to="/">Home</Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/shop">Shop</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Not Found</span>
          </nav>

          <div className="product-not-found">
            <span className="not-found-icon" aria-hidden="true">🔍</span>
            <h2>Product Not Found</h2>
            <p>We couldn't find the item you're looking for. It may have been moved or is no longer available.</p>
            <Link to="/shop" className="btn-back-shop">
              ← Back to Shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const {
    name,
    category,
    price,
    oldPrice,
    image,
    rating,
    reviewsCount = 120,
    badge,
    color,
    icon,
  } = product;

  // Description generator using product metadata
  const description =
    product.description ||
    `Crafted with luxury materials and modern engineering, the ${name} offers exceptional comfort, high versatility, and long-lasting durability for any wardrobe.`;

  const availableSizes = SIZES_BY_CATEGORY[category] || ["S", "M", "L", "XL"];
  const availableColors = COLORS_BY_CATEGORY[category] || [
    { name: "Standard", hex: "#1e293b" },
  ];

  // Related products (exclude current product)
  // Already fetched in the API call above

  const handleDecreaseQuantity = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseQuantity = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleAddToCart = async () => {
    const res = await addToCart(product, quantity, selectedSize, selectedColor?.name || selectedColor || "");
    if (res?.success !== false) {
      setAddedToCartToast(true);
      setTimeout(() => {
        setAddedToCartToast(false);
      }, 3000);
    }
  };

  return (
    <main className="product-details-page">
      <div className="product-details-container">
        
        {/* Navigation & Breadcrumbs */}
        <div className="product-details-top-bar">
          <nav className="breadcrumb" aria-label="Breadcrumb navigation">
            <Link to="/">Home</Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/shop">Shop</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{name}</span>
          </nav>

          <Link to="/shop" className="back-link" aria-label="Return to shop page">
            ← Back to Shop
          </Link>
        </div>

        {/* Product Showcase Section */}
        <div className="product-showcase-grid">
          
          {/* Left Column: Image / Gallery Visual */}
          <div className="product-gallery">
            <div className="product-main-image-wrapper">
              {!imageError && image ? (
                <img
                  src={image}
                  alt={`${name} preview`}
                  className="product-main-image"
                  onError={() => setImageError(true)}
                />
              ) : null}

              <div
                className={`product-main-placeholder ${imageError || !image ? "active" : ""}`}
                style={{ background: color || "linear-gradient(135deg, #1e293b, #0f172a)" }}
              >
                <span className="placeholder-big-icon" aria-hidden="true">
                  {icon || "🛍️"}
                </span>
                <span className="placeholder-category-tag">{category} Collection</span>
              </div>

              {badge && <span className="product-detail-badge">{badge}</span>}
            </div>
          </div>

          {/* Right Column: Product Information & Controls */}
          <div className="product-info">
            <div className="product-info-header">
              <span className="product-category-label">{category}</span>
              <h1 className="product-title">{name}</h1>
              
              {/* Rating */}
              <div className="product-rating-row">
                <div className="stars" aria-label={`Rated ${rating} out of 5 stars`}>
                  {"★".repeat(Math.round(rating))}
                  {"☆".repeat(5 - Math.round(rating))}
                </div>
                <span className="rating-num">{rating}</span>
                <span className="rating-divider">•</span>
                <span className="reviews-text">{reviewsCount} Verified Reviews</span>
              </div>
            </div>

            {/* Pricing */}
            <div className="product-price-row">
              <span className="current-price">${price.toFixed(2)}</span>
              {oldPrice && (
                <>
                  <span className="old-price">${oldPrice.toFixed(2)}</span>
                  <span className="discount-tag">
                    Save ${(oldPrice - price).toFixed(2)}
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="product-description">{description}</p>

            <hr className="product-divider" />

            {/* Color Selector */}
            {availableColors && availableColors.length > 0 && (
              <fieldset className="option-group">
                <legend className="option-label">
                  Color: <strong>{selectedColor?.name || "Default"}</strong>
                </legend>
                <div className="color-swatches" role="radiogroup" aria-label="Color options">
                  {availableColors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={selectedColor?.name === c.name}
                      aria-label={`Select ${c.name} color`}
                      className={`color-swatch-btn ${selectedColor?.name === c.name ? "selected" : ""}`}
                      onClick={() => setSelectedColor(c)}
                    >
                      <span
                        className="color-dot"
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Size Selector */}
            {availableSizes && availableSizes.length > 0 && (
              <fieldset className="option-group">
                <legend className="option-label">
                  Select Size: <strong>{selectedSize}</strong>
                </legend>
                <div className="size-chips" role="radiogroup" aria-label="Size options">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={selectedSize === size}
                      aria-label={`Select size ${size}`}
                      className={`size-chip-btn ${selectedSize === size ? "selected" : ""}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Quantity Selector */}
            <div className="option-group">
              <label htmlFor="product-quantity-input" className="option-label">
                Quantity:
              </label>
              <div className="quantity-controls">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={handleDecreaseQuantity}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  id="product-quantity-input"
                  type="number"
                  className="qty-input"
                  value={quantity}
                  min="1"
                  readOnly
                  aria-label="Current quantity"
                />
                <button
                  type="button"
                  className="qty-btn"
                  onClick={handleIncreaseQuantity}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="product-actions-row">
              <button
                type="button"
                className="btn-add-to-cart"
                onClick={handleAddToCart}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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
                <span>Add to Cart</span>
              </button>

              <button
                type="button"
                className={`btn-wishlist ${isWishlisted ? "active" : ""}`}
                onClick={() => toggleWishlist(product)}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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

            {/* Notification Toast */}
            {addedToCartToast && (
              <div className="cart-toast-notification" role="status">
                ✓ Added {quantity} × {name} ({selectedSize}) to your cart
              </div>
            )}

            {/* Feature Highlights */}
            <div className="product-highlights">
              <div className="highlight-item">
                <span className="highlight-icon">🚚</span>
                <span>Free Express Shipping over $100</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">🔄</span>
                <span>30-Day Hassle-Free Returns</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">🛡️</span>
                <span>2-Year NEXORA Quality Guarantee</span>
              </div>
            </div>

          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="related-products-section" aria-labelledby="related-products-heading">
            <div className="related-header">
              <span className="related-eyebrow">EXPLORE MORE</span>
              <h2 id="related-products-heading" className="related-title">You Might Also Like</h2>
              <div className="related-title-underline" aria-hidden="true" />
            </div>

            <div className="related-products-grid">
              {relatedProducts.map((relProduct) => (
                <ProductCard key={relProduct._id || relProduct.id} product={relProduct} />
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
};

export default ProductDetails;
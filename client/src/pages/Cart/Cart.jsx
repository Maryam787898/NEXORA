import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import "./Cart.css";

const Cart = () => {
  const {
    cartItems,
    cartItemCount,
    cartSubtotal,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
  } = useCart();

  const [imageErrors, setImageErrors] = useState({});

  const handleImageError = (id) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const estimatedTax = Math.round(cartSubtotal * 0.08 * 100) / 100;
  const shippingFee = cartSubtotal >= 100 || cartSubtotal === 0 ? 0 : 9.99;
  const grandTotal = Math.round((cartSubtotal + estimatedTax + shippingFee) * 100) / 100;

  if (!cartItems || cartItems.length === 0) {
    return (
      <main className="cart-page">
        <div className="cart-container">
          <div className="cart-empty-state">
            <span className="empty-cart-icon" aria-hidden="true">🛒</span>
            <h2>Your Shopping Cart is Empty</h2>
            <p>
              Looks like you haven't added anything to your cart yet. Explore our curated categories and find your next style.
            </p>
            <Link to="/shop" className="btn-start-shopping">
              <span>Start Shopping</span>
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
    <main className="cart-page">
      <div className="cart-container">
        
        {/* Header */}
        <div className="cart-header">
          <div className="cart-title-row">
            <h1 className="cart-title">Your Shopping Cart</h1>
            <span className="cart-items-count">
              {cartItemCount} {cartItemCount === 1 ? "Item" : "Items"}
            </span>
          </div>
        </div>

        {/* Cart Main Grid */}
        <div className="cart-grid">
          
          {/* Left Column: Cart Line Items */}
          <div className="cart-items-section">
            {cartItems.map((item) => {
              const cartItemId = item._id || item.cartItemId;
              const product = item.product;
              const quantity = item.quantity || 1;
              const selectedSize = item.size || item.selectedSize;
              const selectedColor = item.color || item.selectedColor;
              const productId = product?._id || product?.id;
              const hasImageError = imageErrors[cartItemId];
              const itemPrice = product?.price || 0;
              const lineTotal = Math.round(itemPrice * quantity * 100) / 100;

              return (
                <div key={cartItemId} className="cart-item-card">
                  {/* Thumbnail Image */}
                  <div className="cart-item-image-wrapper">
                    {!hasImageError && product?.image ? (
                      <img
                        src={product.image}
                        alt={product?.name || "Product"}
                        className="cart-item-image"
                        onError={() => handleImageError(cartItemId)}
                      />
                    ) : null}

                    <div
                      className="cart-item-placeholder"
                      style={{
                        background: product?.color || "linear-gradient(135deg, #1e293b, #0f172a)",
                        display: hasImageError || !product?.image ? "flex" : "none",
                      }}
                    >
                      <span>{product?.icon || "🛍️"}</span>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="cart-item-info">
                    <h3 className="cart-item-name">
                      <Link to={`/product/${productId}`}>{product?.name || "Product"}</Link>
                    </h3>

                    <div className="cart-item-variants">
                      {selectedSize && (
                        <span className="variant-badge">Size: {selectedSize}</span>
                      )}
                      {selectedColor && (
                        <span className="variant-badge">Color: {selectedColor}</span>
                      )}
                    </div>

                    <span className="cart-item-unit-price">
                      ${itemPrice.toFixed(2)} each
                    </span>
                  </div>

                  {/* Quantity Modifier Controls */}
                  <div className="cart-item-actions">
                    <div className="cart-qty-controls" aria-label="Adjust item quantity">
                      <button
                        type="button"
                        className="cart-qty-btn"
                        onClick={() => decreaseQuantity(cartItemId)}
                        disabled={quantity <= 1}
                        aria-label={`Decrease quantity of ${product?.name}`}
                      >
                        −
                      </button>
                      <span className="cart-qty-value">{quantity}</span>
                      <button
                        type="button"
                        className="cart-qty-btn"
                        onClick={() => increaseQuantity(cartItemId)}
                        aria-label={`Increase quantity of ${product?.name}`}
                      >
                        +
                      </button>
                    </div>

                    <span className="cart-item-line-total">${lineTotal.toFixed(2)}</span>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    className="cart-item-remove-btn"
                    onClick={() => removeFromCart(cartItemId)}
                    aria-label={`Remove ${product?.name} from cart`}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {/* Footer Control Buttons */}
            <div className="cart-items-footer">
              <Link to="/shop" className="btn-continue-shopping">
                ← Continue Shopping
              </Link>
              <button
                type="button"
                className="btn-clear-cart"
                onClick={clearCart}
              >
                Clear Cart
              </button>
            </div>
          </div>

          {/* Right Column: Order Summary Sidebar */}
          <div className="order-summary-card">
            <h2 className="order-summary-title">Order Summary</h2>

            <div className="summary-row">
              <span>Subtotal ({cartItemCount} items)</span>
              <span>${cartSubtotal.toFixed(2)}</span>
            </div>

            <div className="summary-row">
              <span>Estimated Shipping</span>
              <span>
                {shippingFee === 0 ? (
                  <strong style={{ color: "#34d399" }}>FREE</strong>
                ) : (
                  `$${shippingFee.toFixed(2)}`
                )}
              </span>
            </div>

            <div className="summary-row">
              <span>Estimated Sales Tax (8%)</span>
              <span>${estimatedTax.toFixed(2)}</span>
            </div>

            <hr className="summary-divider" />

            <div className="summary-row total-row">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>

            {/* Checkout Button */}
            <Link
              to="/checkout"
              className="btn-checkout"
              style={{ textDecoration: "none" }}
            >
              <span>Proceed to Checkout</span>
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

            <div className="checkout-security-notice">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Encrypted 256-bit SSL Checkout</span>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
};

export default Cart;
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import API from "../../api/axios";
import "./Checkout.css";

const Checkout = () => {
  const { cartItems, cartItemCount, cartSubtotal, fetchBackendCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "Pakistan",
  });

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Pricing preview (mirrors backend formula exactly) ──────────────────────
  // Backend rule: free shipping ≥ $100; $9.99 otherwise; 8% tax on subtotal.
  // These are display-only estimates — the stored Order total comes from the server.
  const shippingFee    = cartSubtotal >= 100 || cartSubtotal === 0 ? 0 : 9.99;
  const estimatedTax   = Math.round(cartSubtotal * 0.08 * 100) / 100;
  const estimatedTotal = Math.round((cartSubtotal + estimatedTax + shippingFee) * 100) / 100;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg("");

    if (
      !formData.fullName.trim() ||
      !formData.phone.trim() ||
      !formData.address.trim() ||
      !formData.city.trim() ||
      !formData.postalCode.trim() ||
      !formData.country.trim()
    ) {
      setErrorMsg("Please fill in all required shipping address fields.");
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      setErrorMsg("Your cart is empty. Please add products before placing an order.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Send shippingAddress + paymentMethod. Backend validates the method and
      // calculates all amounts — the frontend never controls totals or payment state.
      const { data } = await API.post("/orders", {
        shippingAddress: {
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        },
        paymentMethod,
      });

      if (data.success && data.data) {
        await fetchBackendCart();
        const orderId = data.data._id;

        if (paymentMethod === "online") {
          // Navigate to order details with a flag to trigger the payment flow
          navigate(`/orders/${orderId}`, {
            state: { orderCreated: true, initiatePayment: true },
          });
        } else {
          // COD — just show the order details success screen
          navigate(`/orders/${orderId}`, {
            state: { orderCreated: true },
          });
        }
      }
    } catch (error) {
      console.error("Order creation failed:", error);
      const message =
        error.response?.data?.message ||
        "Failed to place order. Please check your cart and try again.";
      setErrorMsg(message);
      setIsSubmitting(false);
    }
  };

  if (!cartItems || cartItems.length === 0) {
    return (
      <main className="checkout-page">
        <div className="checkout-container">
          <div className="checkout-empty">
            <h2>Your Shopping Cart is Empty</h2>
            <p>You cannot checkout with an empty cart. Please add items to proceed.</p>
            <Link
              to="/shop"
              className="btn-place-order"
              style={{ maxWidth: "240px", margin: "0 auto", textDecoration: "none" }}
            >
              Explore Shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-container">

        {/* Header */}
        <div className="checkout-header">
          <div className="checkout-title-row">
            <h1 className="checkout-title">Checkout</h1>
            <span className="checkout-step-badge">Step 1 of 1 • Shipping &amp; Payment</span>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="checkout-error-banner" role="alert">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="checkout-grid">

          {/* Left Column: Shipping + Payment Method */}
          <section className="checkout-form-section">
            <h2 className="section-subtitle">
              <span>📍</span>
              <span>Shipping Information</span>
            </h2>

            <form className="checkout-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="checkout-field">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="e.g. Maryam Khan"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="phone">Phone Number *</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="e.g. 03001234567"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="address">Street Address *</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  placeholder="e.g. 123 Main Avenue, Suite 4B"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <div className="checkout-field">
                  <label htmlFor="city">City *</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    required
                    placeholder="e.g. Lahore"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="postalCode">Postal / Zip Code *</label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    required
                    placeholder="e.g. 54000"
                    value={formData.postalCode}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="country">Country *</label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  required
                  placeholder="e.g. Pakistan"
                  value={formData.country}
                  onChange={handleChange}
                />
              </div>

              {/* ── Payment Method Selection ── */}
              <div className="checkout-field">
                <label>Payment Method *</label>
                <div className="payment-method-options" role="radiogroup" aria-label="Payment method">
                  <label
                    className={`payment-method-option ${paymentMethod === "cod" ? "selected" : ""}`}
                    htmlFor="pm-cod"
                  >
                    <input
                      id="pm-cod"
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                    />
                    <span className="pm-icon">🚚</span>
                    <span className="pm-label">
                      <strong>Cash on Delivery</strong>
                      <small>Pay when your order arrives</small>
                    </span>
                  </label>

                  <label
                    className={`payment-method-option ${paymentMethod === "online" ? "selected" : ""}`}
                    htmlFor="pm-online"
                  >
                    <input
                      id="pm-online"
                      type="radio"
                      name="paymentMethod"
                      value="online"
                      checked={paymentMethod === "online"}
                      onChange={() => setPaymentMethod("online")}
                    />
                    <span className="pm-icon">💳</span>
                    <span className="pm-label">
                      <strong>Online Payment</strong>
                      <small>Simulated secure payment</small>
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn-place-order"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Processing Order...</span>
                ) : (
                  <>
                    <span>
                      {paymentMethod === "online"
                        ? "Place Order & Pay Online"
                        : "Confirm & Place Order (COD)"}
                    </span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Right Column: Order Summary */}
          <aside className="checkout-summary-card">
            <h2 className="checkout-summary-title">Order Summary</h2>

            <div className="checkout-items-preview">
              {cartItems.map((item) => {
                const product = item.product;
                const quantity = item.quantity || 1;
                const size = item.size || item.selectedSize;
                const color = item.color || item.selectedColor;
                const itemPrice = product?.price || 0;
                const itemId = item._id || item.cartItemId;

                return (
                  <div key={itemId} className="checkout-item-row">
                    <img
                      src={product?.image || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518"}
                      alt={product?.name || "Product"}
                      className="checkout-item-img"
                    />
                    <div className="checkout-item-info">
                      <h4 className="checkout-item-name">{product?.name || "Item"}</h4>
                      <span className="checkout-item-meta">
                        Qty: {quantity}
                        {size ? ` • Size: ${size}` : ""}
                        {color ? ` • ${color}` : ""}
                      </span>
                    </div>
                    <span className="checkout-item-price">
                      ${(itemPrice * quantity).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="checkout-breakdown">
              <div className="breakdown-row">
                <span>Items Subtotal ({cartItemCount})</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="breakdown-row">
                <span>Shipping</span>
                <span>
                  {shippingFee === 0 ? (
                    <strong style={{ color: "#34d399" }}>FREE</strong>
                  ) : (
                    `$${shippingFee.toFixed(2)}`
                  )}
                </span>
              </div>
              <div className="breakdown-row">
                <span>Sales Tax (8%)</span>
                <span>${estimatedTax.toFixed(2)}</span>
              </div>
              <div className="breakdown-row total-row">
                <span>Grand Total</span>
                <span>${estimatedTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method summary */}
            <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", fontSize: "0.85rem", color: "#94a3b8" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Payment Method</span>
                <span style={{ color: "#f1f5f9", fontWeight: "600" }}>
                  {paymentMethod === "cod" ? "🚚 Cash on Delivery" : "💳 Online Payment"}
                </span>
              </div>
            </div>

            <div style={{ marginTop: "12px", fontSize: "0.8rem", color: "#64748b", textAlign: "center" }}>
              🔒 Authoritative prices and stock verified atomically by NEXORA server.
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
};

export default Checkout;

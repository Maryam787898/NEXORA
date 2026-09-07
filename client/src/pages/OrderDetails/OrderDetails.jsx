import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import API from "../../api/axios";
import "./OrderDetails.css";

const OrderDetails = () => {
  const { id } = useParams();
  const location = useLocation();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [showCreatedToast] = useState(
    location.state?.orderCreated || false
  );

  // ── Payment flow state ───────────────────────────────────────────────────
  // paymentStep values:
  //   null        → no payment UI (COD or already paid or cancelled)
  //   "idle"      → Pay Now button visible
  //   "loading"   → initiate API in flight (disables button, prevents duplicate calls)
  //   "initiated" → simulated payment modal shown
  //   "confirming"→ confirm API in flight
  //   "done"      → payment confirmed this session
  const [paymentStep, setPaymentStep] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentError, setPaymentError] = useState("");

  // Ref guard to prevent simultaneous confirm calls from double-click
  const isConfirming = useRef(false);

  // Derive initial paymentStep once the order loads — keeps location.state out of
  // the render cycle once we have real order data.
  const derivePaymentStep = useCallback((loadedOrder) => {
    if (!loadedOrder) return null;
    if (loadedOrder.paymentStatus === "paid") return null;
    if (loadedOrder.orderStatus === "cancelled") return null;
    if (loadedOrder.paymentMethod === "online" && location.state?.initiatePayment) {
      return "idle";
    }
    if (loadedOrder.paymentMethod === "online" &&
        loadedOrder.paymentStatus !== "paid") {
      return "idle";
    }
    return null;
  }, [location.state?.initiatePayment]);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await API.get(`/orders/${id}`);
      if (data.success) {
        setOrder(data.data);
        setPaymentStep(derivePaymentStep(data.data));
      }
    } catch (err) {
      console.error("Failed to fetch order details:", err);
      setError(err.response?.data?.message || "Order not found or unauthorized.");
    } finally {
      setLoading(false);
    }
  }, [id, derivePaymentStep]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── Cancel order ─────────────────────────────────────────────────────────
  const handleCancelOrder = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this order? This will restore product stock."
      )
    ) return;

    try {
      setIsCancelling(true);
      setError("");
      const { data } = await API.patch(`/orders/${id}/cancel`);
      if (data.success) {
        setOrder(data.data);
        setCancelMessage("Your order has been cancelled and stock has been restored.");
        setPaymentStep(null);
        setPaymentInfo(null);
        setPaymentError("");
      }
    } catch (err) {
      console.error("Failed to cancel order:", err);
      setError(err.response?.data?.message || "Could not cancel this order.");
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Initiate payment ──────────────────────────────────────────────────────
  // Guard: if paymentStep is already "loading" or "initiated", do nothing.
  const handleInitiatePayment = async () => {
    if (paymentStep === "loading" || paymentStep === "initiated") return;
    setPaymentError("");
    setPaymentStep("loading");
    try {
      const { data } = await API.post(`/payments/${id}/initiate`);
      if (data.success) {
        setPaymentInfo(data.payment);
        setPaymentStep("initiated");
      }
    } catch (err) {
      console.error("Payment initiation failed:", err);
      setPaymentError(
        err.response?.data?.message || "Could not initiate payment. Please try again."
      );
      setPaymentStep("idle");
    }
  };

  // ── Confirm payment ───────────────────────────────────────────────────────
  // Ref guard prevents double-fire from fast double-click on Confirm button.
  const handleConfirmPayment = async () => {
    if (isConfirming.current) return;
    isConfirming.current = true;
    setPaymentError("");
    setPaymentStep("confirming");
    try {
      const { data } = await API.post(`/payments/${id}/confirm`);
      if (data.success) {
        setPaymentStep("done");
        await fetchOrder();   // refresh to get paidAt, paymentReference, updated status
      }
    } catch (err) {
      console.error("Payment confirmation failed:", err);
      setPaymentError(
        err.response?.data?.message || "Payment could not be confirmed. Please try again."
      );
      setPaymentStep("initiated");
    } finally {
      isConfirming.current = false;
    }
  };

  const handleCancelPayment = () => {
    setPaymentStep("idle");
    setPaymentInfo(null);
    setPaymentError("");
  };

  // ── Formatting helpers ────────────────────────────────────────────────────
  const formatDate = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const paymentMethodLabel = (method) => {
    if (method === "online") return "💳 Online Payment";
    if (method === "cod")    return "🚚 Cash on Delivery";
    return method || "—";
  };

  const paymentStatusLabel = (status) => {
    switch (status) {
      case "paid":     return { text: "Paid",     css: "paid"     };
      case "failed":   return { text: "Failed",   css: "failed"   };
      case "refunded": return { text: "Refunded", css: "refunded" };
      default:         return { text: "Pending",  css: "pending"  };
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="order-details-page">
        <div className="order-details-container" style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ color: "#94a3b8", fontSize: "1.1rem" }}>Loading order details…</div>
        </div>
      </main>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <main className="order-details-page">
        <div className="order-details-container">
          <div className="order-details-nav">
            <Link to="/orders" className="back-to-orders-link">← Back to My Orders</Link>
          </div>
          <div style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#f87171", padding: "24px", borderRadius: "12px", textAlign: "center" }}>
            <h2>Unable to load order</h2>
            <p>{error || "Order not found"}</p>
            <Link to="/orders" className="btn-cancel-order" style={{ display: "inline-block", maxWidth: "200px", marginTop: "16px", textDecoration: "none" }}>
              Return to Orders
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const {
    items,
    shippingAddress,
    subtotal,
    shippingFee,
    taxAmount,
    total,
    orderStatus,
    paymentStatus,
    paymentMethod,
    paymentReference,
    paidAt,
    createdAt,
  } = order;

  const isCancellable = orderStatus === "pending" || orderStatus === "confirmed";
  const psLabel = paymentStatusLabel(paymentStatus);

  // Pay Now is visible when:
  //  - online method, still pending, not cancelled/delivered, and step is idle
  const canPayNow =
    paymentMethod === "online" &&
    paymentStatus !== "paid" &&
    orderStatus !== "cancelled" &&
    orderStatus !== "delivered" &&
    paymentStep === "idle";

  const isPayNowLoading = paymentStep === "loading";
  const timelineStatuses = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const currentTimelineIndex = timelineStatuses.indexOf(orderStatus);

  return (
    <main className="order-details-page">
      <div className="order-details-container">

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <div className="order-details-nav">
          <Link to="/orders" className="back-to-orders-link">← Back to My Orders</Link>
        </div>

        {/* ── Toasts / Banners ──────────────────────────────────────────── */}
        {showCreatedToast && (
          <div className="cancellation-success" role="status">
            🎉 <strong>Order Placed Successfully!</strong>{" "}
            {paymentMethod === "cod"
              ? "Your order is confirmed. Pay on delivery."
              : "Complete your payment below to confirm."}
          </div>
        )}

        {cancelMessage && (
          <div className="cancellation-success" role="status">
            ✓ {cancelMessage}
          </div>
        )}

        {paymentStep === "done" && (
          <div className="cancellation-success" role="status">
            ✅ <strong>Payment Confirmed!</strong> Your payment was processed successfully.
          </div>
        )}

        {paymentError && (
          <div className="checkout-error-banner" role="alert" style={{ marginBottom: "16px" }}>
            <span>⚠️</span>
            <span>{paymentError}</span>
          </div>
        )}

        {/* ── Simulated Payment Modal ────────────────────────────────────── */}
        {paymentStep === "initiated" && paymentInfo && (
          <div
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-modal-title"
          >
            <div className="payment-modal-inner">
              <div className="payment-modal-header">
                <span className="payment-modal-icon">💳</span>
                <h2 id="pay-modal-title">Confirm Your Payment</h2>
                <p>Review the order total and confirm to complete this simulated payment.</p>
              </div>

              <div className="payment-modal-detail">
                <div className="pm-detail-row">
                  <span>Order ID</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    #{String(paymentInfo.orderId).slice(-8).toUpperCase()}
                  </span>
                </div>
                <div className="pm-detail-row">
                  <span>Amount Due</span>
                  <span style={{ color: "#34d399", fontWeight: "800", fontSize: "1.1rem" }}>
                    ${Number(paymentInfo.amount).toFixed(2)} {paymentInfo.currency}
                  </span>
                </div>
                <div className="pm-detail-row">
                  <span>Method</span>
                  <span>Simulated Online Payment</span>
                </div>
              </div>

              <p className="payment-modal-notice">
                🔒 This is a simulated payment flow. No real card details are required or collected.
              </p>

              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="btn-confirm-payment"
                  onClick={handleConfirmPayment}
                  disabled={paymentStep === "confirming"}
                  aria-busy={paymentStep === "confirming"}
                >
                  {paymentStep === "confirming" ? "Processing…" : "✓ Confirm Payment"}
                </button>
                <button
                  type="button"
                  className="btn-cancel-payment"
                  onClick={handleCancelPayment}
                  disabled={paymentStep === "confirming"}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Order Header ──────────────────────────────────────────────── */}
        <header className="order-details-header">
          <div className="order-headline">
            <h1>Order #{order._id}</h1>
            <p>Placed on {formatDate(createdAt)}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span className={`payment-badge ${psLabel.css}`}>{psLabel.text}</span>
            <span className={`status-badge ${orderStatus}`}>
              <span>•</span>
              <span>{orderStatus}</span>
            </span>
          </div>
        </header>

        <section className={`order-status-timeline${orderStatus === "cancelled" ? " cancelled" : ""}`} aria-label="Order status timeline">
          {orderStatus === "cancelled" ? (
            <div className="timeline-cancelled">Order cancelled</div>
          ) : timelineStatuses.map((status, index) => (
            <div key={status} className={`timeline-step${index <= currentTimelineIndex ? " complete" : ""}${status === orderStatus ? " current" : ""}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <span>{status}</span>
            </div>
          ))}
        </section>

        {/* ── Details Grid ──────────────────────────────────────────────── */}
        <div className="order-details-grid">

          {/* Items Snapshot */}
          <section className="order-items-card">
            <h2 className="order-card-title">Purchased Items ({items?.length})</h2>
            <div className="order-items-table">
              {items?.map((item) => (
                <div key={item._id} className="order-detail-item">
                  <div className="item-left">
                    <img
                      src={item.image || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518"}
                      alt={item.name}
                      className="item-img"
                    />
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <div className="item-meta">
                        Qty: {item.quantity}
                        {item.size  ? ` • Size: ${item.size}`  : ""}
                        {item.color ? ` • ${item.color}`       : ""}
                      </div>
                    </div>
                  </div>
                  <div className="item-price-col">
                    <div className="item-unit-price">${item.price?.toFixed(2)} each</div>
                    <div className="item-total-price">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="order-sidebar-section">

            {/* Shipping Address */}
            <div className="order-info-box">
              <h3 className="info-box-title">
                <span>📍</span>
                <span>Shipping Address</span>
              </h3>
              <div className="address-lines">
                <strong style={{ color: "#ffffff" }}>{shippingAddress?.fullName}</strong>
                <span>{shippingAddress?.phone}</span>
                <span>{shippingAddress?.address}</span>
                <span>{shippingAddress?.city}, {shippingAddress?.postalCode}</span>
                <span>{shippingAddress?.country}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="order-info-box">
              <h3 className="info-box-title">
                <span>💳</span>
                <span>Payment Summary</span>
              </h3>

              {/* Price breakdown */}
              <div className="breakdown-list">
                <div className="breakdown-item">
                  <span>Subtotal</span>
                  <span>${subtotal?.toFixed(2)}</span>
                </div>
                <div className="breakdown-item">
                  <span>Shipping Fee</span>
                  <span>
                    {shippingFee === 0
                      ? <strong style={{ color: "#34d399" }}>FREE</strong>
                      : `$${shippingFee?.toFixed(2)}`}
                  </span>
                </div>
                {(taxAmount > 0 || taxAmount === 0) && (
                  <div className="breakdown-item">
                    <span>Sales Tax (8%)</span>
                    <span>${(taxAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="breakdown-item total">
                  <span>Total Amount</span>
                  <span>${total?.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment fields */}
              <div className="payment-details-block">
                <div className="payment-detail-row">
                  <span>Payment Method</span>
                  <span>{paymentMethodLabel(paymentMethod)}</span>
                </div>

                <div className="payment-detail-row">
                  <span>Payment Status</span>
                  <span className={`payment-badge ${psLabel.css}`}>{psLabel.text}</span>
                </div>

                {/* COD info line — no Pay Now, no reference */}
                {paymentMethod === "cod" && paymentStatus !== "paid" && (
                  <div className="payment-detail-row">
                    <span>Due at delivery</span>
                    <span style={{ color: "#fbbf24", fontWeight: "700" }}>
                      ${total?.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Show paidAt when paid */}
                {paidAt && (
                  <div className="payment-detail-row">
                    <span>Paid At</span>
                    <span style={{ color: "#34d399" }}>{formatDate(paidAt)}</span>
                  </div>
                )}

                {/* Show paymentReference when paid */}
                {paymentReference && (
                  <div className="payment-detail-row">
                    <span>Reference</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#94a3b8" }}>
                      {paymentReference}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Pay Now button (online + pending only) ── */}
              {(canPayNow || isPayNowLoading) && (
                <button
                  type="button"
                  className="btn-pay-now"
                  onClick={handleInitiatePayment}
                  disabled={isPayNowLoading}
                  aria-busy={isPayNowLoading}
                >
                  {isPayNowLoading ? "Preparing payment…" : "💳 Pay Now"}
                </button>
              )}

              {/* ── Cancel Order ── */}
              {isCancellable && (
                <button
                  type="button"
                  className="btn-cancel-order"
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                >
                  {isCancelling ? "Cancelling…" : "Cancel Order"}
                </button>
              )}

              {/* ── Cancelled notice ── */}
              {orderStatus === "cancelled" && (
                <div className="order-cancelled-notice">
                  This order has been cancelled
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default OrderDetails;

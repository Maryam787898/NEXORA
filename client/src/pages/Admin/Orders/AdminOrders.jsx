import React, { useState, useEffect, useMemo } from "react";
import API from "../../../api/axios";
import "./AdminOrders.css";

// ─── Transition map (mirrors backend ORDER_STATUS_TRANSITIONS) ───────────────
const ORDER_STATUS_TRANSITIONS = {
  pending:    ["confirmed", "processing", "cancelled"],
  confirmed:  ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],
  cancelled:  [],
};

const ALL_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUS_FILTERS = ["all", "pending", "paid", "failed", "refunded"];
const ORDER_STATUS_FILTERS   = ["all", ...ALL_STATUSES];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [statusMsg, setStatusMsg] = useState("");

  // ── Filter state ────────────────────────────────────────────────────────
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  // ── Modal State ─────────────────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await API.get("/orders/admin/all");
      if (data.success) {
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin orders:", err);
      setError(err.response?.data?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ── Filtered view (client-side) ─────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (paymentFilter !== "all") {
      result = result.filter((o) => (o.paymentStatus || "pending") === paymentFilter);
    }
    if (orderStatusFilter !== "all") {
      result = result.filter((o) => (o.orderStatus || "pending") === orderStatusFilter);
    }
    return result;
  }, [orders, paymentFilter, orderStatusFilter]);

  // ── Order-status update ─────────────────────────────────────────────────
  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setRowErrors((prev) => ({ ...prev, [orderId]: "" }));
    setStatusMsg("");
    setError("");
    try {
      const { data } = await API.patch(`/orders/admin/${orderId}/status`, {
        orderStatus: newStatus,
      });
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? data.data : o))
        );
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(data.data);
        }
        setStatusMsg(`Order status updated to "${newStatus}".`);
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      console.error("Status update failed:", err);
      const message = err.response?.data?.message || "Failed to update order status.";
      setRowErrors((prev) => ({ ...prev, [orderId]: message }));
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const paymentMethodLabel = (method) => {
    if (method === "online") return "💳 Online";
    if (method === "cod")    return "🚚 COD";
    return method || "—";
  };

  const paymentStatusMeta = (status) => {
    switch (status) {
      case "paid":     return { text: "Paid",     cls: "paid"     };
      case "failed":   return { text: "Failed",   cls: "failed"   };
      case "refunded": return { text: "Refunded", cls: "refunded" };
      default:         return { text: "Pending",  cls: "pending"  };
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="admin-orders-page">
        <div className="admin-orders-container">
          <div className="nexora-loading-state">
            <div className="nexora-spinner" />
            <p>Loading orders…</p>
          </div>
        </div>
      </main>
    );
  }

  // ── Error state (failed to load) ────────────────────────────────────────
  if (error && orders.length === 0) {
    return (
      <main className="admin-orders-page">
        <div className="admin-orders-container">
          <div className="nexora-error-state">
            <span className="nexora-error-icon">⚠️</span>
            <h2>Unable to Load Orders</h2>
            <p>{error}</p>
            <button className="btn-refresh" onClick={fetchOrders} type="button">
              ↻ Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-orders-page">
      <div className="admin-orders-container">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="admin-orders-header">
          <div>
            <h1 className="admin-orders-title">Order Management</h1>
            <p className="admin-orders-subtitle">
              {filteredOrders.length === orders.length
                ? `${orders.length} total order${orders.length !== 1 ? "s" : ""}`
                : `${filteredOrders.length} of ${orders.length} order${orders.length !== 1 ? "s" : ""} (filtered)`}
            </p>
          </div>
          <button className="btn-refresh" onClick={fetchOrders} type="button">
            ↻ Refresh
          </button>
        </div>

        {/* ── Banners ──────────────────────────────────────────────────── */}
        {error && (
          <div className="admin-error-banner" role="alert">⚠️ {error}</div>
        )}
        {statusMsg && (
          <div className="admin-success-banner" role="status">✓ {statusMsg}</div>
        )}

        {/* ── Payment status filter ─────────────────────────────────────── */}
        <div className="filter-section">
          <span className="filter-label">Payment:</span>
          <div className="payment-filter-bar" role="group" aria-label="Filter by payment status">
            {PAYMENT_STATUS_FILTERS.map((f) => {
              const count =
                f === "all"
                  ? orders.length
                  : orders.filter((o) => (o.paymentStatus || "pending") === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  className={`payment-filter-btn${paymentFilter === f ? " active" : ""} ${f}`}
                  onClick={() => setPaymentFilter(f)}
                  aria-pressed={paymentFilter === f}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="filter-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Order status filter ───────────────────────────────────────── */}
        <div className="filter-section">
          <span className="filter-label">Status:</span>
          <div className="payment-filter-bar" role="group" aria-label="Filter by order status">
            {ORDER_STATUS_FILTERS.map((f) => {
              const count =
                f === "all"
                  ? orders.length
                  : orders.filter((o) => (o.orderStatus || "pending") === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  className={`payment-filter-btn${orderStatusFilter === f ? " active" : ""} order-${f}`}
                  onClick={() => setOrderStatusFilter(f)}
                  aria-pressed={orderStatusFilter === f}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="filter-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {filteredOrders.length === 0 ? (
          <div className="admin-empty">
            <span style={{ fontSize: "2.5rem" }}>📦</span>
            <h2>
              {orders.length === 0
                ? "No Orders Found"
                : "No Matching Orders"}
            </h2>
            <p>
              {orders.length === 0
                ? "When customers place orders, they will appear here."
                : "No orders match the selected filters."}
            </p>
            {(paymentFilter !== "all" || orderStatusFilter !== "all") && (
              <button
                type="button"
                className="btn-refresh"
                style={{ marginTop: "16px" }}
                onClick={() => { setPaymentFilter("all"); setOrderStatusFilter("all"); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="admin-orders-table-wrap">
            <table className="admin-orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>Shipping</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Pay Method</th>
                  <th>Pay Status</th>
                  <th>Order Status</th>
                  <th>Update Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const ps = paymentStatusMeta(order.paymentStatus);
                  const isUpdating = updatingId === order._id;
                  const currentStatus = order.orderStatus || "pending";
                  const allowedNext = ORDER_STATUS_TRANSITIONS[currentStatus] || [];

                  return (
                    <tr key={order._id} className={isUpdating ? "row-updating" : ""}>

                      {/* Order ID */}
                      <td>
                        <span className="order-id-cell">
                          #{String(order._id).slice(-8).toUpperCase()}
                        </span>
                      </td>

                      {/* Customer */}
                      <td>
                        <div className="customer-cell">
                          <span className="customer-name">{order.user?.name || "—"}</span>
                          <span className="customer-email">{order.user?.email || ""}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="date-cell">{formatDate(order.createdAt)}</td>

                      {/* Items count */}
                      <td className="items-count-cell">{order.items?.length || 0}</td>

                      {/* Subtotal */}
                      <td className="money-cell">${order.subtotal?.toFixed(2)}</td>

                      {/* Shipping */}
                      <td className="money-cell">
                        {order.shippingFee === 0
                          ? <span style={{ color: "#34d399", fontWeight: 700 }}>FREE</span>
                          : `$${order.shippingFee?.toFixed(2)}`}
                      </td>

                      {/* Tax */}
                      <td className="money-cell">${(order.taxAmount || 0).toFixed(2)}</td>

                      {/* Total */}
                      <td className="total-cell">${order.total?.toFixed(2)}</td>

                      {/* Payment method */}
                      <td>
                        <span className="method-cell">
                          {paymentMethodLabel(order.paymentMethod)}
                        </span>
                      </td>

                      {/* Payment status */}
                      <td>
                        <span className={`payment-status-badge ${ps.cls}`}>
                          {ps.text}
                        </span>
                      </td>

                      {/* Current order status badge */}
                      <td>
                        <span className={`order-status-badge ${order.orderStatus}`}>
                          {order.orderStatus}
                        </span>
                      </td>

                      {/* Order status update dropdown — only shows valid next states */}
                      <td>
                        {allowedNext.length === 0 ? (
                          <span className="terminal-status-label">
                            {currentStatus === "delivered" ? "✓ Delivered" : "✕ Cancelled"}
                          </span>
                        ) : (
                          <>
                            <select
                              className="status-select"
                              value=""
                              disabled={isUpdating}
                              onChange={(e) => handleStatusChange(order._id, e.target.value)}
                              aria-label={`Update status for order ${order._id}`}
                            >
                              <option value="" disabled>
                                Move to…
                              </option>
                              {allowedNext.map((s) => (
                                <option key={s} value={s}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </select>
                            {isUpdating && (
                              <span className="updating-indicator">Saving…</span>
                            )}
                            {rowErrors[order._id] && (
                              <span className="row-error" role="alert">{rowErrors[order._id]}</span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Inspect Button */}
                      <td>
                        <button
                          type="button"
                          className="btn-inspect"
                          onClick={() => setSelectedOrder(order)}
                        >
                          Inspect 🔍
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Order Inspection Modal ────────────────────────────────────── */}
        {selectedOrder && (
          <div
            className="admin-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-order-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedOrder(null);
            }}
          >
            <div className="admin-modal-card">
              <div className="admin-modal-header">
                <div>
                  <h2 id="modal-order-title" className="admin-modal-title">
                    Order #{String(selectedOrder._id).slice(-8).toUpperCase()}
                  </h2>
                  <p className="admin-modal-subtitle">
                    Placed on {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <div className="admin-modal-grid">
                {/* Customer Box */}
                <div className="admin-modal-box">
                  <h3 className="admin-modal-box-title">👤 Customer Info</h3>
                  <div className="admin-modal-row">
                    <span>Name:</span>
                    <span>{selectedOrder.user?.name || "N/A"}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Email:</span>
                    <span>{selectedOrder.user?.email || "N/A"}</span>
                  </div>
                </div>

                {/* Shipping Box */}
                <div className="admin-modal-box">
                  <h3 className="admin-modal-box-title">📍 Shipping Address</h3>
                  <div className="admin-modal-row">
                    <span>Recipient:</span>
                    <span>{selectedOrder.shippingAddress?.fullName}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Phone:</span>
                    <span>{selectedOrder.shippingAddress?.phone}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Address:</span>
                    <span>{selectedOrder.shippingAddress?.address}, {selectedOrder.shippingAddress?.city}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Postal Code:</span>
                    <span>{selectedOrder.shippingAddress?.postalCode}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Country:</span>
                    <span>{selectedOrder.shippingAddress?.country}</span>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div className="admin-modal-box" style={{ marginBottom: "20px" }}>
                <h3 className="admin-modal-box-title">🛍️ Purchased Items ({selectedOrder.items?.length})</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <th style={{ padding: "8px" }}>Product</th>
                        <th style={{ padding: "8px" }}>Variant</th>
                        <th style={{ padding: "8px" }}>Price</th>
                        <th style={{ padding: "8px" }}>Qty</th>
                        <th style={{ padding: "8px" }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item) => (
                        <tr key={item._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px", fontWeight: "600" }}>{item.name}</td>
                          <td style={{ padding: "8px", color: "#94a3b8" }}>
                            {item.size ? `Size: ${item.size}` : ""}{item.color ? ` • ${item.color}` : ""}
                          </td>
                          <td style={{ padding: "8px" }}>${item.price?.toFixed(2)}</td>
                          <td style={{ padding: "8px" }}>{item.quantity}</td>
                          <td style={{ padding: "8px", fontWeight: "700" }}>
                            ${(item.price * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price Breakdown Box */}
              <div className="admin-modal-box">
                <h3 className="admin-modal-box-title">💳 Payment Breakdown</h3>
                <div className="admin-modal-row">
                  <span>Subtotal:</span>
                  <span>${selectedOrder.subtotal?.toFixed(2)}</span>
                </div>
                <div className="admin-modal-row">
                  <span>Shipping Fee:</span>
                  <span>
                    {selectedOrder.shippingFee === 0 ? "FREE" : `$${selectedOrder.shippingFee?.toFixed(2)}`}
                  </span>
                </div>
                <div className="admin-modal-row">
                  <span>Sales Tax (8%):</span>
                  <span>${(selectedOrder.taxAmount || 0).toFixed(2)}</span>
                </div>
                <div className="admin-modal-row" style={{ fontSize: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "8px", marginTop: "4px" }}>
                  <span>Total Amount:</span>
                  <span style={{ color: "#34d399", fontWeight: "800" }}>${selectedOrder.total?.toFixed(2)}</span>
                </div>
                <div className="admin-modal-row" style={{ marginTop: "12px" }}>
                  <span>Payment Method:</span>
                  <span>{paymentMethodLabel(selectedOrder.paymentMethod)}</span>
                </div>
                <div className="admin-modal-row">
                  <span>Payment Status:</span>
                  <span className={`payment-status-badge ${paymentStatusMeta(selectedOrder.paymentStatus).cls}`}>
                    {paymentStatusMeta(selectedOrder.paymentStatus).text}
                  </span>
                </div>
                <div className="admin-modal-row">
                  <span>Order Status:</span>
                  <span className={`order-status-badge ${selectedOrder.orderStatus}`}>
                    {selectedOrder.orderStatus}
                  </span>
                </div>
                {selectedOrder.paymentReference && (
                  <div className="admin-modal-row">
                    <span>Reference:</span>
                    <span style={{ fontFamily: "monospace" }}>{selectedOrder.paymentReference}</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
};

export default AdminOrders;

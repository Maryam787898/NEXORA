import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../../api/axios";
import "./Orders.css";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const fetchOrders = async () => {
      try {
        setLoading(true);
        const { data } = await API.get("/orders");
        if (data.success) {
          setOrders(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setError(err.response?.data?.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order? Product stock will be restored.")) return;
    try {
      setCancellingId(orderId);
      setError("");
      await API.patch(`/orders/${orderId}/cancel`);
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel this order.");
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <main className="orders-page">
        <div className="orders-container nexora-loading-state">
          <div className="nexora-spinner" aria-hidden="true" />
          <p>Loading your orders...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="orders-page">
      <div className="orders-container">
        
        {/* Header */}
        <div className="orders-header">
          <div className="orders-title-row">
            <h1 className="orders-title">My Orders</h1>
            <span className="orders-count-badge">
              {orders.length} {orders.length === 1 ? "Order" : "Orders"} placed
            </span>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#f87171", padding: "14px 18px", borderRadius: "8px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="orders-empty">
            <span className="orders-empty-icon" aria-hidden="true">📦</span>
            <h2>No Orders Placed Yet</h2>
            <p>Once you complete a purchase, your orders will show up here.</p>
            <Link to="/shop" className="btn-view-order" style={{ padding: "12px 24px", fontSize: "1rem" }}>
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const status = order.orderStatus || "pending";
              const payment = order.paymentStatus || "pending";
              const method = order.paymentMethod || "cod";

              return (
                <article key={order._id} className="order-card">
                  {/* Order Meta Header */}
                  <div className="order-card-header">
                    <div className="order-meta-group">
                      <div className="order-meta-item">
                        <span className="order-meta-label">Order Placed</span>
                        <span className="order-meta-value">{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="order-meta-item">
                        <span className="order-meta-label">Total</span>
                        <span className="order-meta-value">${order.total?.toFixed(2)}</span>
                      </div>
                      <div className="order-meta-item">
                        <span className="order-meta-label">Payment</span>
                        <span className="order-meta-value">
                          {method === "online" ? "💳 Online" : "🚚 COD"}
                        </span>
                      </div>
                      <div className="order-meta-item">
                        <span className="order-meta-label">Order ID</span>
                        <span className="order-meta-value" style={{ fontFamily: "monospace" }}>
                          #{order._id.substring(order._id.length - 8).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="order-status-group">
                      <span className={`payment-badge ${payment}`}>
                        {payment === "pending" ? "Pending" :
                         payment === "paid"    ? "Paid"    :
                         payment === "failed"  ? "Failed"  :
                         payment === "refunded"? "Refunded": payment}
                      </span>
                      <span className={`status-badge ${status}`}>
                        <span>•</span>
                        <span>{status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="order-card-body">
                    <div className="order-items-grid">
                      {order.items?.map((item, idx) => (
                        <div key={item._id || idx} className="order-item-tile">
                          <img
                            src={item.image || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518"}
                            alt={item.name}
                            className="order-item-img"
                          />
                          <div className="order-item-details">
                            <h4 className="order-item-title">{item.name}</h4>
                            <div className="order-item-sub">
                              Qty: {item.quantity} {item.size ? `• Size: ${item.size}` : ""} {item.color ? `• ${item.color}` : ""}
                            </div>
                            <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#f1f5f9", marginTop: "2px" }}>
                              ${item.price?.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Footer & Action */}
                  <div className="order-card-footer">
                    {(["pending", "confirmed"].includes(status)) && (
                      <button
                        type="button"
                        className="btn-cancel-order"
                        onClick={() => handleCancelOrder(order._id)}
                        disabled={cancellingId === order._id}
                      >
                        {cancellingId === order._id ? "Cancelling..." : "Cancel Order"}
                      </button>
                    )}
                    <Link to={`/orders/${order._id}`} className="btn-view-order">
                      <span>View Order Details</span>
                      <span>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
};

export default Orders;

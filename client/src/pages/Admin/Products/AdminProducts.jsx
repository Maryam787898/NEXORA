import React, { useState, useEffect, useCallback } from "react";
import API from "../../../api/axios";
import "./AdminProducts.css";

// ─── Empty form state ─────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "",
  image: "",
  images: "",        // comma-separated input → array on submit
  sizes: "",         // comma-separated input → array on submit
  colors: "",        // comma-separated input → array on submit
  stock: "",
  featured: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Split a comma-separated string into a trimmed, non-empty string array
const splitCSV = (str) =>
  str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// Convert an array back to a comma-separated string for the form input
const joinCSV = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Modal / form state ───────────────────────────────────────────────────
  // mode: null | "create" | "edit"
  const [mode, setMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // ── Delete confirmation ──────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState(null);

  // ── Fetch all products ───────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await API.get("/products");
      if (data.success) {
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError(err.response?.data?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Open create modal ────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingId(null);
    setMode("create");
  };

  // ── Open edit modal ──────────────────────────────────────────────────────
  const openEdit = (product) => {
    setForm({
      name:        product.name        || "",
      description: product.description || "",
      price:       product.price       != null ? String(product.price) : "",
      category:    product.category    || "",
      image:       product.image       || "",
      images:      joinCSV(product.images),
      sizes:       joinCSV(product.sizes),
      colors:      joinCSV(product.colors),
      stock:       product.stock       != null ? String(product.stock) : "",
      featured:    product.featured    || false,
    });
    setFormError("");
    setEditingId(product._id);
    setMode("edit");
  };

  const closeModal = () => {
    setMode(null);
    setEditingId(null);
    setFormError("");
  };

  // ── Handle form field changes ────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ── Validate form before submission ─────────────────────────────────────
  const validateForm = () => {
    if (!form.name.trim())        return "Product name is required.";
    if (!form.description.trim()) return "Description is required.";
    if (!form.category.trim())    return "Category is required.";
    if (!form.image.trim())       return "Primary image URL is required.";
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) return "Price must be a non-negative number.";
    const stock = parseInt(form.stock, 10);
    if (isNaN(stock) || stock < 0) return "Stock must be a non-negative integer.";
    return null;
  };

  // ── Build the payload — only whitelisted fields ──────────────────────────
  // The backend product controller whitelist will be enforced server-side too
  // (Item 5), but we also keep the frontend clean.
  const buildPayload = () => ({
    name:        form.name.trim(),
    description: form.description.trim(),
    price:       parseFloat(form.price),
    category:    form.category.trim(),
    image:       form.image.trim(),
    images:      splitCSV(form.images),
    sizes:       splitCSV(form.sizes),
    colors:      splitCSV(form.colors),
    stock:       parseInt(form.stock, 10),
    featured:    form.featured,
  });

  // ── Save (create or update) ──────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const payload = buildPayload();
      let res;
      if (mode === "create") {
        res = await API.post("/products", payload);
      } else {
        res = await API.put(`/products/${editingId}`, payload);
      }

      if (res.data.success) {
        const msg =
          mode === "create"
            ? `"${res.data.data.name}" created successfully.`
            : `"${res.data.data.name}" updated successfully.`;
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(""), 4000);
        closeModal();
        await fetchProducts();
      }
    } catch (err) {
      console.error("Save failed:", err);
      setFormError(err.response?.data?.message || "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Delete "${productName}"? This cannot be undone.`)) return;
    setDeletingId(productId);
    setError("");
    try {
      const { data } = await API.delete(`/products/${productId}`);
      if (data.success) {
        setSuccessMsg(`"${productName}" deleted.`);
        setTimeout(() => setSuccessMsg(""), 3000);
        setProducts((prev) => prev.filter((p) => p._id !== productId));
      }
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err.response?.data?.message || "Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="ap-page">
        <div className="ap-container" style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ color: "#94a3b8" }}>Loading products…</div>
        </div>
      </main>
    );
  }

  if (error && products.length === 0) {
    return (
      <main className="ap-page">
        <div className="ap-container ap-error-state" role="alert">
          <h2>Unable to load products</h2>
          <p>{error}</p>
          <button type="button" className="btn-ap-refresh" onClick={fetchProducts}>Try Again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="ap-page">
      <div className="ap-container">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="ap-header">
          <div>
            <h1 className="ap-title">Product Management</h1>
            <p className="ap-subtitle">
              {products.length} product{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="ap-header-actions">
            <button
              type="button"
              className="btn-ap-refresh"
              onClick={fetchProducts}
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              className="btn-ap-create"
              onClick={openCreate}
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* ── Banners ────────────────────────────────────────────────── */}
        {error && (
          <div className="ap-error-banner" role="alert">⚠️ {error}</div>
        )}
        {successMsg && (
          <div className="ap-success-banner" role="status">✓ {successMsg}</div>
        )}

        {/* ── Product table ───────────────────────────────────────────── */}
        {products.length === 0 ? (
          <div className="ap-empty">
            <span style={{ fontSize: "2.5rem" }}>📦</span>
            <h2>No Products Yet</h2>
            <p>Click &ldquo;+ Add Product&rdquo; to create your first product.</p>
          </div>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Featured</th>
                  <th>Sizes</th>
                  <th>Colors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isDeleting = deletingId === product._id;
                  return (
                    <tr key={product._id} className={isDeleting ? "row-deleting" : ""}>

                      {/* Image thumbnail */}
                      <td>
                        <img
                          src={product.image}
                          alt={product.name}
                          className="ap-product-thumb"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </td>

                      {/* Name + description excerpt */}
                      <td>
                        <div className="ap-name-cell">
                          <span className="ap-product-name">{product.name}</span>
                          <span className="ap-product-desc">
                            {product.description?.slice(0, 60)}
                            {product.description?.length > 60 ? "…" : ""}
                          </span>
                        </div>
                      </td>

                      <td className="ap-category-cell">{product.category}</td>

                      <td className="ap-price-cell">
                        ${product.price?.toFixed(2)}
                      </td>

                      <td className={`ap-stock-cell${product.stock === 0 ? " out-of-stock" : ""}`}>
                        {product.stock}
                        {product.stock === 0 && (
                          <span className="ap-out-badge">OUT</span>
                        )}
                      </td>

                      <td className="ap-featured-cell">
                        {product.featured ? (
                          <span className="ap-featured-yes">★ Yes</span>
                        ) : (
                          <span className="ap-featured-no">—</span>
                        )}
                      </td>

                      <td className="ap-tags-cell">
                        {product.sizes?.length > 0
                          ? product.sizes.join(", ")
                          : <span style={{ color: "#475569" }}>—</span>}
                      </td>

                      <td className="ap-tags-cell">
                        {product.colors?.length > 0
                          ? product.colors.join(", ")
                          : <span style={{ color: "#475569" }}>—</span>}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="ap-actions">
                          <button
                            type="button"
                            className="btn-ap-edit"
                            onClick={() => openEdit(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ap-delete"
                            onClick={() => handleDelete(product._id, product.name)}
                            disabled={isDeleting}
                            aria-label={`Delete ${product.name}`}
                          >
                            {isDeleting ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create / Edit modal ─────────────────────────────────────── */}
        {mode && (
          <div
            className="ap-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ap-modal-title"
            onClick={(e) => {
              // close if user clicks the backdrop directly
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div className="ap-modal">

              <div className="ap-modal-header">
                <h2 id="ap-modal-title">
                  {mode === "create" ? "Add New Product" : "Edit Product"}
                </h2>
                <button
                  type="button"
                  className="ap-modal-close"
                  onClick={closeModal}
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="ap-form-error" role="alert">⚠️ {formError}</div>
              )}

              <form className="ap-form" onSubmit={handleSave} noValidate>

                {/* Name */}
                <div className="ap-field">
                  <label htmlFor="ap-name">Product Name *</label>
                  <input
                    id="ap-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Minimalist Hoodie"
                    maxLength={200}
                    required
                  />
                </div>

                {/* Description */}
                <div className="ap-field">
                  <label htmlFor="ap-description">Description *</label>
                  <textarea
                    id="ap-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe the product…"
                    maxLength={2000}
                    rows={3}
                    required
                  />
                </div>

                {/* Price + Category row */}
                <div className="ap-field-row">
                  <div className="ap-field">
                    <label htmlFor="ap-price">Price (USD) *</label>
                    <input
                      id="ap-price"
                      name="price"
                      type="number"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="ap-field">
                    <label htmlFor="ap-category">Category *</label>
                    <input
                      id="ap-category"
                      name="category"
                      type="text"
                      value={form.category}
                      onChange={handleChange}
                      placeholder="e.g. Men, Women, Kids"
                      required
                    />
                  </div>
                </div>

                {/* Stock + Featured row */}
                <div className="ap-field-row">
                  <div className="ap-field">
                    <label htmlFor="ap-stock">Stock Quantity *</label>
                    <input
                      id="ap-stock"
                      name="stock"
                      type="number"
                      value={form.stock}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      step="1"
                      required
                    />
                  </div>
                  <div className="ap-field ap-field-featured">
                    <label htmlFor="ap-featured">Featured Product</label>
                    <label className="ap-toggle" htmlFor="ap-featured">
                      <input
                        id="ap-featured"
                        name="featured"
                        type="checkbox"
                        checked={form.featured}
                        onChange={handleChange}
                      />
                      <span className="ap-toggle-track">
                        <span className="ap-toggle-thumb" />
                      </span>
                      <span className="ap-toggle-label">
                        {form.featured ? "Yes — shown on homepage" : "No"}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Primary image */}
                <div className="ap-field">
                  <label htmlFor="ap-image">Primary Image URL *</label>
                  <input
                    id="ap-image"
                    name="image"
                    type="url"
                    value={form.image}
                    onChange={handleChange}
                    placeholder="https://…"
                    required
                  />
                  {form.image && (
                    <img
                      src={form.image}
                      alt="preview"
                      className="ap-image-preview"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>

                {/* Additional images */}
                <div className="ap-field">
                  <label htmlFor="ap-images">
                    Additional Images
                    <span className="ap-field-hint"> (comma-separated URLs)</span>
                  </label>
                  <input
                    id="ap-images"
                    name="images"
                    type="text"
                    value={form.images}
                    onChange={handleChange}
                    placeholder="https://…, https://…"
                  />
                </div>

                {/* Sizes + Colors row */}
                <div className="ap-field-row">
                  <div className="ap-field">
                    <label htmlFor="ap-sizes">
                      Sizes
                      <span className="ap-field-hint"> (comma-separated)</span>
                    </label>
                    <input
                      id="ap-sizes"
                      name="sizes"
                      type="text"
                      value={form.sizes}
                      onChange={handleChange}
                      placeholder="S, M, L, XL"
                    />
                  </div>
                  <div className="ap-field">
                    <label htmlFor="ap-colors">
                      Colors
                      <span className="ap-field-hint"> (comma-separated)</span>
                    </label>
                    <input
                      id="ap-colors"
                      name="colors"
                      type="text"
                      value={form.colors}
                      onChange={handleChange}
                      placeholder="Black, White, Navy"
                    />
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="ap-modal-footer">
                  <button
                    type="button"
                    className="btn-ap-cancel"
                    onClick={closeModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-ap-save"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving…"
                      : mode === "create"
                      ? "Create Product"
                      : "Save Changes"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};

export default AdminProducts;

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import API from "../../api/axios";
import "./Shop.css";

const CATEGORIES = ["All", "Men", "Women", "Kids", "Accessories"];

const SORT_OPTIONS = [
  { label: "Featured", value: "featured" },
  { label: "Price: Low to High", value: "price-low-high" },
  { label: "Price: High to Low", value: "price-high-low" },
  { label: "Rating: High to Low", value: "rating-high-low" },
  { label: "Newest Arrivals", value: "newest" },
];

const RATING_OPTIONS = [
  { label: "All Ratings", value: "" },
  { label: "4★ & above", value: "4" },
  { label: "3★ & above", value: "3" },
];

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch products from API on mount
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await API.get("/products");
      if (data.success) setProducts(data.data || []);
    } catch (fetchError) {
      console.error("Error fetching products for shop:", fetchError);
      setError("Unable to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Extract filter parameters from URL Search Params
  const searchQuery = searchParams.get("search") || "";
  const selectedCategory = searchParams.get("category") || "all";
  const minPriceVal = searchParams.get("minPrice") || "";
  const maxPriceVal = searchParams.get("maxPrice") || "";
  const minRatingVal = searchParams.get("minRating") || "";
  const sortOption = searchParams.get("sort") || "featured";

  // Helper to update a single search parameter while preserving others
  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (!value || value === "" || value.toLowerCase() === "all" || value === "featured") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  // Helper to reset all search parameters
  const clearAllFilters = () => {
    setSearchParams({});
  };

  // Scroll to top on filter change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchQuery, selectedCategory, minPriceVal, maxPriceVal, minRatingVal, sortOption]);

  // Optimized memoized filtering and sorting pipeline
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // 1. Text Search Filter (case-insensitive)
        if (searchQuery.trim() !== "") {
          const term = searchQuery.toLowerCase().trim();
          if (!product.name.toLowerCase().includes(term)) {
            return false;
          }
        }

        // 2. Category Filter
        if (selectedCategory && selectedCategory.toLowerCase() !== "all") {
          if (product.category.toLowerCase() !== selectedCategory.toLowerCase()) {
            return false;
          }
        }

        // 3. Price Filter (Minimum)
        if (minPriceVal !== "" && !isNaN(minPriceVal)) {
          if (product.price < Number(minPriceVal)) {
            return false;
          }
        }

        // 4. Price Filter (Maximum)
        if (maxPriceVal !== "" && !isNaN(maxPriceVal)) {
          if (product.price > Number(maxPriceVal)) {
            return false;
          }
        }

        // 5. Rating Filter
        if (minRatingVal !== "" && !isNaN(minRatingVal)) {
          if (product.rating < Number(minRatingVal)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "price-low-high") {
          return a.price - b.price;
        }
        if (sortOption === "price-high-low") {
          return b.price - a.price;
        }
        if (sortOption === "rating-high-low") {
          return b.rating - a.rating;
        }
        if (sortOption === "newest") {
          const aNew = a.badge === "New" ? 1 : 0;
          const bNew = b.badge === "New" ? 1 : 0;
          if (bNew !== aNew) return bNew - aNew;
          return Number(b.id) - Number(a.id);
        }
        return 0; // "featured" keeps original dataset order
      });
  }, [searchQuery, selectedCategory, minPriceVal, maxPriceVal, minRatingVal, sortOption]);

  const hasActiveFilters =
    searchQuery !== "" ||
    (selectedCategory !== "" && selectedCategory.toLowerCase() !== "all") ||
    minPriceVal !== "" ||
    maxPriceVal !== "" ||
    minRatingVal !== "" ||
    sortOption !== "featured";

  if (loading) {
    return (
      <main className="shop-page">
        <div className="shop-container nexora-loading-state">
          <div className="nexora-spinner" aria-hidden="true" />
          <p>Loading products...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shop-page">
        <div className="shop-container nexora-error-state" role="alert">
          <h2>Unable to load products</h2>
          <p>{error}</p>
          <button type="button" className="btn-clear-filters" onClick={fetchProducts}>Try Again</button>
        </div>
      </main>
    );
  }

  // Filter Sidebar Layout Component (Shared between Desktop & Mobile Drawer)
  const FilterContent = () => (
    <>
      <div className="sidebar-header">
        <h3 className="sidebar-title">Filters</h3>
        {hasActiveFilters && (
          <button
            type="button"
            className="btn-reset-all"
            onClick={clearAllFilters}
          >
            Reset All
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="filter-group">
        <h4 className="filter-group-title">Categories</h4>
        <div className="category-options">
          {CATEGORIES.map((cat) => {
            const isActive =
              (cat.toLowerCase() === "all" &&
                (selectedCategory.toLowerCase() === "all" || !selectedCategory)) ||
              selectedCategory.toLowerCase() === cat.toLowerCase();

            return (
              <button
                key={cat}
                type="button"
                className={`category-option-btn ${isActive ? "active" : ""}`}
                onClick={() => updateFilter("category", cat.toLowerCase() === "all" ? "" : cat)}
              >
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range Filter */}
      <div className="filter-group">
        <h4 className="filter-group-title">Price Range ($)</h4>
        <div className="price-inputs-row">
          <div className="price-input-field">
            <span className="price-symbol">$</span>
            <input
              type="number"
              placeholder="Min"
              value={minPriceVal}
              min="0"
              onChange={(e) => updateFilter("minPrice", e.target.value)}
              aria-label="Minimum price"
            />
          </div>
          <span className="price-separator">-</span>
          <div className="price-input-field">
            <span className="price-symbol">$</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPriceVal}
              min="0"
              onChange={(e) => updateFilter("maxPrice", e.target.value)}
              aria-label="Maximum price"
            />
          </div>
        </div>
      </div>

      {/* Rating Filter */}
      <div className="filter-group">
        <h4 className="filter-group-title">Minimum Rating</h4>
        <div className="rating-options">
          {RATING_OPTIONS.map((rate) => {
            const isActive = minRatingVal === rate.value;
            return (
              <button
                key={rate.label}
                type="button"
                className={`rating-option-btn ${isActive ? "active" : ""}`}
                onClick={() => updateFilter("minRating", rate.value)}
              >
                {rate.value ? (
                  <span className="rating-stars">★ {rate.value}.0+</span>
                ) : (
                  <span>{rate.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <main className="shop-page">
      <div className="shop-container">
        
        {/* Header & Search Banner */}
        <header className="shop-header">
          <span className="shop-eyebrow">EXPLORE OUR COLLECTION</span>
          <h1 className="shop-title">Shop All Products</h1>
          <div className="shop-title-underline" aria-hidden="true" />

          {/* Search Input Bar */}
          <div className="shop-search-bar">
            <span className="search-input-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="shop-search-input"
              aria-label="Search products by name"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => updateFilter("search", "")}
                aria-label="Clear search text"
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {/* Main Layout Grid */}
        <div className="shop-main-layout">
          
          {/* Desktop Left Sidebar */}
          <aside className="shop-sidebar">
            <FilterContent />
          </aside>

          {/* Catalog Right Area */}
          <section className="shop-catalog-area">
            
            {/* Toolbar: Results Count, Mobile Filter Button, Sort Dropdown */}
            <div className="catalog-toolbar">
              <div className="results-count">
                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
              </div>

              <div className="toolbar-controls">
                <button
                  type="button"
                  className="btn-mobile-filter"
                  onClick={() => setIsMobileFilterOpen(true)}
                >
                  <span aria-hidden="true">⚙️</span>
                  <span>Filters</span>
                  {hasActiveFilters && <span className="active-dot">•</span>}
                </button>

                <div className="sort-select-wrapper">
                  <label htmlFor="shop-sort-select" className="sort-label">
                    Sort by:
                  </label>
                  <select
                    id="shop-sort-select"
                    value={sortOption}
                    onChange={(e) => updateFilter("sort", e.target.value)}
                    className="sort-select"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="active-filter-chips">
                {searchQuery && (
                  <span className="chip-item">
                    Search: "{searchQuery}"
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => updateFilter("search", "")}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedCategory && selectedCategory.toLowerCase() !== "all" && (
                  <span className="chip-item">
                    Category: {selectedCategory}
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => updateFilter("category", "")}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {minPriceVal && (
                  <span className="chip-item">
                    Min: ${minPriceVal}
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => updateFilter("minPrice", "")}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {maxPriceVal && (
                  <span className="chip-item">
                    Max: ${maxPriceVal}
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => updateFilter("maxPrice", "")}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {minRatingVal && (
                  <span className="chip-item">
                    Rating: {minRatingVal}★+
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => updateFilter("minRating", "")}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {sortOption !== "featured" && (
                  <span className="chip-item">
                    Sorted
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => updateFilter("sort", "")}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Product Cards Grid or Empty State */}
            {filteredProducts.length > 0 ? (
              <div className="catalog-grid">
                {filteredProducts.map((product) => (
                  <ProductCard key={product._id || product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="shop-empty-state">
                <span className="empty-shop-icon" aria-hidden="true">🔍</span>
                <h3>No Matching Products Found</h3>
                <p>
                  We couldn't find any items matching your selected criteria. Try adjusting your filters or clearing search.
                </p>
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={clearAllFilters}
                >
                  Reset All Filters
                </button>
              </div>
            )}

          </section>

        </div>

      </div>

      {/* Mobile Filter Drawer Overlay */}
      <div
        className={`mobile-drawer-overlay ${isMobileFilterOpen ? "open" : ""}`}
        onClick={() => setIsMobileFilterOpen(false)}
      >
        <div
          className="mobile-drawer-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mobile-drawer-header">
            <h3>Filters</h3>
            <button
              type="button"
              className="btn-close-drawer"
              onClick={() => setIsMobileFilterOpen(false)}
              aria-label="Close filters drawer"
            >
              ✕
            </button>
          </div>
          <FilterContent />
        </div>
      </div>
    </main>
  );
};

export default Shop;
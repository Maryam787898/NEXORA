import React from "react";
import ProductCard from "../ProductCard/ProductCard";
import "./ProductGrid.css";

const ProductGrid = ({
  products = [],
  title = "Featured Products",
  subtitle = "EXPLORE OUR TOP SELECTIONS",
  description = "Handpicked essentials crafted with premium materials and modern silhouettes.",
}) => {
  return (
    <section className="product-grid-section" aria-labelledby="product-grid-heading">
      <div className="product-grid-container">
        
        {/* Header */}
        <div className="product-grid-header">
          {subtitle && <span className="product-grid-eyebrow">{subtitle}</span>}
          <h2 id="product-grid-heading" className="product-grid-title">
            {title}
          </h2>
          <div className="product-grid-underline" aria-hidden="true" />
          {description && (
            <p className="product-grid-description">{description}</p>
          )}
        </div>

        {/* Grid Container */}
        {products && products.length > 0 ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product._id || product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="product-grid-empty">
            <p>No products found at the moment.</p>
          </div>
        )}

      </div>
    </section>
  );
};

export default ProductGrid;

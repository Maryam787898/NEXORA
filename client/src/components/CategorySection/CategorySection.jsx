import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./CategorySection.css";

const DEFAULT_CATEGORIES = [
  {
    id: "men",
    name: "Men",
    description: "Elevate your wardrobe with timeless men's essentials and tailored streetwear.",
    link: "/shop?category=men",
    image: "/assets/categories/men.jpg",
    badge: "Trending",
    color: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    icon: "👔",
  },
  {
    id: "women",
    name: "Women",
    description: "Discover curated silhouettes, chic dresses, and versatile everyday wear.",
    link: "/shop?category=women",
    image: "/assets/categories/women.jpg",
    badge: "Popular",
    color: "linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)",
    icon: "👗",
  },
  {
    id: "kids",
    name: "Kids",
    description: "Comfortable, durable, and vibrant outfits designed for active everyday play.",
    link: "/shop?category=kids",
    image: "/assets/categories/kids.jpg",
    badge: "New",
    color: "linear-gradient(135deg, #065f46 0%, #022c22 100%)",
    icon: "🧸",
  },
  {
    id: "accessories",
    name: "Accessories",
    description: "Premium bags, watches, eyewear, and subtle accents to complete any outfit.",
    link: "/shop?category=accessories",
    image: "/assets/categories/accessories.jpg",
    badge: "Essential",
    color: "linear-gradient(135deg, #701a75 0%, #4a044e 100%)",
    icon: "⌚",
  },
];

const CategorySection = ({
  title = "Shop By Category",
  subtitle = "EXPLORE OUR COLLECTION",
  categories = DEFAULT_CATEGORIES,
}) => {
  const [imageErrors, setImageErrors] = useState({});

  const handleImageError = (id) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section className="category-section" aria-labelledby="category-section-title">
      <div className="category-container">
        
        {/* Section Header */}
        <div className="category-header">
          {subtitle && <span className="category-eyebrow">{subtitle}</span>}
          <h2 id="category-section-title" className="category-title">
            {title}
          </h2>
          <div className="category-title-underline" aria-hidden="true" />
        </div>

        {/* Categories Grid */}
        <div className="category-grid">
          {categories.map((category) => {
            const hasError = imageErrors[category.id];

            return (
              <article key={category.id} className="category-card">
                <Link
                  to={category.link}
                  className="category-card-link"
                  aria-label={`Browse ${category.name} category`}
                >
                  {/* Visual / Image Wrapper */}
                  <div className="category-image-wrapper">
                    {!hasError && category.image ? (
                      <img
                        src={category.image}
                        alt={`${category.name} fashion collection`}
                        className="category-image"
                        onError={() => handleImageError(category.id)}
                        loading="lazy"
                      />
                    ) : null}

                    {/* Placeholder fallback visual if image doesn't exist or fails */}
                    <div
                      className={`category-placeholder ${hasError || !category.image ? "active" : ""}`}
                      style={{ background: category.color || "linear-gradient(135deg, #1f2937, #111827)" }}
                    >
                      <span className="category-placeholder-icon" aria-hidden="true">
                        {category.icon || "🛍️"}
                      </span>
                      <span className="category-placeholder-text">
                        {category.name}
                      </span>
                    </div>

                    {/* Dark gradient overlay for contrast */}
                    <div className="category-overlay" aria-hidden="true" />

                    {/* Badge */}
                    {category.badge && (
                      <span className="category-badge">{category.badge}</span>
                    )}
                  </div>

                  {/* Content Overlay / Card Details */}
                  <div className="category-content">
                    <h3 className="category-name">{category.name}</h3>
                    <p className="category-description">{category.description}</p>
                    
                    <div className="category-cta">
                      <span>Shop Now</span>
                      <svg
                        className="category-cta-icon"
                        xmlns="http://www.w3.org/2000/svg"
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
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default CategorySection;

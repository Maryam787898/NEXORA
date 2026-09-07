import React from "react";
import { Link } from "react-router-dom";
import "./NotFound.css";

const NotFound = () => {
  return (
    <main className="not-found-page">
      <div className="not-found-container">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          The page you are looking for doesn't exist or has been moved. Explore our catalog or return to the homepage.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-not-found-home">
            Back to Home
          </Link>
          <Link to="/shop" className="btn-not-found-shop">
            Explore Shop
          </Link>
        </div>
      </div>
    </main>
  );
};

export default NotFound;

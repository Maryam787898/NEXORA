import { Link } from "react-router-dom";
import "./Footer.css";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">

        {/* Brand column */}
        <div className="footer-brand">
          <Link to="/" className="footer-logo">NEXORA</Link>
          <p className="footer-tagline">
            Modern style essentials, curated for every occasion.
          </p>
        </div>

        {/* Shop column */}
        <nav className="footer-col" aria-label="Shop links">
          <h4 className="footer-col-title">Shop</h4>
          <ul className="footer-links">
            <li><Link to="/shop">All Products</Link></li>
            <li><Link to="/shop?category=men">Men</Link></li>
            <li><Link to="/shop?category=women">Women</Link></li>
            <li><Link to="/shop?category=kids">Kids</Link></li>
            <li><Link to="/shop?category=accessories">Accessories</Link></li>
          </ul>
        </nav>

        {/* Account column */}
        <nav className="footer-col" aria-label="Account links">
          <h4 className="footer-col-title">Account</h4>
          <ul className="footer-links">
            <li><Link to="/login">Sign In</Link></li>
            <li><Link to="/cart">My Cart</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
            <li><Link to="/orders">My Orders</Link></li>
          </ul>
        </nav>

        {/* Info column */}
        <nav className="footer-col" aria-label="Info links">
          <h4 className="footer-col-title">Info</h4>
          <ul className="footer-links">
            <li><span className="footer-link-static">Free shipping over $100</span></li>
            <li><span className="footer-link-static">Secure checkout</span></li>
            <li><span className="footer-link-static">Cancel eligible orders</span></li>
          </ul>
        </nav>

      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p className="footer-copy">
          © {year} NEXORA. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;

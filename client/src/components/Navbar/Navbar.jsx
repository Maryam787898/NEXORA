import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

const navLinks = [
    { to: "/", label: "Home" },
    { to: "/shop", label: "Shop" },
    { to: "/shop?category=men", label: "Men" },
    { to: "/shop?category=women", label: "Women" },
    { to: "/shop?category=kids", label: "Kids" },
];

const Navbar = () => {
    const { cartItemCount } = useCart();
    const { wishlistCount } = useWishlist();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 767) {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    const handleLogout = () => {
        logout();
        closeMobileMenu();
        navigate("/");
    };

    return (
        <header className="navbar">
            <div className="navbar-container">

                {/* Logo */}
                <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
                    NEXORA
                </Link>

                {/* Desktop Navigation */}
                <nav className="navbar-links" aria-label="Main navigation">
                    {navLinks.map((link) => (
                        <NavLink key={link.label} to={link.to} onClick={closeMobileMenu}>
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Actions */}
                <div className="navbar-actions">

                    {/* Search */}
                    <button className="navbar-icon" type="button" aria-label="Search">
                        🔍
                    </button>

                    {/* Wishlist */}
                    <Link to="/wishlist" className="navbar-cart" aria-label={`View wishlist (${wishlistCount} items)`} onClick={closeMobileMenu}>
                        ❤️
                        <span className="cart-count">{wishlistCount}</span>
                    </Link>

                    {/* Cart */}
                    <Link to="/cart" className="navbar-cart" aria-label={`View cart (${cartItemCount} items)`} onClick={closeMobileMenu}>
                        🛒
                        <span className="cart-count">{cartItemCount}</span>
                    </Link>

                    {/* Auth */}
                    {user ? (
                        <div className="navbar-user">
                            {user.role === 'admin' && (
                                <>
                                    <Link
                                        to="/admin/products"
                                        className="navbar-login"
                                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', textDecoration: 'none' }}
                                        onClick={closeMobileMenu}
                                    >
                                        Admin Products
                                    </Link>
                                    <Link
                                        to="/admin/orders"
                                        className="navbar-login"
                                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', textDecoration: 'none' }}
                                        onClick={closeMobileMenu}
                                    >
                                        Admin Orders
                                    </Link>
                                </>
                            )}
                            <Link to="/orders" className="navbar-login" style={{ background: 'none', border: '1px solid var(--border-color)', textDecoration: 'none' }} onClick={closeMobileMenu}>
                                My Orders
                            </Link>
                            <span className="user-greeting" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Hi, {user.name.split(' ')[0]}
                            </span>
                            <button onClick={handleLogout} className="navbar-login" style={{ background: 'none', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" className="navbar-login" onClick={closeMobileMenu}>
                            Login
                        </Link>
                    )}

                    <button
                        type="button"
                        className="navbar-menu-toggle"
                        onClick={() => setMobileMenuOpen((prev) => !prev)}
                        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className="navbar-menu-lines" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </span>
                    </button>
                </div>
            </div>

            <div
                className={`mobile-menu-overlay ${mobileMenuOpen ? "open" : ""}`}
                onClick={closeMobileMenu}
            >
                <aside
                    className={`mobile-menu-panel ${mobileMenuOpen ? "open" : ""}`}
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Mobile navigation"
                >
                    <div className="mobile-menu-header">
                        <span className="mobile-menu-title">Menu</span>
                        <button
                            type="button"
                            className="mobile-menu-close"
                            onClick={closeMobileMenu}
                            aria-label="Close navigation menu"
                        >
                            ✕
                        </button>
                    </div>

                    <nav className="mobile-navbar-links" aria-label="Mobile navigation links">
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.label}
                                to={link.to}
                                className={({ isActive }) => `mobile-menu-link ${isActive ? "active" : ""}`}
                                onClick={closeMobileMenu}
                            >
                                {link.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mobile-menu-actions">
                        {user ? (
                            <>
                                <div className="mobile-account-summary">
                                    <span className="mobile-account-label">Account</span>
                                    <span className="mobile-user-name">Hi, {user.name.split(' ')[0]}</span>
                                </div>

                                {user.role === 'admin' && (
                                    <>
                                        <Link to="/admin/products" className="mobile-menu-link" onClick={closeMobileMenu}>
                                            Admin Products
                                        </Link>
                                        <Link to="/admin/orders" className="mobile-menu-link" onClick={closeMobileMenu}>
                                            Admin Orders
                                        </Link>
                                    </>
                                )}

                                <Link to="/orders" className="mobile-menu-link" onClick={closeMobileMenu}>
                                    My Orders
                                </Link>
                                <button type="button" className="mobile-menu-logout" onClick={handleLogout}>
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link to="/login" className="mobile-menu-link mobile-menu-login" onClick={closeMobileMenu}>
                                Login
                            </Link>
                        )}
                    </div>
                </aside>
            </div>
        </header>
    );
};

export default Navbar;
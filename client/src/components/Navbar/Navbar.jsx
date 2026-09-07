import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

const Navbar = () => {
    const { cartItemCount } = useCart();
    const { wishlistCount } = useWishlist();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <header className="navbar">
            <div className="navbar-container">

                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    NEXORA
                </Link>

                {/* Navigation */}
                <nav className="navbar-links">
                    <NavLink to="/">Home</NavLink>
                    <NavLink to="/shop">Shop</NavLink>
                    <NavLink to="/shop?category=men">Men</NavLink>
                    <NavLink to="/shop?category=women">Women</NavLink>
                    <NavLink to="/shop?category=kids">Kids</NavLink>
                </nav>

                {/* Actions */}
                <div className="navbar-actions">

                    {/* Search */}
                    <button className="navbar-icon" type="button" aria-label="Search">
                        🔍
                    </button>

                    {/* Wishlist */}
                    <Link to="/wishlist" className="navbar-cart" aria-label={`View wishlist (${wishlistCount} items)`}>
                        ❤️
                        <span className="cart-count">{wishlistCount}</span>
                    </Link>

                    {/* Cart */}
                    <Link to="/cart" className="navbar-cart" aria-label={`View cart (${cartItemCount} items)`}>
                        🛒
                        <span className="cart-count">{cartItemCount}</span>
                    </Link>

                    {/* Auth */}
                    {user ? (
                        <div className="navbar-user" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                            {user.role === 'admin' && (
                                <>
                                    <Link
                                        to="/admin/products"
                                        className="navbar-login"
                                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', textDecoration: 'none' }}
                                    >
                                        Admin Products
                                    </Link>
                                    <Link
                                        to="/admin/orders"
                                        className="navbar-login"
                                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', textDecoration: 'none' }}
                                    >
                                        Admin Orders
                                    </Link>
                                </>
                            )}
                            <Link to="/orders" className="navbar-login" style={{ background: 'none', border: '1px solid var(--border-color)', textDecoration: 'none' }}>
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
                        <Link to="/login" className="navbar-login">
                            Login
                        </Link>
                    )}

                </div>

            </div>
        </header>
    );
};

export default Navbar;
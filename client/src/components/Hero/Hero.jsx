import { Link } from "react-router-dom";
import "./Hero.css";

const Hero = () => {
    return (
        <section className="hero">
            <div className="hero-container">

                <div className="hero-content">
                    <p className="hero-eyebrow">
                        NEW SEASON 2026
                    </p>

                    <h1>
                        Style That
                        <br />
                        Speaks For You.
                    </h1>

                    <p className="hero-description">
                        Discover carefully curated fashion designed
                        for modern lifestyles. Find your next favorite
                        look today.
                    </p>

                    <div className="hero-actions">
                        <Link to="/shop" className="hero-primary-btn">
                            Shop Collection
                        </Link>

                        <Link to="/shop?category=new" className="hero-secondary-btn">
                            Explore New Arrivals
                        </Link>
                    </div>
                </div>

                <div className="hero-visual">
                    <div className="hero-image-placeholder">
                        <span>HERO IMAGE</span>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default Hero;
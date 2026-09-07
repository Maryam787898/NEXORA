import React, { useState, useEffect } from "react";
import Hero from "../../components/Hero/Hero";
import CategorySection from "../../components/CategorySection/CategorySection";
import ProductGrid from "../../components/ProductGrid/ProductGrid";
import API from "../../api/axios";

const Home = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data } = await API.get("/products");
                if (data.success) {
                    setProducts(data.data);
                }
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    return (
        <div className="home-page">
            <Hero />
            <CategorySection />
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>Loading products...</div>
            ) : (
                <ProductGrid
                    products={products}
                    title="Featured Products"
                    subtitle="DISCOVER OUR TOP SELECTIONS"
                    description="Explore our handpicked collection of modern style essentials."
                />
            )}
        </div>
    );
};

export default Home;
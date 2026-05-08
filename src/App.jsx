import React, { useState, useCallback } from "react";
import products from "./data/products";
import { getRecommendations } from "./services/aiService";
import SearchBar from "./components/SearchBar";
import AIResponse from "./components/AIResponse";
import FilterBar from "./components/FilterBar";
import ProductCard from "./components/ProductCard";

const CATEGORIES = [...new Set(products.map((p) => p.category))];

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [recommendedIds, setRecommendedIds] = useState(new Set());
  const [reasons, setReasons] = useState({});
  const [activeCategory, setActiveCategory] = useState("All");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (query) => {
    setLoading(true);
    setError(null);
    setAiSummary("");
    setRecommendedIds(new Set());
    setReasons({});
    setHasSearched(true);

    try {
      const result = await getRecommendations(query, products);

      setAiSummary(result.summary ?? "");

      const ids = new Set((result.recommended ?? []).map((r) => Number(r.id)));
      setRecommendedIds(ids);

      const reasonMap = {};
      (result.recommended ?? []).forEach((r) => {
        reasonMap[Number(r.id)] = r.reason;
      });
      setReasons(reasonMap);
    } catch (err) {
      // Show the real error message so we can diagnose the problem
      console.error("AI recommendation error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const categoryFiltered =
    activeCategory === "All"
      ? products
      : products.filter((p) => p.category === activeCategory);

  const displayProducts = [...categoryFiltered].sort((a, b) => {
    const aRec = recommendedIds.has(a.id) ? 1 : 0;
    const bRec = recommendedIds.has(b.id) ? 1 : 0;
    return bRec - aRec;
  });

  const visibleRecCount = displayProducts.filter((p) => recommendedIds.has(p.id)).length;

  return (
    <div className="app">
      <header className="page-header">
        <p className="page-kicker">AI-Powered</p>
        <h1 className="page-title">
          Product <span className="accent">Finder</span>
        </h1>
        <p className="page-sub">
          Describe what you need in plain English — the AI will pick the best matches.
        </p>
      </header>

      <SearchBar onSearch={handleSearch} loading={loading} />

      {loading && (
        <div className="loading-bar" role="status" aria-live="polite">
          <span className="loading-dots">
            <span />
            <span />
            <span />
          </span>
          Analysing your preferences and matching products…
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          ⚠ {error}
        </div>
      )}

      {!loading && <AIResponse summary={aiSummary} />}

      <FilterBar
        categories={CATEGORIES}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />

      <p className="results-meta">
        Showing <strong>{displayProducts.length}</strong> product
        {displayProducts.length !== 1 ? "s" : ""}
        {visibleRecCount > 0 && (
          <>
            {" "}·{" "}
            <strong className="rec-count">{visibleRecCount} recommended</strong>
          </>
        )}
      </p>

      {displayProducts.length === 0 ? (
        <div className="empty-state">
          <p>No products in this category.</p>
        </div>
      ) : (
        <div className="product-grid">
          {displayProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              recommended={recommendedIds.has(product.id)}
              reason={reasons[product.id] ?? ""}
            />
          ))}
        </div>
      )}

      {!hasSearched && !loading && (
        <p className="hint-text">
          ↑ Try a suggestion above or type your own preference to get started.
        </p>
      )}
    </div>
  );
}

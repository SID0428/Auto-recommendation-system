/**
 * FilterBar.jsx
 * Category filter buttons.  "All" shows every product.
 * Props:
 *   categories: string[]          – list of category names
 *   activeCategory: string        – currently selected category
 *   onSelect(category: string)    – called on category change
 */

import React from "react";

export default function FilterBar({ categories, activeCategory, onSelect }) {
  return (
    <div className="filter-bar" role="toolbar" aria-label="Filter by category">
      <span className="filter-label">Category:</span>
      {["All", ...categories].map((cat) => (
        <button
          key={cat}
          className={`filter-btn ${activeCategory === cat ? "active" : ""}`}
          onClick={() => onSelect(cat)}
          aria-pressed={activeCategory === cat}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

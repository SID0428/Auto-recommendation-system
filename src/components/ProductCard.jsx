/**
 * ProductCard.jsx
 * Renders a single product card.
 * Highlighted (green border) when the AI has recommended it.
 * Shows the AI's per-product reason in a footer strip.
 *
 * Props:
 *   product:     object   – product data from products.js
 *   recommended: boolean  – whether the AI selected this product
 *   reason:      string   – AI's one-line reason (only when recommended)
 */

import React, { useState } from "react";

/** Formats a number as Indian Rupees: ₹1,29,999 */
function formatINR(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ProductCard({ product, recommended, reason }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { emoji, imageUrl, category, name, description, price, rating, tags } = product;

  return (
    <article className={`product-card ${recommended ? "recommended" : ""}`}>
      {recommended && (
        <div className="rec-badge" aria-label="AI Recommended">
          ✦ Recommended
        </div>
      )}

      <div className={`card-thumb ${imageUrl && !imageFailed ? "has-image" : ""}`}>
        {imageUrl && !imageFailed ? (
          <img
            className="product-image"
            src={imageUrl}
            alt={name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="emoji-fallback" aria-hidden="true">
            {emoji}
          </span>
        )}
      </div>

      <div className="card-body">
        <p className="card-category">{category}</p>
        <h2 className="card-name">{name}</h2>
        <p className="card-desc">{description}</p>

        <div className="card-footer">
          <span className="card-price">{formatINR(price)}</span>
          <span className="card-rating" aria-label={`Rating: ${rating} out of 5`}>
            <span className="star" aria-hidden="true">★</span>
            {rating}
          </span>
        </div>

        <ul className="card-tags" aria-label="Product tags">
          {tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>
      </div>

      {/* AI reason strip — only visible when recommended */}
      {recommended && reason && (
        <div className="rec-reason">
          <span aria-hidden="true">✓ </span>
          {reason}
        </div>
      )}
    </article>
  );
}

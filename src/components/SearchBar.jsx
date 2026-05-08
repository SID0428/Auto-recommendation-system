/**
 * SearchBar.jsx
 * User preference input + quick-suggestion chips.
 * Props:
 *   onSearch(query: string) – called when the user submits a query
 *   loading: boolean         – disables the button while AI is working
 */

import React, { useState } from "react";

const SUGGESTIONS = [
  "Phone under ₹30,000",
  "Best headphones for WFH",
  "Budget laptop for students",
  "Smartwatch for Android",
  "Gaming laptop under ₹60,000",
  "Wireless earbuds under ₹5,000",
  "Premium phone",
  "Tablet with stylus",
];

export default function SearchBar({ onSearch, loading }) {
  const [input, setInput] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) onSearch(input.trim());
  }

  function handleChip(suggestion) {
    setInput(suggestion);
    onSearch(suggestion);
  }

  return (
    <div className="search-section">
      <label className="search-label" htmlFor="pref-input">
        <span className="search-label-icon">✦</span>
        Tell the AI what you&apos;re looking for
      </label>

      <form className="search-row" onSubmit={handleSubmit}>
        <input
          id="pref-input"
          className="search-input"
          type="text"
          placeholder='e.g. "I want a phone under ₹35,000 with a great camera"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          className={`search-btn ${loading ? "loading" : ""}`}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Thinking…
            </>
          ) : (
            "Recommend →"
          )}
        </button>
      </form>

      <div className="chips" role="list" aria-label="Quick suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="chip"
            role="listitem"
            onClick={() => handleChip(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

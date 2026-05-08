# AI Product Recommender
### Task 1 — React + AI API Integration

---

## Tech Stack
- **React 18** + **Vite 5** (frontend)
- **Groq API** (`llama-3.1-8b-instant`) for recommendations
- **Google Gemini API** kept as a disabled backup provider

---

## Project Structure

```
task1/
├── index.html                  # HTML entry point
├── vite.config.js              # Vite config
├── package.json
├── api/
│   └── recommendations.js      # Vercel serverless AI API route
└── src/
    ├── main.jsx                # ReactDOM entry
    ├── App.jsx                 # Root component (state + layout)
    ├── App.css                 # All styles
    ├── data/
    │   └── products.js         # Product catalog (20 products, 5 categories)
    ├── services/
    │   └── aiService.js        # Free AI API integration
    └── components/
        ├── SearchBar.jsx       # Preference input + suggestion chips
        ├── AIResponse.jsx      # AI summary display
        ├── FilterBar.jsx       # Category filter buttons
        └── ProductCard.jsx     # Individual product card
```

---

## How to Run

```bash
cd task1
npm install
cp .env.example .env
# Add your Groq API key to .env
npx vercel dev
# Opens at http://localhost:3000
```

Set `GROQ_API_KEY` in `.env` locally and in Vercel Project Settings → Environment Variables for the hosted app.
Groq has a free developer tier, but it still has rate limits. If the key is missing or the API is temporarily unavailable, the app falls back to local catalog matching so the frontend demo still works.

Gemini is disabled by default. To switch back later, set `AI_PROVIDER=gemini` and provide `GEMINI_API_KEY`.

---

## How It Works

1. User types a preference (e.g. *"phone under $500 with good camera"*) or clicks a quick-chip.
2. `App.jsx` calls `getRecommendations(query, products)` in `aiService.js`.
3. `aiService.js` sends the user preference and catalog to `/api/recommendations`.
4. The Vercel serverless function in `api/recommendations.js` calls Groq using the server-side API key.
5. The AI returns JSON: `{ summary, recommended: [{id, reason}] }`. If the API is unavailable, a local fallback ranks the catalog from the same user preference.
6. App highlights matched products (green border, floated to top) and shows per-card AI reasons.
7. User can further filter by category using the filter bar.

---

## Evaluation Criteria Coverage

| Criterion | Where |
|---|---|
| Basic React frontend | `App.jsx`, all components, `App.css` |
| AI API integration | `src/services/aiService.js` |
| Pass input → AI → filter products | `App.jsx` `handleSearch()` + `aiService.js` |
| Clean & maintainable code | Separated concerns: data / service / components / styles |

/**
 * aiService.js
 * Handles product recommendations through the Vercel API route.
 * The browser never calls Groq/Gemini directly, so API keys stay server-side.
 */

const CATEGORY_SYNONYMS = {
  Phones: ["phone", "phones", "mobile", "mobiles", "smartphone", "smartphones"],
  Audio: [
    "audio",
    "headphone",
    "headphones",
    "earphone",
    "earphones",
    "earbud",
    "earbuds",
    "headset",
    "headsets",
    "wfh",
    "work from home",
  ],
  Laptops: ["laptop", "laptops", "notebook", "notebooks", "computer", "gaming"],
  Wearables: ["wearable", "wearables", "watch", "watches", "smartwatch", "smartwatches"],
  Tablets: ["tablet", "tablets", "tab", "ipad", "stylus"],
};

function normalize(value) {
  return String(value).toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preferenceHasTerm(preference, term) {
  const normalizedTerm = normalize(term);
  if (normalizedTerm.includes(" ")) {
    return preference.includes(normalizedTerm);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`).test(preference);
}

function findBudgetInINR(preference) {
  const text = normalize(preference).replace(/,/g, "");
  const dollarMatch = text.match(/\$\s*(\d+)/);
  if (dollarMatch) return Number(dollarMatch[1]) * 84;

  const rupeeMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d+)/);
  if (rupeeMatch) return Number(rupeeMatch[1]);

  const underMatch = text.match(/(?:under|below|less than)\s*(\d+)/);
  return underMatch ? Number(underMatch[1]) : null;
}

function findRequestedCategory(preference, products) {
  const text = normalize(preference);
  return [...new Set(products.map((product) => product.category))].find((category) =>
    (CATEGORY_SYNONYMS[category] ?? [category]).some((term) =>
      preferenceHasTerm(text, term)
    )
  );
}

function productMatchesBudget(product, budget) {
  return !budget || product.price <= budget;
}

function getFallbackRecommendations(userPreference, products, apiReason) {
  const preference = normalize(userPreference);
  const budget = findBudgetInINR(preference);
  const requestedCategory = findRequestedCategory(userPreference, products);

  const candidateProducts = requestedCategory
    ? products.filter((product) => product.category === requestedCategory)
    : products;

  const scored = candidateProducts
    .filter((product) => productMatchesBudget(product, budget))
    .map((product) => {
      const searchableText = normalize(
        `${product.name} ${product.category} ${product.description} ${product.tags.join(" ")}`
      );
      let score = 0;

      if (budget) score += 4;
      if (preferenceHasTerm(preference, product.category.slice(0, -1))) score += 4;
      if (preferenceHasTerm(preference, product.category)) score += 4;

      for (const tag of product.tags) {
        if (preferenceHasTerm(preference, tag)) score += 3;
      }

      for (const word of preference.split(/\W+/).filter((w) => w.length > 3)) {
        if (searchableText.includes(word)) score += 1;
      }

      score += product.rating / 2;
      return { product, score };
    })
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const fallbackPool = candidateProducts.filter((product) =>
    productMatchesBudget(product, budget)
  );
  const fallbackProducts = fallbackPool.length ? fallbackPool : candidateProducts;

  const recommended = (scored.length ? scored : fallbackProducts.slice(0, 4).map((product) => ({ product }))).map(
    ({ product }) => ({
      id: product.id,
      reason: budget && product.price <= budget ? "Fits your budget and preferences." : "Strong catalog match.",
    })
  );

  return {
    summary: `AI API is unavailable right now (${apiReason}). Showing a local catalog match so the demo still works.`,
    recommended,
  };
}

function sanitizeResult(result, products) {
  const validIds = new Set(products.map((p) => p.id));
  return {
    summary: result?.summary ?? "",
    recommended: (result?.recommended ?? [])
      .map((item) => ({
        id: Number(item.id),
        reason: String(item.reason ?? "Good match for your preference."),
      }))
      .filter((item) => validIds.has(item.id)),
  };
}

function enforceUserConstraints(result, userPreference, products) {
  const requestedCategory = findRequestedCategory(userPreference, products);
  const budget = findBudgetInINR(userPreference);
  const productById = new Map(products.map((product) => [product.id, product]));

  const recommended = (result.recommended ?? []).filter((item) => {
    const product = productById.get(item.id);
    if (!product) return false;
    if (requestedCategory && product.category !== requestedCategory) return false;
    return productMatchesBudget(product, budget);
  });

  return {
    summary:
      recommended.length > 0
        ? result.summary
        : "I could not find matching products for those exact filters. Try widening your budget or changing the category.",
    recommended,
  };
}

function withFallbackIfEmpty(result, userPreference, products) {
  if ((result.recommended ?? []).length > 0) return result;
  return getFallbackRecommendations(
    userPreference,
    products,
    "AI did not return matching product ids"
  );
}

/**
 * Calls the Vercel serverless function with the user's preference and catalog.
 * Returns { summary, recommended: [{ id, reason }] }.
 */
export async function getRecommendations(userPreference, products) {
  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userPreference, products }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || `API route error ${response.status}`);
    }

    const result = sanitizeResult(await response.json(), products);
    return withFallbackIfEmpty(
      enforceUserConstraints(result, userPreference, products),
      userPreference,
      products
    );
  } catch (err) {
    return getFallbackRecommendations(
      userPreference,
      products,
      err.message || "request failed"
    );
  }
}

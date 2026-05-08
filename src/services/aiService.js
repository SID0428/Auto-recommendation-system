/**
 * aiService.js
 * Handles product recommendations through an AI API.
 * Groq is the active provider. Gemini is kept here but disabled by config
 * so it can be re-enabled later without rewriting this service.
 * Requests go through the Vite dev-server proxy to avoid CORS issues.
 */

const ACTIVE_PROVIDER = import.meta.env.VITE_AI_PROVIDER ?? "groq";

const GROQ_API_URL = "/api/groq/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY ?? "";
const isGroqKeyConfigured =
  GROQ_API_KEY && GROQ_API_KEY !== "your-groq-api-key-here";

// Disabled by default. Set VITE_AI_PROVIDER=gemini to use this again.
const GEMINI_API_URL = "/api/gemini/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const isGeminiKeyConfigured =
  GEMINI_API_KEY && GEMINI_API_KEY !== "your-gemini-api-key-here";

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

/**
 * Serialises the product catalog into a compact string the model can read.
 * Prices are shown in Indian Rupees (₹) so the AI respects INR budget queries.
 */
function buildCatalogText(products) {
  return products
    .map(
      (p) =>
        `ID:${p.id} | ${p.name} | Category:${p.category} | Price:₹${p.price} | Rating:${p.rating}/5 | ${p.description} | Tags: ${p.tags.join(", ")}`
    )
    .join("\n");
}

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
 * Calls Groq with the user's preference and the full product catalog.
 * Returns { summary, recommended: [{ id, reason }] }.
 */
export async function getRecommendations(userPreference, products) {
  const catalogText = buildCatalogText(products);

  const prompt = `You are a helpful product recommendation assistant for an Indian electronics store.
All prices are in Indian Rupees (₹). Given the user's preference below, identify the best matching products from the catalog.

User preference: "${userPreference}"

Product catalog:
${catalogText}

Rules:
- Recommend between 2 and 6 products that genuinely match the preference.
- If the user specifies a price limit (e.g. "under ₹30000"), strictly respect it — never include products above that price.
- If the user mentions a budget in dollars, convert roughly (1 USD ≈ ₹84) before filtering.
- If the user specifies a category or feature, filter accordingly.
- Rank by best match first.

Respond ONLY with valid JSON — no markdown fences, no extra text — in exactly this shape:
{
  "summary": "<2–3 sentence friendly explanation of what you found and why>",
  "recommended": [
    { "id": <number>, "reason": "<one short sentence, max 12 words, why this fits>" },
    ...
  ]
}`;

  try {
    if (ACTIVE_PROVIDER === "gemini") {
      const result = await getGeminiRecommendations(prompt, products);
      return withFallbackIfEmpty(
        enforceUserConstraints(result, userPreference, products),
        userPreference,
        products
      );
    }

    const result = await getGroqRecommendations(prompt, products);
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

async function getGroqRecommendations(prompt, products) {
  if (!isGroqKeyConfigured) {
    throw new Error("missing VITE_GROQ_API_KEY");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a product recommendation engine. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return sanitizeResult(JSON.parse(clean), products);
}

async function getGeminiRecommendations(prompt, products) {
  if (!isGeminiKeyConfigured) {
    throw new Error("missing VITE_GEMINI_API_KEY");
  }

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are a product recommendation engine. Return only valid JSON.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const raw =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return sanitizeResult(JSON.parse(clean), products);
}

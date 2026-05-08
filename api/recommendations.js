const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildCatalogText(products) {
  return products
    .map(
      (p) =>
        `ID:${p.id} | ${p.name} | Category:${p.category} | Price:₹${p.price} | Rating:${p.rating}/5 | ${p.description} | Tags: ${p.tags.join(", ")}`
    )
    .join("\n");
}

function buildPrompt(userPreference, products) {
  return `You are a helpful product recommendation assistant for an Indian electronics store.
All prices are in Indian Rupees (₹). Given the user's preference below, identify the best matching products from the catalog.

User preference: "${userPreference}"

Product catalog:
${buildCatalogText(products)}

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
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("missing GROQ_API_KEY");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("missing GEMINI_API_KEY");
  }

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "You are a product recommendation engine. Return only valid JSON." }],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
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
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const { userPreference, products } = body;
    if (!userPreference || !Array.isArray(products)) {
      return res.status(400).json({ error: "Missing userPreference or products" });
    }

    const prompt = buildPrompt(userPreference, products);
    const provider = process.env.AI_PROVIDER ?? "groq";
    const raw = provider === "gemini" ? await callGemini(prompt) : await callGroq(prompt);
    const clean = raw.replace(/```json|```/g, "").trim();

    return res.status(200).json(JSON.parse(clean));
  } catch (err) {
    return res.status(500).json({
      error: err.message || "AI request failed",
    });
  }
};

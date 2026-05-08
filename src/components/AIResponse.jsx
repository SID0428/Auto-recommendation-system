/**
 * AIResponse.jsx
 * Displays the AI's natural-language summary after a recommendation run.
 * Props:
 *   summary: string  – text returned by the AI
 */

import React from "react";

export default function AIResponse({ summary }) {
  if (!summary) return null;

  return (
    <div className="ai-response" role="status" aria-live="polite">
      <div className="ai-response-avatar" aria-hidden="true">AI</div>
      <p className="ai-response-text">{summary}</p>
    </div>
  );
}

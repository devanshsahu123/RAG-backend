const { GoogleGenAI } = require('@google/genai');

// Max characters to send to Gemini as context
const MAX_CONTEXT_CHARS = 30000;

/**
 * Find the most relevant paragraphs from the document text based on the user's question.
 * This keyword-based approach works WITHOUT any API key.
 * @param {string} text - Full document text
 * @param {string} question - User's question
 * @param {number} maxChars - Max characters to return
 * @returns {string} - Relevant excerpt(s)
 */
function findRelevantExcerpts(text, question, maxChars = 3000) {
  // Split into paragraphs
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 50);

  if (paragraphs.length === 0) return text.substring(0, maxChars);

  // Extract keywords from the question (ignore stop words)
  const stopWords = new Set(['what', 'when', 'where', 'who', 'which', 'how', 'why', 'is', 'are',
    'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
    'about', 'this', 'that', 'with', 'from', 'by', 'do', 'does', 'did', 'book', 'document',
    'page', 'tell', 'me', 'its', 'it', 'give', 'explain', 'describe', 'can', 'please']);

  const keywords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Score each paragraph by keyword matches
  const scored = paragraphs.map(para => {
    const lowerPara = para.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      // Exact word match scores higher
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = (lowerPara.match(regex) || []).length;
      score += matches * 2;
      // Partial match
      if (lowerPara.includes(kw)) score += 1;
    }
    return { para, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top paragraphs up to maxChars
  let result = '';
  for (const { para, score } of scored) {
    if (score === 0) break; // no relevant content
    if ((result.length + para.length) > maxChars) break;
    result += para + '\n\n';
  }

  // If nothing matched, return the beginning of the document
  if (!result.trim()) {
    result = paragraphs.slice(0, 5).join('\n\n');
  }

  return result.trim();
}

/**
 * Build a simple rule-based answer from the relevant text when no LLM is available.
 * @param {string} context - Relevant text excerpts
 * @param {string} question - User's question
 * @returns {string}
 */
function buildFallbackAnswer(context, question) {
  const lowerQ = question.toLowerCase();

  // Generic question patterns
  const isAboutQuestion = /about|topic|subject|what is this|summary|overview|introduction/.test(lowerQ);

  if (isAboutQuestion && context) {
    return `Based on the document:\n\n${context.substring(0, 1000)}...\n\n(Note: For more detailed AI-powered answers, please add a valid GEMINI_API_KEY to your backend .env file.)`;
  }

  if (!context || context.trim().length === 0) {
    return "I couldn't find relevant content in this document for your question. Try rephrasing or ask about specific topics mentioned in the document.";
  }

  return `Here's what I found in the document related to your question:\n\n${context.substring(0, 1500)}...\n\n(Note: For full AI-powered answers, add a valid GEMINI_API_KEY to backend/.env)`;
}

/**
 * Main function: tries Gemini first, falls back to keyword search if API key is missing/invalid.
 * @param {string} documentText - Full extracted text from the PDF
 * @param {string} message - User's question
 * @returns {Promise<string>}
 */
async function generateChatResponse(documentText, message) {
  const apiKey = process.env.GEMINI_API_KEY;

  // ── Try Gemini if we have a key ──────────────────────────────
  if (apiKey && apiKey !== 'your_gemini_api_key_here') {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const context = documentText.length > MAX_CONTEXT_CHARS
        ? documentText.substring(0, MAX_CONTEXT_CHARS)
        : documentText;

      const prompt = `You are an intelligent assistant that answers questions strictly based on the provided document content.

DOCUMENT CONTENT:
---
${context}
---

USER QUESTION: ${message}

INSTRUCTIONS:
- Answer ONLY based on the document content above.
- If the answer is not found in the document, say "I couldn't find information about that in this document."
- Be concise and precise. Do NOT make up information.

ANSWER:`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
      });

      return response.text;
    } catch (err) {
      console.warn('[aiService] Gemini API failed, using fallback. Reason:', err.message?.substring(0, 120));
      // Fall through to keyword-based fallback below
    }
  }

  // ── Keyword-based fallback (no API key needed) ───────────────
  console.log('[aiService] Using keyword-based fallback (no valid Gemini key).');
  const relevantContext = findRelevantExcerpts(documentText, message);
  return buildFallbackAnswer(relevantContext, message);
}

module.exports = { generateChatResponse };

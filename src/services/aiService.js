const { HfInference } = require('@huggingface/inference');

// Max characters to send as context (Hugging Face free tier models typically have an 8k-32k context window)
const MAX_CONTEXT_CHARS = 12000;

/**
 * Find the most relevant paragraphs from the document text based on the user's question.
 * This keyword-based approach works WITHOUT any API key.
 * @param {string} text - Full document text
 * @param {string} question - User's question
 * @param {number} maxChars - Max characters to return
 * @returns {string} - Relevant excerpt(s)
 */
function findRelevantExcerpts(text, question, maxChars = 3000) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 50);

  if (paragraphs.length === 0) return text.substring(0, maxChars);

  const stopWords = new Set(['what', 'when', 'where', 'who', 'which', 'how', 'why', 'is', 'are',
    'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
    'about', 'this', 'that', 'with', 'from', 'by', 'do', 'does', 'did', 'book', 'document',
    'page', 'tell', 'me', 'its', 'it', 'give', 'explain', 'describe', 'can', 'please']);

  const keywords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const scored = paragraphs.map(para => {
    const lowerPara = para.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = (lowerPara.match(regex) || []).length;
      score += matches * 2;
      if (lowerPara.includes(kw)) score += 1;
    }
    return { para, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let result = '';
  for (const { para, score } of scored) {
    if (score === 0) break; 
    if ((result.length + para.length) > maxChars) break;
    result += para + '\n\n';
  }

  if (!result.trim()) {
    result = paragraphs.slice(0, 5).join('\n\n');
  }

  return result.trim();
}

/**
 * Build a simple rule-based answer when no LLM is available.
 */
function buildFallbackAnswer(context, question) {
  const lowerQ = question.toLowerCase();
  const isAboutQuestion = /about|topic|subject|what is this|summary|overview|introduction/.test(lowerQ);

  const keyMsg = '(Note: For full AI answers, add a HF_API_KEY from huggingface.co to backend/.env)';

  if (isAboutQuestion && context) {
    return `Based on the document:\n\n${context.substring(0, 1000)}...\n\n${keyMsg}`;
  }

  if (!context || context.trim().length === 0) {
    return "I couldn't find relevant content in this document for your question. Try rephrasing.";
  }

  return `Here's what I found in the document related to your question:\n\n${context.substring(0, 1500)}...\n\n${keyMsg}`;
}

/**
 * Main function: tries Hugging Face first, falls back to keyword search if API key missing/fails.
 */
async function generateChatResponse(documentText, message) {
  // We'll use the Hugging Face API key
  const apiKey = process.env.HF_API_KEY;

  if (apiKey && apiKey !== 'your_hf_api_key_here') {
    try {
      const hf = new HfInference(apiKey);
      console.log('[aiService] Sending request to Hugging Face...');

      const context = documentText.length > MAX_CONTEXT_CHARS
        ? documentText.substring(0, MAX_CONTEXT_CHARS)
        : documentText;

      const prompt = `You are a helpful assistant. Answer the user's question based strictly on the provided document content. If the answer is not in the text, say you don't know based on the document. Do not make up information.

Document Content:
${context}

User Question: ${message}

Answer:`;

      // We use Qwen2.5 72B Instruct model (fully free on HF Serverless API)
      const response = await hf.chatCompletion({
        model: "Qwen/Qwen2.5-72B-Instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.2, // low temp for factual extraction
      });

      return response.choices[0].message.content.trim();
    } catch (err) {
      console.warn('[aiService] Hugging Face API failed, using fallback. Reason:', err.message?.substring(0, 120));
      // Fall through to keyword-based fallback
    }
  } else {
     console.log('[aiService] No valid HF_API_KEY found, jumping straight to fallback.');
  }

  // ── Keyword-based fallback (no API key needed) ───────────────
  const relevantContext = findRelevantExcerpts(documentText, message);
  return buildFallbackAnswer(relevantContext, message);
}

module.exports = { generateChatResponse };

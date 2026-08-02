// services/explanationService.js
// Recommendation-improvement item #4: upgrade XAI explanations from raw
// templated strings (see recommendationController.buildRecommendationFromML)
// into natural, personalized text — reusing the same Groq client already
// wired in for the AI quiz generator (config/groq.js) instead of adding a
// new LLM dependency.
//
// Design choices:
//  - ONE batched call per recommendation set, not one call per item. A
//    student never sees more than MAX_RECOMMENDATIONS (8) items, so this is
//    a single request instead of up to 8 — bounded latency and cost.
//  - Grounded, not generative: the prompt hands the model the exact score /
//    SHAP feature / cluster already computed and asks it to rewrite the
//    *phrasing* only. It's explicitly told not to invent numbers. This keeps
//    the "explain" part of "explainable AI" honest instead of turning it
//    into a chatbot guessing why a recommendation was made.
//  - Fails soft: if Groq is unavailable, misconfigured, times out, or
//    returns something unparseable, the original templated explanation
//    (already computed by the caller) is used untouched. LLM enhancement is
//    a nice-to-have layered on a working system, never a dependency of it —
//    matches the fallback pattern already used in aiQuizService.js.

const groq = require('../config/groq');

const MODEL      = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 8_000;

function buildPrompt(items) {
  const rows = items.map((it, i) => (
    `${i + 1}. topic="${it.topic}", your_score=${it.topicScore ?? 'n/a'}%, ` +
    `cluster=${it.cluster ?? 'n/a'}, top_shap_feature="${it.topShapFeature ?? 'n/a'}", ` +
    `template_explanation="${it.templateExplanation}"`
  )).join('\n');

  return `You are rewriting explanations for an AI learning platform's recommendation feed.
For each numbered item below, rewrite its "template_explanation" into ONE warm,
encouraging, plain-English sentence (max 30 words) aimed directly at the student ("you").

STRICT RULES:
- Do NOT invent, change, or omit any number, percentage, or topic name given.
- Do NOT mention "SHAP", "cluster", "KMeans", or other ML jargon — translate it into
  a plain reason (e.g. "students with a similar learning pattern" instead of "cluster 2").
- Keep every sentence grounded in the facts given for that item — no generic filler.

Items:
${rows}

Return ONLY valid JSON, no markdown, no code fences:
{ "explanations": ["rewritten sentence for item 1", "rewritten sentence for item 2", ...] }`;
}

/**
 * Rewrites an array of templated XAI explanations into warmer, natural
 * language with a single batched Groq call. Always resolves to an array the
 * same length as `items` — falls back to each item's own
 * `templateExplanation` on any failure (no client configured, timeout, bad
 * JSON, mismatched length, empty string).
 *
 * @param {Array<{ topic, topicScore, cluster, topShapFeature, templateExplanation }>} items
 * @returns {Promise<string[]>}
 */
async function enhanceExplanations(items) {
  const fallback = items.map(it => it.templateExplanation);
  if (!groq || items.length === 0) return fallback;

  try {
    const result = await Promise.race([
      groq.chat.completions.create({
        model:       MODEL,
        messages:    [{ role: 'user', content: buildPrompt(items) }],
        temperature: 0.4,
        max_tokens:  800,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('LLM explanation timed out')), TIMEOUT_MS)),
    ]);

    const raw   = result?.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed   = JSON.parse(clean);
    const enhanced = parsed?.explanations;

    if (!Array.isArray(enhanced) || enhanced.length !== items.length) {
      console.warn('[Explanation] Groq returned a malformed batch — using templated fallback');
      return fallback;
    }

    // Guard against empty/garbage strings for any individual item rather
    // than discarding the whole batch over one bad entry.
    return enhanced.map((text, i) =>
      (typeof text === 'string' && text.trim()) ? text.trim() : fallback[i]
    );
  } catch (err) {
    console.warn('[Explanation] LLM enhancement failed, using templated fallback:', err.message);
    return fallback;
  }
}

module.exports = { enhanceExplanations };
// services/resourceSuggestionService.js
// "AI suggests where to look, never what the link is" — the tutor's idea
// was to auto-populate resources at course/module creation the same way
// quizzes are AI-generated. The critical difference: quiz generation lets
// the LLM invent content it fully controls (questions/answers). A resource
// link is a factual claim about something that exists on the internet, and
// Groq has no way to verify a URL at generation time — it will confidently
// return dead or wrong links if asked for one directly.
//
// So this service asks Groq for candidate SEARCH STRATEGIES instead: for a
// given course/module, which topics need a resource, what type (video /
// article / practice) best fits each, and a good search query — restricted
// to a small allowlist of sites already trusted elsewhere in this project
// (see topic_resources.json). The frontend turns each suggestion into a
// one-click search link; the tutor still finds and pastes the real URL
// themselves via the existing ResourceSubmissionForm, which still goes
// through admin approval before students ever see it.
//
// Nothing here ever reaches a student directly — worst case if Groq
// returns something odd is a slightly-off search query, not a broken link
// live on a quiz result page.

const groq = require('../config/groq');

const MODEL      = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 8_000;

// Same trusted-site set already used for hand-curated topic_resources.json
// entries — keeps AI-assisted suggestions consistent with the existing
// quality bar instead of pointing tutors at random sites.
const TRUSTED_SITES = {
  youtube:       { label: 'YouTube',       searchUrl: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  mdn:           { label: 'MDN Web Docs',  searchUrl: q => `https://www.google.com/search?q=${encodeURIComponent('site:developer.mozilla.org ' + q)}` },
  w3schools:     { label: 'W3Schools',     searchUrl: q => `https://www.google.com/search?q=${encodeURIComponent('site:w3schools.com ' + q)}` },
  freecodecamp:  { label: 'freeCodeCamp',  searchUrl: q => `https://www.google.com/search?q=${encodeURIComponent('site:freecodecamp.org ' + q)}` },
  geeksforgeeks: { label: 'GeeksforGeeks', searchUrl: q => `https://www.google.com/search?q=${encodeURIComponent('site:geeksforgeeks.org ' + q)}` },
  realpython:    { label: 'Real Python',   searchUrl: q => `https://www.google.com/search?q=${encodeURIComponent('site:realpython.com ' + q)}` },
};
const SITE_KEYS = Object.keys(TRUSTED_SITES);

function buildPrompt({ courseTitle, courseDescription, moduleTitle, existingTopics }) {
  return `You are helping a tutor find supplementary learning resources for a course.

Course: "${courseTitle}"
${moduleTitle ? `Module: "${moduleTitle}"` : ''}
${courseDescription ? `Description: ${courseDescription}` : ''}
${existingTopics?.length ? `Topics already covered by lessons: ${existingTopics.join(', ')}` : ''}

Suggest up to 5 sub-topics within this course/module that would benefit from
an external supplementary resource (a video, article, or hands-on practice
link), especially ones students commonly find difficult.

For EACH suggestion, choose exactly ONE site from this list — the ONE most
likely to have strong content for that specific sub-topic:
${SITE_KEYS.join(', ')}

STRICT RULES:
- Do NOT invent, guess, or output any URL. Only output a site key from the
  list above and a search query — nothing else identifies where to look.
- Do NOT output a made-up video/article title as if it's a real resource
  you found. You have not browsed the internet; you are only suggesting
  where a human should search.
- type must be exactly one of: "video", "article", "practice"
- difficulty must be exactly one of: "beginner", "intermediate", "advanced"

Return ONLY valid JSON, no markdown, no code fences:
{
  "suggestions": [
    { "topic": "...", "type": "video", "difficulty": "beginner", "site": "youtube", "searchQuery": "..." }
  ]
}`;
}

/**
 * Suggests where a tutor should search for resources on a course/module —
 * never a direct URL. Always resolves to an array (possibly empty), never
 * throws — a failed suggestion should never block the tutor from just
 * using the manual form directly.
 *
 * @param {{courseTitle, courseDescription?, moduleTitle?, existingTopics?}} input
 * @returns {Promise<Array<{topic,type,difficulty,site,siteLabel,searchQuery,searchUrl}>>}
 */
async function suggestResourceSearches(input) {
  if (!groq) return [];
  if (!input?.courseTitle?.trim()) return [];

  try {
    const result = await Promise.race([
      groq.chat.completions.create({
        model:       MODEL,
        messages:    [{ role: 'user', content: buildPrompt(input) }],
        temperature: 0.5,
        max_tokens:  700,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Suggestion request timed out')), TIMEOUT_MS)),
    ]);

    const raw   = result?.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    // Validate + attach the real, code-constructed search URL — the LLM
    // never gets to produce a URL itself, only pick a site key + query.
    return rawSuggestions
      .filter(s =>
        s?.topic && s?.searchQuery &&
        ['video', 'article', 'practice'].includes(s.type) &&
        ['beginner', 'intermediate', 'advanced'].includes(s.difficulty) &&
        SITE_KEYS.includes(s.site)
      )
      .slice(0, 5)
      .map(s => ({
        topic:       s.topic,
        type:        s.type,
        difficulty:  s.difficulty,
        site:        s.site,
        siteLabel:   TRUSTED_SITES[s.site].label,
        searchQuery: s.searchQuery,
        searchUrl:   TRUSTED_SITES[s.site].searchUrl(s.searchQuery),
      }));
  } catch (err) {
    console.warn('[resourceSuggestionService] suggestion failed, returning empty list:', err.message);
    return [];
  }
}

module.exports = { suggestResourceSearches, TRUSTED_SITES };
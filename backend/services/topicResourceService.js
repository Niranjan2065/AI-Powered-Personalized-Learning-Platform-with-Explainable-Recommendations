// services/topicResourceService.js
// Curated external-resource lookup for weak topics — e.g. "you scored 42% on
// Arrays, here's a video and an article on it" alongside the usual internal
// lesson recommendation.
//
// Backstory: this data (ai_engine/data/raw/topic_resources.json) and a
// lookup function already existed in backend/ml_service/db_stub.py, wired
// to Flask routes (/api/recommendations/<id>, .../lime,
// /api/students/<id>/recommendations) that the live Node pipeline never
// calls — mlBridgeService.js only calls /ml/train and /ml/recommend/:id.
// So the curated library was real but effectively dead. Rather than wiring
// the Node backend to yet another Flask route (extra network hop, extra
// failure mode), this ports the same lookup directly into Node, reading the
// same JSON file — one less moving part, same data.
//
// Coverage note: topic_resources.json currently only has entries for a
// handful of topics (see _meta.topic_id_map in the file). Any topic not in
// there returns [] — callers must treat an empty array as "no curated
// resources yet," not an error. Add more topics by editing that JSON file;
// no code change needed here.

const fs   = require('fs');
const path = require('path');

const RESOURCES_JSON_PATH = path.join(
  __dirname, '..', '..', 'ai_engine', 'data', 'raw', 'topic_resources.json'
);

let _cache = null; // loaded once per process, same pattern as db_stub.py's lru_cache

function _loadLibrary() {
  if (_cache) return _cache;
  try {
    const raw = JSON.parse(fs.readFileSync(RESOURCES_JSON_PATH, 'utf8'));
    const { _meta, ...topics } = raw;
    _cache = { topics, topicIdMap: _meta?.topic_id_map || {} };
  } catch (err) {
    console.warn('[topicResourceService] Could not load topic_resources.json:', err.message);
    _cache = { topics: {}, topicIdMap: {} };
  }
  return _cache;
}

function _resolveTopicName(topicIdOrName, library) {
  // Already a real key (case-sensitive exact match — the common case)
  if (library.topics[topicIdOrName]) return topicIdOrName;

  // Case-insensitive fallback — quiz/lesson topic strings aren't always
  // capitalized identically to the resource-library keys
  const lower = String(topicIdOrName).toLowerCase();
  const match = Object.keys(library.topics).find(k => k.toLowerCase() === lower);
  if (match) return match;

  // Numeric topic_id → name, via _meta.topic_id_map
  const numId = Number(topicIdOrName);
  if (!Number.isNaN(numId)) {
    const byId = Object.entries(library.topicIdMap).find(([, id]) => id === numId);
    if (byId) return byId[0];
  }

  return null;
}

/**
 * Returns curated external resources for a topic, best-quality first.
 * Always resolves (never throws) — returns [] for unknown/uncovered topics.
 *
 * @param {string} topicIdOrName - topic name (e.g. "Arrays") or numeric topic_id
 * @param {Object} [opts]
 * @param {number} [opts.limit=3]  - max resources to return
 * @param {string} [opts.type]     - filter to one type: 'video' | 'article' | 'practice'
 * @returns {Array<{id,title,url,type,difficulty,quality_score,site,description}>}
 */
function getTopicResources(topicIdOrName, { limit = 3, type } = {}) {
  const library    = _loadLibrary();
  const topicName  = _resolveTopicName(topicIdOrName, library);
  if (!topicName) return [];

  let resources = library.topics[topicName]?.resources || [];
  if (type) resources = resources.filter(r => r.type === type);

  return [...resources]
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
    .slice(0, limit);
}

/** True if the resource library has any entries at all for this topic. */
function hasResourcesFor(topicIdOrName) {
  const library = _loadLibrary();
  return _resolveTopicName(topicIdOrName, library) !== null;
}

module.exports = { getTopicResources, hasResourcesFor };
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
// handful of hand-curated topics (see _meta.topic_id_map in the file).
// Item #5 (coverage expansion): rather than requiring someone to hand-edit
// that JSON forever, getTopicResources() now ALSO merges in tutor-submitted
// resources from the TopicResource collection (status: 'approved') — see
// models/TopicResource.js and resourceCoverageController.js for the
// submission/approval workflow. Any topic with neither a static entry nor
// an approved DB entry still returns [] — callers must treat that as "no
// resources yet," not an error.

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
    _cache = { topics, topicIdMap: _meta?.topic_id_map || {}, meta: _meta || {} };
  } catch (err) {
    console.warn('[topicResourceService] Could not load topic_resources.json:', err.message);
    _cache = { topics: {}, topicIdMap: {}, meta: {} };
  }
  return _cache;
}

function _escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Returns curated + tutor-approved external resources for a topic,
 * best-quality first. Always resolves (never throws) — returns [] for
 * unknown/uncovered topics.
 *
 * @param {string} topicIdOrName - topic name (e.g. "Arrays") or numeric topic_id
 * @param {Object} [opts]
 * @param {number} [opts.limit=3]  - max resources to return
 * @param {string} [opts.type]     - filter to one type: 'video' | 'article' | 'practice'
 * @returns {Promise<Array<{id,title,url,type,difficulty,quality_score,site,description,source}>>}
 */
async function getTopicResources(topicIdOrName, { limit = 3, type } = {}) {
  const library   = _loadLibrary();
  const topicName = _resolveTopicName(topicIdOrName, library) || String(topicIdOrName);

  const staticResources = (library.topics[_resolveTopicName(topicIdOrName, library)]?.resources || [])
    .map(r => ({ ...r, source: 'curated' }));

  let dbResources = [];
  try {
    // Lazy require avoids a circular-import risk if TopicResource ever
    // needs something from this file in the future.
    const TopicResource = require('../models/TopicResource');
    const docs = await TopicResource.find({
      status: 'approved',
      topic: { $regex: `^${_escapeRegex(topicName)}$`, $options: 'i' },
    }).lean();

    dbResources = docs.map(d => ({
      id:            d._id.toString(),
      title:         d.title,
      url:           d.url,
      type:          d.type,
      difficulty:    d.difficulty,
      quality_score: d.qualityScore,
      site:          d.site,
      description:   d.description,
      source:        'tutor',
    }));
  } catch (err) {
    // Non-critical — students still see the static/curated set even if the
    // DB lookup fails for any reason (e.g. Mongo briefly unreachable).
    console.warn('[topicResourceService] DB resource lookup failed (non-critical):', err.message);
  }

  let combined = [...staticResources, ...dbResources];
  if (type) combined = combined.filter(r => r.type === type);

  return combined
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
    .slice(0, limit);
}

/**
 * True if there's at least one resource (static or approved tutor
 * submission) for this topic. Used by the coverage-priority report.
 */
async function hasResourcesFor(topicIdOrName) {
  const library = _loadLibrary();
  if (_resolveTopicName(topicIdOrName, library) !== null) return true;

  try {
    const TopicResource = require('../models/TopicResource');
    const count = await TopicResource.countDocuments({
      status: 'approved',
      topic: { $regex: `^${_escapeRegex(String(topicIdOrName))}$`, $options: 'i' },
    });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Item #5: coverage-priority report. Cross-references every topic that has
 * ever appeared in a quiz question against (a) how often students fail it
 * and (b) whether it already has curated/approved resources — so curation
 * effort (yours or your tutors') goes to the topics that need it most
 * first, instead of guessing. Uncovered topics are sorted first; within
 * each coverage bucket, worst fail rate first.
 *
 * Deliberately joins through Quiz.questions rather than reading a `topic`
 * field off QuizAttempt.answers — that field isn't persisted on the
 * QuizAttempt schema (topic lives on the Quiz document, not copied onto
 * each stored answer), so joining through Quiz is what makes this work
 * retroactively across every historical attempt, not just new ones.
 *
 * @returns {Promise<Array<{topic, attempts, failRate, covered}>>}
 */
async function getCoverageReport() {
  const QuizAttempt = require('../models/QuizAttempt');
  const TopicResource = require('../models/TopicResource');

  const attempts = await QuizAttempt
    .find({})
    .select('quiz answers')
    .populate('quiz', 'questions')
    .lean();

  const stats = {}; // topic -> { attempts, correct }
  for (const attempt of attempts) {
    const topicByQuestionId = {};
    for (const q of attempt.quiz?.questions || []) {
      if (q.topic) topicByQuestionId[String(q._id)] = q.topic;
    }
    for (const ans of attempt.answers || []) {
      const topic = topicByQuestionId[String(ans.questionId)];
      if (!topic) continue;
      if (!stats[topic]) stats[topic] = { attempts: 0, correct: 0 };
      stats[topic].attempts += 1;
      if (ans.isCorrect) stats[topic].correct += 1;
    }
  }

  const library = _loadLibrary();
  const staticTopics = new Set(Object.keys(library.topics).map(t => t.toLowerCase()));

  const approvedDbTopics = new Set(
    (await TopicResource.find({ status: 'approved' }).select('topic -_id').lean())
      .map(d => d.topic.toLowerCase())
  );

  const report = Object.entries(stats).map(([topic, s]) => ({
    topic,
    attempts: s.attempts,
    failRate: s.attempts > 0 ? Math.round((1 - s.correct / s.attempts) * 100) : 0,
    covered:  staticTopics.has(topic.toLowerCase()) || approvedDbTopics.has(topic.toLowerCase()),
  }));

  report.sort((a, b) => {
    if (a.covered !== b.covered) return a.covered ? 1 : -1; // uncovered first
    return b.failRate - a.failRate;                          // then worst first
  });

  return report;
}

module.exports = { getTopicResources, hasResourcesFor, getCoverageReport };
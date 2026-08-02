/**
 * services/mlBridgeService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridge between Node.js and the Python ML microservice (port 5001).
 *
 * Zero extra npm dependencies — uses only:
 *   • Node built-in `http` / `https`   (instead of axios)
 *   • Node built-in `fs`, `path`       (instead of fast-csv)
 *
 * Responsibilities:
 *  1. Export quiz interaction data from MongoDB → CSV, folding in student
 *     thumbs-up/down feedback (as a score adjustment) and recency
 *     (days_since_activity, for the Ebbinghaus retention feature) so the
 *     Python model actually learns from both signals on the next retrain
 *  2. Call POST /ml/train  — retrain KMeans + CF models
 *  3. Call GET  /ml/recommend/:numericId — ML recs + SHAP
 *  4. Map MongoDB ObjectIds ↔ numeric ids used by Python
 *  5. Graceful fallback: returns null if Python service is down
 * ─────────────────────────────────────────────────────────────────────────────
 */

const http  = require('http');
const https = require('https');
const path  = require('path');
const fs    = require('fs');

const QuizAttempt            = require('../models/QuizAttempt');
const Enrollment             = require('../models/Enrollment');
const Progress                = require('../models/Progress');
const RecommendationFeedback = require('../models/RecommendationFeedback');

// ── Config ────────────────────────────────────────────────────────────────────
const ML_BASE_URL  = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_TIMEOUT   = 30_000;
const DATA_DIR     = path.resolve(__dirname, '../../ai_engine/data/raw');
const ID_MAP_PATH  = path.join(DATA_DIR, 'student_id_map.json');

// Shared secret sent on every request to the Python ML service.
// Must match ML_SECRET in the environment the Flask service runs in
// (backend/ml_service/app.py reads the same env var name).
// If unset, the header is simply omitted — app.py's require_ml_secret
// decorator no-ops when its own ML_SECRET is unset too, so local dev
// without any .env still works without configuration.
const ML_SECRET = process.env.ML_SECRET || null;

if (!ML_SECRET) {
  console.warn(
    '[ML Bridge] ⚠️  ML_SECRET is not set. Requests to the Python ML service ' +
    'will be sent without auth. Set ML_SECRET in backend/.env before deploying.'
  );
}

// ── Simple HTTP helper (replaces axios) ───────────────────────────────────────
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const timeout = options.timeout || ML_TIMEOUT;

    const reqOptions = {
      hostname: parsed.hostname,
      port:     parsed.port,
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Sent on every request — app.py validates this on protected routes.
        // Omitted entirely when ML_SECRET is unset (matches Flask's dev-mode no-op).
        ...(ML_SECRET ? { 'X-ML-Secret': ML_SECRET } : {}),
        ...(options.headers || {}),
      },
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Request timed out: ${url}`));
    });

    req.on('error', reject);

    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ── ID map helpers ────────────────────────────────────────────────────────────
function loadIdMap() {
  try {
    if (fs.existsSync(ID_MAP_PATH)) {
      return JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveIdMap(map) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ID_MAP_PATH, JSON.stringify(map, null, 2));
  } catch (e) {
    console.error('[ML Bridge] Could not save ID map:', e.message);
  }
}

function getOrCreateNumericId(mongoId, map) {
  if (map[mongoId] !== undefined) return map[mongoId];
  const nextId = Object.keys(map).length + 1;
  map[mongoId] = nextId;
  return nextId;
}

// ── Write CSV (replaces fast-csv) ─────────────────────────────────────────────
function writeCSV(filePath, rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const val = row[h] === undefined || row[h] === null ? '' : String(row[h]);
      return val.includes(',') ? `"${val}"` : val;
    }).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ── Feedback → implicit relevance signal (recommendation-improvement #1) ─────
// Student thumbs-up/down feedback previously only reweighted the JS
// rule-based engine at request time (see recommendationEngine.applyFeedbackWeights)
// and never touched the Python CF/KMeans training data at all — a student
// could downvote a topic every day and the ML model would never learn from
// it. This pulls that same signal into the exported training rows, so the
// next scheduled retrain (server.js runMLRetrain) actually learns from it.
//
// Returns a map of "<studentMongoId>:<topicName>" → a signed score shift in
// roughly [-21, +21], mirroring the same weight formula feedbackController's
// getFeedbackSummary already uses for the JS engine, so both systems treat
// feedback consistently:
//   thumbs_up / already_know → push the effective quiz_score UP  (student
//                               engaged well / already knows this topic)
//   thumbs_down / too_hard   → push the effective quiz_score DOWN (content
//                               was rejected / mismatched their level)
async function getFeedbackWeights() {
  const rows = await RecommendationFeedback.aggregate([
    { $group: {
      _id: { student: '$student', topic: '$topic' },
      thumbs_up:    { $sum: { $cond: [{ $eq: ['$signal', 'thumbs_up']    }, 1, 0] } },
      thumbs_down:  { $sum: { $cond: [{ $eq: ['$signal', 'thumbs_down']  }, 1, 0] } },
      already_know: { $sum: { $cond: [{ $eq: ['$signal', 'already_know'] }, 1, 0] } },
      too_hard:     { $sum: { $cond: [{ $eq: ['$signal', 'too_hard']     }, 1, 0] } },
    }},
  ]);

  const map = {};
  for (const row of rows) {
    const up    = row.thumbs_up   + row.already_know * 0.5;
    const down  = row.thumbs_down + row.too_hard      * 0.5;
    const total = up + down;
    if (total === 0) continue;

    // Same Bayesian-smoothed weight (0.3–1.7, neutral at 1.0) as
    // feedbackController.getFeedbackSummary, converted to a +/-21 point
    // additive shift on the 0-100 quiz_score scale instead of a multiplier —
    // additive avoids zeroing out already-low scores for students who
    // thumbs-down a weak topic (multiplying a low score by <1 would make
    // it look like the student is doing *better*, which is backwards).
    const weight = Math.max(0.3, Math.min(1.7, 1.0 + (up - down) / (total + 2)));
    const key = `${row._id.student.toString()}:${row._id.topic}`;
    map[key] = (weight - 1.0) * 30;
  }
  return map;
}

function applyFeedbackAdjustment(score, studentMongoId, topicName, feedbackWeights) {
  const key   = `${studentMongoId}:${topicName}`;
  const shift = feedbackWeights[key];
  if (shift === undefined) return score;
  return Math.max(0, Math.min(100, Math.round(score + shift)));
}

// ── Export interactions CSV ───────────────────────────────────────────────────
async function exportInteractionsCSV() {
  const attempts = await QuizAttempt.find({})
    .populate('quiz', 'topicsTested')
    .lean();

  if (!attempts.length) return { studentIdMap: {}, rowCount: 0 };

  // Item #1: pull in feedback signal so retraining learns from thumbs up/down.
  const feedbackWeights = await getFeedbackWeights();

  const idMap    = loadIdMap();
  const topicMap = {};
  let   topicNext = 100;

  function topicId(str) {
    if (!str) return topicNext;
    if (topicMap[str] === undefined) { topicMap[str] = topicNext++; }
    return topicMap[str];
  }

  const rows = [];

  for (const attempt of attempts) {
    const numStudentId = getOrCreateNumericId(attempt.student.toString(), idMap);
    const studentKey   = attempt.student.toString();
    const scorePercent = attempt.score || 0;
    const timeSpent    = attempt.timeTaken ? Math.round(attempt.timeTaken / 60) : 10;
    const errorCount   = attempt.answers
      ? attempt.answers.filter(a => !a.isCorrect).length
      : 0;

    // Item #3: recency, in whole days since this attempt — the raw input
    // for the Ebbinghaus retention-score feature computed in
    // ai_engine/src/preprocessing.py (engineer_features).
    const attemptDate = attempt.createdAt ? new Date(attempt.createdAt) : new Date();
    const daysSince    = Math.max(0, Math.floor((Date.now() - attemptDate.getTime()) / 86_400_000));

    const weakTopics   = attempt.weakTopics   || [];
    const strongTopics = attempt.strongTopics || [];
    const quizTopics   = attempt.quiz?.topicsTested || [];
    const allTopics    = [...new Set([...weakTopics, ...strongTopics, ...quizTopics])];

    if (allTopics.length === 0) {
      const adjustedScore = applyFeedbackAdjustment(scorePercent, studentKey, 'general', feedbackWeights);
      rows.push({
        student_id:          numStudentId,
        topic_id:            topicId('general'),
        quiz_score:          adjustedScore,
        time_spent_minutes:  timeSpent,
        error_count:         errorCount,
        attempts:            attempt.attemptNumber || 1,
        days_since_activity: daysSince,
      });
    } else {
      for (const topic of allTopics) {
        const isWeak     = weakTopics.includes(topic);
        const topicScore = isWeak
          ? Math.min(scorePercent, 55)
          : Math.max(scorePercent, 70);
        const adjustedScore = applyFeedbackAdjustment(topicScore, studentKey, topic, feedbackWeights);

        rows.push({
          student_id:          numStudentId,
          topic_id:            topicId(topic),
          quiz_score:          adjustedScore,
          time_spent_minutes:  timeSpent,
          error_count:         isWeak ? errorCount : Math.max(0, errorCount - 2),
          attempts:            attempt.attemptNumber || 1,
          days_since_activity: daysSince,
        });
      }
    }
  }

  // Persist topic map for reverse lookup
  const topicMapPath = path.join(DATA_DIR, 'topic_id_map.json');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(topicMapPath, JSON.stringify(topicMap, null, 2));
  saveIdMap(idMap);

  const headers = ['student_id', 'topic_id', 'quiz_score', 'time_spent_minutes', 'error_count', 'attempts', 'days_since_activity'];
  writeCSV(path.join(DATA_DIR, 'interactions.csv'), rows, headers);

  console.log(`[ML Bridge] Exported ${rows.length} rows → interactions.csv`);
  return { studentIdMap: idMap, rowCount: rows.length };
}

// ── ML service health check ───────────────────────────────────────────────────
async function isMLServiceUp() {
  try {
    const r = await httpRequest(`${ML_BASE_URL}/api/health`, { timeout: 3_000 });
    return r.status === 200;
  } catch (_) {
    return false;
  }
}

// ── Trigger training ──────────────────────────────────────────────────────────
async function triggerMLTraining() {
  try {
    const { rowCount } = await exportInteractionsCSV();
    if (rowCount < 3) {
      return { success: false, message: 'Not enough data to train models (need ≥ 3 rows).' };
    }
    const resp = await httpRequest(`${ML_BASE_URL}/ml/train`, {
      method: 'POST',
      body:   {},
    });
    console.log('[ML Bridge] Training response:', resp.data);
    return { success: true, message: resp.data?.message || 'Models trained successfully.' };
  } catch (err) {
    console.error('[ML Bridge] Training error:', err.message);
    return { success: false, message: err.message };
  }
}

// ── Get ML recommendations ────────────────────────────────────────────────────
async function getMLRecommendations(mongoStudentId, topN = 5) {
  const idMap     = loadIdMap();
  const numericId = idMap[mongoStudentId.toString()];

  if (!numericId) {
    console.log(`[ML Bridge] Student ${mongoStudentId} not in ID map — needs training.`);
    return null;
  }

  try {
    const url  = `${ML_BASE_URL}/api/recommendations/${numericId}?top_n=${topN}`;
    const resp = await httpRequest(url);
    if (resp.status !== 200) return null;
    return resp.data;
  } catch (err) {
    console.error('[ML Bridge] Recommendation error:', err.message);
    return null;
  }
}

// ── Topic name reverse lookup ─────────────────────────────────────────────────
function getTopicName(numericTopicId) {
  try {
    const mapPath = path.join(DATA_DIR, 'topic_id_map.json');
    if (!fs.existsSync(mapPath)) return `Topic ${numericTopicId}`;
    const map   = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const entry = Object.entries(map).find(([, v]) => v === numericTopicId);
    return entry ? entry[0] : `Topic ${numericTopicId}`;
  } catch (_) {
    return `Topic ${numericTopicId}`;
  }
}

module.exports = {
  exportInteractionsCSV,
  triggerMLTraining,
  getMLRecommendations,
  isMLServiceUp,
  getTopicName,
  loadIdMap,
};
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
 *  1. Export quiz interaction data from MongoDB → CSV
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

const QuizAttempt = require('../models/QuizAttempt');
const Enrollment  = require('../models/Enrollment');
const Progress    = require('../models/Progress');

// ── Config ────────────────────────────────────────────────────────────────────
const ML_BASE_URL  = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_TIMEOUT   = 30_000;
const DATA_DIR     = path.resolve(__dirname, '../../ai_engine/data/raw');
const ID_MAP_PATH  = path.join(DATA_DIR, 'student_id_map.json');

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
      headers:  { 'Content-Type': 'application/json', ...(options.headers || {}) },
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

// ── Export interactions CSV ───────────────────────────────────────────────────
async function exportInteractionsCSV() {
  const attempts = await QuizAttempt.find({})
    .populate('quiz', 'topicsTested')
    .lean();

  if (!attempts.length) return { studentIdMap: {}, rowCount: 0 };

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
    const scorePercent = attempt.score || 0;
    const timeSpent    = attempt.timeTaken ? Math.round(attempt.timeTaken / 60) : 10;
    const errorCount   = attempt.answers
      ? attempt.answers.filter(a => !a.isCorrect).length
      : 0;

    const weakTopics   = attempt.weakTopics   || [];
    const strongTopics = attempt.strongTopics || [];
    const quizTopics   = attempt.quiz?.topicsTested || [];
    const allTopics    = [...new Set([...weakTopics, ...strongTopics, ...quizTopics])];

    if (allTopics.length === 0) {
      rows.push({
        student_id:         numStudentId,
        topic_id:           topicId('general'),
        quiz_score:         scorePercent,
        time_spent_minutes: timeSpent,
        error_count:        errorCount,
        attempts:           attempt.attemptNumber || 1,
      });
    } else {
      for (const topic of allTopics) {
        const isWeak     = weakTopics.includes(topic);
        const topicScore = isWeak
          ? Math.min(scorePercent, 55)
          : Math.max(scorePercent, 70);

        rows.push({
          student_id:         numStudentId,
          topic_id:           topicId(topic),
          quiz_score:         topicScore,
          time_spent_minutes: timeSpent,
          error_count:        isWeak ? errorCount : Math.max(0, errorCount - 2),
          attempts:           attempt.attemptNumber || 1,
        });
      }
    }
  }

  // Persist topic map for reverse lookup
  const topicMapPath = path.join(DATA_DIR, 'topic_id_map.json');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(topicMapPath, JSON.stringify(topicMap, null, 2));
  saveIdMap(idMap);

  const headers = ['student_id', 'topic_id', 'quiz_score', 'time_spent_minutes', 'error_count', 'attempts'];
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
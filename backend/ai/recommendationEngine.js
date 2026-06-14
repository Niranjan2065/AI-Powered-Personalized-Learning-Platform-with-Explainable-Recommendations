// recommendationEngine.js
// Fix: seed "general" bucket from score alone when weakTopics/strongTopics are both empty,
// and normalise the score field across old + new QuizAttempt shapes.

const MIN_QUIZ_DATA_POINTS = 1;

// ---------------------------------------------------------------------------
// Score normalisation
// ---------------------------------------------------------------------------
// Older attempts stored the numeric result on different keys
// (result.percentage, result.totalScore, result.mark, attempt.score, …).
// This helper resolves whichever field is actually present and returns a
// value in the 0-100 range, or null when nothing usable is found.
function resolveScore(attempt) {
  // Prefer explicit 0-100 percentage fields
  const candidates = [
    attempt?.result?.score,        // current shape  (was undefined on old docs)
    attempt?.result?.percentage,   // legacy shape A
    attempt?.result?.percent,      // legacy shape B
    attempt?.score,                // flat shape
    attempt?.percentage,           // flat legacy
  ];

  for (const raw of candidates) {
    if (raw == null) continue;          // skip undefined / null
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;  // skip NaN / Infinity

    // Normalise 0-1 fractions to 0-100
    return n <= 1 && n >= 0 ? n * 100 : n;
  }

  // totalScore requires maxScore to compute a percentage
  const total = Number(attempt?.result?.totalScore ?? attempt?.totalScore);
  const max   = Number(attempt?.result?.maxScore   ?? attempt?.maxScore ?? attempt?.result?.total);
  if (Number.isFinite(total) && Number.isFinite(max) && max > 0) {
    return (total / max) * 100;
  }

  return null; // genuinely unknowable
}

// ---------------------------------------------------------------------------
// Bucket label from a raw 0-100 score
// ---------------------------------------------------------------------------
function scoreToBucket(score) {
  if (score >= 80) return "strong";
  if (score >= 50) return "average";
  return "weak";
}

// ---------------------------------------------------------------------------
// aggregateTopicPerformance
// ---------------------------------------------------------------------------
// Builds topicStats from all attempts.  When an attempt has empty topic
// arrays but a resolvable score, it is credited to a synthetic "general"
// bucket so the engine always has something to work with after attempt #1.
function aggregateTopicPerformance(attempts) {
  const topicStats = {}; // { [topic]: { correct, total, bucket } }

  function record(topic, isCorrect) {
    if (!topicStats[topic]) {
      topicStats[topic] = { correct: 0, total: 0 };
    }
    topicStats[topic].total   += 1;
    topicStats[topic].correct += isCorrect ? 1 : 0;
  }

  for (const attempt of attempts) {
    const weakTopics   = Array.isArray(attempt.weakTopics)   ? attempt.weakTopics   : [];
    const strongTopics = Array.isArray(attempt.strongTopics) ? attempt.strongTopics : [];

    // --- Normal path: topic arrays are populated --------------------------
    for (const topic of weakTopics)   record(topic, false);
    for (const topic of strongTopics) record(topic, true);

    // --- Fallback path: both arrays are empty -----------------------------
    // This is the core fix.  Previously the condition read `result.score`
    // which was `undefined` on older attempts, so the truthiness check
    // always failed and no bucket was ever seeded.
    if (weakTopics.length === 0 && strongTopics.length === 0) {
      const score = resolveScore(attempt);      // ← normalised, never undefined

      if (score !== null) {
        // Accumulate the raw score directly into a dedicated accumulator so
        // that the bucket reflects the true percentage rather than the result
        // of a binary pass/fail count (which would collapse every passing
        // score to 100 % and every failing score to 0 %).
        if (!topicStats["general"]) {
          topicStats["general"] = { correct: 0, total: 0, rawScores: [] };
        }
        topicStats["general"].rawScores.push(score);
      }
      // If score is genuinely null we still skip (no useful signal at all)
    }
  }

  // Annotate each topic with its performance bucket
  for (const [topic, stats] of Object.entries(topicStats)) {
    let pct;
    if (stats.rawScores && stats.rawScores.length > 0) {
      // General bucket: average the raw quiz percentages directly
      pct = stats.rawScores.reduce((a, b) => a + b, 0) / stats.rawScores.length;
    } else {
      pct = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    }
    stats.bucket      = scoreToBucket(pct);
    stats.performance = Math.round(pct);
  }

  return topicStats;
}

// ---------------------------------------------------------------------------
// buildRecommendations  (main entry point)
// ---------------------------------------------------------------------------
function buildRecommendations(attempts, lessonCatalogue) {
  if (!attempts || attempts.length < MIN_QUIZ_DATA_POINTS) {
    return { status: "not_enough_data", recommendations: [] };
  }

  const topicStats = aggregateTopicPerformance(attempts);

  // topicStats is now guaranteed non-empty for any attempt with a score,
  // even when the topic arrays were blank, so this guard is just a safety net.
  if (Object.keys(topicStats).length === 0) {
    return _fallbackNextLesson(attempts, lessonCatalogue);
  }

  const recommendations = [];

  for (const [topic, stats] of Object.entries(topicStats)) {
    const isGeneral = topic === "general";

    if (stats.bucket === "weak") {
      const lessons = isGeneral
        ? _generalReviewLessons(lessonCatalogue, attempts)
        : _lessonsForTopic(lessonCatalogue, topic, "remedial");

      recommendations.push({
        type:        "remedial",
        topic,
        reason:      isGeneral
          ? `Your overall quiz score suggests you'd benefit from a review.`
          : `You struggled with "${topic}" — let's strengthen it.`,
        lessons,
      });
    } else if (stats.bucket === "strong") {
      const lessons = isGeneral
        ? _generalAdvanceLessons(lessonCatalogue, attempts)
        : _lessonsForTopic(lessonCatalogue, topic, "advanced");

      recommendations.push({
        type:        "advancement",
        topic,
        reason:      isGeneral
          ? `Great score! Here are some more challenging materials.`
          : `You're doing well in "${topic}" — time to go deeper.`,
        lessons,
      });
    } else {
      // "average" bucket → consolidation
      const lessons = isGeneral
        ? _generalConsolidationLessons(lessonCatalogue, attempts)
        : _lessonsForTopic(lessonCatalogue, topic, "consolidation");

      recommendations.push({
        type:        "consolidation",
        topic,
        reason:      isGeneral
          ? `Solid start! These lessons will help consolidate what you know.`
          : `You're on track with "${topic}" — keep the momentum going.`,
        lessons,
      });
    }
  }

  return { status: "ok", recommendations };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function _lessonsForTopic(catalogue, topic, level) {
  if (!catalogue) return [];
  return (catalogue[topic]?.[level] ?? catalogue[topic] ?? []).slice(0, 3);
}

function _generalReviewLessons(catalogue, attempts) {
  // Pick the most recently attempted subject area as a hint, else return
  // a generic starter set from whatever the catalogue exposes.
  const hint = _lastSubject(attempts);
  return _lessonsForTopic(catalogue, hint ?? "general", "remedial");
}

function _generalAdvanceLessons(catalogue, attempts) {
  const hint = _lastSubject(attempts);
  return _lessonsForTopic(catalogue, hint ?? "general", "advanced");
}

function _generalConsolidationLessons(catalogue, attempts) {
  const hint = _lastSubject(attempts);
  return _lessonsForTopic(catalogue, hint ?? "general", "consolidation");
}

function _lastSubject(attempts) {
  // Walk backwards to find the most recent attempt that carries a subject tag
  for (let i = attempts.length - 1; i >= 0; i--) {
    const s = attempts[i]?.subject ?? attempts[i]?.quizSubject ?? attempts[i]?.topic;
    if (s) return s;
  }
  return null;
}

function _fallbackNextLesson(attempts, catalogue) {
  // Last-resort: just return the next lesson in sequence
  const last  = attempts[attempts.length - 1];
  const next  = last?.nextLesson ?? last?.result?.nextLesson ?? null;
  return {
    status: "fallback",
    recommendations: next
      ? [{ type: "next", topic: "general", reason: "Continue where you left off.", lessons: [next] }]
      : [],
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  resolveScore,
  aggregateTopicPerformance,
  buildRecommendations,
  MIN_QUIZ_DATA_POINTS,
};
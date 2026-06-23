// controllers/feedbackController.js
// Handles recommendation feedback (thumbs up/down/already_know/too_hard).
// Also exposes a summary endpoint so the engine can read signal weights.
const RecommendationFeedback = require('../models/RecommendationFeedback');
const Recommendation         = require('../models/Recommendation');

// ── POST /api/recommendations/:recId/items/:itemId/feedback ──────────────────
// Student submits or updates feedback on one recommendation item.
const submitFeedback = async (req, res, next) => {
  try {
    const { recId, itemId } = req.params;
    const { signal, comment = '' } = req.body;
    const studentId = req.user._id;

    const allowed = ['thumbs_up', 'thumbs_down', 'already_know', 'too_hard'];
    if (!allowed.includes(signal)) {
      return res.status(400).json({
        success: false,
        message: `signal must be one of: ${allowed.join(', ')}`,
      });
    }

    // Pull topic from the recommendation item so we can aggregate by topic
    const rec = await Recommendation.findById(recId);
    if (!rec) {
      return res.status(404).json({ success: false, message: 'Recommendation not found' });
    }
    const item = rec.recommendations.id(itemId);
    const topic = item?.addressesTopic || 'general';

    // Upsert — re-voting overwrites the previous signal
    const feedback = await RecommendationFeedback.findOneAndUpdate(
      { student: studentId, itemId },
      { student: studentId, recommendation: recId, itemId, signal, topic, comment },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`💬 Feedback [${signal}] from ${studentId} on topic "${topic}"`);
    res.status(200).json({ success: true, data: feedback });
  } catch (error) { next(error); }
};

// ── GET /api/recommendations/feedback/summary ─────────────────────────────────
// Returns per-topic signal weights for the current student.
// Called by recommendationEngine to re-weight confidence scores.
// Shape: { topic: { thumbs_up: N, thumbs_down: N, already_know: N, too_hard: N, weight: 0.0–2.0 } }
const getFeedbackSummary = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const raw = await RecommendationFeedback.aggregate([
      { $match: { student: studentId } },
      { $group: {
        _id:          '$topic',
        thumbs_up:    { $sum: { $cond: [{ $eq: ['$signal', 'thumbs_up']    }, 1, 0] } },
        thumbs_down:  { $sum: { $cond: [{ $eq: ['$signal', 'thumbs_down']  }, 1, 0] } },
        already_know: { $sum: { $cond: [{ $eq: ['$signal', 'already_know'] }, 1, 0] } },
        too_hard:     { $sum: { $cond: [{ $eq: ['$signal', 'too_hard']     }, 1, 0] } },
      }},
    ]);

    // Convert to a topic-keyed map with a computed weight
    // weight > 1.0 → boost this topic in recommendations
    // weight < 1.0 → suppress this topic
    const summary = {};
    for (const row of raw) {
      const up   = row.thumbs_up   + row.already_know * 0.5; // already_know = soft positive
      const down = row.thumbs_down + row.too_hard     * 0.5; // too_hard     = soft negative
      const total = up + down;
      // Bayesian-smoothed weight: neutral at 1.0, range 0.3–1.7
      const weight = total === 0 ? 1.0
        : Math.max(0.3, Math.min(1.7, 1.0 + (up - down) / (total + 2)));

      summary[row._id] = {
        thumbs_up:    row.thumbs_up,
        thumbs_down:  row.thumbs_down,
        already_know: row.already_know,
        too_hard:     row.too_hard,
        weight:       Math.round(weight * 100) / 100,
      };
    }

    res.status(200).json({ success: true, data: summary });
  } catch (error) { next(error); }
};

// ── GET /api/recommendations/feedback/my ─────────────────────────────────────
// Returns all feedback submitted by the current student — used to restore
// button state when the page reloads.
const getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await RecommendationFeedback.find({ student: req.user._id })
      .select('itemId signal topic createdAt')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: feedback });
  } catch (error) { next(error); }
};

module.exports = { submitFeedback, getFeedbackSummary, getMyFeedback };
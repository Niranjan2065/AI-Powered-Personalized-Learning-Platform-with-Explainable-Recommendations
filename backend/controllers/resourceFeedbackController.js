// controllers/resourceFeedbackController.js
// Feedback on curated external resources shown for weak topics on the quiz
// result page. Same upsert-on-revote pattern as feedbackController.js, but
// scoped to a resourceId string instead of a Recommendation/itemId pair.
const ResourceFeedback = require('../models/ResourceFeedback');

// ── POST /api/resource-feedback/:resourceId ───────────────────────────────
const submitResourceFeedback = async (req, res, next) => {
  try {
    const { resourceId } = req.params;
    const { signal, topic = 'general' } = req.body;
    const studentId = req.user._id;

    const allowed = ['thumbs_up', 'thumbs_down'];
    if (!allowed.includes(signal)) {
      return res.status(400).json({
        success: false,
        message: `signal must be one of: ${allowed.join(', ')}`,
      });
    }

    const feedback = await ResourceFeedback.findOneAndUpdate(
      { student: studentId, resourceId },
      { student: studentId, resourceId, signal, topic },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: feedback });
  } catch (error) { next(error); }
};

// ── GET /api/resource-feedback/mine ───────────────────────────────────────
// Returns { [resourceId]: 'thumbs_up' | 'thumbs_down' } for the current
// student, so the frontend can restore prior selections on page load
// instead of every resource card resetting to "unvoted" on every visit.
const getMyResourceFeedback = async (req, res, next) => {
  try {
    const rows = await ResourceFeedback.find({ student: req.user._id })
      .select('resourceId signal -_id')
      .lean();

    const map = {};
    for (const r of rows) map[r.resourceId] = r.signal;

    res.status(200).json({ success: true, data: map });
  } catch (error) { next(error); }
};

module.exports = { submitResourceFeedback, getMyResourceFeedback };
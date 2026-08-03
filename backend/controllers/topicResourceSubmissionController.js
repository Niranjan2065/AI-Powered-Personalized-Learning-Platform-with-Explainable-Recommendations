// controllers/topicResourceSubmissionController.js
// Item #2 of the coverage-expansion plan: tutors submit candidate external
// resources for a topic, an admin reviews and approves/rejects — same
// approval-workflow shape as applicationController.js, applied to resource
// curation instead of tutor applications. Approved resources are picked up
// automatically by topicResourceService.getTopicResources() (it queries
// TopicResource with status: 'approved' directly — no cache to invalidate,
// no file to rewrite).
const TopicResource = require('../models/TopicResource');
const { suggestResourceSearches } = require('../services/resourceSuggestionService');

// ── POST /api/tutor-resources ── (tutor) ──────────────────────────────────
const submitResource = async (req, res, next) => {
  try {
    const { topic, title, url, type, difficulty, site, description } = req.body;

    if (!topic?.trim() || !title?.trim() || !url?.trim() || !type) {
      return res.status(400).json({
        success: false,
        message: 'topic, title, url and type are required',
      });
    }
    if (!['video', 'article', 'practice'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "type must be one of: 'video', 'article', 'practice'",
      });
    }

    const resource = await TopicResource.create({
      topic: topic.trim(),
      title: title.trim(),
      url: url.trim(),
      type,
      difficulty: difficulty || 'beginner',
      site: site?.trim() || '',
      description: description?.trim() || '',
      submittedBy: req.user._id,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: resource });
  } catch (error) { next(error); }
};

// ── GET /api/tutor-resources/mine ── (tutor) ──────────────────────────────
// Lets a tutor see the status of everything they've submitted — mirrors
// getMyApplication() in applicationController.js.
const getMySubmissions = async (req, res, next) => {
  try {
    const submissions = await TopicResource.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: submissions });
  } catch (error) { next(error); }
};

// ── GET /api/admin/resource-submissions ── (admin) ────────────────────────
// Query params: status=pending|approved|rejected (default: pending)
const getSubmissions = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const filter = ['pending', 'approved', 'rejected'].includes(status) ? { status } : {};

    const submissions = await TopicResource.find(filter)
      .populate('submittedBy', 'name email')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: submissions });
  } catch (error) { next(error); }
};

// ── PUT /api/admin/resource-submissions/:id ── (admin) ────────────────────
// Body: { status: 'approved'|'rejected', qualityScore?, reviewNote? }
const reviewSubmission = async (req, res, next) => {
  try {
    const { status, qualityScore, reviewNote = '' } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be 'approved' or 'rejected'",
      });
    }
    if (status === 'rejected' && !reviewNote.trim()) {
      return res.status(400).json({
        success: false,
        message: 'reviewNote is required when rejecting a submission',
      });
    }

    const update = {
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      reviewNote,
    };
    // Admin can adjust the quality score on approval (e.g. downgrade an
    // over-claimed submission) — otherwise the schema default (0.75) holds.
    if (status === 'approved' && qualityScore != null) {
      update.qualityScore = Math.max(0, Math.min(1, Number(qualityScore)));
    }

    const submission = await TopicResource.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    res.status(200).json({ success: true, data: submission });
  } catch (error) { next(error); }
};

// ── POST /api/tutor-resources/suggest ── (tutor) ───────────────────────────
// "AI suggests where to look, never what the link is" — see
// resourceSuggestionService.js for why this deliberately never returns a
// direct URL from the LLM. Body: { courseTitle, courseDescription?,
// moduleTitle?, existingTopics? }
const suggestSearches = async (req, res, next) => {
  try {
    const { courseTitle, courseDescription, moduleTitle, existingTopics } = req.body;

    if (!courseTitle?.trim()) {
      return res.status(400).json({ success: false, message: 'courseTitle is required' });
    }

    const suggestions = await suggestResourceSearches({
      courseTitle, courseDescription, moduleTitle, existingTopics,
    });

    res.status(200).json({ success: true, data: suggestions });
  } catch (error) { next(error); }
};

module.exports = {
  submitResource,
  getMySubmissions,
  getSubmissions,
  reviewSubmission,
  suggestSearches,
};
// controllers/applicationController.js
// Admin: list, review, approve, reject tutor applications.
// Applicant: check own application status.
const TutorApplication = require('../models/TutorApplication');
const User             = require('../models/User');
const { sendTutorApplicationEmail } = require('../services/emailService');

// ── GET /api/applications  (admin) ───────────────────────────────────────────
// Query params: status=pending|under_review|approved|rejected, page, limit
const getAllApplications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [applications, total] = await Promise.all([
      TutorApplication.find(filter)
        .populate('user',       'name email avatar createdAt')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      TutorApplication.countDocuments(filter),
    ]);

    // Summary counts for admin dashboard tabs
    const counts = await TutorApplication.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const summary = { pending: 0, under_review: 0, approved: 0, rejected: 0 };
    counts.forEach(c => { summary[c._id] = c.count; });

    res.status(200).json({
      success: true,
      data:    applications,
      summary,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

// ── GET /api/applications/:id  (admin) ───────────────────────────────────────
const getApplication = async (req, res, next) => {
  try {
    const app = await TutorApplication.findById(req.params.id)
      .populate('user',       'name email avatar bio createdAt tutorStatus')
      .populate('reviewedBy', 'name email');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.status(200).json({ success: true, data: app });
  } catch (error) { next(error); }
};

// ── PATCH /api/applications/:id/status  (admin) ──────────────────────────────
// Body: { status: 'approved'|'rejected'|'under_review', adminFeedback, internalNote }
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, adminFeedback = '', internalNote = '' } = req.body;
    const allowed = ['under_review', 'approved', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
    }
    if (status === 'rejected' && !adminFeedback.trim()) {
      return res.status(400).json({ success: false, message: 'Feedback is required when rejecting an application' });
    }

    const app = await TutorApplication.findById(req.params.id).populate('user', 'name email role');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    // Update application
    app.status        = status;
    app.adminFeedback = adminFeedback;
    app.internalNote  = internalNote;
    app.reviewedBy    = req.user._id;
    app.reviewedAt    = new Date();
    await app.save();

    // Mirror status + activate/deactivate user account
    const userUpdate = { tutorStatus: status };
    if (status === 'approved') {
      userUpdate.isActive = true;   // unlock login
      userUpdate.role     = 'tutor';
    } else if (status === 'rejected') {
      userUpdate.isActive = false;  // keep locked
    }
    const updatedUser = await User.findByIdAndUpdate(app.user._id, userUpdate, { new: true });

    // Email notification
    try {
      await sendTutorApplicationEmail(
        { name: app.user.name, email: app.user.email },
        { status, adminFeedback }
      );
    } catch (emailErr) {
      console.warn('[Email] Failed to send application status email:', emailErr.message);
    }

    console.log(`📋 Application ${app._id} → ${status} by admin ${req.user.email}`);
    res.status(200).json({
      success: true,
      message: `Application ${status}`,
      data:    { application: app, user: updatedUser },
    });
  } catch (error) { next(error); }
};

// ── GET /api/applications/my  (applicant) ────────────────────────────────────
// Lets a pending tutor check their own application status after registration.
// They can't log in yet, so we identify them by email via query param.
const getMyApplication = async (req, res, next) => {
  try {
    // If they managed to log in (approved), use req.user; else fall back to email query
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const app = await TutorApplication.findOne({ user: userId })
      .populate('user',       'name email tutorStatus')
      .populate('reviewedBy', 'name');

    if (!app) return res.status(404).json({ success: false, message: 'No application found' });
    res.status(200).json({ success: true, data: app });
  } catch (error) { next(error); }
};

// ── DELETE /api/applications/:id  (admin — hard delete for spam/test apps) ──
const deleteApplication = async (req, res, next) => {
  try {
    const app = await TutorApplication.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    // Also clean up the orphaned user account
    await User.findByIdAndDelete(app.user);
    res.status(200).json({ success: true, message: 'Application and user account deleted' });
  } catch (error) { next(error); }
};

module.exports = {
  getAllApplications,
  getApplication,
  updateApplicationStatus,
  getMyApplication,
  deleteApplication,
};
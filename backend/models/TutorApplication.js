// models/TutorApplication.js
// Stores tutor registration applications pending admin review.
// Separate from User so rejected applicants can reapply without
// leaving orphaned user documents in the system.
const mongoose = require('mongoose');

const tutorApplicationSchema = new mongoose.Schema(
  {
    // ── Linked user account (created at registration, role='tutor', isActive=false) ──
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },

    // ── Core professional details ─────────────────────────────────────────────
    highestQualification: {
      type:     String,
      required: true,
      enum: [
        "High School Diploma",
        "Associate's Degree",
        "Bachelor's Degree",
        "Master's Degree",
        "Doctorate (PhD)",
        "Professional Certification",
        "Other",
      ],
    },

    yearsOfExperience: {
      type:    Number,
      required: true,
      min:     0,
      max:     50,
    },

    // Primary teaching domain — maps to platform course categories
    areaOfExpertise: {
      type:     String,
      required: true,
      enum: [
        "Web Development",
        "Data Science",
        "Machine Learning / AI",
        "Mobile Development",
        "DevOps & Cloud",
        "Cybersecurity",
        "Database Administration",
        "UI/UX Design",
        "Programming Fundamentals",
        "Other",
      ],
    },

    // Free-text: specific languages, frameworks, tools
    // e.g. "React, Node.js, MongoDB, TypeScript"
    specificSkills: {
      type:    String,
      required: true,
      maxlength: 500,
    },

    // LinkedIn or personal portfolio — optional but helps admin verify
    linkedinUrl: {
      type:    String,
      default: '',
      match:   [/^(https?:\/\/)?(www\.)?linkedin\.com\/.*$/, 'Enter a valid LinkedIn URL'],
    },

    portfolioUrl: {
      type:    String,
      default: '',
    },

    // Short motivation statement — "Why do you want to teach on AILearn?"
    // My addition: gives admin a signal of intent, not just credentials
    teachingStatement: {
      type:     String,
      required: true,
      minlength: 100,
      maxlength: 1000,
    },

    // ── Resume ───────────────────────────────────────────────────────────────
    resumeUrl:      { type: String, default: '' },     // path after multer upload
    resumeFileName: { type: String, default: '' },     // original name shown in UI

    // ── Admin review ─────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending',
      index:   true,
    },

    // Set when admin changes status
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:  { type: Date, default: null },

    // Feedback shown to the applicant in their dashboard
    // Required when rejecting so applicants know what to improve
    adminFeedback: { type: String, default: '' },

    // My addition: internal admin note not shown to the applicant
    internalNote: { type: String, default: '' },

    // My addition: track reapplication attempts
    attemptNumber: { type: Number, default: 1 },
  },
  { timestamps: true }
);

tutorApplicationSchema.index({ status: 1, createdAt: -1 });
tutorApplicationSchema.index({ user: 1 });

module.exports = mongoose.model('TutorApplication', tutorApplicationSchema);
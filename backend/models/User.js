// models/User.js — updated: added tutorStatus + tutorApplication ref
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },

    role: {
      type:    String,
      enum:    ["student", "teacher", "tutor", "admin"],
      default: "student",
    },

    // ── Tutor approval gate ───────────────────────────────────────────────
    // pending   → registered, waiting for admin review
    // approved  → active tutor, can create courses
    // rejected  → registration denied (can reapply)
    // null/''   → not a tutor (students, admins)
    tutorStatus: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected', null],
      default: null,
    },

    // Link to TutorApplication doc for quick lookup
    tutorApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'TutorApplication',
      default: null,
    },

    // isActive=false for pending tutors so they can't login yet
    isActive:  { type: Boolean, default: true },
    avatar:    { type: String,  default: "" },
    bio:       { type: String,  default: "" },
    expertise: [{ type: String }],

    learningLevel: {
      type:    String,
      enum:    ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },

    lastLogin: { type: Date },

    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    createdCourses:  [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true, collection: "users" }
);

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Methods ───────────────────────────────────────────────────────────────────
userSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    email:     { type: String, required: true, unique: true, lowercase: true },
    password:  { type: String, required: true, select: false },

    // ✅ Both "tutor" and "teacher" supported
    role: {
      type: String,
      enum: ["student", "teacher", "tutor", "admin"],
      default: "student",
    },

    isActive:      { type: Boolean, default: true },
    avatar:        { type: String,  default: "" },
    bio:           { type: String,  default: "" },
    expertise:     [{ type: String }],
    learningLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    lastLogin:     { type: Date },

    // References
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    createdCourses:  [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true, collection: "users" }
);

// ============================================================
// PRE-SAVE: Hash password before saving
// ============================================================
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ============================================================
// METHODS
// ============================================================

// ✅ FIX 1: authController.js calls user.matchPassword() — was missing from User.js
// This was the root cause of the 500 "matchPassword is not a function" error
userSchema.methods.matchPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Kept as alias so comparePassword also works if used elsewhere
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// ✅ FIX 2: authController.js calls user.getSignedJwtToken() — was missing from User.js
// Without this, login/register would throw "getSignedJwtToken is not a function"
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
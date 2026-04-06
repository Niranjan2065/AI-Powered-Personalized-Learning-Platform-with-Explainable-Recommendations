// ============================================================
// utils/fixPasswords.js - One-time password rehash script
// ============================================================
// Run: node utils/fixPasswords.js
//
// ✅ SAFE: Only updates passwords for the 3 seeded accounts.
//    Does NOT delete or modify any other data (courses, modules,
//    lessons, quizzes, enrollments, results, etc.)
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
};

const fixPasswords = async () => {
  try {
    // We use the raw mongoose model to bypass Mongoose middleware
    // so we can manually hash and save without triggering double-hash
    const User = require('../models/User');

    const seededEmails = [
      'admin@ailearn.com',
      'tutor@ailearn.com',
      'student@ailearn.com',
    ];

    console.log('\n🔑 Rehashing passwords for seeded accounts...\n');

    for (const email of seededEmails) {
      // Find user - select password field explicitly
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        console.log(`⚠️  User not found: ${email} — skipping`);
        continue;
      }

      // Check if password is already a bcrypt hash
      const alreadyHashed = user.password && user.password.startsWith('$2b$');

      if (alreadyHashed) {
        console.log(`✅ ${email} — already hashed, skipping`);
        continue;
      }

      // Hash the plain text password manually
      const hashed = await bcrypt.hash('password123', 12);

      // Use updateOne to bypass pre-save hook (avoids double-hashing)
      await User.updateOne({ email }, { $set: { password: hashed } });

      console.log(`✅ Fixed password for: ${email} (${user.role})`);
    }

    console.log('\n✅ ============ PASSWORD FIX COMPLETE ============');
    console.log('🔑 All seeded accounts now use: password123');
    console.log('   👑 Admin:   admin@ailearn.com');
    console.log('   👨‍🏫 Tutor:   tutor@ailearn.com');
    console.log('   🎓 Student: student@ailearn.com');
    console.log('   ⚠️  Your real courses and data are untouched.');
    console.log('=================================================\n');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
};

connectDB().then(fixPasswords);
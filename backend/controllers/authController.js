// controllers/authController.js
const User             = require('../models/User');
const TutorApplication = require('../models/TutorApplication');

// ── Helper ────────────────────────────────────────────────────────────────────
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = user.getSignedJwtToken();
  res.status(statusCode)
    .cookie('token', token, {
      expires:  new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })
    .json({
      success: true,
      message,
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        avatar:       user.avatar,
        bio:          user.bio,
        learningLevel:user.learningLevel,
        tutorStatus:  user.tutorStatus ?? null,
      },
    });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be created via registration' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const isTutor = role === 'tutor' || role === 'teacher';

    // Tutors start as inactive pending accounts
    const user = await User.create({
      name:        name.trim(),
      email:       email.toLowerCase().trim(),
      password,
      role:        isTutor ? 'tutor' : (role || 'student'),
      isActive:    !isTutor,      // tutors blocked until approved
      tutorStatus: isTutor ? 'pending' : null,
    });

    // ── Tutor application ─────────────────────────────────────────────────────
    if (isTutor) {
      const {
        highestQualification, yearsOfExperience, areaOfExpertise,
        specificSkills, linkedinUrl, portfolioUrl, teachingStatement,
      } = req.body;

      // Resume uploaded via multer — req.file is set by the route middleware
      const resumeUrl      = req.file?.path     || '';
      const resumeFileName = req.file?.originalname || '';

      const application = await TutorApplication.create({
        user:                user._id,
        highestQualification,
        yearsOfExperience:   Number(yearsOfExperience),
        areaOfExpertise,
        specificSkills,
        linkedinUrl:         linkedinUrl   || '',
        portfolioUrl:        portfolioUrl  || '',
        teachingStatement,
        resumeUrl,
        resumeFileName,
      });

      // Link application back to user
      user.tutorApplication = application._id;
      await user.save({ validateBeforeSave: false });

      console.log(`📋 Tutor application submitted by ${user.email}`);

      // Don't send a login token — tutor must wait for approval
      return res.status(201).json({
        success:          true,
        pendingApproval:  true,
        message:          'Application submitted! Our team will review it within 2-3 business days. You will receive an email once a decision is made.',
        user: {
          id:          user._id,
          name:        user.name,
          email:       user.email,
          role:        user.role,
          tutorStatus: user.tutorStatus,
        },
      });
    }

    // Student — send token immediately
    console.log(`✅ New ${user.role} registered: ${user.email}`);
    sendTokenResponse(user, 201, res, 'Registration successful! Welcome aboard.');

  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // ── Tutor pending / rejected gate ────────────────────────────────────────
    if (user.role === 'tutor' && user.tutorStatus === 'pending') {
      return res.status(403).json({
        success:         false,
        pendingApproval: true,
        message:         'Your tutor application is under review. You will be notified by email once approved.',
      });
    }
    if (user.role === 'tutor' && user.tutorStatus === 'rejected') {
      return res.status(403).json({
        success:  false,
        rejected: true,
        message:  'Your tutor application was not approved. Please check your email for feedback.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Your account has been deactivated. Contact support.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    console.log(`✅ User logged in: ${user.email} (${user.role})`);
    sendTokenResponse(user, 200, res, 'Login successful!');

  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    res.cookie('token', 'none', { expires: new Date(Date.now() + 10000), httpOnly: true });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) { next(error); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('enrolledCourses', 'title thumbnail category level')
      .populate('createdCourses',  'title thumbnail enrollmentCount isPublished')
      .populate('tutorApplication');
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// ── PUT /api/auth/update-profile ──────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowed    = ['name', 'bio', 'expertise', 'avatar'];
    const updateData = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) { next(error); }
};

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!await user.matchPassword(currentPassword)) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    user.password = newPassword;
    await user.save();
    sendTokenResponse(user, 200, res, 'Password changed successfully');
  } catch (error) { next(error); }
};

module.exports = { register, login, logout, getMe, updateProfile, changePassword };
// routes/authRoutes.js
const express = require('express');
const router  = express.Router();
const { register, login, logout, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { protect }      = require('../middleware/auth');
const { resumeUpload } = require('./applicationRoutes');

// register uses multer so tutor resume is available as req.file
router.post('/register',        resumeUpload.single('resume'), register);
router.post('/login',           login);
router.post('/logout',          protect, logout);
router.get ('/me',              protect, getMe);
router.put ('/update-profile',  protect, updateProfile);
router.put ('/change-password', protect, changePassword);

module.exports = router;
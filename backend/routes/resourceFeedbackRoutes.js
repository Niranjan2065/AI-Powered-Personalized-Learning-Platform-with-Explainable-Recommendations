// routes/resourceFeedbackRoutes.js
const express = require('express');
const router  = express.Router();

const { protect, authorize } = require('../middleware/auth');
const {
  submitResourceFeedback,
  getMyResourceFeedback,
} = require('../controllers/resourceFeedbackController');

router.get ('/mine',            protect, authorize('student'), getMyResourceFeedback);
router.post('/:resourceId',     protect, authorize('student'), submitResourceFeedback);

module.exports = router;
// models/RecommendationFeedback.js
// Stores student thumbs-up/down on each recommendation item.
// The engine reads this to re-weight future recommendations:
//   - thumbs_down on a topic → lower confidence for that topic next time
//   - thumbs_up             → boost confidence, extend SR interval
const mongoose = require('mongoose');

const recommendationFeedbackSchema = new mongoose.Schema(
  {
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    // The parent Recommendation document
    recommendation: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Recommendation',
      required: true,
    },
    // The specific item inside recommendations[]
    itemId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // What the student thought of it
    signal: {
      type:    String,
      enum:    ['thumbs_up', 'thumbs_down', 'already_know', 'too_hard'],
      required: true,
    },
    // Topic this item addressed — copied from the recommendation item
    // so we can aggregate by topic without joining
    topic: {
      type:    String,
      default: 'general',
    },
    // Optional free-text comment (shown as placeholder in UI)
    comment: {
      type:    String,
      default: '',
      maxlength: 300,
    },
  },
  { timestamps: true }
);

// One feedback entry per student per item — upsert on re-vote
recommendationFeedbackSchema.index({ student: 1, itemId: 1 }, { unique: true });
recommendationFeedbackSchema.index({ student: 1, topic: 1 });
recommendationFeedbackSchema.index({ recommendation: 1 });

module.exports = mongoose.model('RecommendationFeedback', recommendationFeedbackSchema);
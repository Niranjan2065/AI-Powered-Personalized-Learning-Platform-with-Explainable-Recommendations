// models/ResourceFeedback.js
// Thumbs up/down on a curated external resource (topic_resources.json
// entries shown on the quiz-result "Weak Topics" breakdown).
//
// This is intentionally a separate, lighter model from
// RecommendationFeedback — that one requires a `recommendation` ObjectId +
// `itemId` because it's voting on an item inside a Recommendation document.
// Resource links aren't part of a Recommendation; they're looked up fresh
// per quiz attempt from a static JSON file (see topicResourceService.js),
// so there's no Recommendation document to reference. `resourceId` here is
// the resource's own string id from topic_resources.json (e.g. "res_var_01").
const mongoose = require('mongoose');

const resourceFeedbackSchema = new mongoose.Schema(
  {
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    // The resource's own id from topic_resources.json, e.g. "res_var_01"
    resourceId: {
      type:     String,
      required: true,
    },
    topic: {
      type:    String,
      default: 'general',
    },
    signal: {
      type:     String,
      enum:     ['thumbs_up', 'thumbs_down'],
      required: true,
    },
  },
  { timestamps: true }
);

// One vote per student per resource — upsert on re-vote
resourceFeedbackSchema.index({ student: 1, resourceId: 1 }, { unique: true });
resourceFeedbackSchema.index({ resourceId: 1 });

module.exports = mongoose.model('ResourceFeedback', resourceFeedbackSchema);
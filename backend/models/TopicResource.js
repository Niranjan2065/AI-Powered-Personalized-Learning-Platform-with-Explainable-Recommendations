// models/TopicResource.js
// Tutor-submitted external learning resources, with an admin approval
// workflow before they become visible to students — same pattern this
// codebase already uses for tutor applications (see Application.js /
// applicationRoutes.js), just applied to resource curation instead.
//
// This is deliberately a separate collection from the static
// ai_engine/data/raw/topic_resources.json file rather than a replacement
// for it: that JSON is the original hand-curated seed set (10 topics,
// high-confidence quality scores); this collection is how coverage grows
// over time without someone hand-editing a JSON file for every addition.
// topicResourceService.getTopicResources() merges both sources — see the
// merge logic there.
const mongoose = require('mongoose');

const topicResourceSchema = new mongoose.Schema(
  {
    topic:       { type: String, required: true, trim: true },
    title:       { type: String, required: true, trim: true },
    url:         { type: String, required: true, trim: true },
    type:        { type: String, enum: ['video', 'article', 'practice'], required: true },
    difficulty:  { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    site:        { type: String, trim: true, default: '' },
    description: { type: String, trim: true, maxlength: 300, default: '' },

    // Tutor-submitted resources start with no score; an admin sets one on
    // approval (or it defaults to a conservative 0.75 so it still ranks
    // reasonably against hand-curated entries without an explicit review).
    qualityScore: { type: Number, min: 0, max: 1, default: 0.75 },

    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:  { type: Date },
    reviewNote:  { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

topicResourceSchema.index({ topic: 1, status: 1 });
topicResourceSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('TopicResource', topicResourceSchema);
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  domain: { type: String },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  gapAnalysisStatus: {
    type: String,
    enum: ['NOT_STARTED', 'ANALYZING', 'COMPLETED', 'FAILED'],
    default: 'NOT_STARTED',
    index: true,
  },
  gapAnalysisError: { type: String, default: null },
  lastGapAnalysisAt: { type: Date, default: null },
  gapCount: { type: Number, default: 0 },
  recommendationCount: { type: Number, default: 0 },
  lastRecommendationAnalysisAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);

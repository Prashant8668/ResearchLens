const mongoose = require('mongoose');

const similarityResultSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  targetTopic: { type: String, required: true },
  researchIdea: { type: String },
  overallSimilarityScore: { type: Number, min: 0, max: 100 },
  similarityScore: { type: Number, min: 0, max: 1 },
  interpretation: { type: String, enum: ['High', 'Moderate', 'Low', 'high', 'moderate', 'low'], default: 'Low' },
  interpretationText: { type: String },
  explanation: { type: String, default: 'This score reflects textual similarity to the available project corpus.' },
  statusBadge: { type: String },
  matchingKeywords: [{ type: String }],
  totalPapersAnalyzed: { type: Number, default: 0 },
  thresholdsUsed: {
    high: { type: Number, default: 0.60 },
    moderate: { type: Number, default: 0.30 },
  },
  similarPapers: [{
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
    title: { type: String },
    originalFilename: { type: String },
    similarityScore: { type: Number },
    similarityPercentage: { type: Number },
    matchingKeywords: [{ type: String }],
    rank: { type: Number },
  }],
  rawResults: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('SimilarityResult', similarityResultSchema);

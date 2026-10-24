const mongoose = require('mongoose');

const paperAnalysisSchema = new mongoose.Schema({
  paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper', required: true, unique: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  extractedKeywords: [{ term: String, score: Number, rank: Number }],
  keywordsExtractedAt: { type: Date, default: null },

  // Phase 7: Structured AI Summary
  structuredSummary: {
    researchProblem: { type: String, default: null },
    objective: { type: String, default: null },
    methodology: { type: String, default: null },
    keyFindings: [{ type: String }],
    limitations: [{ type: String }],
    model: { type: String, default: null },
    generatedAt: { type: Date, default: null },
  },
  summaryStatus: {
    type: String,
    enum: ['NOT_STARTED', 'GENERATING', 'COMPLETED', 'FAILED'],
    default: 'NOT_STARTED',
    index: true,
  },
  summaryError: { type: String, default: null },

  // Backward compatibility fields
  summary: { type: String },
  methodology: { type: String },
  limitations: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('PaperAnalysis', paperAnalysisSchema);

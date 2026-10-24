const mongoose = require('mongoose');

const supportingPaperSchema = new mongoose.Schema({
  paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper', required: true },
  title: { type: String, required: true },
  paperTitle: { type: String },
  originalFilename: { type: String },
  publicationYear: { type: Number, default: null },
  evidenceExcerpt: { type: String }, // Verifiable quote from author or summary
  sourceSection: { type: String, default: 'Limitations' }, // 'Limitations' | 'Future Work' | 'Methodology' | 'Findings'
}, { _id: false });

const gapResultSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true },
  topic: { type: String, required: true },
  category: {
    type: String,
    enum: [
      'Methodological',
      'Empirical / Evaluation',
      'Theoretical / Algorithmic',
      'Application / Deployment',
      'Scope & Generalizability',
      'Other'
    ],
    default: 'Methodological',
    index: true,
  },
  gapType: {
    type: String,
    enum: ['Explicit Gap', 'Corpus-Based Opportunity', 'Unverified Hypothesis'],
    default: 'Corpus-Based Opportunity',
    index: true,
  },
  description: { type: String, required: true },
  whyItMatters: { type: String, required: true },
  suggestedDirection: { type: String, required: true },
  supportingPapers: [supportingPaperSchema],
  confidenceScore: { type: Number, min: 0, max: 1, default: 0.75 },
  confidenceRationale: { type: String },
  dataLimitations: { type: String },
  isPotentialGap: { type: Boolean, default: true },

  // Backward compatibility fields
  researchLevel: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  trendScore: { type: Number, default: 0 },
  gapDescription: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('GapResult', gapResultSchema);

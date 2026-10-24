const mongoose = require('mongoose');

const matchingPassageSchema = new mongoose.Schema({
  passageId: { type: String, required: true },
  submittedText: { type: String, required: true },
  submittedPageNumber: { type: Number, default: 1 },
  submittedSection: { type: String, default: 'General' },
  sourcePaperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
  sourceTitle: { type: String, required: true },
  sourceFilename: { type: String },
  sourcePageNumber: { type: Number, default: 1 },
  sourceSection: { type: String, default: 'General' },
  sourceText: { type: String, required: true },
  matchType: {
    type: String,
    enum: ['EXACT', 'NEAR_VERBATIM', 'PARAPHRASE_CANDIDATE'],
    required: true,
  },
  matchedTokenCount: { type: Number, default: 0 },
  similarityScore: { type: Number, min: 0, max: 1, default: 1 },
  matchedKeywords: [{ type: String }],
}, { _id: false });

const candidateSourceSchema = new mongoose.Schema({
  sourcePaperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
  sourceTitle: { type: String, required: true },
  sourceFilename: { type: String },
  matchedTokenCount: { type: Number, default: 0 },
  matchedPassageCount: { type: Number, default: 0 },
  sourceMatchPercentage: { type: Number, default: 0 },
}, { _id: false });

const pairwiseComparisonSchema = new mongoose.Schema({
  pairId: { type: String, required: true },
  paperA: {
    id: { type: String },
    title: { type: String, required: true },
    filename: { type: String },
  },
  paperB: {
    id: { type: String },
    title: { type: String, required: true },
    filename: { type: String },
  },
  matchPercentage: { type: Number, default: 0 },
  paperAMatchPercentage: { type: Number, default: 0 },
  paperBMatchPercentage: { type: Number, default: 0 },
  matchedTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  matchingPassageCount: { type: Number, default: 0 },
  matchingPassages: [matchingPassageSchema],
  status: { type: String, default: 'COMPLETED' },
  error: { type: String, default: null },
}, { _id: false });

const plagiarismScanSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  submittedPaperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paper',
    default: null,
  },
  paperTitle: { type: String, required: true },
  originalFilename: { type: String, required: true },
  comparisonScope: {
    type: String,
    enum: ['PROJECT_CORPUS', 'EXTERNAL_SOURCES'],
    default: 'PROJECT_CORPUS',
  },
  status: {
    type: String,
    enum: ['QUEUED', 'EXTRACTING', 'COMPARING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'QUEUED',
    index: true,
  },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  currentStage: { type: String, default: 'Queued' },
  error: { type: String, default: null },

  // Comparison Workflow Mode
  comparisonMode: {
    type: String,
    enum: ['CUSTOM_PAIRS', 'TWO_GROUP', 'PAIRWISE', 'PROJECT_CORPUS'],
  },
  selectedPairs: [{
    pairId: { type: String },
    paperAId: { type: String },
    paperBId: { type: String },
    paperATitle: { type: String },
    paperBTitle: { type: String },
  }],
  paper1Group: [{
    id: { type: String },
    title: { type: String, required: true },
    filename: { type: String },
    originalFilename: { type: String },
    isUploaded: { type: Boolean, default: false },
    tokenCount: { type: Number, default: 0 },
  }],
  paper2Group: [{
    id: { type: String },
    title: { type: String, required: true },
    filename: { type: String },
    originalFilename: { type: String },
    isUploaded: { type: Boolean, default: false },
    tokenCount: { type: Number, default: 0 },
  }],

  // Selected Papers & Comparisons
  selectedPapers: [{
    id: { type: String },
    title: { type: String, required: true },
    filename: { type: String },
    isUploaded: { type: Boolean, default: false },
    tokenCount: { type: Number, default: 0 },
  }],
  totalSelectedPapers: { type: Number, default: 0 },
  totalComparisonsExpected: { type: Number, default: 0 },
  totalComparisonsCompleted: { type: Number, default: 0 },
  pairwiseComparisons: [pairwiseComparisonSchema],

  // Denominator & Counts
  totalSubmittedTokens: { type: Number, default: 0 },
  matchedTokens: { type: Number, default: 0 },
  matchPercentage: { type: Number, default: null }, // Null when no comparison corpus exists
  distinctSourceCount: { type: Number, default: 0 },
  matchingPassageCount: { type: Number, default: 0 },

  // Exclusions Breakdown
  exclusions: {
    excludeQuotes: { type: Boolean, default: true },
    excludeReferences: { type: Boolean, default: true },
    quotesExcludedCount: { type: Number, default: 0 },
    quotesExcludedTokens: { type: Number, default: 0 },
    bibliographyExcluded: { type: Boolean, default: false },
    bibliographyExcludedTokens: { type: Number, default: 0 },
    headersFootersExcludedTokens: { type: Number, default: 0 },
  },

  // Matches and Sources
  matchingPassages: [matchingPassageSchema],
  candidateSources: [candidateSourceSchema],

  // Comparison Summary & Transparency
  comparisonSummary: {
    totalComparisonPapers: { type: Number, default: 0 },
    checkedComparisonPapers: { type: Number, default: 0 },
    checkedPapers: [{
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
      title: { type: String, default: 'Untitled' },
      filename: { type: String, default: '' },
    }],
    scopeDescription: { type: String, default: 'Project Papers' },
    limitations: { type: String, default: null },
    humanReviewDisclaimer: {
      type: String,
      default: 'These results show text that matches the sources we checked. A match does not automatically mean plagiarism.',
    },
  },
}, { timestamps: true });

// Compound index for querying project scan history quickly
plagiarismScanSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('PlagiarismScan', plagiarismScanSchema);

const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true }, // Recommended research direction title
  researchDirection: { type: String, default: null }, // Broad future research direction
  researchQuestion: { type: String, required: true }, // Specific academic researchable question
  targetTopic: { type: String, default: null }, // Core subject area or keyword
  
  // Phase 11 Grounding & Epistemic Categorization
  // 1. EXPLICIT_GAP_GROUNDED: directly backed by author limitations/future work excerpts in source papers
  // 2. CORPUS_INFERRED: cross-paper syntheses or unaddressed combinations inferred from corpus
  // 3. AI_HYPOTHESIS: speculative or novel AI hypothesis requiring empirical validation
  groundingLevel: {
    type: String,
    enum: ['EXPLICIT_GAP_GROUNDED', 'CORPUS_INFERRED', 'AI_HYPOTHESIS'],
    default: 'CORPUS_INFERRED',
  },

  // Detailed Methodology Suggestions (Phase 11 Requirement C)
  methodologyDetails: {
    studyDesign: { type: String, default: null }, // e.g. Empirical ablation, randomized control, comparative benchmark
    dataRequirements: { type: String, default: null }, // Concrete dataset, corpus, or data characteristics needed
    evaluationMetrics: [{ type: String }], // Quantitative & qualitative metrics
    reasoning: { type: String, default: null }, // Justification for the selected methodology
    limitations: { type: String, default: null }, // Inherent methodological limitations or threats to validity
  },

  possibleMethodology: { type: String, required: true }, // Concise methodology summary (backward-compatible)
  expectedContribution: { type: String, required: true }, // Theoretical or practical contribution
  whyRecommended: { type: String, required: true }, // Why this direction matters
  limitations: { type: String, default: null }, // Direction-level limitations

  supportingGaps: [{ type: String }], // Titles of supporting research gaps
  evidenceExcerpts: [{
    excerpt: { type: String },
    paperTitle: { type: String },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
    sourceSection: { type: String },
  }],

  // Related Papers with explicit relevance explanation
  supportingPapers: [{
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
    title: { type: String },
    paperTitle: { type: String },
    originalFilename: { type: String },
    publicationYear: { type: Number },
    relevanceExplanation: { type: String },
  }],

  sourceType: {
    type: String,
    enum: [
      'Literature Limitation',
      'Future Work Extrapolation',
      'Corpus Heuristic',
      'Direct Author Suggestion',
      'Synthesis',
      'AI-Assisted Synthesis',
    ],
    default: 'Synthesis',
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium',
  },

  // Provenance & Auditability
  provenance: {
    generatedBy: { type: String, default: 'deterministic' }, // 'gemini' | 'openai' | 'deterministic'
    generatedAt: { type: Date, default: Date.now },
    corpusPaperCount: { type: Number, default: 0 },
  },

  // Backward compatibility fields
  gapStatus: { type: String },
  potentialStatus: { type: String },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Recommendation', recommendationSchema);

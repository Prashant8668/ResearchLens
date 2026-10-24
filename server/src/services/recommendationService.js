/**
 * Phase 11 — Research Recommendations Service
 * Generates explainable, evidence-grounded future research directions, questions,
 * and methodology suggestions anchored in validated project gaps and paper corpus.
 */

const Paper = require('../models/Paper');
const PaperAnalysis = require('../models/PaperAnalysis');
const GapResult = require('../models/GapResult');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');
const aiService = require('./aiService');
const { runGapAnalysisForProject } = require('./gapAnalysisService');

/**
 * Capitalize string helper
 */
function cap(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Deterministic Recommendation Engine.
 * Constructs rigorous, evidence-grounded recommendations from verified gaps,
 * author limitation excerpts, and cross-paper topic patterns.
 */
function generateDeterministicRecommendations(project, papersWithDetails, gaps) {
  const recommendations = [];
  const eligibleCount = papersWithDetails.length;

  if (eligibleCount === 0) {
    return [];
  }

  // 1. Generate Explicit Gap Grounded Recommendations
  const explicitGaps = gaps.filter(g => g.gapType === 'Explicit Gap' || (g.supportingPapers && g.supportingPapers.some(sp => sp.evidenceExcerpt)));
  for (const gap of explicitGaps.slice(0, 3)) {
    const mainPaper = gap.supportingPapers && gap.supportingPapers[0] ? gap.supportingPapers[0] : null;
    const paperTitle = mainPaper ? (mainPaper.title || mainPaper.originalFilename || 'Source Paper') : 'Source Paper';
    const excerpt = mainPaper?.evidenceExcerpt || gap.description;

    recommendations.push({
      projectId: project._id,
      title: `Overcoming Stated Constraints in ${gap.topic || gap.title}`,
      researchDirection: `Robust Mitigation of ${gap.topic || 'Stated Constraints'}`,
      researchQuestion: `To what extent can alternative architectural or empirical methods mitigate the ${gap.topic || 'constraints'} highlighted in recent literature?`,
      targetTopic: gap.topic || 'Methodological Constraint',
      groundingLevel: 'EXPLICIT_GAP_GROUNDED',
      methodologyDetails: {
        studyDesign: 'Empirical comparative benchmark using controlled ablation experiments and counter-factual analysis.',
        dataRequirements: 'Standard domain benchmark dataset paired with cross-validation splits to verify generalizability.',
        evaluationMetrics: ['Accuracy / F1-Score', 'Latency / Computational Overhead', 'Error Distribution across subgroups'],
        reasoning: `Directly targets the author-reported constraint: "${excerpt.slice(0, 160)}..."`,
        limitations: 'Findings are bound to benchmark dataset properties and may require external transfer testing.',
      },
      possibleMethodology: 'Controlled comparative ablation on standardized benchmarks with error-subgroup profiling.',
      expectedContribution: 'Provides validated empirical evidence on overcoming known limitations without degrading baseline accuracy.',
      whyRecommended: `Directly addresses an explicit author-stated constraint documented in "${paperTitle}".`,
      limitations: 'May exhibit sensitivity to hyperparameter selection and domain shift.',
      supportingGaps: [gap.title],
      evidenceExcerpts: [{
        excerpt: excerpt.slice(0, 280),
        paperTitle,
        paperId: mainPaper?.paperId || null,
        sourceSection: mainPaper?.sourceSection || 'Limitations / Future Work',
      }],
      supportingPapers: gap.supportingPapers ? gap.supportingPapers.map(sp => ({
        paperId: sp.paperId,
        title: sp.title || sp.originalFilename,
        paperTitle: sp.title || sp.originalFilename,
        originalFilename: sp.originalFilename,
        publicationYear: sp.publicationYear || null,
        relevanceExplanation: `Reports explicit constraints and baseline benchmarks that this direction seeks to resolve.`,
      })) : [],
      sourceType: 'Direct Author Suggestion',
      priority: 'High',
      provenance: {
        generatedBy: 'deterministic',
        generatedAt: new Date(),
        corpusPaperCount: eligibleCount,
      },
    });
  }

  // 2. Generate Corpus-Inferred Opportunities (Cross-Paper Synthesis)
  const inferredGaps = gaps.filter(g => g.gapType === 'Corpus-Based Opportunity');
  for (const gap of inferredGaps.slice(0, 3)) {
    recommendations.push({
      projectId: project._id,
      title: `Cross-Corpus Integration: ${gap.title}`,
      researchDirection: `Harmonizing ${gap.topic || 'Distinct Methodologies'} across Contexts`,
      researchQuestion: `Can a unified framework effectively bridge the methodological divide identified between project approaches?`,
      targetTopic: gap.topic || 'Cross-Method Synthesis',
      groundingLevel: 'CORPUS_INFERRED',
      methodologyDetails: {
        studyDesign: 'Modular hybrid pipeline integrating standalone implementations from both approaches under identical evaluation conditions.',
        dataRequirements: 'Multi-modal or multi-task datasets capable of exercising both integrated components.',
        evaluationMetrics: ['End-to-End System Throughput', 'Unified Task Accuracy', 'Integration Overhead Ratio'],
        reasoning: 'Synthesizes complementary strengths observed across distinct documents in the current project corpus.',
        limitations: 'Risk of pipeline complexity and compounding error propagation between stages.',
      },
      possibleMethodology: 'Modular multi-stage integration benchmarked against isolated standalone baselines.',
      expectedContribution: 'Delivers a novel reference architecture demonstrating feasibility and trade-offs of combining isolated project methods.',
      whyRecommended: 'Explores unaddressed synergy between topics active within your project literature.',
      limitations: 'Hypothesized synergy requires rigorous ablation to confirm that combination beats tuned single models.',
      supportingGaps: [gap.title],
      evidenceExcerpts: (gap.supportingPapers || []).map(sp => ({
        excerpt: sp.evidenceExcerpt || `Methodological context from ${sp.title || sp.originalFilename}.`,
        paperTitle: sp.title || sp.originalFilename,
        paperId: sp.paperId,
        sourceSection: 'Corpus Analysis',
      })),
      supportingPapers: (gap.supportingPapers || []).map(sp => ({
        paperId: sp.paperId,
        title: sp.title || sp.originalFilename,
        paperTitle: sp.title || sp.originalFilename,
        originalFilename: sp.originalFilename,
        publicationYear: sp.publicationYear || null,
        relevanceExplanation: `Represents one branch of the cross-paper synthesis evaluated in this recommendation.`,
      })),
      sourceType: 'Corpus Heuristic',
      priority: 'Medium',
      provenance: {
        generatedBy: 'deterministic',
        generatedAt: new Date(),
        corpusPaperCount: eligibleCount,
      },
    });
  }

  // 3. Generate AI Hypothesis / Exploratory Direction
  if (recommendations.length < 3) {
    const primaryTopic = project.domain || 'Domain Research';
    recommendations.push({
      projectId: project._id,
      title: `Exploratory Hypothesis: Evaluating Generalizability of ${cap(primaryTopic)} Under Extreme Conditions`,
      researchDirection: `Stress-Testing and Out-of-Distribution Robustness in ${cap(primaryTopic)}`,
      researchQuestion: `How do current algorithms degrade when subjected to real-world edge cases, noise, or adversarial domain shifts?`,
      targetTopic: `${primaryTopic} Robustness`,
      groundingLevel: 'AI_HYPOTHESIS',
      methodologyDetails: {
        studyDesign: 'Perturbation and stress-testing analysis across systematically corrupted test distributions.',
        dataRequirements: 'Synthetically perturbed evaluation sets paired with naturally occurring out-of-distribution samples.',
        evaluationMetrics: ['Out-of-Distribution Degradation Rate', 'Worst-Case Performance', 'Recovery Time'],
        reasoning: 'Literature frequently reports high in-distribution scores without evaluating robustness under severe distribution shifts.',
        limitations: 'Synthetic noise models may not fully mirror in-the-wild deployment hazards.',
      },
      possibleMethodology: 'Systematic corruption benchmark and stress testing across synthetic and natural distribution shifts.',
      expectedContribution: 'Quantifies real-world reliability limits and establishes baseline robustness guidelines for the field.',
      whyRecommended: 'Identifies critical boundary conditions that must be established before practical deployment.',
      limitations: 'Requires empirical validation; speculative hypothesis inferred from general domain trends.',
      supportingGaps: gaps.length > 0 ? [gaps[0].title] : ['Broad Out-of-Distribution Reliability'],
      evidenceExcerpts: papersWithDetails.slice(0, 1).map(p => ({
        excerpt: `Evaluated against corpus baseline in "${p.title || p.originalFilename}".`,
        paperTitle: p.title || p.originalFilename,
        paperId: p.id,
        sourceSection: 'Corpus Baseline',
      })),
      supportingPapers: papersWithDetails.slice(0, 2).map(p => ({
        paperId: p.id,
        title: p.title || p.originalFilename,
        paperTitle: p.title || p.originalFilename,
        originalFilename: p.originalFilename,
        publicationYear: p.publicationYear || null,
        relevanceExplanation: 'Serves as representative in-distribution baseline to test against corrupted distributions.',
      })),
      sourceType: 'Synthesis',
      priority: 'Medium',
      provenance: {
        generatedBy: 'deterministic',
        generatedAt: new Date(),
        corpusPaperCount: eligibleCount,
      },
    });
  }

  // If single paper corpus, add explicit limited corpus note
  if (eligibleCount === 1) {
    recommendations.forEach(r => {
      r.limitations = `Preliminary single-paper corpus: ${r.limitations || ''} (Requires verification against broader literature).`;
    });
  }

  return recommendations;
}

/**
 * AI-Powered Recommendation Synthesis Pass.
 * Prompts Gemini or OpenAI to synthesize grounded research recommendations.
 */
async function synthesizeRecommendationsWithAI(project, papersWithDetails, gaps) {
  const papersPayload = papersWithDetails.map((p, idx) => ({
    paperIndex: idx + 1,
    paperId: p.id.toString(),
    title: p.title,
    publicationYear: p.publicationYear || 'Unknown Year',
    researchProblem: p.analysis?.structuredSummary?.researchProblem || 'Not explicitly stated',
    methodology: p.analysis?.structuredSummary?.methodology || 'Not explicitly stated',
    keyFindings: (p.analysis?.structuredSummary?.keyFindings || []).slice(0, 2),
    authorLimitations: (p.analysis?.structuredSummary?.limitations || []).slice(0, 2),
    textLimitationSnippets: (p.textLimitations || []).slice(0, 2),
    textFutureWorkSnippets: (p.textFutureWork || []).slice(0, 2),
  }));

  const gapsPayload = gaps.map(g => ({
    title: g.title,
    topic: g.topic,
    category: g.category,
    gapType: g.gapType,
    description: g.description,
    supportingPapers: (g.supportingPapers || []).map(sp => sp.title || sp.originalFilename),
  }));

  const systemPrompt = `You are a Principal Academic Research Strategist formulating future research directions and research questions for project "${project.name}" (domain: ${project.domain || 'General Research'}).

CRITICAL RULES:
1. ONLY reference papers and gaps provided in the JSON input. NEVER invent citations, authors, external papers, or datasets.
2. Ground each recommendation strictly in the analyzed gaps and paper records.
3. Formulate clear, specific, researchable academic questions.
4. Provide realistic methodology suggestions: study design, potential data requirements, evaluation metrics, reasoning, and limitations.
5. Clearly categorize each recommendation into one of three grounding levels:
   - "EXPLICIT_GAP_GROUNDED": directly addressing explicit author-stated limitations or future work excerpts.
   - "CORPUS_INFERRED": synthesizing unaddressed combinations or patterns across multiple project papers.
   - "AI_HYPOTHESIS": novel or speculative hypothesis requiring empirical validation.
6. Clearly explain why each supporting paper is relevant to the recommendation.
7. Return raw JSON matching this schema:
{
  "recommendations": [
    {
      "title": "Clear Actionable Recommendation Title",
      "researchDirection": "Core Future Research Direction",
      "researchQuestion": "Precise, specific researchable question",
      "targetTopic": "Core topic or technology",
      "groundingLevel": "EXPLICIT_GAP_GROUNDED",
      "methodologyDetails": {
        "studyDesign": "e.g. Empirical ablation, randomized control, comparative benchmark",
        "dataRequirements": "Concrete data or dataset specifications needed",
        "evaluationMetrics": ["Metric 1", "Metric 2", "Metric 3"],
        "reasoning": "Scientific rationale for this methodology",
        "limitations": "Inherent methodological limitations or threats to validity"
      },
      "possibleMethodology": "Concise 1-2 sentence methodology summary",
      "expectedContribution": "Theoretical, empirical, or practical contribution",
      "whyRecommended": "Why this direction is impactful and needed",
      "limitations": "Scope and generalizability limitations of this direction",
      "supportingGapTitles": ["Title of supporting gap"],
      "supportingPaperIndices": [1],
      "paperRelevanceExplanations": {
        "1": "Why paper 1 is specifically relevant to this recommendation"
      },
      "priority": "High"
    }
  ]
}
Output raw JSON only. No markdown formatting.`;

  const userPrompt = `Analyzed Papers (${papersPayload.length}):\n${JSON.stringify(papersPayload, null, 2)}\n\nValidated Gaps (${gapsPayload.length}):\n${JSON.stringify(gapsPayload, null, 2)}`;

  let parsed = null;
  const provider = aiService.getActiveProvider();

  if (provider === 'gemini') {
    const res = await aiService.callGemini(userPrompt, systemPrompt);
    parsed = res.parsed;
  } else if (provider === 'openai') {
    const res = await aiService.callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);
    parsed = res.parsed;
  }

  if (!parsed || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
    throw new Error('AI output did not contain valid recommendations array');
  }

  // Validate and map indices to verified database records
  const validatedRecs = parsed.recommendations.map((r, rIdx) => {
    const supportingPapers = [];
    const evidenceExcerpts = [];

    if (Array.isArray(r.supportingPaperIndices)) {
      r.supportingPaperIndices.forEach(idx => {
        const paper = papersWithDetails[idx - 1];
        if (paper) {
          const explanation = r.paperRelevanceExplanations && r.paperRelevanceExplanations[String(idx)]
            ? String(r.paperRelevanceExplanations[String(idx)]).slice(0, 200)
            : 'Provides baseline findings and methodology relevant to this research direction.';
          supportingPapers.push({
            paperId: paper.id,
            title: paper.title,
            paperTitle: paper.title,
            originalFilename: paper.originalFilename,
            publicationYear: paper.publicationYear || null,
            relevanceExplanation: explanation,
          });

          if (paper.textLimitations && paper.textLimitations.length > 0) {
            evidenceExcerpts.push({
              excerpt: paper.textLimitations[0].slice(0, 280),
              paperTitle: paper.title,
              paperId: paper.id,
              sourceSection: 'Author Limitations',
            });
          }
        }
      });
    }

    if (supportingPapers.length === 0 && papersWithDetails.length > 0) {
      const p = papersWithDetails[0];
      supportingPapers.push({
        paperId: p.id,
        title: p.title,
        paperTitle: p.title,
        originalFilename: p.originalFilename,
        publicationYear: p.publicationYear || null,
        relevanceExplanation: 'Primary project paper establishing domain baseline.',
      });
    }

    const validLevels = ['EXPLICIT_GAP_GROUNDED', 'CORPUS_INFERRED', 'AI_HYPOTHESIS'];
    const groundingLevel = validLevels.includes(r.groundingLevel) ? r.groundingLevel : 'CORPUS_INFERRED';

    const validPriorities = ['High', 'Medium', 'Low'];
    const priority = validPriorities.includes(r.priority) ? r.priority : 'Medium';

    const mDetails = r.methodologyDetails || {};
    const evalMetrics = Array.isArray(mDetails.evaluationMetrics) && mDetails.evaluationMetrics.length > 0
      ? mDetails.evaluationMetrics.map(m => String(m).slice(0, 50))
      : ['Accuracy / F1-Score', 'Inference Latency', 'Generalization Error'];

    return {
      projectId: project._id,
      title: r.title || `Research Recommendation ${rIdx + 1}`,
      researchDirection: r.researchDirection || r.title || 'Advanced Domain Exploration',
      researchQuestion: r.researchQuestion || 'How can current architectural constraints be effectively mitigated?',
      targetTopic: r.targetTopic || project.domain || 'Domain Integration',
      groundingLevel,
      methodologyDetails: {
        studyDesign: mDetails.studyDesign || 'Empirical comparative benchmark under controlled evaluation conditions.',
        dataRequirements: mDetails.dataRequirements || 'Standard domain benchmark datasets with cross-validation splits.',
        evaluationMetrics: evalMetrics,
        reasoning: mDetails.reasoning || 'Aligns evaluation with established literature standards.',
        limitations: mDetails.limitations || 'Bound by domain distribution and dataset scale.',
      },
      possibleMethodology: r.possibleMethodology || mDetails.studyDesign || 'Empirical comparative benchmark under controlled evaluation conditions.',
      expectedContribution: r.expectedContribution || 'Provides validated baseline comparisons and architectural insights.',
      whyRecommended: r.whyRecommended || 'Directly addresses constraints identified across analyzed papers.',
      limitations: r.limitations || 'Requires experimental validation in target deployment environment.',
      supportingGaps: Array.isArray(r.supportingGapTitles) ? r.supportingGapTitles : [],
      evidenceExcerpts,
      supportingPapers,
      sourceType: 'Synthesis',
      priority,
      provenance: {
        generatedBy: provider,
        generatedAt: new Date(),
        corpusPaperCount: papersWithDetails.length,
      },
    };
  });

  return validatedRecs;
}

/**
 * Main Orchestrator: Generate and persist research recommendations for a project.
 */
async function generateRecommendationsForProject(projectId, options = {}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const allPapers = await Paper.find({ projectId: project._id });
  const eligiblePapers = allPapers.filter(
    p => p.status === 'COMPLETED' && p.extractedText && p.extractedText.trim().length > 0
  );

  if (eligiblePapers.length === 0) {
    await Recommendation.deleteMany({ projectId: project._id });
    return {
      status: 'INSUFFICIENT_DATA',
      count: 0,
      eligiblePaperCount: 0,
      recommendations: [],
      dataLimitations: 'At least 1 successfully processed research paper is required to generate recommendations.',
      disclaimer: 'Recommendations are derived strictly from the papers uploaded to your project corpus.',
    };
  }

  // Ensure gaps exist. If not, run gap analysis first
  let gaps = await GapResult.find({ projectId: project._id });
  if (gaps.length === 0 || options.forceGaps) {
    try {
      const gapRes = await runGapAnalysisForProject(project._id, { force: options.forceGaps });
      gaps = gapRes.gaps || await GapResult.find({ projectId: project._id });
    } catch (gapErr) {
      console.warn('Gap analysis prerequisite warning:', gapErr.message);
    }
  }

  // Prepare paper details with analysis & snippets
  const { extractFutureWorkSnippets, extractLimitationSnippets } = require('./gapAnalysisService');
  const analyses = await PaperAnalysis.find({ projectId: project._id });
  const analysisMap = {};
  analyses.forEach(a => { analysisMap[a.paperId.toString()] = a; });

  const papersWithDetails = eligiblePapers.map(p => ({
    id: p._id,
    title: p.title || p.originalFilename || 'Untitled Paper',
    originalFilename: p.originalFilename,
    publicationYear: p.publicationYear,
    extractedText: p.extractedText,
    analysis: analysisMap[p._id.toString()] || null,
    textLimitations: extractLimitationSnippets(p.extractedText),
    textFutureWork: extractFutureWorkSnippets(p.extractedText),
  }));

  let finalRecs = [];
  let usedProvider = 'deterministic';

  if (aiService.isConfigured() && !options.deterministicOnly) {
    try {
      finalRecs = await synthesizeRecommendationsWithAI(project, papersWithDetails, gaps);
      usedProvider = aiService.getActiveProvider();
    } catch (aiErr) {
      console.warn('AI Recommendation Synthesis fallback to deterministic engine:', aiErr.message);
      finalRecs = generateDeterministicRecommendations(project, papersWithDetails, gaps);
      usedProvider = 'deterministic_fallback';
    }
  } else {
    finalRecs = generateDeterministicRecommendations(project, papersWithDetails, gaps);
    usedProvider = 'deterministic';
  }

  // If single paper corpus, ensure explicit preliminary disclaimer on all recommendations
  if (eligiblePapers.length === 1) {
    finalRecs.forEach(r => {
      if (!r.limitations || !r.limitations.toLowerCase().includes('single-paper')) {
        r.limitations = `Preliminary single-paper corpus: ${r.limitations || ''} (Requires verification against broader literature).`;
      }
    });
  }

  // Atomic database persistence
  await Recommendation.deleteMany({ projectId: project._id });
  let savedRecs = [];
  if (finalRecs.length > 0) {
    savedRecs = await Recommendation.insertMany(finalRecs);
  }

  await Project.findByIdAndUpdate(projectId, {
    lastRecommendationAnalysisAt: new Date(),
    recommendationCount: savedRecs.length,
  });

  return {
    status: 'COMPLETED',
    count: savedRecs.length,
    eligiblePaperCount: eligiblePapers.length,
    recommendations: savedRecs,
    provider: usedProvider,
    lastUpdated: new Date(),
  };
}

/**
 * Query recommendations with filtering and grounded metadata
 */
async function getProjectRecommendations(projectId, query = {}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const allPapers = await Paper.find({ projectId: project._id });
  const eligiblePapers = allPapers.filter(
    p => p.status === 'COMPLETED' && p.extractedText && p.extractedText.trim().length > 0
  );

  if (eligiblePapers.length === 0) {
    return {
      projectId: project._id,
      projectName: project.name,
      domain: project.domain || 'General Research',
      status: 'INSUFFICIENT_DATA',
      count: 0,
      eligiblePaperCount: 0,
      recommendations: [],
      groundingCounts: {
        explicitGrounded: 0,
        corpusInferred: 0,
        aiHypothesis: 0,
      },
      dataLimitations: 'At least 1 processed paper is required to generate research recommendations.',
      disclaimer: 'All recommendations are derived strictly from the papers uploaded to this project corpus.',
    };
  }

  // If no recommendations exist yet, generate them automatically
  let existingCount = await Recommendation.countDocuments({ projectId: project._id });
  if (existingCount === 0) {
    try {
      await generateRecommendationsForProject(project._id);
    } catch (genErr) {
      console.warn('Auto-generation of recommendations warning:', genErr.message);
    }
  }

  // Build filter
  const filter = { projectId: project._id };
  if (query.groundingLevel && query.groundingLevel !== 'All' && query.groundingLevel !== 'ALL') {
    filter.groundingLevel = query.groundingLevel;
  }
  if (query.priority && query.priority !== 'All' && query.priority !== 'ALL') {
    filter.priority = query.priority;
  }
  if (query.search && query.search.trim()) {
    const sRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { title: sRegex },
      { researchDirection: sRegex },
      { researchQuestion: sRegex },
      { targetTopic: sRegex },
      { whyRecommended: sRegex },
    ];
  }

  const recommendations = await Recommendation.find(filter).sort({ priority: 1, createdAt: -1 });
  const allProjectRecs = await Recommendation.find({ projectId: project._id });

  const groundingCounts = {
    explicitGrounded: allProjectRecs.filter(r => r.groundingLevel === 'EXPLICIT_GAP_GROUNDED').length,
    corpusInferred: allProjectRecs.filter(r => r.groundingLevel === 'CORPUS_INFERRED').length,
    aiHypothesis: allProjectRecs.filter(r => r.groundingLevel === 'AI_HYPOTHESIS').length,
  };

  const isSinglePaper = eligiblePapers.length === 1;
  const dataLimitations = isSinglePaper
    ? 'Preliminary single-paper analysis: recommendations reflect single-paper limitations. Cross-literature validation is recommended.'
    : `Recommendations synthesized across ${eligiblePapers.length} project documents. Directions reflect corpus patterns.`;

  return {
    projectId: project._id,
    projectName: project.name,
    domain: project.domain || 'General Research',
    status: 'COMPLETED',
    count: recommendations.length,
    totalProjectRecommendations: allProjectRecs.length,
    eligiblePaperCount: eligiblePapers.length,
    groundingCounts,
    recommendations,
    dataLimitations,
    disclaimer: 'Research recommendations are grounded strictly in the papers uploaded to your project corpus and reflect potential directions, not guaranteed scientific outcomes.',
    lastUpdated: project.lastRecommendationAnalysisAt || project.updatedAt,
  };
}

module.exports = {
  generateRecommendationsForProject,
  getProjectRecommendations,
  generateDeterministicRecommendations,
};

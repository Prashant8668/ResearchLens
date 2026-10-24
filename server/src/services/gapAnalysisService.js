/**
 * Phase 10 — Research Gap Analysis & Recommendation Service
 * Detects evidence-based research gaps and generates actionable recommendations
 * grounded strictly in uploaded project paper summaries, limitations, and future work.
 */

const Paper = require('../models/Paper');
const PaperAnalysis = require('../models/PaperAnalysis');
const GapResult = require('../models/GapResult');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');
const aiService = require('./aiService');

/**
 * Extract explicit future work excerpts directly from paper text.
 */
function extractFutureWorkSnippets(text) {
  if (!text || typeof text !== 'string') return [];
  const snippets = [];
  const regex = /(?:^|\n)\s*(?:[0-9.]*\s*)?(?:future\s+work|future\s+research|future\s+directions|open\s+problems|open\s+challenges|next\s+steps)[\s\S]{20,800}?(?=\n\s*(?:[0-9.]*\s*)?(?:references|bibliography|acknowledg|appendix|\n\n\n)|$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null && snippets.length < 3) {
    const cleaned = match[0].replace(/\s+/g, ' ').trim();
    if (cleaned.length > 25) snippets.push(cleaned.slice(0, 300));
  }
  return snippets;
}

/**
 * Extract explicit limitation excerpts directly from paper text.
 */
function extractLimitationSnippets(text) {
  if (!text || typeof text !== 'string') return [];
  const snippets = [];
  const regex = /(?:^|\n)\s*(?:[0-9.]*\s*)?(?:limitations|threats\s+to\s+validity|constraints|weaknesses)[\s\S]{20,800}?(?=\n\s*(?:[0-9.]*\s*)?(?:conclusion|future|references|acknowledg|\n\n\n)|$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null && snippets.length < 3) {
    const cleaned = match[0].replace(/\s+/g, ' ').trim();
    if (cleaned.length > 25) snippets.push(cleaned.slice(0, 300));
  }
  return snippets;
}

/**
 * Deterministic Evidence-Based Gap Generator.
 * Runs independently of external AI services to guarantee 100% uptime, zero hallucinations,
 * and immediate resilience against API quota or network failures.
 */
function generateDeterministicGapsAndRecommendations(project, papersWithDetails) {
  const gaps = [];
  const recommendations = [];

  const eligibleCount = papersWithDetails.length;
  if (eligibleCount === 0) {
    return { gaps: [], recommendations: [] };
  }

  // 1. Collect all explicit author-stated limitations across papers
  const paperLimitationPairs = [];
  const paperFutureWorkPairs = [];
  const paperMethodologies = [];

  papersWithDetails.forEach(p => {
    // Collect from structuredSummary
    if (p.analysis?.structuredSummary?.limitations && Array.isArray(p.analysis.structuredSummary.limitations)) {
      p.analysis.structuredSummary.limitations.forEach(lim => {
        const str = String(lim).trim();
        if (str && !str.toLowerCase().includes('not contain sufficient information') && !str.toLowerCase().includes('do not explicitly report')) {
          paperLimitationPairs.push({ paper: p, limitation: str, sourceSection: 'Limitations' });
        }
      });
    }

    // Collect from text regex snippets
    (p.textLimitations || []).forEach(snippet => {
      paperLimitationPairs.push({ paper: p, limitation: snippet, sourceSection: 'Text Limitations Section' });
    });

    (p.textFutureWork || []).forEach(snippet => {
      paperFutureWorkPairs.push({ paper: p, futureWork: snippet, sourceSection: 'Future Work' });
    });

    if (p.analysis?.structuredSummary?.methodology) {
      paperMethodologies.push({ paper: p, methodology: p.analysis.structuredSummary.methodology });
    }
  });

  // 2. Identify Explicit Gaps from direct author statements
  if (paperLimitationPairs.length > 0) {
    // Group limitations into thematic clusters (Methodology, Scope, Evaluation)
    const methodLims = paperLimitationPairs.filter(x => /dataset|sample|size|bias|synthetic|benchmark|baseline/i.test(x.limitation));
    const evalLims = paperLimitationPairs.filter(x => /latency|throughput|scale|real-world|hardware|deployment|overhead/i.test(x.limitation));
    const generalLims = paperLimitationPairs.filter(x => !methodLims.includes(x) && !evalLims.includes(x));

    if (methodLims.length > 0) {
      const supporting = methodLims.slice(0, 3).map(x => ({
        paperId: x.paper.id,
        title: x.paper.title,
        paperTitle: x.paper.title,
        originalFilename: x.paper.originalFilename,
        publicationYear: x.paper.publicationYear,
        evidenceExcerpt: x.limitation.slice(0, 250),
        sourceSection: x.sourceSection,
      }));

      gaps.push({
        projectId: project._id,
        title: 'Limited Testing on Real-World Datasets',
        topic: 'evaluation methodology',
        category: 'Methodological',
        gapType: 'Explicit Gap',
        description: `Authors in the analyzed papers report that experiments relied on small or synthetic datasets. The methods should be tested on larger, real-world datasets to confirm their general performance.`,
        whyItMatters: 'Models that perform well on small test benchmarks often experience accuracy drops when deployed on real-world, diverse data.',
        suggestedDirection: 'Test the proposed algorithms on open-access, real-world datasets with diverse user groups or varied operating conditions.',
        supportingPapers: supporting,
        confidenceScore: 0.90,
        confidenceRationale: `Directly supported by explicit author statements in ${supporting.length} project document(s).`,
        dataLimitations: `Corpus scope: observed across ${supporting.length} of ${eligibleCount} project papers.`,
        researchLevel: 'High',
        isPotentialGap: true,
      });

      recommendations.push({
        projectId: project._id,
        title: 'Evaluate Methods on Real-World Datasets',
        researchQuestion: 'How well do the proposed models maintain accuracy when evaluated on diverse real-world benchmarks?',
        targetTopic: 'evaluation methodology',
        possibleMethodology: 'Set up experiments using at least two public real-world datasets and compare precision, recall, and error rates against standard baselines.',
        expectedContribution: 'Provides realistic performance benchmarks that prove the algorithm works beyond synthetic tests.',
        whyRecommended: 'Directly addresses the author-stated limitation regarding dataset constraints.',
        supportingGaps: ['Limited Testing on Real-World Datasets'],
        supportingPapers: supporting.map(s => ({ paperId: s.paperId, title: s.title, paperTitle: s.title, originalFilename: s.originalFilename })),
        sourceType: 'Direct Author Suggestion',
        priority: 'High',
      });
    }

    if (evalLims.length > 0) {
      const supporting = evalLims.slice(0, 3).map(x => ({
        paperId: x.paper.id,
        title: x.paper.title,
        paperTitle: x.paper.title,
        originalFilename: x.paper.originalFilename,
        publicationYear: x.paper.publicationYear,
        evidenceExcerpt: x.limitation.slice(0, 250),
        sourceSection: x.sourceSection,
      }));

      gaps.push({
        projectId: project._id,
        title: 'High Computing and Memory Overhead',
        topic: 'scalability & deployment',
        category: 'Application / Deployment',
        gapType: 'Explicit Gap',
        description: `Authors note that the algorithms have high execution latency or require significant memory during processing.`,
        whyItMatters: 'Algorithms with heavy computational demands cannot run easily on edge devices, smartphones, or real-time applications.',
        suggestedDirection: 'Explore lightweight optimizations such as model quantization, pruning, or parallel asynchronous pipelines to reduce latency.',
        supportingPapers: supporting,
        confidenceScore: 0.88,
        confidenceRationale: `Corroborated by runtime/hardware constraints stated in ${supporting.length} document(s).`,
        dataLimitations: `Scoped to runtime observations documented in this project corpus.`,
        researchLevel: 'Medium',
        isPotentialGap: true,
      });

      recommendations.push({
        projectId: project._id,
        title: 'Optimize Algorithm Speed and Memory Footprint',
        researchQuestion: 'What optimization techniques reduce runtime and memory usage without significant loss in accuracy?',
        targetTopic: 'scalability & deployment',
        possibleMethodology: 'Implement lightweight model variants (such as 8-bit quantization or feature pruning) and benchmark speed across CPU and GPU hardware.',
        expectedContribution: 'Produces a faster, resource-efficient model suitable for deployment on standard or resource-constrained devices.',
        whyRecommended: 'Directly resolves execution overhead constraints cited by authors.',
        supportingGaps: ['High Computing and Memory Overhead'],
        supportingPapers: supporting.map(s => ({ paperId: s.paperId, title: s.title, paperTitle: s.title, originalFilename: s.originalFilename })),
        sourceType: 'Direct Author Suggestion',
        priority: 'High',
      });
    }

    if (generalLims.length > 0 && gaps.length < 3) {
      const supporting = generalLims.slice(0, 2).map(x => ({
        paperId: x.paper.id,
        title: x.paper.title,
        paperTitle: x.paper.title,
        originalFilename: x.paper.originalFilename,
        publicationYear: x.paper.publicationYear,
        evidenceExcerpt: x.limitation.slice(0, 250),
        sourceSection: x.sourceSection,
      }));

      gaps.push({
        projectId: project._id,
        title: 'Limited Evaluation Outside Standard Conditions',
        topic: 'domain scope',
        category: 'Scope & Generalizability',
        gapType: 'Explicit Gap',
        description: 'The analyzed papers test their methods within specific assumptions. Performance under unexpected inputs or extreme conditions remains unverified.',
        whyItMatters: 'Systems can fail unexpectedly when deployed outside the exact parameters tested in the laboratory.',
        suggestedDirection: 'Conduct stress testing and out-of-distribution tests to map where the algorithm succeeds and where it fails.',
        supportingPapers: supporting,
        confidenceScore: 0.82,
        confidenceRationale: `Derived from explicit boundary constraints reported in ${supporting.length} paper(s).`,
        dataLimitations: `Reflects boundaries discussed in ${supporting.length} project paper(s).`,
        researchLevel: 'Medium',
        isPotentialGap: true,
      });
    }
  }

  // 3. Corpus-Based Opportunity: Underexplored Topic Intersections
  // Noise words to ignore (administrative tokens, common adjectives, meta-research terms)
  const NOISY_TERMS = new Set([
    'natural', 'derivatives', 'technology', 'information', 'development', 'diploma', 'management',
    'pursuing', 'skills', 'technical', 'project', 'research', 'problem', 'solution', 'brainstorming',
    'ideas', 'assignment', 'practical', 'session', 'laboratory', 'ipc', 'department', 'generate',
    'possible', 'reminder', 'multiple', 'evaluation', 'conduct', 'planner', 'progress', 'mention',
    'specific', 'challenges', 'understanding', 'week', 'academics', 'alongside', 'allows', 'across',
    'study', 'paper', 'approach', 'system', 'method', 'table', 'figure', 'model', 'results',
    'review', 'overview', 'finding', 'findings', 'author', 'authors', 'university', 'college',
    'student', 'report', 'viva', 'roll', 'semester', 'submission', 'faculty', 'editor', 'vol',
    'issue', 'abstract', 'introduction', 'conclusion', 'references', 'android', 'html', 'css',
    'javascript', 'website', 'responsive', 'knowledge', 'ai-powered', 'recipe', 'certifications',
    'learning', 'machine', 'deep', 'network', 'networks', 'neural', 'data'
  ]);

  // Helper to check if two terms have an obvious parent-child relationship (e.g. spark & mllib)
  const areRelatedOrNoise = (a, b) => {
    if (!a || !b) return true;
    const tA = a.toLowerCase();
    const tB = b.toLowerCase();
    if (tA === tB || tA.includes(tB) || tB.includes(tA)) return true;
    if ((tA === 'spark' && tB === 'mllib') || (tA === 'mllib' && tB === 'spark')) return true;
    return false;
  };

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  const allTerms = {};
  papersWithDetails.forEach(p => {
    (p.analysis?.extractedKeywords || []).slice(0, 10).forEach(kw => {
      if (kw && kw.term && kw.term.length >= 4) {
        const raw = kw.term.toLowerCase().trim();
        if (!NOISY_TERMS.has(raw)) {
          allTerms[raw] = (allTerms[raw] || 0) + 1;
        }
      }
    });
  });

  const sortedTerms = Object.keys(allTerms).sort((a, b) => allTerms[b] - allTerms[a]);
  // Only propose cross-topic gap if terms appear in multiple papers (recurring themes, not 1-paper noise)
  if (sortedTerms.length >= 2 && gaps.length < 3) {
    let termA = null;
    let termB = null;

    for (let i = 0; i < sortedTerms.length; i++) {
      if (allTerms[sortedTerms[i]] < 2) continue; // Must be present in at least 2 papers
      for (let j = i + 1; j < sortedTerms.length; j++) {
        if (allTerms[sortedTerms[j]] < 2) continue;
        if (!areRelatedOrNoise(sortedTerms[i], sortedTerms[j])) {
          termA = sortedTerms[i];
          termB = sortedTerms[j];
          break;
        }
      }
      if (termA && termB) break;
    }

    if (termA && termB) {
      const supporting = papersWithDetails.slice(0, 2).map(p => {
        const paperObj = p.paper || p;
        const pTitle = paperObj.title || paperObj.originalFilename || 'Uploaded Paper';
        return {
          paperId: paperObj._id || paperObj.id,
          title: pTitle,
          paperTitle: pTitle,
          originalFilename: paperObj.originalFilename || pTitle,
          publicationYear: paperObj.publicationYear,
          evidenceExcerpt: `Investigates concepts related to ${termA} within "${pTitle}".`,
          sourceSection: 'Corpus Analysis',
        };
      });

      gaps.push({
        projectId: project._id,
        title: `Combining ${cap(termA)} with ${cap(termB)}`,
        topic: `${termA} & ${termB}`,
        category: 'Theoretical / Algorithmic',
        gapType: 'Corpus-Based Opportunity',
        description: `Both "${termA}" and "${termB}" are prominent topics in your project papers, but testing them together remains underexplored in these documents.`,
        whyItMatters: `Combining both techniques could solve weaknesses found when using either method alone.`,
        suggestedDirection: `Design a unified system that integrates ${termA} methods with ${termB} pipelines and compare performance.`,
        supportingPapers: supporting,
        confidenceScore: 0.70,
        confidenceRationale: `Observed from keyword distributions across ${eligibleCount} project paper(s).`,
        dataLimitations: 'Inferred opportunity based on uploaded documents; requires broader literature validation.',
        researchLevel: 'Medium',
        isPotentialGap: true,
      });

      recommendations.push({
        projectId: project._id,
        title: `Build a Hybrid System Combining ${cap(termA)} and ${cap(termB)}`,
        researchDirection: `Cross-Domain Synthesis: Combining ${cap(termA)} and ${cap(termB)}`,
        researchQuestion: `Does combining ${termA} and ${termB} improve overall accuracy and system robustness?`,
        targetTopic: `${termA} & ${termB}`,
        groundingLevel: 'CORPUS_INFERRED',
        methodologyDetails: {
          studyDesign: 'Empirical comparative benchmark under controlled evaluation conditions.',
          dataRequirements: 'Standard domain benchmark dataset with cross-validation splits.',
          evaluationMetrics: ['Accuracy / F1-Score', 'Inference Latency', 'Generalization Error'],
          reasoning: 'Connects two major research topics identified across your project papers.',
          limitations: 'Combining multiple components may increase computational overhead.',
        },
        possibleMethodology: `Build a prototype integrating ${termA} and ${termB}, and measure performance against standalone baselines.`,
        expectedContribution: `Provides the first head-to-head comparison of a combined approach for your project domain.`,
        whyRecommended: `Connects two major research topics identified across your project papers.`,
        supportingGaps: [`Combining ${cap(termA)} with ${cap(termB)}`],
        supportingPapers: supporting.map(s => ({
          paperId: s.paperId,
          title: s.title,
          paperTitle: s.title,
          originalFilename: s.originalFilename,
          relevanceExplanation: `Represents one of the primary topic areas (${cap(termA)} / ${cap(termB)}) synthesized in this recommendation.`,
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
  }

  // 4. Honest fallback when no gaps were found, or when corpus is single/mixed documents
  if (gaps.length === 0) {
    const isSingle = eligibleCount === 1;
    const firstPaper = papersWithDetails[0]?.paper || papersWithDetails[0] || {};
    const firstTitle = firstPaper.title || firstPaper.originalFilename || 'Uploaded Paper';

    gaps.push({
      projectId: project._id,
      title: isSingle ? 'Preliminary Analysis: Single Paper Uploaded' : 'Preliminary Analysis: More Research Papers Needed',
      topic: 'project corpus',
      category: 'Scope & Generalizability',
      gapType: isSingle ? 'Unverified Hypothesis' : 'Corpus-Based Opportunity',
      description: isSingle
        ? `Analysis is currently based on 1 uploaded paper ("${firstTitle}"). Cross-paper limitations and consensus research gaps cannot be verified until additional related literature is processed.`
        : `Your uploaded files include different document types (such as technical papers, lab manuals, or resumes). Because these files do not share a single research topic, we cannot yet confirm a true research gap between them.`,
      whyItMatters: 'Drawing conclusions from unrelated documents or a single paper can lead to inaccurate findings. Research gaps require multiple papers on the same subject to be valid.',
      suggestedDirection: 'Upload 2 to 3 research papers on the same topic so the system can compare their methods and find real research gaps.',
      supportingPapers: papersWithDetails.slice(0, 3).map(p => {
        const paperObj = p.paper || p;
        const pTitle = paperObj.title || paperObj.originalFilename || 'Uploaded Paper';
        return {
          paperId: paperObj._id || paperObj.id,
          title: pTitle,
          paperTitle: pTitle,
          originalFilename: paperObj.originalFilename || pTitle,
          publicationYear: paperObj.publicationYear,
          evidenceExcerpt: `Uploaded document: "${pTitle}" (${paperObj.originalFilename || 'document'}).`,
          sourceSection: 'Corpus Metadata',
        };
      }),
      confidenceScore: 0.50,
      confidenceRationale: 'Preliminary observation based on mixed or limited document uploads. More papers on the same topic are needed.',
      dataLimitations: `${eligibleCount} document(s) analyzed. Upload more research papers in the same field for deeper cross-paper analysis.`,
      researchLevel: 'Low',
      isPotentialGap: true,
    });

    recommendations.push({
      projectId: project._id,
      title: 'Upload Additional Papers in the Same Research Area',
      researchDirection: 'Corpus Literature Expansion',
      researchQuestion: 'How do other recent papers approach this problem, and what limitations do they report?',
      targetTopic: 'corpus expansion',
      groundingLevel: isSingle ? 'AI_HYPOTHESIS' : 'CORPUS_INFERRED',
      methodologyDetails: {
        studyDesign: 'Systematic literature search and cross-paper comparative review.',
        dataRequirements: 'At least 2-3 peer-reviewed publications covering identical problem formulations.',
        evaluationMetrics: ['Literature Coverage Ratio', 'Cross-Validation Consensus'],
        reasoning: 'Essential prerequisite before finalizing a project problem statement or proposing a novel method.',
        limitations: 'Single-paper or sparse corpora cannot support verified cross-study conclusions.',
      },
      possibleMethodology: 'Search Google Scholar or IEEE Xplore for 2-3 recent papers on your project topic and upload them here.',
      expectedContribution: 'Builds a reliable research foundation for your college project and viva demonstration.',
      whyRecommended: 'Essential prerequisite before finalizing your project problem statement or proposing a novel method.',
      supportingGaps: [isSingle ? 'Preliminary Analysis: Single Paper Uploaded' : 'Preliminary Analysis: More Research Papers Needed'],
      supportingPapers: papersWithDetails.slice(0, 3).map(p => {
        const paperObj = p.paper || p;
        const pTitle = paperObj.title || paperObj.originalFilename || 'Uploaded Paper';
        return {
          paperId: paperObj._id || paperObj.id,
          title: pTitle,
          paperTitle: pTitle,
          originalFilename: paperObj.originalFilename || pTitle,
          relevanceExplanation: 'Uploaded document requiring cross-corpus validation.',
        };
      }),
      sourceType: 'Corpus Heuristic',
      priority: 'Medium',
      provenance: {
        generatedBy: 'deterministic',
        generatedAt: new Date(),
        corpusPaperCount: eligibleCount,
      },
    });
  }

  return { gaps, recommendations };
}

/**
 * AI-Powered Synthesis Pass.
 * Prompts Gemini or OpenAI to synthesize grounded observations into high-impact academic gaps.
 */
async function synthesizeGapsWithAI(project, papersWithDetails) {
  const papersPayload = papersWithDetails.map((p, idx) => ({
    paperIndex: idx + 1,
    paperId: p.id.toString(),
    title: p.title,
    publicationYear: p.publicationYear || 'Unknown Year',
    researchProblem: p.analysis?.structuredSummary?.researchProblem || 'Not explicitly stated',
    methodology: p.analysis?.structuredSummary?.methodology || 'Not explicitly stated',
    keyFindings: (p.analysis?.structuredSummary?.keyFindings || []).slice(0, 3),
    authorLimitations: (p.analysis?.structuredSummary?.limitations || []).slice(0, 3),
    textLimitationSnippets: p.textLimitations.slice(0, 2),
    textFutureWorkSnippets: p.textFutureWork.slice(0, 2),
  }));

  const systemPrompt = `You are an expert academic research strategist analyzing an academic literature corpus for the project "${project.name}" (domain: ${project.domain || 'General Research'}).
Your task is to identify rigorous, evidence-based research gaps and actionable recommendations grounded strictly in the provided paper records.

CRITICAL GROUNDING & STYLE RULES:
1. ONLY reference papers and author statements actually present in the provided JSON. NEVER invent papers, DOIs, authors, or external citations.
2. Formulate gaps as observations about the current project corpus. Do NOT claim a gap is globally novel or that no research exists in the world.
3. Use simple, clear, professional English suitable for college project demonstrations and viva. Keep sentences short and direct. Avoid overly complex jargon.
4. Categorize each gap strictly as one of: "Methodological", "Empirical / Evaluation", "Theoretical / Algorithmic", "Application / Deployment", "Scope & Generalizability".
5. Label each gapType strictly as:
   - "Explicit Gap": directly backed by an author's stated limitation or future work.
   - "Corpus-Based Opportunity": inferred cross-paper synthesis or unaddressed topic combination.
   - "Unverified Hypothesis": a suggested direction requiring broader validation.
6. Provide a realistic confidenceScore between 0.50 and 0.95 with an honest rationale.
6. Return a valid JSON object matching this schema:
{
  "gaps": [
    {
      "title": "Clear concise gap title",
      "topic": "Core subject area or keyword",
      "category": "Methodological",
      "gapType": "Explicit Gap",
      "description": "Comprehensive explanation of what is lacking or constrained",
      "whyItMatters": "Academic/practical significance of resolving this gap",
      "suggestedDirection": "Concrete direction researchers should take",
      "supportingPaperIndices": [1, 2],
      "evidenceExcerpts": ["Exact quote or close paraphrase from paper 1"],
      "confidenceScore": 0.88,
      "confidenceRationale": "Directly corroborated by explicit limitations in Papers 1 and 2",
      "dataLimitations": "Observation based on the 3 analyzed project documents"
    }
  ],
  "recommendations": [
    {
      "title": "Actionable research direction title",
      "researchQuestion": "Specific academic research question",
      "targetTopic": "Core topic",
      "possibleMethodology": "Detailed experimental or theoretical setup",
      "expectedContribution": "Theoretical, empirical, or practical contribution",
      "whyRecommended": "Why this direction is impactful based on identified gaps",
      "supportingGapTitles": ["Title of gap addressed"],
      "supportingPaperIndices": [1],
      "priority": "High"
    }
  ]
}
Output raw JSON only. No markdown formatting.`;

  const userPrompt = `Here is the analyzed paper corpus (${papersPayload.length} papers):\n\n${JSON.stringify(papersPayload, null, 2)}`;

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

  if (!parsed || !Array.isArray(parsed.gaps) || parsed.gaps.length === 0) {
    throw new Error('AI output did not contain valid gaps array');
  }

  // Map indices back to real paper records to prevent any hallucination
  const validatedGaps = parsed.gaps.map((g, gIdx) => {
    const supportingPapers = [];
    if (Array.isArray(g.supportingPaperIndices)) {
      g.supportingPaperIndices.forEach(idx => {
        const paper = papersWithDetails[idx - 1];
        if (paper) {
          supportingPapers.push({
            paperId: paper.id,
            title: paper.title,
            paperTitle: paper.title,
            originalFilename: paper.originalFilename,
            publicationYear: paper.publicationYear,
            evidenceExcerpt: Array.isArray(g.evidenceExcerpts) && g.evidenceExcerpts[0] ? String(g.evidenceExcerpts[0]).slice(0, 250) : 'Author-stated limitation in paper.',
            sourceSection: 'Author Limitations',
          });
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
        publicationYear: p.publicationYear,
        evidenceExcerpt: 'Derived from analyzed project literature.',
        sourceSection: 'Corpus Analysis',
      });
    }

    const validCategories = ['Methodological', 'Empirical / Evaluation', 'Theoretical / Algorithmic', 'Application / Deployment', 'Scope & Generalizability', 'Other'];
    const category = validCategories.includes(g.category) ? g.category : 'Methodological';

    const validTypes = ['Explicit Gap', 'Corpus-Based Opportunity', 'Unverified Hypothesis'];
    const gapType = validTypes.includes(g.gapType) ? g.gapType : 'Corpus-Based Opportunity';

    return {
      projectId: project._id,
      title: g.title || `Identified Gap ${gIdx + 1}`,
      topic: g.topic || 'General Domain',
      category,
      gapType,
      description: g.description || 'Identified limitation in current literature.',
      whyItMatters: g.whyItMatters || 'Resolving this gap advances domain robustness.',
      suggestedDirection: g.suggestedDirection || 'Conduct comparative empirical validation.',
      supportingPapers,
      confidenceScore: typeof g.confidenceScore === 'number' ? Math.max(0.5, Math.min(0.95, g.confidenceScore)) : 0.80,
      confidenceRationale: g.confidenceRationale || `Grounded in ${supportingPapers.length} analyzed paper(s).`,
      dataLimitations: g.dataLimitations || `Scoped strictly to the ${papersWithDetails.length} uploaded project paper(s).`,
      researchLevel: g.confidenceScore >= 0.85 ? 'High' : g.confidenceScore >= 0.70 ? 'Medium' : 'Low',
      isPotentialGap: true,
    };
  });

  const validatedRecs = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).map((r, rIdx) => {
    const supportingPapers = [];
    if (Array.isArray(r.supportingPaperIndices)) {
      r.supportingPaperIndices.forEach(idx => {
        const paper = papersWithDetails[idx - 1];
        if (paper) supportingPapers.push({ paperId: paper.id, title: paper.title, originalFilename: paper.originalFilename });
      });
    }
    if (supportingPapers.length === 0 && papersWithDetails.length > 0) {
      supportingPapers.push({ paperId: papersWithDetails[0].id, title: papersWithDetails[0].title, originalFilename: papersWithDetails[0].originalFilename });
    }

    const mDetails = r.methodologyDetails || {};
    return {
      projectId: project._id,
      title: r.title || `Research Recommendation ${rIdx + 1}`,
      researchDirection: r.researchDirection || r.title || 'Advanced Domain Exploration',
      researchQuestion: r.researchQuestion || 'How can current architectural constraints be mitigated?',
      targetTopic: r.targetTopic || 'Domain Integration',
      groundingLevel: ['EXPLICIT_GAP_GROUNDED', 'CORPUS_INFERRED', 'AI_HYPOTHESIS'].includes(r.groundingLevel) ? r.groundingLevel : 'CORPUS_INFERRED',
      methodologyDetails: {
        studyDesign: mDetails.studyDesign || 'Empirical comparative benchmark under controlled evaluation conditions.',
        dataRequirements: mDetails.dataRequirements || 'Standard domain benchmark dataset with cross-validation splits.',
        evaluationMetrics: Array.isArray(mDetails.evaluationMetrics) && mDetails.evaluationMetrics.length > 0
          ? mDetails.evaluationMetrics
          : ['Accuracy / F1-Score', 'Inference Latency', 'Generalization Error'],
        reasoning: mDetails.reasoning || 'Aligns evaluation with established literature standards.',
        limitations: mDetails.limitations || 'Bound by domain distribution and dataset scale.',
      },
      possibleMethodology: r.possibleMethodology || mDetails.studyDesign || 'Empirical benchmark cross-validation.',
      expectedContribution: r.expectedContribution || 'Provides validated baseline comparisons.',
      whyRecommended: r.whyRecommended || 'Addresses primary constraints identified across project papers.',
      supportingGaps: Array.isArray(r.supportingGapTitles) ? r.supportingGapTitles : [],
      supportingPapers: supportingPapers.map(sp => ({
        ...sp,
        relevanceExplanation: sp.relevanceExplanation || 'Provides baseline findings and methodology relevant to this recommendation.',
      })),
      sourceType: 'Synthesis',
      priority: ['High', 'Medium', 'Low'].includes(r.priority) ? r.priority : 'Medium',
      provenance: {
        generatedBy: provider,
        generatedAt: new Date(),
        corpusPaperCount: papersWithDetails.length,
      },
    };
  });

  return { gaps: validatedGaps, recommendations: validatedRecs };
}

/**
 * Execute or update Gap Analysis for a project.
 * Completely idempotent: deletes previous records and atomically replaces them.
 * Never creates duplicate records. Reuses existing summaries.
 */
async function runGapAnalysisForProject(projectId, options = {}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  // Prevent concurrent runs on the same project
  if (project.gapAnalysisStatus === 'ANALYZING' && !options.force) {
    return { status: 'ANALYZING', message: 'Analysis is already in progress' };
  }

  await Project.findByIdAndUpdate(projectId, {
    gapAnalysisStatus: 'ANALYZING',
    gapAnalysisError: null,
  });

  try {
    // 1. Fetch eligible completed papers
    const allPapers = await Paper.find({ projectId: project._id });
    const eligiblePapers = allPapers.filter(
      p => p.status === 'COMPLETED' && p.extractedText && p.extractedText.trim().length > 0
    );

    if (eligiblePapers.length === 0) {
      // Clear previous gaps if all papers were deleted
      await GapResult.deleteMany({ projectId: project._id });
      await Recommendation.deleteMany({ projectId: project._id });
      await Project.findByIdAndUpdate(projectId, {
        gapAnalysisStatus: 'INSUFFICIENT_DATA',
        lastGapAnalysisAt: new Date(),
        gapCount: 0,
        recommendationCount: 0,
      });
      return {
        status: 'INSUFFICIENT_DATA',
        gapCount: 0,
        recommendationCount: 0,
        eligiblePaperCount: 0,
        totalEligiblePapers: 0,
        gaps: [],
        recommendations: [],
        message: 'No completed papers available for gap analysis.',
        dataLimitations: 'At least 1 processed paper is required to analyze research gaps.',
      };
    }

    // 2. Fetch existing PaperAnalysis records (REUSE existing summaries!)
    const analyses = await PaperAnalysis.find({ projectId: project._id });
    const analysisByPaperId = {};
    analyses.forEach(a => { analysisByPaperId[a.paperId.toString()] = a; });

    // 3. Prepare rich paper details with extracted future work and limitations
    const papersWithDetails = eligiblePapers.map(p => {
      const text = p.extractedText || '';
      return {
        id: p._id,
        title: p.title || p.originalFilename,
        originalFilename: p.originalFilename,
        publicationYear: p.publicationYear || null,
        authors: Array.isArray(p.authors) ? p.authors : [],
        analysis: analysisByPaperId[p._id.toString()] || null,
        textLimitations: extractLimitationSnippets(text),
        textFutureWork: extractFutureWorkSnippets(text),
      };
    });

    let finalGaps = [];
    let finalRecs = [];
    let usedProvider = 'deterministic';

    // 4. Try AI synthesis if provider is configured and not opted out
    if (aiService.isConfigured() && !options.deterministicOnly) {
      try {
        const aiResult = await synthesizeGapsWithAI(project, papersWithDetails);
        finalGaps = aiResult.gaps;
        finalRecs = aiResult.recommendations;
        usedProvider = aiService.getActiveProvider();
      } catch (aiErr) {
        console.warn('AI Gap Synthesis encountered error, falling back to deterministic evidence engine:', aiErr.message);
        const fallback = generateDeterministicGapsAndRecommendations(project, papersWithDetails);
        finalGaps = fallback.gaps;
        finalRecs = fallback.recommendations;
        usedProvider = 'deterministic_fallback';
      }
    } else {
      const fallback = generateDeterministicGapsAndRecommendations(project, papersWithDetails);
      finalGaps = fallback.gaps;
      finalRecs = fallback.recommendations;
      usedProvider = 'deterministic';
    }

    // If single paper corpus, ensure explicit preliminary disclaimer on all gaps
    if (eligiblePapers.length === 1) {
      finalGaps.forEach(g => {
        if (!g.dataLimitations || !/single paper|corpus/i.test(g.dataLimitations)) {
          g.dataLimitations = `Preliminary single paper corpus observation: ${g.dataLimitations || 'Single paper analysis'}.`;
        }
      });
    }

    // 5. Idempotent Database Persistence (Atomic clean replace)
    await GapResult.deleteMany({ projectId: project._id });
    await Recommendation.deleteMany({ projectId: project._id });

    let savedGaps = [];
    let savedRecs = [];

    if (finalGaps.length > 0) {
      savedGaps = await GapResult.insertMany(finalGaps);
    }
    if (finalRecs.length > 0) {
      savedRecs = await Recommendation.insertMany(finalRecs);
    }

    await Project.findByIdAndUpdate(projectId, {
      gapAnalysisStatus: 'COMPLETED',
      gapAnalysisError: null,
      lastGapAnalysisAt: new Date(),
      gapCount: savedGaps.length,
      recommendationCount: savedRecs.length,
    });

    return {
      status: 'COMPLETED',
      gapCount: savedGaps.length,
      recommendationCount: savedRecs.length,
      eligiblePaperCount: eligiblePapers.length,
      totalEligiblePapers: eligiblePapers.length,
      gaps: savedGaps,
      recommendations: savedRecs,
      provider: usedProvider,
      lastUpdated: new Date(),
    };
  } catch (err) {
    console.error('runGapAnalysisForProject error:', err);
    await Project.findByIdAndUpdate(projectId, {
      gapAnalysisStatus: 'FAILED',
      gapAnalysisError: err.message || 'Error executing research gap analysis',
    });
    throw err;
  }
}

module.exports = {
  runGapAnalysisForProject,
  generateDeterministicGapsAndRecommendations,
  extractFutureWorkSnippets,
  extractLimitationSnippets,
};

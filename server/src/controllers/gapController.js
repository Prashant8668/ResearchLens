/**
 * Phase 10 — Gap Analysis Controller
 * Provides secure, project-isolated endpoints for research gaps and recommendations.
 */

const Project = require('../models/Project');
const Paper = require('../models/Paper');
const GapResult = require('../models/GapResult');
const Recommendation = require('../models/Recommendation');
const { runGapAnalysisForProject } = require('../services/gapAnalysisService');

// Helper to check ownership
const enforceOwnership = (project, userId) => {
  if (!project) return false;
  return project.userId.toString() === userId.toString();
};

/**
 * GET /api/projects/:id/gaps
 * Retrieve research gaps and recommendations for an authorized project.
 * Automatically runs initial analysis if not yet performed and papers exist.
 */
exports.getGaps = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    // Fetch eligible papers
    const allPapers = await Paper.find({ projectId: project._id });
    const eligiblePapers = allPapers.filter(
      p => p.status === 'COMPLETED' && p.extractedText && p.extractedText.trim().length > 0
    );

    // If zero eligible papers, return honest insufficient data state immediately
    if (eligiblePapers.length === 0) {
      return res.status(200).json({
        projectId: project._id,
        projectName: project.name,
        domain: project.domain || 'General Research',
        status: 'INSUFFICIENT_DATA',
        lastUpdated: project.lastGapAnalysisAt || project.updatedAt,
        error: null,
        eligiblePaperCount: 0,
        totalEligiblePapers: 0,
        gapCount: 0,
        recommendationCount: 0,
        categoryCounts: {},
        typeCounts: {},
        gaps: [],
        recommendations: [],
        dataLimitations: 'At least 1 processed paper is required to analyze research gaps.',
        disclaimer: 'Scope & Epistemic Notice: All detected research gaps and recommendations are derived strictly from the papers uploaded to this ResearchLens project corpus.',
      });
    }

    // If analysis was never performed, or if papers exist but no gaps exist, run analysis
    const existingGapsCount = await GapResult.countDocuments({ projectId: project._id });
    if (project.gapAnalysisStatus === 'NOT_STARTED' || (existingGapsCount === 0 && eligiblePapers.length > 0)) {
      try {
        await runGapAnalysisForProject(project._id);
      } catch (runErr) {
        console.warn('Initial gap analysis run error:', runErr.message);
      }
    }

    // Refresh project record
    const updatedProject = await Project.findById(projectId);

    // Build filter based on query params
    const { category, gapType } = req.query;
    const gapFilter = { projectId: project._id };
    if (category && category !== 'All' && category !== 'ALL') {
      gapFilter.category = category;
    }
    if (gapType && gapType !== 'All' && gapType !== 'ALL') {
      gapFilter.gapType = gapType;
    }

    // Retrieve saved results
    const gaps = await GapResult.find(gapFilter).sort({ confidenceScore: -1, createdAt: -1 });
    const recommendations = await Recommendation.find({ projectId: project._id }).sort({ priority: 1, createdAt: -1 });

    // Categorization coverage
    const categoryCounts = {};
    const typeCounts = {};
    const allProjectGaps = await GapResult.find({ projectId: project._id });
    allProjectGaps.forEach(g => {
      categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1;
      typeCounts[g.gapType] = (typeCounts[g.gapType] || 0) + 1;
    });

    const isSinglePaper = eligiblePapers.length === 1;
    const explicitGapsCount = allProjectGaps.filter(g => g.gapType === 'Explicit Gap').length;
    const limitationNotice = explicitGapsCount === 0
      ? 'No explicit limitation sections were detected in the analyzed papers. Note: This does not mean the research has no limitations — some uploaded files (such as lab reports or resumes) do not contain formal limitation sections, or the paper may not have a dedicated Limitations heading.'
      : null;

    const dataLimitations = isSinglePaper
      ? 'Preliminary corpus analysis: only 1 paper available in project. Identified gaps reflect single-paper limitations and require broader literature review.'
      : `Analysis synthesized across ${eligiblePapers.length} project documents. Gaps represent corpus patterns, not global novelty assertions.`;

    res.status(200).json({
      projectId: project._id,
      projectName: project.name,
      domain: project.domain || 'General Research',
      status: updatedProject.gapAnalysisStatus || 'COMPLETED',
      lastUpdated: updatedProject.lastGapAnalysisAt || updatedProject.updatedAt,
      error: updatedProject.gapAnalysisError || null,
      eligiblePaperCount: eligiblePapers.length,
      totalEligiblePapers: eligiblePapers.length,
      gapCount: gaps.length,
      recommendationCount: recommendations.length,
      explicitGapsCount,
      limitationNotice,
      categoryCounts,
      typeCounts,
      gaps,
      recommendations,
      dataLimitations,
      disclaimer: 'We analyze the papers you uploaded to this project. Results describe gaps and ideas found in your project papers, not all research published worldwide.',
    });
  } catch (error) {
    console.error('getGaps controller error:', error);
    res.status(500).json({ error: error.message || 'Server error fetching research gaps' });
  }
};

/**
 * POST /api/projects/:id/gaps/analyze
 * Manually trigger a fresh reanalysis of research gaps and recommendations.
 */
exports.analyzeGaps = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const result = await runGapAnalysisForProject(project._id, { force: true });
    res.status(200).json({
      message: 'Gap analysis updated successfully',
      ...result,
    });
  } catch (error) {
    console.error('analyzeGaps controller error:', error);
    res.status(500).json({ error: error.message || 'Server error updating research gaps' });
  }
};

/**
 * GET /api/projects/:id/recommendations
 * Retrieve actionable research recommendations for an authorized project.
 */
exports.getRecommendations = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const recommendationService = require('../services/recommendationService');
    const result = await recommendationService.getProjectRecommendations(projectId, req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error('getRecommendations controller error:', error);
    res.status(500).json({ error: error.message || 'Server error fetching recommendations' });
  }
};


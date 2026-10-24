/**
 * Phase 11 — Research Recommendations Controller
 * Endpoints for retrieving and generating explainable, evidence-grounded research recommendations.
 */

const Project = require('../models/Project');
const recommendationService = require('../services/recommendationService');

// Helper to check ownership
const enforceOwnership = (project, userId) => {
  if (!project) return false;
  return project.userId.toString() === userId.toString();
};

/**
 * GET /api/projects/:id/recommendations
 * Retrieve evidence-grounded future research directions and questions.
 */
exports.getRecommendations = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const result = await recommendationService.getProjectRecommendations(projectId, req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error('getRecommendations controller error:', error);
    res.status(500).json({ error: error.message || 'Server error fetching research recommendations' });
  }
};

/**
 * POST /api/projects/:id/recommendations
 * POST /api/projects/:id/recommendations/generate
 * Trigger fresh generation of research recommendations.
 */
exports.generateRecommendations = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const result = await recommendationService.generateRecommendationsForProject(projectId, {
      forceGaps: req.body?.forceGaps === true,
      deterministicOnly: req.body?.deterministicOnly === true,
    });

    res.status(200).json({
      message: 'Research recommendations generated successfully',
      ...result,
    });
  } catch (error) {
    console.error('generateRecommendations controller error:', error);
    res.status(500).json({ error: error.message || 'Server error generating research recommendations' });
  }
};

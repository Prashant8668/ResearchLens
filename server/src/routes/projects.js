const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const paperController = require('../controllers/paperController');
const { requireAuth } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/upload');

// Protect all project routes
router.use(requireAuth);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProjectById);

// --- Paper routes within a project ---
// GET papers list for a project (ownership enforced in controller)
router.get('/:id/papers', paperController.getPapersByProject);

// POST upload one or more PDFs (multer handles multi-file; ownership in controller)
router.post(
  '/:id/papers',
  (req, res, next) => {
    upload.array('pdfs', 20)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File too large. Maximum size is ${process.env.MAX_PDF_SIZE_MB || 25}MB per file.` });
        }
        if (err.message && err.message.startsWith('INVALID_')) {
          return res.status(400).json({ error: err.message.split(': ')[1] || err.message });
        }
        return res.status(400).json({ error: err.message || 'Upload error' });
      }
      next();
    });
  },
  paperController.uploadPapers
);

// Ownership middleware for sub-routes that need it
router.use('/:id', projectController.enforceProjectOwnership);

router.post('/:id/analyze', projectController.analyzeProject);
router.post('/:id/similarity', projectController.getSimilarity);
const gapController = require('../controllers/gapController');
const recommendationController = require('../controllers/recommendationController');

router.get('/:id/trends', projectController.getTrends);
router.get('/:id/trends/topics/:term', projectController.getTrendTopicDetails);
router.get('/:id/gaps', gapController.getGaps);
router.post('/:id/gaps/analyze', gapController.analyzeGaps);
router.get('/:id/recommendations', recommendationController.getRecommendations);
router.post('/:id/recommendations', recommendationController.generateRecommendations);
router.post('/:id/recommendations/generate', recommendationController.generateRecommendations);
router.get('/:id/report', projectController.getReport);

// Phase 6: aggregated keyword analysis for a project
router.get('/:id/analysis', paperController.getProjectAnalysis);

// Phase 8: Similarity Screening (TF-IDF + Cosine Similarity)
router.post('/:id/novelty', projectController.screenNovelty);
router.get('/:id/novelty', projectController.getNovelty);

// Phase 13: Plagiarism Checker
const plagiarismController = require('../controllers/plagiarismController');
router.post(
  '/:id/plagiarism/scan',
  (req, res, next) => {
    upload.fields([
      { name: 'pdfs', maxCount: 20 },
      { name: 'files', maxCount: 20 },
      { name: 'uploadedFiles', maxCount: 20 },
      { name: 'pdf', maxCount: 1 },
      { name: 'paper1Pdfs', maxCount: 20 },
      { name: 'paper2Pdfs', maxCount: 20 },
      { name: 'paper1Pdf', maxCount: 1 },
      { name: 'paper2Pdf', maxCount: 1 },
      { name: 'group1Pdfs', maxCount: 20 },
      { name: 'group2Pdfs', maxCount: 20 },
    ])(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File too large. Maximum size is ${process.env.MAX_PDF_SIZE_MB || 25}MB per file.` });
        }
        if (err.message && err.message.startsWith('INVALID_')) {
          return res.status(400).json({ error: err.message.split(': ')[1] || err.message });
        }
        return res.status(400).json({ error: err.message || 'Upload error' });
      }
      next();
    });
  },
  plagiarismController.startScan
);
router.all('/:id/plagiarism/scan', (req, res) => {
  res.status(405).json({ error: `Method ${req.method} not allowed on this endpoint. Use POST to start a scan.` });
});
router.get('/:id/plagiarism/scans', plagiarismController.listScans);
router.get('/:id/plagiarism/scans/:scanId', plagiarismController.getScanStatus);
router.get('/:id/plagiarism/scans/:scanId/status', plagiarismController.getScanStatus);
router.get('/:id/plagiarism/scans/:scanId/results', plagiarismController.getScanResults);
router.delete('/:id/plagiarism/scans/:scanId', plagiarismController.deleteScan);
router.post('/:id/plagiarism/scans/:scanId/cancel', plagiarismController.cancelScan);
router.get('/:id/plagiarism/summary', plagiarismController.getPlagiarismSummary);

module.exports = router;

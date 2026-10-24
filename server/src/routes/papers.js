const express = require('express');
const router = express.Router();
const paperController = require('../controllers/paperController');
const { requireAuth } = require('../middleware/authMiddleware');

// All paper routes require authentication
router.use(requireAuth);

// GET /api/papers/:id — get a specific paper
router.get('/:id', paperController.getPaperById);

// GET /api/papers/:id/analysis — keyword extraction results
router.get('/:id/analysis', paperController.getAnalysis);

// POST /api/papers/:id/summary — generate AI structured summary
router.post('/:id/summary', paperController.generateSummary);

// GET /api/papers/:id/summary — get AI structured summary
router.get('/:id/summary', paperController.getSummary);

// POST /api/papers/:id/retry — retry a FAILED paper
router.post('/:id/retry', paperController.retryPaper);

// POST /api/papers/:id/reprocess — reprocess keywords from paper extracted text
router.post('/:id/reprocess', paperController.reprocessPaper);

// PATCH /api/papers/:id — update paper metadata
router.patch('/:id', paperController.updatePaper);

// DELETE /api/papers/:id — delete a paper and its analysis
router.delete('/:id', paperController.deletePaper);

module.exports = router;

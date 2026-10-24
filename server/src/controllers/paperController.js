const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Paper = require('../models/Paper');
const PaperAnalysis = require('../models/PaperAnalysis');
const Project = require('../models/Project');
const SimilarityResult = require('../models/SimilarityResult');
const GapResult = require('../models/GapResult');
const Recommendation = require('../models/Recommendation');
const TrendResult = require('../models/TrendResult');
const { UPLOAD_DIR } = require('../middleware/upload');
const aiService = require('../services/aiService');

const NLP_SERVICE_URL = process.env.PYTHON_SERVICE_URL || process.env.NLP_SERVICE_URL || 'http://localhost:8000';

// Helper: verify authenticated user owns the project
const getOwnedProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;
  if (project.userId.toString() !== userId.toString()) return null;
  return project;
};

// Helper: sanitize paper titles from PDF metadata placeholders
const getCleanPaperTitle = (paper) => {
  if (!paper) return 'Untitled Document';
  const raw = paper.title?.trim();
  if (raw && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(raw.toLowerCase())) {
    return raw;
  }
  return paper.originalFilename || 'Untitled Document';
};

// Helper: verify authenticated user owns the paper (via its project)
const getOwnedPaper = async (paperId, userId) => {
  const paper = await Paper.findById(paperId);
  if (!paper) return null;
  const project = await Project.findById(paper.projectId);
  if (!project || project.userId.toString() !== userId.toString()) return null;
  return paper;
};

// Trigger async processing via FastAPI (fire-and-forget, updates DB)
// Trigger async processing via FastAPI (fire-and-forget, updates DB)
const triggerProcessing = async (paper) => {
  try {
    await Paper.findByIdAndUpdate(paper._id, { status: 'PROCESSING' });

    const urls = [NLP_SERVICE_URL];
    if (NLP_SERVICE_URL.includes('localhost')) {
      urls.push(NLP_SERVICE_URL.replace('localhost', '127.0.0.1'));
    } else if (NLP_SERVICE_URL.includes('127.0.0.1')) {
      urls.push(NLP_SERVICE_URL.replace('127.0.0.1', 'localhost'));
    }

    let response;
    let lastErr = null;
    for (const url of urls) {
      try {
        response = await axios.post(
          `${url}/process-pdf/`,
          {
            paper_id: paper._id.toString(),
            stored_filename: paper.storedFilename,
            upload_dir: UPLOAD_DIR,
          },
          { timeout: 120000 }
        );
        lastErr = null;
        break;
      } catch (postErr) {
        lastErr = postErr;
        if (postErr.code === 'ECONNREFUSED' && urls.length > 1) {
          continue;
        }
        break;
      }
    }

    if (lastErr) throw lastErr;

    const result = response.data;

    if (result.error) {
      await Paper.findByIdAndUpdate(paper._id, {
        status: 'FAILED',
        processingError: result.error,
      });
    } else if (!result.text || !result.text.trim()) {
      await Paper.findByIdAndUpdate(paper._id, {
        status: 'FAILED',
        processingError: 'No extractable text found in PDF',
      });
    } else {
      const extractedText = result.text.trim();

      // Phase 6: trigger keyword extraction and persist to PaperAnalysis (extracts all unique keywords)
      try {
        await extractAndPersistKeywords(paper._id, paper.projectId, extractedText);
      } catch (kwErr) {
        console.error('Keyword extraction error for paper', paper._id, ':', kwErr.message);
      }

      const rawTitle = result.metadata?.title?.trim();
      const isPlaceholder = !rawTitle || ['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(rawTitle.toLowerCase());
      const cleanTitle = !isPlaceholder
        ? rawTitle
        : (paper.title && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(paper.title.toLowerCase())
            ? paper.title
            : (paper.originalFilename ? path.basename(paper.originalFilename, path.extname(paper.originalFilename)) : 'Untitled Document'));

      const cleanAuthors = Array.isArray(result.metadata?.authors)
        ? result.metadata.authors.filter(a => a && !['(anonymous)', 'anonymous', 'unknown'].includes(a.trim().toLowerCase()))
        : [];

      await Paper.findByIdAndUpdate(paper._id, {
        status: 'COMPLETED',
        extractedText,
        title: cleanTitle,
        authors: cleanAuthors,
        abstract: result.metadata?.abstract || null,
        publicationYear: result.metadata?.year || null,
        processingError: null,
      });

      // Phase 7: trigger structured AI summarization if active provider is configured
      if (aiService.isConfigured()) {
        generateAndPersistSummary(paper._id, paper.projectId, extractedText).catch((aiErr) => {
          console.warn('Background AI summarization failed for paper', paper._id, ':', aiErr.message);
        });
      }

      // Phase 10: trigger real-time background gap analysis update for the affected project
      try {
        const { runGapAnalysisForProject } = require('../services/gapAnalysisService');
        runGapAnalysisForProject(paper.projectId).catch((gapErr) => {
          console.warn('Background gap analysis update failed for project', paper.projectId, ':', gapErr.message);
        });
      } catch (gapLoadErr) {
        console.warn('Failed to schedule gap analysis:', gapLoadErr.message);
      }
    }
  } catch (err) {
    console.error('FastAPI processing error for paper', paper._id, ':', err.message);
    let errorMsg = 'Processing service unavailable';
    if (err.response && err.response.data) {
      const detail = err.response.data.detail;
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map(d => d.msg || JSON.stringify(d)).join('; ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = JSON.stringify(detail);
      } else if (err.response.data.error) {
        errorMsg = err.response.data.error;
      } else {
        errorMsg = `Processing failed with status ${err.response.status}`;
      }
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      errorMsg = 'Processing service unavailable';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      errorMsg = 'Processing service timed out';
    } else if (err.message) {
      errorMsg = err.message;
    }
    await Paper.findByIdAndUpdate(paper._id, {
      status: 'FAILED',
      processingError: errorMsg,
    });
  }
};

// Helper: normalize keyword duplicates (case and whitespace), aggregate scores, and strictly enforce 50-keyword ceiling
const normalizeAndCapKeywords = (rawKeywords) => {
  if (!Array.isArray(rawKeywords) || rawKeywords.length === 0) return [];
  const termMap = new Map();
  for (const kw of rawKeywords) {
    if (!kw || !kw.term) continue;
    const termNorm = String(kw.term).toLowerCase().trim();
    if (!termNorm) continue;
    const kwScore = typeof kw.score === 'number' ? kw.score : 0;
    if (termMap.has(termNorm)) {
      const existing = termMap.get(termNorm);
      existing.score = Math.round((existing.score + kwScore) * 1e4) / 1e4;
    } else {
      termMap.set(termNorm, {
        term: termNorm,
        score: kwScore,
      });
    }
  }

  // Sort descending by score, then alphabetical for deterministic ordering
  const sorted = Array.from(termMap.values())
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, 50);

  return sorted.map((kw, i) => ({
    term: kw.term,
    score: kw.score,
    rank: i + 1,
  }));
};

// Phase 6: call /extract-keywords/ and upsert PaperAnalysis (enforcing max 50 unique keywords per paper)
const extractAndPersistKeywords = async (paperId, projectId, text, topN = 50) => {
  try {
    const limit = (topN && topN > 0) ? Math.min(topN, 50) : 50;
    const payload = { paper_id: paperId.toString(), text, top_n: limit };

    const urls = [NLP_SERVICE_URL];
    if (NLP_SERVICE_URL.includes('localhost')) {
      urls.push(NLP_SERVICE_URL.replace('localhost', '127.0.0.1'));
    } else if (NLP_SERVICE_URL.includes('127.0.0.1')) {
      urls.push(NLP_SERVICE_URL.replace('127.0.0.1', 'localhost'));
    }

    let response;
    let lastErr = null;
    for (const url of urls) {
      try {
        response = await axios.post(`${url}/extract-keywords/`, payload, { timeout: 60000 });
        lastErr = null;
        break;
      } catch (postErr) {
        lastErr = postErr;
        if (postErr.code === 'ECONNREFUSED' && urls.length > 1) {
          continue;
        }
        break;
      }
    }
    if (lastErr) throw lastErr;

    const { keywords } = response.data || {};
    if (!Array.isArray(keywords) || keywords.length === 0) return null;

    const normalizedKeywords = normalizeAndCapKeywords(keywords);
    if (normalizedKeywords.length === 0) return null;

    const saved = await PaperAnalysis.findOneAndUpdate(
      { paperId },
      {
        paperId,
        projectId,
        extractedKeywords: normalizedKeywords,
        keywordsExtractedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return saved;
  } catch (err) {
    console.error('Keyword extraction failed for paper', paperId, ':', err.message);
    return null;
  }
};

// Phase 7: Generate structured summary with OpenAI and persist to PaperAnalysis
const generateAndPersistSummary = async (paperId, projectId, text, options = {}) => {
  try {
    await PaperAnalysis.findOneAndUpdate(
      { paperId },
      {
        paperId,
        projectId,
        summaryStatus: 'GENERATING',
        summaryError: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const result = await aiService.generateStructuredSummary(text, options);

    const updated = await PaperAnalysis.findOneAndUpdate(
      { paperId },
      {
        paperId,
        projectId,
        structuredSummary: result.structuredSummary,
        summaryStatus: 'COMPLETED',
        summaryError: null,
        summary: result.structuredSummary.researchProblem + ' ' + result.structuredSummary.objective,
        methodology: result.structuredSummary.methodology,
        limitations: result.structuredSummary.limitations,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { success: true, analysis: updated, aiResult: result };
  } catch (err) {
    const errorMsg = err.message || 'Failed to generate AI summary';
    await PaperAnalysis.findOneAndUpdate(
      { paperId },
      {
        paperId,
        projectId,
        summaryStatus: 'FAILED',
        summaryError: errorMsg,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    throw err;
  }
};

// POST /api/projects/:id/papers  — upload one or more PDFs
exports.uploadPapers = async (req, res) => {
  try {
    const project = await getOwnedProject(req.params.id, req.user.id);
    if (!project) return res.status(403).json({ error: 'Forbidden' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No PDF files provided' });
    }

    const createdPapers = [];

    for (const file of req.files) {
      const paper = new Paper({
        projectId: project._id,
        originalFilename: file.originalname,
        storedFilename: file.filename, // UUID-based safe filename
        fileSizeBytes: file.size,
        status: 'QUEUED',
        title: path.basename(file.originalname, '.pdf'), // temp title from filename
      });
      await paper.save();
      createdPapers.push(paper);

      // Trigger processing asynchronously (do not await — respond immediately)
      triggerProcessing(paper);
    }

    res.status(201).json({
      message: `${createdPapers.length} paper(s) queued for processing`,
      papers: createdPapers.map(p => ({
        id: p._id,
        originalFilename: p.originalFilename,
        status: p.status,
      })),
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

// GET /api/papers/:id — get paper details (ownership enforced)
exports.getPaperById = async (req, res) => {
  try {
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    // Do not return raw filesystem paths
    const safeResponse = {
      id: paper._id,
      projectId: paper.projectId,
      originalFilename: paper.originalFilename,
      fileSizeBytes: paper.fileSizeBytes,
      status: paper.status,
      processingError: paper.status === 'FAILED' ? paper.processingError : undefined,
      title: getCleanPaperTitle(paper),
      authors: (paper.authors || []).filter(a => a && !['(anonymous)', 'anonymous', 'unknown'].includes(a.trim().toLowerCase())),
      abstract: paper.abstract,
      publicationYear: paper.publicationYear,
      extractedText: paper.extractedText,
      createdAt: paper.createdAt,
      updatedAt: paper.updatedAt,
    };
    res.status(200).json(safeResponse);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/projects/:id/papers — list papers for a project (ownership enforced)
exports.getPapersByProject = async (req, res) => {
  try {
    const project = await getOwnedProject(req.params.id, req.user.id);
    if (!project) return res.status(403).json({ error: 'Forbidden' });

    const papers = await Paper.find({ projectId: project._id }).select(
      '-storedFilename'
    );
    const sanitized = papers.map(p => {
      const obj = p.toObject();
      obj.title = getCleanPaperTitle(p);
      return obj;
    });
    res.status(200).json(sanitized);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/papers/:id/retry — retry FAILED paper (ownership enforced)
exports.retryPaper = async (req, res) => {
  try {
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    if (paper.status !== 'FAILED') {
      return res.status(400).json({ error: 'Only FAILED papers can be retried' });
    }

    await Paper.findByIdAndUpdate(paper._id, { status: 'QUEUED', processingError: null });
    const updatedPaper = await Paper.findById(paper._id);

    // Trigger async processing
    triggerProcessing(updatedPaper);

    res.status(200).json({ message: 'Paper queued for retry', id: paper._id, status: 'QUEUED' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/papers/:id/analysis — get keyword analysis for a single paper
exports.getAnalysis = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    let analysis = await PaperAnalysis.findOne({ paperId: paper._id });
    if (!analysis && paper.status === 'COMPLETED' && paper.extractedText && paper.extractedText.trim()) {
      await extractAndPersistKeywords(paper._id, paper.projectId, paper.extractedText.trim(), 50);
      analysis = await PaperAnalysis.findOne({ paperId: paper._id });
    }

    if (!analysis) {
      return res.status(200).json({
        paperId: paper._id,
        title: getCleanPaperTitle(paper),
        extractedKeywords: [],
        totalKeywords: 0,
        keywordsExtractedAt: null,
        structuredSummary: null,
        summaryStatus: 'NOT_STARTED',
        summaryError: null,
      });
    }

    const cleanKeywords = normalizeAndCapKeywords(analysis.extractedKeywords);

    res.status(200).json({
      paperId: paper._id,
      title: getCleanPaperTitle(paper),
      extractedKeywords: cleanKeywords,
      totalKeywords: cleanKeywords.length,
      keywordsExtractedAt: analysis.keywordsExtractedAt,
      structuredSummary: analysis.structuredSummary || null,
      summaryStatus: analysis.summaryStatus || 'NOT_STARTED',
      summaryError: analysis.summaryError || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/projects/:id/analysis — aggregate keyword analysis for a project
exports.getProjectAnalysis = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch all papers for this project to associate titles/filenames
    const allPapers = await Paper.find({ projectId: project._id });
    const paperMap = {};
    for (const p of allPapers) {
      paperMap[p._id.toString()] = p;
    }

    // All completed papers
    const completedPapers = allPapers.filter(p => p.status === 'COMPLETED');
    const completedPaperIds = new Set(completedPapers.map(p => p._id.toString()));

    // Fetch all existing analyses for this project
    let analyses = await PaperAnalysis.find({ projectId: project._id });

    const analyzedPaperIds = new Set(analyses.map(a => a.paperId.toString()));
    const missing = completedPapers.filter(
      p => !analyzedPaperIds.has(p._id.toString()) && p.extractedText && p.extractedText.trim().length > 0
    );

    if (missing.length > 0) {
      await Promise.all(
        missing.map(p => extractAndPersistKeywords(p._id, project._id, p.extractedText.trim(), 50))
      );
      analyses = await PaperAnalysis.find({ projectId: project._id });
    }

    // Only aggregate analyses belonging to COMPLETED papers in this project
    const validAnalyses = analyses.filter(a => completedPaperIds.has(a.paperId.toString()));

    // Build per-document analyses list only for completed papers with normalized keywords (max 50)
    const paperAnalyses = validAnalyses.map(a => {
      const p = paperMap[a.paperId.toString()];
      const cleanKeywords = normalizeAndCapKeywords(a.extractedKeywords);
      return {
        paperId: a.paperId,
        title: getCleanPaperTitle(p),
        originalFilename: p?.originalFilename,
        keywordsCount: cleanKeywords.length,
        keywordsExtractedAt: a.keywordsExtractedAt,
        extractedKeywords: cleanKeywords,
        structuredSummary: a.structuredSummary || null,
        summaryStatus: a.summaryStatus || 'NOT_STARTED',
        summaryError: a.summaryError || null,
      };
    });

    // Dashboard total: SUM of the actual unique keyword counts of all eligible papers in the selected project
    // Example: Paper A = 35, Paper B = 50, Paper C = 42 -> totalKeywordsSum = 127
    const totalKeywordsSum = paperAnalyses.reduce((acc, pa) => acc + (pa.keywordsCount || 0), 0);

    // Aggregate keyword frequencies across completed papers with case/whitespace normalization
    const keywordAgg = {};
    for (const pa of paperAnalyses) {
      const seenTermsInPaper = new Set();
      for (const kw of pa.extractedKeywords) {
        const norm = kw.term;
        if (!keywordAgg[norm]) {
          keywordAgg[norm] = { term: norm, totalScore: 0, paperCount: 0 };
        }
        keywordAgg[norm].totalScore += kw.score || 0;

        if (!seenTermsInPaper.has(norm)) {
          seenTermsInPaper.add(norm);
          keywordAgg[norm].paperCount += 1;
        }
      }
    }

    // Number of globally unique keywords across the project corpus
    const totalUniqueKeywords = Object.keys(keywordAgg).length;

    // Sort by totalScore desc
    const aggregatedKeywords = Object.values(keywordAgg)
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((kw, i) => ({
        ...kw,
        rank: i + 1,
        totalScore: Math.round(kw.totalScore * 1e4) / 1e4,
        averageScore: Math.round((kw.totalScore / kw.paperCount) * 1e4) / 1e4,
      }));

    res.status(200).json({
      projectId: project._id,
      papersAnalyzed: completedPapers.length,
      totalKeywordsSum,
      totalUniqueKeywords,
      aggregationRule: 'Sum of individual document TF scores across completed analyzed papers',
      aggregatedKeywords,
      topAggregatedKeywords: aggregatedKeywords.slice(0, 30),
      paperAnalyses,
      aiProvider: aiService.getActiveProvider(),
      aiModel: aiService.getActiveModel(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/papers/:id/summary — generate AI structured summary
exports.generateSummary = async (req, res) => {
  try {
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    if (paper.status !== 'COMPLETED' || !paper.extractedText || !paper.extractedText.trim()) {
      return res.status(400).json({ error: 'Paper has no extractable text to summarize' });
    }

    try {
      const { analysis, aiResult } = await generateAndPersistSummary(paper._id, paper.projectId, paper.extractedText.trim());
      const usedModel = analysis.structuredSummary?.model || aiService.getActiveModel();
      const usedProvider = aiResult?.provider || (usedModel?.toLowerCase().includes('gemini') ? 'gemini' : (usedModel?.toLowerCase().includes('llama') || usedModel?.toLowerCase().includes('groq') ? 'groq' : aiService.getActiveProvider()));

      res.status(200).json({
        message: 'Summary generated successfully',
        paperId: paper._id,
        structuredSummary: analysis.structuredSummary,
        summaryStatus: analysis.summaryStatus,
        aiProvider: usedProvider,
        aiModel: usedModel,
        fallbackUsed: aiResult?.fallbackUsed || false,
      });
    } catch (err) {
      const statusCode = err.status || (err instanceof aiService.AIConfigurationError ? 503 : 502);
      return res.status(statusCode).json({
        error: err.message || 'Failed to generate summary',
        summaryStatus: 'FAILED',
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/papers/:id/summary — get AI structured summary for a paper
exports.getSummary = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const analysis = await PaperAnalysis.findOne({ paperId: paper._id });
    if (!analysis) {
      return res.status(200).json({
        paperId: paper._id,
        title: getCleanPaperTitle(paper),
        structuredSummary: null,
        summaryStatus: 'NOT_STARTED',
        summaryError: null,
      });
    }

    const usedModel = analysis.structuredSummary?.model;
    const inferredProvider = usedModel
      ? (usedModel.toLowerCase().includes('gemini') ? 'gemini' : (usedModel.toLowerCase().includes('llama') || usedModel.toLowerCase().includes('groq') ? 'groq' : aiService.getActiveProvider()))
      : aiService.getActiveProvider();

    res.status(200).json({
      paperId: paper._id,
      title: getCleanPaperTitle(paper),
      structuredSummary: analysis.structuredSummary || null,
      summaryStatus: analysis.summaryStatus || 'NOT_STARTED',
      summaryError: analysis.summaryError || null,
      aiProvider: inferredProvider,
      aiModel: usedModel || aiService.getActiveModel(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/papers/:id — update paper metadata (publicationYear, title, authors)
exports.updatePaper = async (req, res) => {
  try {
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const updates = {};
    if (req.body.title !== undefined && typeof req.body.title === 'string' && req.body.title.trim()) {
      updates.title = req.body.title.trim();
    }
    if (req.body.authors !== undefined && Array.isArray(req.body.authors)) {
      updates.authors = req.body.authors.filter(a => a && typeof a === 'string' && a.trim());
    }
    if (req.body.publicationYear !== undefined) {
      const yr = req.body.publicationYear;
      if (yr === null || yr === '' || yr === 'null') {
        updates.publicationYear = null;
      } else {
        const num = parseInt(yr, 10);
        if (isNaN(num) || num < 1900 || num > 2100) {
          return res.status(400).json({ error: 'Publication year must be an integer between 1900 and 2100' });
        }
        updates.publicationYear = num;
      }
    }

    const updated = await Paper.findByIdAndUpdate(paper._id, updates, { new: true });
    res.status(200).json({
      id: updated._id,
      title: getCleanPaperTitle(updated),
      authors: updated.authors,
      publicationYear: updated.publicationYear,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error updating paper' });
  }
};

// DELETE /api/papers/:id — delete paper and associated analysis
exports.deletePaper = async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const project = await Project.findById(paper.projectId);
    if (!project || project.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this paper' });
    }

    const paperId = paper._id;
    const projectId = paper.projectId;

    // 1. Delete associated PaperAnalysis
    await PaperAnalysis.deleteMany({ paperId });

    // 2. Delete Paper record
    await Paper.findByIdAndDelete(paperId);

    // 3. Safely unlink stored PDF file
    if (paper.storedFilename) {
      const uploadDir = process.env.UPLOAD_DIR
        ? (path.isAbsolute(process.env.UPLOAD_DIR) ? process.env.UPLOAD_DIR : path.resolve(path.join(__dirname, '..', '..', '..', process.env.UPLOAD_DIR)))
        : UPLOAD_DIR;
      const filePath = path.join(uploadDir, paper.storedFilename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.warn('Could not remove file for deleted paper', paperId, ':', fileErr.message);
        }
      }
    }

    // 4. Safely clean up references in SimilarityResult, GapResult, and Recommendation
    try {
      await SimilarityResult.updateMany(
        { projectId },
        { $pull: { similarPapers: { paperId } } }
      );
    } catch (_) {}

    try {
      await GapResult.updateMany(
        { projectId },
        { $pull: { supportingPapers: { paperId } } }
      );
    } catch (_) {}

    try {
      await Recommendation.updateMany(
        { projectId },
        { $pull: { supportingPapers: { paperId }, evidenceExcerpts: { paperId } } }
      );
    } catch (_) {}

    // 5. Invalidate / clean up cache if no papers remain in project
    try {
      const remainingPapers = await Paper.find({ projectId });
      if (remainingPapers.length === 0) {
        await TrendResult.deleteMany({ projectId });
      }
    } catch (_) {}

    // 6. Trigger background gap analysis update for affected project
    try {
      const { runGapAnalysisForProject } = require('../services/gapAnalysisService');
      runGapAnalysisForProject(projectId).catch(() => {});
    } catch (_) {}

    res.status(200).json({
      success: true,
      message: 'Paper deleted successfully',
      id: paperId,
      projectId,
    });
  } catch (err) {
    console.error('Delete paper error:', err);
    res.status(500).json({ error: 'Server error deleting paper' });
  }
};

// POST /api/papers/:id/reprocess — re-extract keywords from extractedText for COMPLETED paper
exports.reprocessPaper = async (req, res) => {
  try {
    const paper = await getOwnedPaper(req.params.id, req.user.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    if (paper.status !== 'COMPLETED' || !paper.extractedText || !paper.extractedText.trim()) {
      return res.status(400).json({ error: 'Paper has no extracted text to reprocess' });
    }

    const analysis = await extractAndPersistKeywords(paper._id, paper.projectId, paper.extractedText.trim());

    res.status(200).json({
      success: true,
      message: 'Paper reprocessed successfully',
      id: paper._id,
      totalKeywords: analysis?.extractedKeywords?.length || 0,
      extractedKeywords: analysis?.extractedKeywords || [],
    });
  } catch (err) {
    console.error('Reprocess paper error:', err);
    res.status(500).json({ error: 'Server error reprocessing paper' });
  }
};

exports.extractAndPersistKeywords = extractAndPersistKeywords;
exports.generateAndPersistSummary = generateAndPersistSummary;


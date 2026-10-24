const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Paper = require('../models/Paper');
const PlagiarismScan = require('../models/PlagiarismScan');
const { runPlagiarismScan } = require('../services/plagiarismService');

// Helper to resolve a group of papers (existing DB papers + uploaded files)
async function resolvePaperGroup({ idsInput, uploadedFiles, projectId }) {
  let requestedIds = [];
  if (idsInput) {
    if (Array.isArray(idsInput)) {
      requestedIds = idsInput;
    } else if (typeof idsInput === 'string') {
      try {
        const parsed = JSON.parse(idsInput);
        requestedIds = Array.isArray(parsed) ? parsed : [idsInput];
      } catch (_) {
        requestedIds = idsInput.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  requestedIds = [...new Set(requestedIds)];

  const papersList = [];
  const seenKeys = new Set();

  for (const pId of requestedIds) {
    if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
      return { error: `Paper ${pId} not found or not accessible in this project`, statusCode: 400 };
    }
    const p = await Paper.findById(pId);
    if (!p || p.projectId.toString() !== projectId) {
      return { error: `Paper ${pId} not found or not accessible in this project`, statusCode: 400 };
    }
    const title = p.title || p.originalFilename || 'Untitled Paper';
    const key = title.trim().toLowerCase();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      papersList.push({
        id: p._id.toString(),
        title,
        filename: p.storedFilename || p.originalFilename,
        originalFilename: p.originalFilename,
        isUploaded: false,
      });
    }
  }

  for (const f of uploadedFiles || []) {
    const title = path.basename(f.originalname, path.extname(f.originalname));
    const key = title.trim().toLowerCase();
    if (seenKeys.has(key)) {
      try {
        if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      } catch (_) {}
      continue;
    }
    seenKeys.add(key);
    papersList.push({
      id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      filename: f.filename || f.originalname,
      originalFilename: f.originalname,
      isUploaded: true,
    });
  }

  return { papersList };
}

// Start a new plagiarism scan
exports.startScan = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = (req.user?.id || req.user?._id || req.user?.userId || '').toString();

    const {
      // Two-Group Parameters (Paper 1 & Paper 2)
      paper1Id,
      paper1Ids,
      group1PaperIds,
      paper2Id,
      paper2Ids,
      group2PaperIds,
      // Legacy Parameters
      paperId,
      paperIds,
      excludeQuotes = 'true',
      excludeReferences = 'true',
      comparisonScope = 'PROJECT_CORPUS',
    } = req.body;

    const hasCustomPairs = Boolean(req.body.selectedPairs || req.body.customPairs);

    const isTwoGroupMode = !hasCustomPairs && Boolean(
      paper1Id ||
        paper1Ids ||
        group1PaperIds ||
        req.body['paper1Ids[]'] ||
        req.files?.paper1Pdfs?.length ||
        req.files?.group1Pdfs?.length ||
        req.files?.paper1Pdf?.length ||
        paper2Id ||
        paper2Ids ||
        group2PaperIds ||
        req.body['paper2Ids[]'] ||
        req.files?.paper2Pdfs?.length ||
        req.files?.group2Pdfs?.length ||
        req.files?.paper2Pdf?.length
    );

    if (isTwoGroupMode) {
      // 1. Resolve Paper 1 Group
      const group1Files = [];
      if (req.files) {
        if (Array.isArray(req.files.paper1Pdfs)) group1Files.push(...req.files.paper1Pdfs);
        if (Array.isArray(req.files.group1Pdfs)) group1Files.push(...req.files.group1Pdfs);
        if (Array.isArray(req.files.paper1Pdf)) group1Files.push(...req.files.paper1Pdf);
      }
      const res1 = await resolvePaperGroup({
        idsInput: paper1Ids || group1PaperIds || paper1Id || req.body['paper1Ids[]'],
        uploadedFiles: group1Files,
        projectId,
      });
      if (res1.error) {
        return res.status(res1.statusCode).json({ error: res1.error });
      }
      const paper1List = res1.papersList;

      // 2. Resolve Paper 2 Group
      const group2Files = [];
      if (req.files) {
        if (Array.isArray(req.files.paper2Pdfs)) group2Files.push(...req.files.paper2Pdfs);
        if (Array.isArray(req.files.group2Pdfs)) group2Files.push(...req.files.group2Pdfs);
        if (Array.isArray(req.files.paper2Pdf)) group2Files.push(...req.files.paper2Pdf);
      }
      const res2 = await resolvePaperGroup({
        idsInput: paper2Ids || group2PaperIds || paper2Id || req.body['paper2Ids[]'],
        uploadedFiles: group2Files,
        projectId,
      });
      if (res2.error) {
        return res.status(res2.statusCode).json({ error: res2.error });
      }
      const paper2List = res2.papersList;

      // Validate at least 1 in each input
      if (paper1List.length === 0) {
        return res.status(400).json({ error: 'Please select or upload at least one valid paper for Paper 1.' });
      }
      if (paper2List.length === 0) {
        return res.status(400).json({ error: 'Please select or upload at least one valid paper for Paper 2.' });
      }

      // Max limit per group
      if (paper1List.length > 10 || paper2List.length > 10) {
        return res.status(400).json({ error: 'A maximum of 10 papers per input can be compared in a single scan.' });
      }

      // Calculate valid cross-group pairs (excluding self-matches)
      let validPairsCount = 0;
      const skippedSelfList = [];
      for (const p1 of paper1List) {
        for (const p2 of paper2List) {
          const isSame =
            (p1.id && p2.id && p1.id === p2.id) ||
            ((p1.title || '').trim().toLowerCase() === (p2.title || '').trim().toLowerCase());
          if (isSame) {
            skippedSelfList.push(p1.title);
          } else {
            validPairsCount++;
          }
        }
      }

      if (validPairsCount === 0) {
        return res.status(400).json({
          error: 'Paper 1 and Paper 2 contain the same document. Please select different papers to compare.',
        });
      }

      const paperTitle =
        paper1List.length === 1 && paper2List.length === 1
          ? `${paper1List[0].title} vs ${paper2List[0].title}`
          : `Paper 1 (${paper1List.length}) vs Paper 2 (${paper2List.length})`;
      const originalFilename = `${paper1List[0].filename} vs ${paper2List[0].filename}`;

      // Create PlagiarismScan record
      const scan = new PlagiarismScan({
        projectId,
        userId,
        comparisonMode: 'TWO_GROUP',
        paper1Group: paper1List,
        paper2Group: paper2List,
        selectedPapers: [...paper1List, ...paper2List],
        totalSelectedPapers: paper1List.length + paper2List.length,
        totalComparisonsExpected: validPairsCount,
        totalComparisonsCompleted: 0,
        paperTitle,
        originalFilename,
        comparisonScope: 'PROJECT_CORPUS',
        status: 'QUEUED',
        progress: 5,
        currentStage: 'Waiting',
        exclusions: {
          excludeQuotes: String(excludeQuotes) === 'true',
          excludeReferences: String(excludeReferences) === 'true',
        },
      });

      await scan.save();

      setImmediate(() => {
        runPlagiarismScan(scan._id).catch((err) => {
          console.error('Two-group plagiarism worker failed for scan', scan._id, ':', err);
        });
      });

      return res.status(201).json({
        success: true,
        scanId: scan._id,
        scan: {
          id: scan._id,
          _id: scan._id,
          status: scan.status,
          comparisonMode: 'TWO_GROUP',
          paper1Group: paper1List,
          paper2Group: paper2List,
          paper1Count: paper1List.length,
          paper2Count: paper2List.length,
          totalComparisonsExpected: validPairsCount,
        },
        status: scan.status,
        message: 'Two-paper plagiarism scan started successfully',
        comparisonMode: 'TWO_GROUP',
        paper1Count: paper1List.length,
        paper2Count: paper2List.length,
        totalComparisonsExpected: validPairsCount,
        skippedSelfMatches: skippedSelfList,
      });
    }

    // --- Multiple Paper Selection & Custom Comparison Workflow ---
    let requestedPaperIds = [];
    if (paperIds) {
      if (Array.isArray(paperIds)) {
        requestedPaperIds = paperIds;
      } else if (typeof paperIds === 'string') {
        try {
          const parsed = JSON.parse(paperIds);
          requestedPaperIds = Array.isArray(parsed) ? parsed : [paperIds];
        } catch (_) {
          requestedPaperIds = paperIds.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    } else if (req.body['paperIds[]']) {
      const arr = req.body['paperIds[]'];
      requestedPaperIds = Array.isArray(arr) ? arr : [arr];
    } else if (paperId) {
      requestedPaperIds = [paperId];
    }

    requestedPaperIds = [...new Set(requestedPaperIds)];

    let uploadedFilesCount = 0;
    if (req.files) {
      if (Array.isArray(req.files.pdfs)) uploadedFilesCount += req.files.pdfs.length;
      if (Array.isArray(req.files.files)) uploadedFilesCount += req.files.files.length;
      if (Array.isArray(req.files.uploadedFiles)) uploadedFilesCount += req.files.uploadedFiles.length;
      if (Array.isArray(req.files.pdf)) uploadedFilesCount += req.files.pdf.length;
    } else if (req.file) {
      uploadedFilesCount += 1;
    }

    if (requestedPaperIds.length + uploadedFilesCount > 10) {
      return res.status(400).json({
        error: 'A maximum of 10 papers can be compared in a single scan.',
      });
    }

    const selectedPapersList = [];
    const seenPaperKeys = new Set();

    for (const pId of requestedPaperIds) {
      if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
        return res.status(400).json({ error: `Paper ${pId} not found or not accessible in this project` });
      }
      const p = await Paper.findById(pId);
      if (!p || p.projectId.toString() !== projectId) {
        return res.status(400).json({ error: `Paper ${pId} not found or not accessible in this project` });
      }
      const title = p.title || p.originalFilename || 'Untitled Paper';
      const key = title.trim().toLowerCase();
      if (!seenPaperKeys.has(key)) {
        seenPaperKeys.add(key);
        selectedPapersList.push({
          id: p._id.toString(),
          title,
          filename: p.storedFilename || p.originalFilename,
          originalFilename: p.originalFilename,
          isUploaded: false,
        });
      }
    }

    let uploadedFiles = [];
    if (req.files) {
      if (Array.isArray(req.files.pdfs)) uploadedFiles.push(...req.files.pdfs);
      if (Array.isArray(req.files.files)) uploadedFiles.push(...req.files.files);
      if (Array.isArray(req.files.uploadedFiles)) uploadedFiles.push(...req.files.uploadedFiles);
      if (Array.isArray(req.files.pdf)) uploadedFiles.push(...req.files.pdf);
    } else if (req.file) {
      uploadedFiles.push(req.file);
    }

    for (const f of uploadedFiles) {
      const title = path.basename(f.originalname, path.extname(f.originalname));
      const key = title.trim().toLowerCase();
      if (seenPaperKeys.has(key)) {
        try {
          if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (_) {}
        continue;
      }
      seenPaperKeys.add(key);
      selectedPapersList.push({
        id: f.filename || `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        filename: f.filename || f.originalname,
        originalFilename: f.originalname,
        isUploaded: true,
      });
    }

    if (selectedPapersList.length === 0) {
      return res.status(400).json({ error: 'Please select existing papers or upload PDF files to compare.' });
    }

    if (selectedPapersList.length > 10) {
      return res.status(400).json({
        error: 'A maximum of 10 papers can be compared in a single scan.',
      });
    }

    // Helper to find a paper from selectedPapersList by ID, filename, or title
    const findPaper = (ref) => {
      if (!ref) return null;
      const refStr = String(ref).trim().toLowerCase();
      return (
        selectedPapersList.find((p) => p.id === ref || p.id.toLowerCase() === refStr) ||
        selectedPapersList.find((p) => (p.title || '').trim().toLowerCase() === refStr) ||
        selectedPapersList.find((p) => (p.originalFilename || '').trim().toLowerCase() === refStr) ||
        selectedPapersList.find((p) => (p.filename || '').trim().toLowerCase() === refStr)
      );
    };

    // 3. Resolve Custom Comparison Pairs
    let resolvedPairs = [];
    if (hasCustomPairs) {
      let rawPairs = [];
      try {
        const pInput = req.body.selectedPairs || req.body.customPairs;
        rawPairs = typeof pInput === 'string' ? JSON.parse(pInput) : pInput;
        if (!Array.isArray(rawPairs)) rawPairs = [];
      } catch (_) {
        rawPairs = [];
      }

      const seenPairKeys = new Set();
      for (const raw of rawPairs) {
        const refA = raw.paperAId || raw.paperA || (Array.isArray(raw) ? raw[0] : null);
        const refB = raw.paperBId || raw.paperB || (Array.isArray(raw) ? raw[1] : null);
        const pA = findPaper(refA);
        const pB = findPaper(refB);

        if (!pA || !pB) continue;

        // Skip self-comparison
        const isSame =
          pA.id === pB.id ||
          pA.title.trim().toLowerCase() === pB.title.trim().toLowerCase();
        if (isSame) continue;

        // Deduplicate pairs (order-independent)
        const pairKey = [pA.id, pB.id].sort().join('___');
        if (seenPairKeys.has(pairKey)) continue;
        seenPairKeys.add(pairKey);

        resolvedPairs.push({
          pairId: raw.pairId || `pair_${resolvedPairs.length + 1}`,
          paperAId: pA.id,
          paperBId: pB.id,
          paperATitle: pA.title,
          paperBTitle: pB.title,
          paperAFilename: pA.filename,
          paperBFilename: pB.filename,
        });
      }

      if (resolvedPairs.length === 0) {
        return res.status(400).json({
          error: 'Please select at least one valid comparison pair to scan.',
        });
      }

      if (resolvedPairs.length > 20) {
        return res.status(400).json({
          error: 'A maximum of 20 comparisons can be scanned at once. Please reduce your selected comparisons.',
        });
      }
    } else if (selectedPapersList.length >= 2) {
      // Default pairwise: all unique combinations
      for (let i = 0; i < selectedPapersList.length - 1; i++) {
        for (let j = i + 1; j < selectedPapersList.length; j++) {
          resolvedPairs.push({
            pairId: `pair_${resolvedPairs.length + 1}`,
            paperAId: selectedPapersList[i].id,
            paperBId: selectedPapersList[j].id,
            paperATitle: selectedPapersList[i].title,
            paperBTitle: selectedPapersList[j].title,
            paperAFilename: selectedPapersList[i].filename,
            paperBFilename: selectedPapersList[j].filename,
          });
        }
      }
    }

    const isExplicitMulti =
      (paperIds != null && requestedPaperIds.length > 0) ||
      uploadedFiles.length > 1 ||
      (requestedPaperIds.length > 0 && uploadedFiles.length > 0) ||
      hasCustomPairs;

    if (isExplicitMulti && selectedPapersList.length < 2) {
      return res.status(400).json({ error: 'Please select at least 2 distinct papers to compare.' });
    }

    const isPairwise = resolvedPairs.length > 0;
    const totalComparisonsExpected = isPairwise ? resolvedPairs.length : 1;

    const paperTitle = isPairwise
      ? `${selectedPapersList.length} Papers (${totalComparisonsExpected} Comparison${totalComparisonsExpected === 1 ? '' : 's'})`
      : selectedPapersList[0].title;
    const originalFilename = isPairwise
      ? `${resolvedPairs[0]?.paperAFilename || 'doc'} vs ${resolvedPairs[0]?.paperBFilename || 'doc'}`
      : (selectedPapersList[0].filename || selectedPapersList[0].originalFilename);

    const activeScan = await PlagiarismScan.findOne({
      projectId,
      paperTitle,
      status: { $in: ['QUEUED', 'EXTRACTING', 'COMPARING', 'VERIFYING'] },
    });

    if (activeScan) {
      return res.status(409).json({
        error: 'A scan is already in progress for this document.',
        scanId: activeScan._id,
        status: activeScan.status,
      });
    }

    const scan = new PlagiarismScan({
      projectId,
      userId,
      comparisonMode: hasCustomPairs ? 'CUSTOM_PAIRS' : (isPairwise ? 'PAIRWISE' : 'PROJECT_CORPUS'),
      submittedPaperId: !isPairwise && !selectedPapersList[0].isUploaded ? selectedPapersList[0].id : null,
      paperTitle,
      originalFilename,
      comparisonScope: comparisonScope === 'EXTERNAL_SOURCES' ? 'EXTERNAL_SOURCES' : 'PROJECT_CORPUS',
      status: 'QUEUED',
      progress: 5,
      currentStage: 'Waiting',
      selectedPapers: selectedPapersList,
      selectedPairs: resolvedPairs,
      totalSelectedPapers: selectedPapersList.length,
      totalComparisonsExpected,
      totalComparisonsCompleted: 0,
      exclusions: {
        excludeQuotes: String(excludeQuotes) === 'true',
        excludeReferences: String(excludeReferences) === 'true',
      },
    });

    await scan.save();

    setImmediate(() => {
      runPlagiarismScan(scan._id).catch((err) => {
        console.error('Plagiarism worker failed for scan', scan._id, ':', err);
      });
    });

    res.status(201).json({
      success: true,
      scanId: scan._id,
      scan: {
        id: scan._id,
        _id: scan._id,
        status: scan.status,
        comparisonMode: scan.comparisonMode,
        totalSelectedPapers: selectedPapersList.length,
        totalComparisonsExpected,
        selectedPapers: scan.selectedPapers,
        selectedPairs: scan.selectedPairs,
      },
      status: scan.status,
      message: 'Plagiarism scan started successfully',
      comparisonMode: scan.comparisonMode,
      paperTitle,
      comparisonScope: scan.comparisonScope,
      totalSelectedPapers: selectedPapersList.length,
      totalComparisonsExpected,
      selectedPapers: scan.selectedPapers,
      selectedPairs: scan.selectedPairs,
    });
  } catch (err) {
    console.error('startScan error:', err);
    res.status(500).json({ error: 'Server error initiating plagiarism scan' });
  }
};

// Get scan progress and status
exports.getScanStatus = async (req, res) => {
  try {
    const scan = await PlagiarismScan.findOne({
      _id: req.params.scanId,
      projectId: req.params.id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Plagiarism scan record not found' });
    }

    res.status(200).json({
      id: scan._id,
      status: scan.status,
      comparisonMode: scan.comparisonMode,
      selectedPairs: scan.selectedPairs || [],
      paper1Group: scan.paper1Group || [],
      paper2Group: scan.paper2Group || [],
      progress: scan.progress,
      currentStage: scan.currentStage,
      error: scan.error,
      paperTitle: scan.paperTitle,
      matchPercentage: scan.matchPercentage,
      totalSelectedPapers: scan.totalSelectedPapers,
      totalComparisonsExpected: scan.totalComparisonsExpected,
      totalComparisonsCompleted: scan.totalComparisonsCompleted,
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
    });
  } catch (err) {
    console.error('getScanStatus error:', err);
    res.status(500).json({ error: 'Server error fetching scan status' });
  }
};

// Get full scan results
exports.getScanResults = async (req, res) => {
  try {
    const scan = await PlagiarismScan.findOne({
      _id: req.params.scanId,
      projectId: req.params.id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Plagiarism scan record not found' });
    }

    res.status(200).json({
      id: scan._id,
      projectId: scan.projectId,
      paperTitle: scan.paperTitle,
      originalFilename: scan.originalFilename,
      comparisonMode: scan.comparisonMode,
      paper1Group: scan.paper1Group || [],
      paper2Group: scan.paper2Group || [],
      comparisonScope: scan.comparisonScope,
      status: scan.status,
      progress: scan.progress,
      currentStage: scan.currentStage,
      error: scan.error,
      selectedPapers: scan.selectedPapers || [],
      selectedPairs: scan.selectedPairs || [],
      totalSelectedPapers: scan.totalSelectedPapers || 0,
      totalComparisonsExpected: scan.totalComparisonsExpected || 0,
      totalComparisonsCompleted: scan.totalComparisonsCompleted || 0,
      pairwiseComparisons: scan.pairwiseComparisons || [],
      totalSubmittedTokens: scan.totalSubmittedTokens,
      matchedTokens: scan.matchedTokens,
      matchPercentage: scan.matchPercentage,
      distinctSourceCount: scan.distinctSourceCount,
      matchingPassageCount: scan.matchingPassageCount,
      exclusions: scan.exclusions,
      matchingPassages: scan.matchingPassages,
      candidateSources: scan.candidateSources,
      comparisonSummary: scan.comparisonSummary,
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
    });
  } catch (err) {
    console.error('getScanResults error:', err);
    res.status(500).json({ error: 'Server error fetching scan results' });
  }
};

// List all past scans for this project
exports.listScans = async (req, res) => {
  try {
    const scans = await PlagiarismScan.find({
      projectId: req.params.id,
    })
      .select('paperTitle originalFilename comparisonScope status progress matchPercentage distinctSourceCount matchingPassageCount currentStage error createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      scans: scans.map(s => ({
        id: s._id,
        paperTitle: s.paperTitle,
        originalFilename: s.originalFilename,
        comparisonScope: s.comparisonScope,
        status: s.status,
        progress: s.progress,
        matchPercentage: s.matchPercentage,
        distinctSourceCount: s.distinctSourceCount,
        matchingPassageCount: s.matchingPassageCount,
        currentStage: s.currentStage,
        error: s.error,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('listScans error:', err);
    res.status(500).json({ error: 'Server error listing plagiarism scans' });
  }
};

// Delete a scan record
exports.deleteScan = async (req, res) => {
  try {
    const scan = await PlagiarismScan.findOneAndDelete({
      _id: req.params.scanId,
      projectId: req.params.id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Plagiarism scan record not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Plagiarism scan deleted successfully',
      scanId: scan._id,
    });
  } catch (err) {
    console.error('deleteScan error:', err);
    res.status(500).json({ error: 'Server error deleting scan' });
  }
};

// Cancel an ongoing scan
exports.cancelScan = async (req, res) => {
  try {
    const scan = await PlagiarismScan.findOne({
      _id: req.params.scanId,
      projectId: req.params.id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Plagiarism scan record not found' });
    }

    if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
      return res.status(400).json({ error: 'Cannot cancel a completed or failed scan' });
    }

    scan.status = 'CANCELLED';
    scan.currentStage = 'Scan cancelled by user';
    scan.progress = 100;
    await scan.save();

    res.status(200).json({
      success: true,
      message: 'Plagiarism scan cancelled successfully',
      scanId: scan._id,
    });
  } catch (err) {
    console.error('cancelScan error:', err);
    res.status(500).json({ error: 'Server error cancelling scan' });
  }
};

// Summary card metrics for the main Analysis Dashboard
exports.getPlagiarismSummary = async (req, res) => {
  try {
    const projectId = req.params.id;

    // Count genuinely completed scans (ignore incomplete/failed)
    const completedScansCount = await PlagiarismScan.countDocuments({
      projectId,
      status: 'COMPLETED',
    });

    // Latest scan
    const latestScan = await PlagiarismScan.findOne({
      projectId,
      status: 'COMPLETED',
    })
      .sort({ createdAt: -1 })
      .select('paperTitle matchPercentage createdAt status distinctSourceCount');

    // Recent 5 scans
    const recentScans = await PlagiarismScan.find({
      projectId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('paperTitle matchPercentage status createdAt');

    res.status(200).json({
      totalCompletedScans: completedScansCount,
      latestScan: latestScan ? {
        id: latestScan._id,
        paperTitle: latestScan.paperTitle,
        matchPercentage: latestScan.matchPercentage,
        distinctSourceCount: latestScan.distinctSourceCount,
        date: latestScan.createdAt,
        status: latestScan.status,
      } : null,
      recentScans: recentScans.map(s => ({
        id: s._id,
        paperTitle: s.paperTitle,
        matchPercentage: s.matchPercentage,
        status: s.status,
        date: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('getPlagiarismSummary error:', err);
    res.status(500).json({ error: 'Server error fetching plagiarism summary' });
  }
};

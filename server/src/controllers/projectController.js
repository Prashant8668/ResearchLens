const Project = require('../models/Project');
const Paper = require('../models/Paper');
const PaperAnalysis = require('../models/PaperAnalysis');
const SimilarityResult = require('../models/SimilarityResult');
const TrendResult = require('../models/TrendResult');
const GapResult = require('../models/GapResult');
const Recommendation = require('../models/Recommendation');
const aiService = require('../services/aiService');
const axios = require('axios');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

// Helper to check ownership
const enforceOwnership = (project, userId) => {
  if (!project) return false;
  return project.userId.toString() === userId.toString();
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createProject = [
  body('name').notEmpty().withMessage('Project name is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
      const project = new Project({
        ...req.body,
        userId: req.user.id // Force ownership to the authenticated user
      });
      const saved = await project.save();
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Generic middleware-like function to protect sub-routes
exports.enforceProjectOwnership = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addPaper = async (req, res) => {
  res.status(201).json({ message: "Paper added placeholder", projectId: req.params.id });
};

exports.analyzeProject = async (req, res) => {
  res.status(200).json({ message: "Analysis started placeholder" });
};

exports.getSimilarity = async (req, res) => {
  res.status(200).json({ message: "Similarity check placeholder" });
};

exports.getTrends = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    // 1. Fetch all papers for this project
    const allPapers = await Paper.find({ projectId: project._id });
    const eligiblePapers = allPapers.filter(
      p => p.status === 'COMPLETED' && p.extractedText && p.extractedText.trim().length > 0
    );

    // 2. Fetch or backfill PaperAnalysis for all eligible papers
    let analyses = await PaperAnalysis.find({ projectId: project._id });
    const analyzedPaperIds = new Set(analyses.map(a => a.paperId.toString()));
    const missingPapers = eligiblePapers.filter(p => !analyzedPaperIds.has(p._id.toString()));

    if (missingPapers.length > 0) {
      const { extractAndPersistKeywords } = require('./paperController');
      await Promise.all(
        missingPapers.map(p => extractAndPersistKeywords(p._id, project._id, p.extractedText.trim()))
      );
      analyses = await PaperAnalysis.find({ projectId: project._id });
    }

    // 3. Map analyses by paperId
    const analysisByPaperId = {};
    for (const a of analyses) {
      analysisByPaperId[a.paperId.toString()] = a;
    }

    // 4. Inspect publication years
    const papersWithValidYear = [];
    const papersMissingYear = [];

    for (const p of eligiblePapers) {
      const year = p.publicationYear;
      if (typeof year === 'number' && !isNaN(year) && year >= 1900 && year <= 2100) {
        papersWithValidYear.push(p);
      } else {
        papersMissingYear.push(p);
      }
    }

    const distinctYears = Array.from(new Set(papersWithValidYear.map(p => p.publicationYear))).sort((a, b) => a - b);
    const hasSufficientHistoricalData = distinctYears.length >= 2;

    // 5. Collect all author name tokens from all project papers to exclude from topic keywords
    const authorTokens = new Set();
    for (const p of allPapers) {
      if (Array.isArray(p.authors)) {
        for (const author of p.authors) {
          if (typeof author === 'string') {
            const parts = author.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
            for (const part of parts) {
              if (part.length >= 3 && !['anonymous', 'unknown'].includes(part)) {
                authorTokens.add(part);
              }
            }
          }
        }
      }
    }

    // Common PDF administrative, journal boilerplate and non-topical structural tokens
    const ADMINISTRATIVE_STOP_WORDS = new Set([
      'department', 'laboratory', 'practical', 'report', 'viva', 'roll', 'semester',
      'submission', 'faculty', 'student', 'journal', 'author', 'authors', 'editor',
      'page', 'pages', 'doi', 'isbn', 'issn', 'vol', 'volume', 'issue', 'abstract',
      'introduction', 'conclusion', 'references', 'university', 'college', 'institution',
      'http', 'https', 'www', 'com', 'org', 'edu', 'sign', 'marks', 'syllabus',
      'acknowledgement', 'academic', 'curriculum', 'diploma', 'pursuing'
    ]);

    // Generic meta-research and writing process tokens (not research topics)
    const GENERIC_RESEARCH_TERMS = new Set([
      'study', 'studies', 'topic', 'topics', 'gap', 'gaps', 'paper', 'papers',
      'research', 'finding', 'findings', 'article', 'articles', 'field', 'area',
      'overview', 'discussion', 'methodology', 'approach', 'review'
    ]);

    // Term normalization helper: maps plurals to root singular form
    const normalizeTerm = (raw) => {
      if (!raw || typeof raw !== 'string') return '';
      let term = raw.toLowerCase().trim();
      if (term.length <= 3) return term;

      if (term.endsWith('s') && !term.endsWith('ss') && !term.endsWith('us') && !term.endsWith('is')) {
        if (term.endsWith('ies') && term.length > 5) {
          term = term.slice(0, -3) + 'y';
        } else if (term.endsWith('sses')) {
          term = term.slice(0, -2);
        } else if (term.endsWith('es') && (term.endsWith('shes') || term.endsWith('ches') || term.endsWith('xes'))) {
          term = term.slice(0, -2);
        } else if (!term.endsWith('es') || term === 'sales' || term === 'games' || term === 'names') {
          term = term.slice(0, -1);
        }
      }
      return term;
    };

    // Real occurrence counter in paper extractedText using word boundaries
    const countOccurrencesInText = (text, term) => {
      if (!text || !term) return 0;
      try {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('\\b' + escaped + '(s|es)?\\b', 'gi');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
      } catch (e) {
        return 0;
      }
    };

    // 6. Aggregate keyword occurrences across all eligible papers
    const termStats = {};

    for (const p of eligiblePapers) {
      const pIdStr = p._id.toString();
      const analysis = analysisByPaperId[pIdStr];
      const pYear = (typeof p.publicationYear === 'number' && p.publicationYear >= 1900 && p.publicationYear <= 2100) ? p.publicationYear : null;
      const seenInThisPaper = new Set();

      if (analysis && Array.isArray(analysis.extractedKeywords)) {
        for (const kw of analysis.extractedKeywords) {
          if (!kw || !kw.term) continue;
          const rawTerm = kw.term.toLowerCase().trim();
          const term = normalizeTerm(rawTerm);
          if (!term || term.length < 3) continue;

          // Filter out author names, administrative noise, and generic meta-research terms
          if (authorTokens.has(rawTerm) || authorTokens.has(term)) continue;
          if (ADMINISTRATIVE_STOP_WORDS.has(rawTerm) || ADMINISTRATIVE_STOP_WORDS.has(term)) continue;
          if (GENERIC_RESEARCH_TERMS.has(rawTerm) || GENERIC_RESEARCH_TERMS.has(term)) continue;

          if (!termStats[term]) {
            termStats[term] = {
              term,
              totalScore: 0,
              paperCount: 0,
              occurrenceCount: 0,
              yearlyCounts: {}, // distinct papers containing keyword in that year
              yearlyOccurrences: {}, // raw occurrences in text in that year
              yearlyScores: {},
              papers: [] // list of paper details containing this keyword
            };
          }

          if (!seenInThisPaper.has(term)) {
            seenInThisPaper.add(term);
            termStats[term].paperCount += 1;
            termStats[term].totalScore += (kw.score || 0);

            const occurrencesInThisPaper = countOccurrencesInText(p.extractedText, term) || 1;
            termStats[term].occurrenceCount += occurrencesInThisPaper;

            termStats[term].papers.push({
              paperId: p._id,
              title: p.title || p.originalFilename,
              originalFilename: p.originalFilename,
              publicationYear: pYear,
              authors: Array.isArray(p.authors) ? p.authors : [],
              occurrencesInPaper: occurrencesInThisPaper,
              score: Math.round((kw.score || 0) * 1000) / 1000
            });

            if (pYear) {
              termStats[term].yearlyCounts[pYear] = (termStats[term].yearlyCounts[pYear] || 0) + 1;
              termStats[term].yearlyOccurrences[pYear] = (termStats[term].yearlyOccurrences[pYear] || 0) + occurrencesInThisPaper;
              termStats[term].yearlyScores[pYear] = (termStats[term].yearlyScores[pYear] || 0) + (kw.score || 0);
            }
          }
        }
      }
    }

    // Sort keywords by paperCount desc, then totalScore desc
    const sortedKeywords = Object.values(termStats).sort((a, b) => {
      if (b.paperCount !== a.paperCount) return b.paperCount - a.paperCount;
      return b.totalScore - a.totalScore;
    });

    const topKeywords = sortedKeywords.slice(0, 30).map((k, idx) => ({
      rank: idx + 1,
      term: k.term,
      paperCount: k.paperCount,
      occurrenceCount: k.occurrenceCount,
      percentage: eligiblePapers.length > 0 ? Math.round((k.paperCount / eligiblePapers.length) * 100) : 0,
      prevalencePercentage: eligiblePapers.length > 0 ? Math.round((k.paperCount / eligiblePapers.length) * 1000) / 10 : 0,
      totalScore: Math.round(k.totalScore * 1000) / 1000,
      papers: k.papers
    }));

    // Yearly timeline data for charts (distinguishing paper counts and occurrences)
    const yearlyTimeline = distinctYears.map(year => {
      const papersInYear = papersWithValidYear.filter(p => p.publicationYear === year);
      const topKwInYear = {}; // Distinct paper counts containing keyword
      const topKwOccurrencesInYear = {}; // Raw occurrence counts in text
      const topKwPrevalenceInYear = {}; // Prevalence % in year
      for (const k of sortedKeywords.slice(0, 10)) {
        const pCount = k.yearlyCounts[year] || 0;
        topKwInYear[k.term] = pCount;
        topKwOccurrencesInYear[k.term] = k.yearlyOccurrences[year] || 0;
        topKwPrevalenceInYear[k.term] = papersInYear.length > 0 ? Math.round((pCount / papersInYear.length) * 100) : 0;
      }
      return {
        year,
        paperCount: papersInYear.length,
        totalPapersInYear: papersInYear.length,
        keywords: topKwInYear,
        keywordOccurrences: topKwOccurrencesInYear,
        keywordPrevalence: topKwPrevalenceInYear
      };
    });

    // Explicit breakdown of papers per observed year
    const observedYearsBreakdown = distinctYears.map(year => ({
      year,
      paperCount: papersWithValidYear.filter(p => p.publicationYear === year).length
    }));

    // 7. Transparent Comparison Periods & Topic Trend Calculation
    let topicsWithTrends = [];
    let generalStatus = 'SUFFICIENT_DATA';
    let dataCoverageMessage = '';
    let comparisonMode = 'NO_DATA';
    let comparisonLabel = 'No comparison available';
    let baselineLabel = 'N/A';
    let recentLabel = 'N/A';
    let baselinePapersCount = 0;
    let recentPapersCount = 0;

    if (eligiblePapers.length === 0) {
      generalStatus = 'NO_PAPERS';
      dataCoverageMessage = 'No processed papers available in this project. Please upload and process research PDFs to view trend analysis.';
    } else if (distinctYears.length === 0) {
      generalStatus = 'ALL_YEARS_MISSING';
      comparisonMode = 'ALL_YEARS_MISSING';
      dataCoverageMessage = `${eligiblePapers.length} paper(s) processed, but none have valid publication years. Multi-year trend analysis requires publication year metadata.`;
      topicsWithTrends = sortedKeywords.slice(0, 20).map(k => ({
        topic: k.term,
        paperCount: k.paperCount,
        occurrenceCount: k.occurrenceCount,
        prevalencePercentage: eligiblePapers.length > 0 ? Math.round((k.paperCount / eligiblePapers.length) * 100) : 0,
        yearlyData: [],
        baselineOccurrences: 0,
        recentOccurrences: 0,
        baselineTopicPapers: 0,
        recentTopicPapers: 0,
        baselineTotalPapers: 0,
        recentTotalPapers: 0,
        baselinePrevalence: 0,
        recentPrevalence: 0,
        percentagePointDiff: 0,
        growthRate: null,
        growthPercentage: null,
        growthTrend: 'N/A',
        status: 'Insufficient Data',
        badge: 'Insufficient Data',
        statusCriteria: 'Missing publication year metadata across project papers prevents longitudinal timeline calculation.',
        insight: `Documented in ${k.paperCount} paper(s), but missing publication years prevent longitudinal timeline calculation.`,
        papers: k.papers
      }));
    } else if (distinctYears.length === 1) {
      const singleYear = distinctYears[0];
      generalStatus = 'SINGLE_YEAR';
      comparisonMode = 'SINGLE_YEAR_SNAPSHOT';
      comparisonLabel = `Snapshot for ${singleYear}`;
      baselineLabel = String(singleYear);
      recentLabel = String(singleYear);
      baselinePapersCount = papersWithValidYear.length;
      recentPapersCount = papersWithValidYear.length;

      if (eligiblePapers.length === 1) {
        dataCoverageMessage = `Analysis is based on 1 uploaded paper (publication year ${singleYear}). Longitudinal trend velocity and emerging topic identification require research papers published across multiple distinct years.`;
      } else {
        dataCoverageMessage = `All ${papersWithValidYear.length} dated paper(s) belong to ${singleYear}${papersMissingYear.length > 0 ? ` (${papersMissingYear.length} paper(s) missing publication year)` : ''}. Trend growth and emergence rates require at least 2 distinct publication years.`;
      }

      topicsWithTrends = sortedKeywords.slice(0, 20).map(k => {
        const pCount = k.yearlyCounts[singleYear] || k.paperCount;
        const prevalence = papersWithValidYear.length > 0 ? Math.round((pCount / papersWithValidYear.length) * 1000) / 10 : 0;
        return {
          topic: k.term,
          paperCount: k.paperCount,
          occurrenceCount: k.occurrenceCount,
          prevalencePercentage: eligiblePapers.length > 0 ? Math.round((k.paperCount / eligiblePapers.length) * 100) : 0,
          yearlyData: [{ year: singleYear, count: pCount }],
          baselineOccurrences: pCount,
          recentOccurrences: pCount,
          baselineTopicPapers: pCount,
          recentTopicPapers: pCount,
          baselineTotalPapers: papersWithValidYear.length,
          recentTotalPapers: papersWithValidYear.length,
          baselinePrevalence: prevalence,
          recentPrevalence: prevalence,
          percentagePointDiff: 0,
          growthRate: null,
          growthPercentage: null,
          growthTrend: 'N/A',
          status: 'Insufficient Data',
          badge: 'Insufficient Data',
          statusCriteria: `Single publication year snapshot (${singleYear}). Longitudinal velocity requires at least 2 distinct publication years.`,
          insight: `Documented in ${k.paperCount} paper(s) in ${singleYear} (${prevalence}% prevalence). No earlier historical baseline available to compute growth velocity.`,
          papers: k.papers
        };
      });
    } else {
      // 2 or more distinct years: define comparison periods transparently!
      generalStatus = 'SUFFICIENT_DATA';

      let baselineYears = [];
      let recentYears = [];

      if (distinctYears.length === 2) {
        comparisonMode = 'DIRECT_YEAR_COMPARISON';
        baselineYears = [distinctYears[0]];
        recentYears = [distinctYears[1]];
        baselineLabel = String(distinctYears[0]);
        recentLabel = String(distinctYears[1]);
        comparisonLabel = `Comparing ${distinctYears[1]} vs ${distinctYears[0]}`;
      } else {
        comparisonMode = 'MULTI_YEAR_PERIODS';
        const splitIdx = Math.max(1, Math.floor(distinctYears.length / 2));
        baselineYears = distinctYears.slice(0, splitIdx);
        recentYears = distinctYears.slice(splitIdx);
        baselineLabel = baselineYears.length === 1 ? String(baselineYears[0]) : `${baselineYears[0]}–${baselineYears[baselineYears.length - 1]}`;
        recentLabel = recentYears.length === 1 ? String(recentYears[0]) : `${recentYears[0]}–${recentYears[recentYears.length - 1]}`;
        comparisonLabel = `Comparing ${recentLabel} vs ${baselineLabel}`;
      }

      baselinePapersCount = papersWithValidYear.filter(p => baselineYears.includes(p.publicationYear)).length;
      recentPapersCount = papersWithValidYear.filter(p => recentYears.includes(p.publicationYear)).length;

      dataCoverageMessage = `Corpus spans ${distinctYears.length} distinct publication years (${distinctYears[0]}–${distinctYears[distinctYears.length - 1]}). ${papersWithValidYear.length} paper(s) analyzed (${baselinePapersCount} in ${baselineLabel}, ${recentPapersCount} in ${recentLabel})${papersMissingYear.length > 0 ? `, with ${papersMissingYear.length} paper(s) missing publication year` : ''}.`;

      topicsWithTrends = sortedKeywords.slice(0, 20).map(k => {
        let C_B = 0;
        for (const y of baselineYears) C_B += (k.yearlyCounts[y] || 0);

        let C_R = 0;
        for (const y of recentYears) C_R += (k.yearlyCounts[y] || 0);

        const N_B = baselinePapersCount;
        const N_R = recentPapersCount;

        const P_B = N_B > 0 ? (C_B / N_B) : 0;
        const P_R = N_R > 0 ? (C_R / N_R) : 0;
        const deltaP = P_R - P_B;
        const percentagePointDiff = Math.round(deltaP * 1000) / 10;
        const baselinePrevalence = Math.round(P_B * 1000) / 10;
        const recentPrevalence = Math.round(P_R * 1000) / 10;
        const totalPaperCount = k.paperCount;

        const yearlyData = distinctYears.map(y => ({
          year: y,
          count: k.yearlyCounts[y] || 0
        }));

        let status = 'Insufficient Data';
        let badge = 'Insufficient Data';
        let growthRate = null;
        let growthPercentage = null;
        let growthTrend = 'N/A';
        let statusCriteria = '';
        let insight = '';
        let isEmerging = false;

        // 1. Single-paper corpus presence: Never claim emergence or macro decline on 1 paper
        if (totalPaperCount <= 1) {
          growthTrend = 'N/A';
          growthRate = null;
          growthPercentage = null;
          if (C_R === 1) {
            status = 'Newly Observed';
            badge = 'Newly Observed';
            growthTrend = 'Newly Observed';
            statusCriteria = `Appears in 1 paper in ${recentLabel} (${C_R}/${N_R} papers) with 0 baseline presence. Emergence or longitudinal velocity requires confirmation across multiple papers.`;
            insight = `Single mention: Observed in 1 paper in ${recentLabel} (${C_R}/${N_R} papers, ${recentPrevalence}% prevalence). Multiple papers required to establish growth velocity.`;
          } else {
            status = 'Insufficient Data';
            badge = 'Insufficient Data';
            statusCriteria = `Observed in 1 baseline paper (${C_B}/${N_B}) and absent in ${recentLabel} (${N_R} paper sample). Absence in a single paper does not substantiate a scientific decline.`;
            insight = `Single mention: Observed in 1 paper in ${baselineLabel} (${C_B}/${N_B} papers) and absent in ${recentLabel}. Sparse data is insufficient to claim a macro decline.`;
          }
        }
        // 2. Sparse 1-to-1 year comparison (1 paper in baseline and 1 paper in recent)
        else if (N_B < 2 && N_R < 2) {
          growthRate = null;
          growthPercentage = null;
          if (C_B === 0 && C_R > 0) {
            status = 'Newly Observed';
            badge = 'Newly Observed';
            growthTrend = 'Newly Observed';
            statusCriteria = `Topic was absent in ${baselineLabel} (0/${N_B}) and appears in ${recentLabel} (${C_R}/${N_R}). Relative percentage growth is mathematically undefined (zero denominator).`;
            insight = `Observed in ${recentLabel} (${C_R}/${N_R} papers) after 0 mentions in ${baselineLabel}. Direct 1-to-1 comparison; percentage growth is N/A.`;
          } else if (C_R === 0 && C_B > 0) {
            status = 'Insufficient Data';
            badge = 'Insufficient Data';
            growthTrend = 'N/A';
            statusCriteria = `Topic present in ${baselineLabel} (1/1) but absent in ${recentLabel} (0/1). 1-paper comparison is too small to substantiate a research decline.`;
            insight = `Present in ${baselineLabel} (${C_B}/${N_B} papers) but absent in ${recentLabel} (${N_R} paper). 1-paper comparison is insufficient to confirm a research decline.`;
          } else {
            status = 'Stable';
            badge = 'Stable';
            growthTrend = 'Stable (0 pp)';
            statusCriteria = `Consistently present in 100% of papers across both ${baselineLabel} (1/1) and ${recentLabel} (1/1). ΔP = 0 percentage points.`;
            insight = `Consistently present in both ${baselineLabel} (1/1 paper) and ${recentLabel} (1/1 paper).`;
          }
        }
        // 3. Zero baseline with multiple recent papers (C_B = 0, C_R >= 2)
        else if (C_B === 0) {
          status = 'Newly Observed';
          badge = 'Newly Observed';
          growthTrend = 'Newly Observed';
          growthRate = null;
          growthPercentage = null;
          statusCriteria = `Appeared in ${C_R} of ${N_R} papers (${recentPrevalence}%) in ${recentLabel} after 0 mentions in ${baselineLabel}. Zero baseline means relative percentage change is mathematically undefined.`;
          insight = `New topic in ${recentLabel}: Appeared in ${C_R} of ${N_R} papers (${recentPrevalence}% prevalence), after 0 mentions in ${baselineLabel}. Baseline is zero so percentage growth is N/A.`;
        }
        // 4. Positive baseline (C_B > 0) with sufficient evidence
        else {
          const relGrowth = (P_R - P_B) / P_B;
          const pct = Math.round(relGrowth * 100);

          if (C_R === 0) {
            // Absent in recent period: confirm whether sample size is sufficient
            if (N_R >= 2 || C_B >= 2) {
              status = 'Decreasing';
              badge = 'Decreasing';
              growthRate = -1.0;
              growthPercentage = -100;
              growthTrend = '-100% Decrease';
              statusCriteria = `Prevalence contracted by 100% (from ${baselinePrevalence}% [${C_B}/${N_B} papers] to 0% in ${recentLabel} [${N_R} papers]). Sample size is sufficient to confirm absence across the observation window.`;
              insight = `Research frequency contracted from ${baselinePrevalence}% (${C_B}/${N_B} papers in ${baselineLabel}) to 0% in ${recentLabel} (${N_R} papers).`;
            } else {
              status = 'Insufficient Data';
              badge = 'Insufficient Data';
              growthRate = null;
              growthPercentage = null;
              growthTrend = 'N/A';
              statusCriteria = `Absent in ${recentLabel}, but sample size (${N_R} paper) is insufficient to confirm a macro research decline.`;
              insight = `Absent in ${recentLabel} (${N_R} paper analyzed). Sample size is too small to confirm macro research decline.`;
            }
          } else if (deltaP >= 0.10 && relGrowth >= 0.15) {
            status = 'Increasing';
            badge = 'Increasing';
            growthRate = relGrowth;
            growthPercentage = pct;
            growthTrend = `+${pct}% Increase`;
            statusCriteria = `Prevalence increased by +${percentagePointDiff} percentage points (relative growth of +${pct}%) from ${baselinePrevalence}% (${C_B}/${N_B}) to ${recentPrevalence}% (${C_R}/${N_R}).`;
            insight = `Prevalence increased from ${baselinePrevalence}% (${C_B}/${N_B} papers in ${baselineLabel}) to ${recentPrevalence}% (${C_R}/${N_R} papers in ${recentLabel}).`;
            if (k.paperCount >= 2 && relGrowth >= 0.30 && C_R >= 2) {
              isEmerging = true;
            }
          } else if (deltaP <= -0.10 && relGrowth <= -0.15) {
            status = 'Decreasing';
            badge = 'Decreasing';
            growthRate = relGrowth;
            growthPercentage = pct;
            growthTrend = `${pct}% Decrease`;
            statusCriteria = `Prevalence contracted by ${percentagePointDiff} percentage points (relative decline of ${pct}%) from ${baselinePrevalence}% (${C_B}/${N_B}) to ${recentPrevalence}% (${C_R}/${N_R}).`;
            insight = `Prevalence contracted from ${baselinePrevalence}% (${C_B}/${N_B} papers in ${baselineLabel}) to ${recentPrevalence}% (${C_R}/${N_R} papers in ${recentLabel}).`;
          } else {
            status = 'Stable';
            badge = 'Stable';
            growthRate = relGrowth;
            growthPercentage = pct;
            growthTrend = `${pct >= 0 ? '+' : ''}${pct}% Stable`;
            statusCriteria = `Prevalence remained steady within ±10 percentage points (${baselinePrevalence}% in ${baselineLabel} vs ${recentPrevalence}% in ${recentLabel}, ΔP = ${percentagePointDiff > 0 ? '+' : ''}${percentagePointDiff} pp).`;
            insight = `Consistent prevalence across observation periods (${baselinePrevalence}% in ${baselineLabel} vs ${recentPrevalence}% in ${recentLabel}).`;
          }
        }

        return {
          topic: k.term,
          paperCount: k.paperCount,
          occurrenceCount: k.occurrenceCount,
          prevalencePercentage: eligiblePapers.length > 0 ? Math.round((k.paperCount / eligiblePapers.length) * 100) : 0,
          yearlyData,
          baselineOccurrences: C_B,
          recentOccurrences: C_R,
          baselineTopicPapers: C_B,
          recentTopicPapers: C_R,
          baselineTotalPapers: N_B,
          recentTotalPapers: N_R,
          baselinePrevalence,
          recentPrevalence,
          percentagePointDiff,
          growthRate,
          growthPercentage,
          growthTrend,
          status,
          badge,
          statusCriteria,
          insight,
          isEmerging,
          papers: k.papers
        };
      });

      // Upsert top topics into TrendResult for persistence
      Promise.all(topicsWithTrends.slice(0, 5).map(t =>
        TrendResult.findOneAndUpdate(
          { projectId: project._id, topic: t.topic },
          {
            projectId: project._id,
            topic: t.topic,
            yearlyData: t.yearlyData,
            growthTrend: t.growthTrend,
            status: t.status,
            insight: t.insight
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )).catch(err => console.warn('TrendResult upsert non-fatal warning:', err.message));
    }

    res.status(200).json({
      projectId: project._id,
      projectName: project.name,
      totalEligiblePapers: eligiblePapers.length,
      papersInYearlyAnalysis: papersWithValidYear.length,
      papersMissingYear: papersMissingYear.length,
      observedYearsBreakdown,
      comparisonMode,
      comparisonLabel,
      baselineLabel,
      recentLabel,
      baselinePapersCount,
      recentPapersCount,
      missingYearPapers: papersMissingYear.map(p => ({
        id: p._id,
        title: p.title || p.originalFilename,
        originalFilename: p.originalFilename,
        uploadDate: p.createdAt
      })),
      allProjectPapers: allPapers.map(p => ({
        id: p._id,
        title: p.title || p.originalFilename,
        originalFilename: p.originalFilename,
        status: p.status,
        publicationYear: p.publicationYear || null,
        uploadDate: p.createdAt
      })),
      distinctYears,
      hasSufficientHistoricalData,
      status: generalStatus,
      dataCoverageMessage,
      yearlyTimeline,
      topKeywords,
      topicTrends: topicsWithTrends
    });
  } catch (error) {
    console.error('getTrends error:', error);
    res.status(500).json({ error: error.message || 'Server error computing trends' });
  }
};

// Endpoint to fetch real paper-level details for a specific research topic
exports.getTrendTopicDetails = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const termQuery = (req.params.term || '').toLowerCase().trim();
    if (!termQuery) return res.status(400).json({ error: 'Topic term is required' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    // Fetch project papers
    const allPapers = await Paper.find({ projectId: project._id });
    const eligiblePapers = allPapers.filter(
      p => p.status === 'COMPLETED' && p.extractedText && p.extractedText.trim().length > 0
    );

    const analyses = await PaperAnalysis.find({ projectId: project._id });
    const analysisByPaperId = {};
    for (const a of analyses) analysisByPaperId[a.paperId.toString()] = a;

    const matchedPapers = [];
    let totalOccurrencesInProject = 0;

    for (const p of eligiblePapers) {
      const a = analysisByPaperId[p._id.toString()];
      let hasKeyword = false;
      let kwScore = 0;

      if (a && Array.isArray(a.extractedKeywords)) {
        const found = a.extractedKeywords.find(k => k && k.term && k.term.toLowerCase() === termQuery);
        if (found) {
          hasKeyword = true;
          kwScore = found.score || 0;
        }
      }

      // Check extracted text occurrences
      const escaped = termQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('\\b' + escaped + '(s|es)?\\b', 'gi');
      const matches = p.extractedText ? p.extractedText.match(regex) : null;
      const occurrencesInText = matches ? matches.length : 0;

      if (hasKeyword || occurrencesInText > 0) {
        totalOccurrencesInProject += occurrencesInText || 1;
        matchedPapers.push({
          paperId: p._id,
          title: p.title || p.originalFilename,
          originalFilename: p.originalFilename,
          publicationYear: (typeof p.publicationYear === 'number' && p.publicationYear >= 1900 && p.publicationYear <= 2100) ? p.publicationYear : null,
          authors: Array.isArray(p.authors) ? p.authors : [],
          occurrencesInPaper: occurrencesInText || 1,
          score: Math.round(kwScore * 1000) / 1000
        });
      }
    }

    res.status(200).json({
      topic: termQuery,
      totalEligiblePapers: eligiblePapers.length,
      paperCount: matchedPapers.length,
      occurrenceCount: totalOccurrencesInProject,
      prevalencePercentage: eligiblePapers.length > 0 ? Math.round((matchedPapers.length / eligiblePapers.length) * 100) : 0,
      papers: matchedPapers
    });
  } catch (error) {
    console.error('getTrendTopicDetails error:', error);
    res.status(500).json({ error: error.message || 'Server error fetching topic details' });
  }
};

const gapController = require('./gapController');
exports.getGaps = gapController.getGaps;
exports.getRecommendations = gapController.getRecommendations;

// ---------------------------------------------------------------------------
// Phase 8: Similarity Screening (TF-IDF + Cosine Similarity)
// ---------------------------------------------------------------------------

exports.screenNovelty = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const researchIdea = (req.body.researchIdea || req.body.idea || req.body.targetTopic || '').trim();
    if (!researchIdea) {
      return res.status(400).json({
        error: 'Research idea text is required',
        message: 'Please provide a research idea to screen against the project corpus.',
      });
    }

    // Only compare papers the authenticated user is authorized to access within the selected project
    const papers = await Paper.find({ projectId: project._id, status: 'COMPLETED' });
    const validPapers = papers.filter(p => p.extractedText && p.extractedText.trim().length > 0);

    const corpusPayload = validPapers.map(p => ({
      id: p._id.toString(),
      title: p.title || p.originalFilename || 'Untitled Document',
      original_filename: p.originalFilename || '',
      text: p.extractedText,
    }));

    const NLP_SERVICE_URL = process.env.PYTHON_SERVICE_URL || process.env.NLP_SERVICE_URL || 'http://localhost:8000';
    const highThreshold = parseFloat(process.env.SIMILARITY_HIGH_THRESHOLD || '0.60');
    const moderateThreshold = parseFloat(process.env.SIMILARITY_MODERATE_THRESHOLD || '0.30');

    let nlpResult;
    try {
      const response = await axios.post(`${NLP_SERVICE_URL}/similarity-screening`, {
        project_id: project._id.toString(),
        research_idea: researchIdea,
        papers: corpusPayload,
        high_threshold: highThreshold,
        moderate_threshold: moderateThreshold,
      }, { timeout: 15000 });
      nlpResult = response.data;
    } catch (nlpErr) {
      console.error('NLP Service similarity screening error:', nlpErr.message);
      return res.status(502).json({
        error: 'Similarity screening service unavailable',
        details: nlpErr.message,
      });
    }

    // Map similar papers to schema
    const mappedSimilarPapers = (nlpResult.similar_papers || []).map(sp => ({
      paperId: mongoose.isValidObjectId(sp.paper_id) ? sp.paper_id : undefined,
      title: sp.title,
      originalFilename: sp.original_filename,
      similarityScore: sp.similarity_score,
      similarityPercentage: sp.similarity_percentage,
      matchingKeywords: sp.matching_keywords || [],
      rank: sp.rank,
    }));

    // Upsert into SimilarityResult
    const savedResult = await SimilarityResult.findOneAndUpdate(
      { projectId: project._id },
      {
        projectId: project._id,
        targetTopic: researchIdea,
        researchIdea: researchIdea,
        overallSimilarityScore: nlpResult.overall_similarity_percentage,
        similarityScore: nlpResult.overall_similarity_score,
        interpretation: nlpResult.interpretation,
        interpretationText: nlpResult.interpretation_text,
        explanation: nlpResult.explanation || 'This score reflects textual similarity to the available project corpus.',
        statusBadge: nlpResult.status_badge,
        matchingKeywords: nlpResult.matching_keywords || [],
        totalPapersAnalyzed: nlpResult.total_papers_analyzed ?? validPapers.length,
        thresholdsUsed: nlpResult.thresholds_used || { high: highThreshold, moderate: moderateThreshold },
        similarPapers: mappedSimilarPapers,
        rawResults: nlpResult,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      projectId: project._id,
      researchIdea: researchIdea,
      overallSimilarityScore: nlpResult.overall_similarity_score,
      overallSimilarityPercentage: nlpResult.overall_similarity_percentage,
      interpretation: nlpResult.interpretation,
      interpretationText: nlpResult.interpretation_text,
      statusBadge: nlpResult.status_badge,
      explanation: nlpResult.explanation || 'This score reflects textual similarity to the available project corpus.',
      matchingKeywords: nlpResult.matching_keywords || [],
      similarPapers: nlpResult.similar_papers || [],
      totalPapersAnalyzed: nlpResult.total_papers_analyzed,
      thresholdsUsed: nlpResult.thresholds_used,
      hasError: nlpResult.has_error || false,
      resultId: savedResult._id,
      updatedAt: savedResult.updatedAt,
    });
  } catch (err) {
    console.error('screenNovelty error:', err);
    res.status(500).json({ error: err.message || 'Internal server error screening similarity' });
  }
};

exports.getNovelty = async (req, res) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const totalCorpusPapers = await Paper.countDocuments({ projectId: project._id, status: 'COMPLETED' });
    const result = await SimilarityResult.findOne({ projectId: project._id }).sort({ updatedAt: -1 });

    if (!result) {
      return res.status(200).json({
        projectId: project._id,
        totalCorpusPapers,
        result: null,
      });
    }

    res.status(200).json({
      projectId: project._id,
      totalCorpusPapers,
      result: {
        id: result._id,
        researchIdea: result.researchIdea || result.targetTopic,
        overallSimilarityScore: result.similarityScore ?? (result.overallSimilarityScore / 100),
        overallSimilarityPercentage: result.overallSimilarityScore,
        interpretation: result.interpretation,
        interpretationText: result.interpretationText,
        statusBadge: result.statusBadge,
        explanation: result.explanation || 'This score reflects textual similarity to the available project corpus.',
        matchingKeywords: result.matchingKeywords || [],
        similarPapers: (result.similarPapers || []).map(sp => ({
          paper_id: sp.paperId,
          title: sp.title,
          original_filename: sp.originalFilename,
          similarity_score: sp.similarityScore,
          similarity_percentage: sp.similarityPercentage,
          matching_keywords: sp.matchingKeywords || [],
          rank: sp.rank,
        })),
        totalPapersAnalyzed: result.totalPapersAnalyzed,
        thresholdsUsed: result.thresholdsUsed,
        updatedAt: result.updatedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal server error getting novelty results' });
  }
};

exports.getReport = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!enforceOwnership(project, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const cleanTitle = (p) => {
      const raw = p?.title?.trim();
      if (raw && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(raw.toLowerCase())) {
        return raw;
      }
      return p?.originalFilename || 'Untitled Document';
    };

    const allPapers = await Paper.find({ projectId: project._id });
    const completedPapers = allPapers.filter(p => p.status === 'COMPLETED');

    const { paperId } = req.query;
    let selectedPaper = null;
    if (paperId && paperId !== 'ALL') {
      selectedPaper = completedPapers.find(p => p._id.toString() === paperId.toString())
        || allPapers.find(p => p._id.toString() === paperId.toString());
    } else if (completedPapers.length > 0) {
      selectedPaper = completedPapers[0];
    }

    const analyses = await PaperAnalysis.find({ projectId: project._id });
    const selectedAnalysis = selectedPaper
      ? analyses.find(a => a.paperId.toString() === selectedPaper._id.toString())
      : null;

    // Phase 8: Fetch latest similarity screening result if available
    const latestSimilarity = await SimilarityResult.findOne({ projectId: project._id }).sort({ updatedAt: -1 });

    const cleanReportKeywords = (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return [];
      const seen = new Set();
      const clean = [];
      for (const kw of raw) {
        if (!kw || !kw.term) continue;
        const termNorm = String(kw.term).toLowerCase().trim();
        if (!termNorm || seen.has(termNorm)) continue;
        seen.add(termNorm);
        clean.push({
          term: termNorm,
          score: typeof kw.score === 'number' ? kw.score : 0,
          rank: clean.length + 1,
        });
        if (clean.length >= 50) break;
      }
      return clean;
    };

    // Phase 9: Fetch longitudinal trends
    const trends = await TrendResult.find({ projectId: project._id }).sort({ topic: 1 }).limit(10);

    // Phase 10: Fetch research gaps
    const gaps = await GapResult.find({ projectId: project._id }).sort({ confidenceScore: -1 }).limit(10);

    // Phase 11: Fetch research recommendations
    const recommendations = await Recommendation.find({ projectId: project._id }).sort({ priority: 1 }).limit(10);

    res.status(200).json({
      projectId: project._id,
      projectName: project.name,
      domain: project.domain || '',
      generatedAt: new Date(),
      totalCompletedPapers: completedPapers.length,
      availablePapers: completedPapers.map(p => ({
        id: p._id,
        title: cleanTitle(p),
        originalFilename: p.originalFilename,
        hasSummary: !!analyses.find(a => a.paperId.toString() === p._id.toString())?.structuredSummary,
      })),
      selectedPaper: selectedPaper ? {
        id: selectedPaper._id,
        title: cleanTitle(selectedPaper),
        originalFilename: selectedPaper.originalFilename,
        authors: (selectedPaper.authors || []).filter(a => a && !['(anonymous)', 'anonymous', 'unknown'].includes(a.trim().toLowerCase())),
        publicationYear: selectedPaper.publicationYear || null,
        fileSizeBytes: selectedPaper.fileSizeBytes,
        status: selectedPaper.status,
      } : null,
      keywords: cleanReportKeywords(selectedAnalysis?.extractedKeywords),
      structuredSummary: selectedAnalysis?.structuredSummary || null,
      summaryStatus: selectedAnalysis?.summaryStatus || 'NOT_STARTED',
      summaryError: selectedAnalysis?.summaryError || null,
      aiProvider: aiService.getActiveProvider(),
      aiModel: aiService.getActiveModel(),
      similarityScreening: latestSimilarity ? {
        researchIdea: latestSimilarity.researchIdea || latestSimilarity.targetTopic,
        similarityScore: latestSimilarity.similarityScore ?? (latestSimilarity.overallSimilarityScore / 100),
        similarityPercentage: latestSimilarity.overallSimilarityScore,
        interpretation: latestSimilarity.interpretation,
        interpretationText: latestSimilarity.interpretationText,
        statusBadge: latestSimilarity.statusBadge,
        explanation: latestSimilarity.explanation || 'This score reflects textual similarity to the available project corpus.',
        matchingKeywords: latestSimilarity.matchingKeywords || [],
        similarPapers: (latestSimilarity.similarPapers || []).map(sp => ({
          paper_id: sp.paperId,
          title: sp.title,
          original_filename: sp.originalFilename,
          similarity_score: sp.similarityScore,
          similarity_percentage: sp.similarityPercentage,
          matching_keywords: sp.matchingKeywords || [],
          rank: sp.rank,
        })),
        totalPapersAnalyzed: latestSimilarity.totalPapersAnalyzed,
        updatedAt: latestSimilarity.updatedAt,
      } : null,
      trends: trends.map(t => ({
        topic: t.topic,
        growthTrend: t.growthTrend || 'N/A',
        status: t.status || 'Insufficient Data',
        insight: t.insight || 'No trend insight recorded.',
        yearlyData: t.yearlyData || [],
      })),
      gaps: gaps.map(g => ({
        id: g._id,
        title: g.title,
        topic: g.topic,
        category: g.category,
        gapType: g.gapType,
        description: g.description,
        whyItMatters: g.whyItMatters,
        suggestedDirection: g.suggestedDirection,
        confidenceScore: g.confidenceScore,
        confidenceRationale: g.confidenceRationale,
        supportingPapers: (g.supportingPapers || []).map(sp => ({
          paperId: sp.paperId,
          title: sp.title || sp.paperTitle,
          originalFilename: sp.originalFilename,
          publicationYear: sp.publicationYear,
          evidenceExcerpt: sp.evidenceExcerpt,
          sourceSection: sp.sourceSection,
        })),
      })),
      recommendations: recommendations.map(r => ({
        id: r._id,
        title: r.title,
        researchDirection: r.researchDirection,
        researchQuestion: r.researchQuestion,
        targetTopic: r.targetTopic,
        groundingLevel: r.groundingLevel,
        possibleMethodology: r.possibleMethodology,
        methodologyDetails: r.methodologyDetails,
        expectedContribution: r.expectedContribution,
        whyRecommended: r.whyRecommended,
        limitations: r.limitations,
        supportingGaps: r.supportingGaps || [],
        evidenceExcerpts: r.evidenceExcerpts || [],
        supportingPapers: (r.supportingPapers || []).map(sp => ({
          paperId: sp.paperId,
          title: sp.title || sp.paperTitle,
          originalFilename: sp.originalFilename,
          publicationYear: sp.publicationYear,
          relevanceExplanation: sp.relevanceExplanation,
        })),
        sourceType: r.sourceType,
        priority: r.priority,
      })),
      corpusPapers: completedPapers.map(p => ({
        id: p._id,
        title: cleanTitle(p),
        originalFilename: p.originalFilename,
        authors: (p.authors || []).filter(a => a && !['(anonymous)', 'anonymous', 'unknown'].includes(a.trim().toLowerCase())),
        publicationYear: p.publicationYear || null,
        fileSizeBytes: p.fileSizeBytes,
        status: p.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error generating report' });
  }
};


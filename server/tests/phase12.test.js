/**
 * Phase 12 — PDF Research Report Audit & Fix Test Suite
 * Validates report generation API, data enrichment across all analysis phases
 * (keywords, structured AI summaries, similarity screening, longitudinal trends,
 * research gaps with citations, recommendations suite, and corpus references),
 * authentication, cross-tenant isolation, empty project handling, error states,
 * and genuine PDF generation validity.
 */

jest.setTimeout(45000);

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let mongoServer;
let app;
let User;
let Project;
let Paper;
let PaperAnalysis;
let SimilarityResult;
let TrendResult;
let GapResult;
let Recommendation;

let user1Token;
let user2Token;
let user1Id;
let user2Id;

let projectMultiId;
let projectEmptyId;
let projectUser2Id;

let paper1Id;
let paper2Id;

const JWT_SECRET = process.env.JWT_SECRET || 'phase12_test_jwt_secret';

// Helper to execute client/src/utils/generatePdfReport.js via native Node ESM
function runPdfGenerator(reportPayload) {
  const tmpJsonPath = path.resolve(__dirname, 'temp_report_test.json');
  fs.writeFileSync(tmpJsonPath, JSON.stringify(reportPayload), 'utf-8');
  const runnerPath = path.resolve(__dirname, 'pdfRunner.mjs');

  try {
    const output = execSync(`node "${runnerPath}" "${tmpJsonPath}"`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
    });
    return JSON.parse(output.trim());
  } finally {
    if (fs.existsSync(tmpJsonPath)) {
      try { fs.unlinkSync(tmpJsonPath); } catch (_) {}
    }
  }
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  process.env.JWT_SECRET = JWT_SECRET;

  app = require('../src/app');
  User = require('../src/models/User');
  Project = require('../src/models/Project');
  Paper = require('../src/models/Paper');
  PaperAnalysis = require('../src/models/PaperAnalysis');
  SimilarityResult = require('../src/models/SimilarityResult');
  TrendResult = require('../src/models/TrendResult');
  GapResult = require('../src/models/GapResult');
  Recommendation = require('../src/models/Recommendation');

  // Create test users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Secret1234', salt);

  const user1 = await User.create({
    name: 'Researcher User1',
    email: 'user1_phase12@test.com',
    password: passwordHash,
  });
  user1Id = user1._id;
  user1Token = jwt.sign({ id: user1._id.toString() }, JWT_SECRET, { expiresIn: '1h' });

  const user2 = await User.create({
    name: 'Researcher User2',
    email: 'user2_phase12@test.com',
    password: passwordHash,
  });
  user2Id = user2._id;
  user2Token = jwt.sign({ id: user2._id.toString() }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Populated Multi-Paper Project (User 1)
  const projMulti = await Project.create({
    name: 'Quantum Network Protocol Research',
    domain: 'Quantum Computing',
    userId: user1Id,
  });
  projectMultiId = projMulti._id;

  // 2. Empty Project (User 1)
  const projEmpty = await Project.create({
    name: 'Brand New Empty Study',
    domain: 'Astrophysics',
    userId: user1Id,
  });
  projectEmptyId = projEmpty._id;

  // 3. User 2 Project
  const projUser2 = await Project.create({
    name: 'User 2 Private Project',
    domain: 'Biotechnology',
    userId: user2Id,
  });
  projectUser2Id = projUser2._id;

  // Seed papers for multi-paper project
  const paper1 = await Paper.create({
    projectId: projectMultiId,
    title: 'Fault-Tolerant Entanglement Routing in Quantum Mesh Networks',
    originalFilename: 'quantum_routing_2024.pdf',
    storedFilename: 'quantum_routing_2024_hash.pdf',
    authors: ['Alice Vance', 'Bob Martinez', 'Carol Chen'],
    publicationYear: 2024,
    status: 'COMPLETED',
    fileSizeBytes: 245000,
    extractedText: 'We present a fault-tolerant entanglement routing protocol. Limitations: The protocol was evaluated exclusively in simulation environments with under 50 nodes.',
  });
  paper1Id = paper1._id;

  const paper2 = await Paper.create({
    projectId: projectMultiId,
    title: 'Decoherence Mitigation in High-Loss Quantum Channels',
    originalFilename: 'decoherence_mitigation_2023.pdf',
    storedFilename: 'decoherence_mitigation_2023_hash.pdf',
    authors: ['David Kim', 'Elena Rostova'],
    publicationYear: 2023,
    status: 'COMPLETED',
    fileSizeBytes: 189000,
    extractedText: 'This paper investigates active decoherence mitigation techniques. Future work will benchmark cryogenic stability under asymmetric thermal fluctuations.',
  });
  paper2Id = paper2._id;

  // Seed Paper Analyses (Keywords & Structured AI Summaries)
  await PaperAnalysis.create({
    paperId: paper1Id,
    projectId: projectMultiId,
    extractedKeywords: [
      { term: 'entanglement routing', score: 9.85 },
      { term: 'quantum mesh', score: 8.42 },
      { term: 'fault tolerance', score: 7.15 },
    ],
    structuredSummary: {
      researchProblem: 'Scalable entanglement distribution under probabilistic link failures.',
      objective: 'Develop an adaptive pathing algorithm minimizing entanglement latency.',
      methodology: 'Monte Carlo simulation across 40-node irregular mesh topologies.',
      keyFindings: [
        'Achieved 34% higher throughput compared to static shortest-path routing.',
        'Maintained sub-10ms distribution latency under 20% simulated channel loss.',
      ],
      limitations: [
        'Experiments were conducted purely in software simulation without physical photonic hardware.',
        'Network size capped at 50 nodes; asymptotic scaling beyond 100 nodes remains untested.',
      ],
      model: 'gemini-2.5-flash',
      generatedAt: new Date(),
    },
    summaryStatus: 'COMPLETED',
  });

  await PaperAnalysis.create({
    paperId: paper2Id,
    projectId: projectMultiId,
    extractedKeywords: [
      { term: 'decoherence mitigation', score: 8.90 },
      { term: 'quantum channels', score: 7.60 },
    ],
    structuredSummary: {
      researchProblem: 'Thermal noise accelerating state degradation in fiber links.',
      objective: 'Implement dynamic phase compensation at repeaters.',
      methodology: 'Cryogenic benchtop laboratory setup with 1550nm laser source.',
      keyFindings: [
        'Extended coherence time by a factor of 2.3x at 4 Kelvin.',
      ],
      limitations: [
        'Hardware complexity introduces 15% insertion loss per intermediate repeater node.',
      ],
      model: 'gemini-2.5-flash',
      generatedAt: new Date(),
    },
    summaryStatus: 'COMPLETED',
  });

  // Seed Similarity Screening (Phase 8)
  await SimilarityResult.create({
    projectId: projectMultiId,
    targetTopic: 'Adaptive photonic entanglement routing with real-time decoherence tracking',
    researchIdea: 'Adaptive photonic entanglement routing with real-time decoherence tracking',
    similarityScore: 0.72,
    overallSimilarityScore: 72,
    interpretation: 'Moderate',
    statusBadge: 'MODERATE OVERLAP',
    matchingKeywords: ['entanglement routing', 'decoherence mitigation', 'quantum channels'],
    explanation: 'This score reflects textual similarity to the available project corpus.',
    similarPapers: [
      {
        paperId: paper1Id,
        title: 'Fault-Tolerant Entanglement Routing in Quantum Mesh Networks',
        originalFilename: 'quantum_routing_2024.pdf',
        similarityScore: 0.76,
        similarityPercentage: 76,
        matchingKeywords: ['entanglement routing'],
        rank: 1,
      },
    ],
    totalPapersAnalyzed: 2,
  });

  // Seed Longitudinal Research Trends (Phase 9)
  await TrendResult.create({
    projectId: projectMultiId,
    topic: 'entanglement routing',
    yearlyData: [{ year: 2023, count: 1 }, { year: 2024, count: 2 }],
    growthTrend: '+100% Emerging',
    status: 'Increasing',
    insight: 'Significant growth in network routing protocols observed between 2023 and 2024.',
  });

  await TrendResult.create({
    projectId: projectMultiId,
    topic: 'decoherence mitigation',
    yearlyData: [{ year: 2023, count: 1 }, { year: 2024, count: 1 }],
    growthTrend: 'Stable',
    status: 'Stable',
    insight: 'Consistent experimental attention across multi-year observation periods.',
  });

  // Seed Research Gap (Phase 10)
  await GapResult.create({
    projectId: projectMultiId,
    title: 'Lack of Physical Photonic Validation for Large-Scale Quantum Meshes',
    topic: 'entanglement routing',
    category: 'Empirical / Evaluation',
    gapType: 'Explicit Gap',
    description: 'Existing protocols rely entirely on idealized software simulations without testing photonic hardware insertion losses.',
    whyItMatters: 'Theoretical latency guarantees often fail when exposed to real-world optical switch jitter and thermal fluctuations.',
    suggestedDirection: 'Deploy hardware-in-the-loop benchmarks using real photonic switches.',
    confidenceScore: 0.88,
    confidenceRationale: 'Derived from author-reported constraints in 2 papers.',
    supportingPapers: [
      {
        paperId: paper1Id,
        title: 'Fault-Tolerant Entanglement Routing in Quantum Mesh Networks',
        originalFilename: 'quantum_routing_2024.pdf',
        publicationYear: 2024,
        evidenceExcerpt: 'The protocol was evaluated exclusively in simulation environments with under 50 nodes.',
        sourceSection: 'Limitations',
      },
    ],
  });

  // Seed Research Recommendation (Phase 11)
  await Recommendation.create({
    projectId: projectMultiId,
    title: 'Physical Photonic Testbed Evaluation of Adaptive Entanglement Routing',
    researchDirection: 'Hardware-grounded validation of quantum network routing',
    researchQuestion: 'How does optical switch insertion loss impact multi-hop entanglement throughput in 10+ node physical testbeds?',
    targetTopic: 'entanglement routing',
    groundingLevel: 'EXPLICIT_GAP_GROUNDED',
    possibleMethodology: 'Empirical hardware-in-the-loop benchmarking with optical switch matrices and cryogenic detectors.',
    expectedContribution: 'The first empirical validation of dynamic entanglement routing under realistic photonic attenuation.',
    whyRecommended: 'Directly addresses the author-acknowledged limitation in simulation-only mesh research.',
    priority: 'High',
    supportingPapers: [
      {
        paperId: paper1Id,
        title: 'Fault-Tolerant Entanglement Routing in Quantum Mesh Networks',
        originalFilename: 'quantum_routing_2024.pdf',
        publicationYear: 2024,
        relevanceExplanation: 'Reports simulation boundaries that this proposal empirically executes.',
      },
    ],
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 12 — PDF Research Report API & Content Integrity', () => {
  describe('Authentication & Project Ownership Authorization', () => {
    it('returns 401 Unauthorized when requesting report without Bearer token', async () => {
      const res = await request(app).get(`/api/projects/${projectMultiId}/report`);
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 403 Forbidden when user2 attempts to access user1 project report', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/report`)
        .set('Authorization', `Bearer ${user2Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden|ownership/i);
    });

    it('returns 404 Not Found when project ID does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/projects/${fakeId}/report`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Project not found/i);
    });
  });

  describe('Empty Project Handling', () => {
    it('returns 200 with honest empty states when project has 0 papers', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectEmptyId}/report`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.projectName).toBe('Brand New Empty Study');
      expect(res.body.totalCompletedPapers).toBe(0);
      expect(res.body.availablePapers).toEqual([]);
      expect(res.body.selectedPaper).toBeNull();
      expect(res.body.keywords).toEqual([]);
      expect(res.body.structuredSummary).toBeNull();
      expect(res.body.trends).toEqual([]);
      expect(res.body.gaps).toEqual([]);
      expect(res.body.recommendations).toEqual([]);
      expect(res.body.corpusPapers).toEqual([]);
    });
  });

  describe('Multi-Paper Project Consolidated Report Data', () => {
    let reportData;

    beforeAll(async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/report`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      reportData = res.body;
    });

    it('includes correct project metadata and completed papers count', () => {
      expect(reportData.projectName).toBe('Quantum Network Protocol Research');
      expect(reportData.domain).toBe('Quantum Computing');
      expect(reportData.totalCompletedPapers).toBe(2);
      expect(reportData.availablePapers.length).toBe(2);
    });

    it('defaults to first completed paper with genuine metadata', () => {
      expect(reportData.selectedPaper).toBeTruthy();
      expect(reportData.selectedPaper.title).toBe('Fault-Tolerant Entanglement Routing in Quantum Mesh Networks');
      expect(reportData.selectedPaper.authors).toEqual(['Alice Vance', 'Bob Martinez', 'Carol Chen']);
      expect(reportData.selectedPaper.publicationYear).toBe(2024);
      expect(reportData.selectedPaper.status).toBe('COMPLETED');
    });

    it('includes extracted NLP keywords with rank and scores', () => {
      expect(Array.isArray(reportData.keywords)).toBe(true);
      expect(reportData.keywords.length).toBeGreaterThan(0);
      const topKw = reportData.keywords[0];
      expect(topKw).toHaveProperty('term', 'entanglement routing');
      expect(topKw).toHaveProperty('score', 9.85);
      expect(topKw).toHaveProperty('rank', 1);
    });

    it('includes structured AI summary with problem, objective, methodology, findings, and limitations', () => {
      expect(reportData.structuredSummary).toBeTruthy();
      expect(reportData.structuredSummary.researchProblem).toContain('entanglement distribution');
      expect(reportData.structuredSummary.objective).toContain('adaptive pathing');
      expect(reportData.structuredSummary.methodology).toContain('Monte Carlo');
      expect(reportData.structuredSummary.keyFindings.length).toBe(2);
      expect(reportData.structuredSummary.limitations.length).toBe(2);
    });

    it('includes Phase 8 similarity screening data and disclaimer', () => {
      expect(reportData.similarityScreening).toBeTruthy();
      expect(reportData.similarityScreening.similarityPercentage).toBe(72);
      expect(reportData.similarityScreening.interpretation).toBe('Moderate');
      expect(reportData.similarityScreening.explanation).toContain('textual similarity');
      expect(reportData.similarityScreening.similarPapers.length).toBe(1);
    });

    it('includes Phase 9 longitudinal research trends', () => {
      expect(Array.isArray(reportData.trends)).toBe(true);
      expect(reportData.trends.length).toBe(2);
      const trend = reportData.trends.find(t => t.topic === 'entanglement routing');
      expect(trend).toBeTruthy();
      expect(trend.status).toBe('Increasing');
      expect(trend.growthTrend).toContain('+100% Emerging');
      expect(trend.insight).toContain('growth');
    });

    it('includes Phase 10 research gaps with citations and author limitation evidence', () => {
      expect(Array.isArray(reportData.gaps)).toBe(true);
      expect(reportData.gaps.length).toBe(1);
      const gap = reportData.gaps[0];
      expect(gap.title).toContain('Physical Photonic Validation');
      expect(gap.category).toBe('Empirical / Evaluation');
      expect(gap.gapType).toBe('Explicit Gap');
      expect(gap.confidenceScore).toBe(0.88);
      expect(gap.supportingPapers.length).toBe(1);
      expect(gap.supportingPapers[0].evidenceExcerpt).toContain('simulation environments');
      expect(gap.supportingPapers[0].sourceSection).toBe('Limitations');
    });

    it('includes Phase 11 research recommendations with methodology and backing papers', () => {
      expect(Array.isArray(reportData.recommendations)).toBe(true);
      expect(reportData.recommendations.length).toBe(1);
      const rec = reportData.recommendations[0];
      expect(rec.title).toContain('Physical Photonic Testbed');
      expect(rec.groundingLevel).toBe('EXPLICIT_GAP_GROUNDED');
      expect(rec.researchQuestion).toContain('optical switch insertion loss');
      expect(rec.possibleMethodology).toContain('hardware-in-the-loop');
      expect(rec.supportingPapers.length).toBe(1);
      expect(rec.supportingPapers[0].title).toBe('Fault-Tolerant Entanglement Routing in Quantum Mesh Networks');
    });

    it('includes complete corpus references list for bibliographic citations', () => {
      expect(Array.isArray(reportData.corpusPapers)).toBe(true);
      expect(reportData.corpusPapers.length).toBe(2);
      expect(reportData.corpusPapers[0].title).toBe('Fault-Tolerant Entanglement Routing in Quantum Mesh Networks');
      expect(reportData.corpusPapers[1].title).toBe('Decoherence Mitigation in High-Loss Quantum Channels');
    });
  });

  describe('Querying Specific Paper (?paperId=...) in Report', () => {
    it('returns selected paper corresponding to paper2 when specified', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/report?paperId=${paper2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.selectedPaper.id.toString()).toBe(paper2Id.toString());
      expect(res.body.selectedPaper.title).toBe('Decoherence Mitigation in High-Loss Quantum Channels');
      expect(res.body.structuredSummary.methodology).toContain('Cryogenic benchtop');
    });
  });

  describe('Error States & Resilience', () => {
    it('handles malformed project id gracefully with 500 error response', async () => {
      const res = await request(app)
        .get('/api/projects/not-a-valid-mongo-id/report')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Client PDF Generation Utility (generatePdfReport)', () => {
    it('successfully generates genuine PDF document for populated project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/report`)
        .set('Authorization', `Bearer ${user1Token}`);

      const result = runPdfGenerator(res.body);

      expect(result.success).toBe(true);
      expect(result.pages).toBeGreaterThanOrEqual(1);
      expect(result.header).toBe('%PDF-');
      expect(result.sizeBytes).toBeGreaterThan(1000);
      expect(result.filename).toMatch(/researchlens_report_.*\.pdf/);
    });

    it('successfully generates genuine PDF for empty project without throwing', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectEmptyId}/report`)
        .set('Authorization', `Bearer ${user1Token}`);

      const result = runPdfGenerator(res.body);

      expect(result.success).toBe(true);
      expect(result.pages).toBeGreaterThanOrEqual(1);
      expect(result.header).toBe('%PDF-');
      expect(result.sizeBytes).toBeGreaterThan(500);
      expect(result.filename).toBe('researchlens_report_brand_new_empty_study_corpus.pdf');
    });

    it('returns error result if report payload is null', () => {
      const result = runPdfGenerator(null);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Report data is required/i);
    });
  });
});

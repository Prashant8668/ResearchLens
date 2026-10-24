/**
 * Phase 10 — Research Gap Analysis & Recommendations Tests
 */

jest.setTimeout(90000);

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let mongoServer;
let app;
let User;
let Project;
let Paper;
let PaperAnalysis;
let GapResult;
let Recommendation;
const { runGapAnalysisForProject } = require('../src/services/gapAnalysisService');

let user1Token;
let user2Token;
let user1Id;
let user2Id;
let projectCorpusId;
let projectSingleId;
let projectEmptyId;
let projectUser2Id;

let paper1Id;
let paper2Id;

const JWT_SECRET = process.env.JWT_SECRET || 'phase10_test_jwt_secret';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  process.env.JWT_SECRET = JWT_SECRET;

  app = require('../src/app');
  User = require('../src/models/User');
  Project = require('../src/models/Project');
  Paper = require('../src/models/Paper');
  PaperAnalysis = require('../src/models/PaperAnalysis');
  GapResult = require('../src/models/GapResult');
  Recommendation = require('../src/models/Recommendation');

  // Create test users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123', salt);

  const user1 = await User.create({
    name: 'Gap Analyst One',
    email: 'analyst1_p10@example.com',
    password: passwordHash,
  });
  user1Id = user1._id;
  user1Token = jwt.sign({ id: user1._id, email: user1.email }, JWT_SECRET, { expiresIn: '1h' });

  const user2 = await User.create({
    name: 'Gap Analyst Two',
    email: 'analyst2_p10@example.com',
    password: passwordHash,
  });
  user2Id = user2._id;
  user2Token = jwt.sign({ id: user2._id, email: user2.email }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Corpus Project (2 papers with real structured analysis and future work sections)
  const projCorpus = await Project.create({
    name: 'Federated Learning Security',
    domain: 'Computer Science',
    userId: user1Id,
  });
  projectCorpusId = projCorpus._id.toString();

  const p1 = await Paper.create({
    projectId: projectCorpusId,
    title: 'Adversarial Robustness in Federated Averaging',
    authors: ['Carlos Vance', 'Elena Rostova'],
    originalFilename: 'fed_robustness.pdf',
    storedFilename: 'fed_robustness_stored.pdf',
    extractedText: `
      1. Introduction
      Federated learning allows distributed model training without centralizing raw data.
      However, Byzantine attackers can poison gradient updates.

      2. Methodology
      We evaluated FedAvg and median-based aggregation on non-IID MNIST datasets under 20% malicious client ratio.

      3. Results and Limitations
      Our approach mitigated label-flipping attacks.
      Limitations: The current defense is computationally prohibitive for edge devices with restricted memory buffers and does not scale well to heterogeneous networks.

      4. Future Work
      Future work should investigate quantized gradient verification mechanisms and explore asynchronous validation protocols on non-convex neural network topologies.
    `,
    status: 'COMPLETED',
    publicationYear: 2024,
  });
  paper1Id = p1._id.toString();

  await PaperAnalysis.create({
    paperId: p1._id,
    projectId: projectCorpusId,
    extractedKeywords: [
      { term: 'federated learning', score: 3.5, rank: 1 },
      { term: 'adversarial', score: 3.0, rank: 2 },
      { term: 'robustness', score: 2.8, rank: 3 },
      { term: 'byzantine', score: 2.5, rank: 4 },
      { term: 'aggregation', score: 2.0, rank: 5 },
    ],
    structuredSummary: {
      researchProblem: 'Vulnerability of federated learning algorithms to Byzantine client poisoning attacks in non-IID settings.',
      methodology: 'Simulated FedAvg with coordinate-wise trimmed median aggregation on non-IID image classification benchmarks.',
      keyFindings: 'Coordinate-wise trimmed median aggregation successfully resists up to 20% Byzantine adversaries without catastrophic convergence failure.',
      limitations: 'Defense incurs high computational latency on edge hardware with limited RAM buffers and lacks support for asynchronous edge clients.',
    },
  });

  const p2 = await Paper.create({
    projectId: projectCorpusId,
    title: 'Differential Privacy Guarantees in Edge Aggregation',
    authors: ['Hassan Al-Sayed'],
    originalFilename: 'diff_privacy_edge.pdf',
    storedFilename: 'diff_privacy_edge_stored.pdf',
    extractedText: `
      Abstract
      Privacy-preserving machine learning requires strict noise calibration.

      Methodology
      We applied Gaussian noise mechanisms under Renyi differential privacy accounting.

      Limitations and Threats to Validity
      Threats to validity: The additive noise substantially degraded utility when client participation dropped below fifty active nodes. Moreover, privacy budgets quickly depleted across multi-round communication cycles.

      Future Research Directions
      We leave adaptive noise scaling tailored to heterogeneous device capabilities for future investigation.
    `,
    status: 'COMPLETED',
    publicationYear: 2025,
  });
  paper2Id = p2._id.toString();

  await PaperAnalysis.create({
    paperId: p2._id,
    projectId: projectCorpusId,
    extractedKeywords: [
      { term: 'differential privacy', score: 3.8, rank: 1 },
      { term: 'gaussian noise', score: 3.2, rank: 2 },
      { term: 'federated learning', score: 3.0, rank: 3 },
      { term: 'privacy budget', score: 2.6, rank: 4 },
    ],
    structuredSummary: {
      researchProblem: 'Balancing privacy budget exhaustion against predictive utility in edge-assisted distributed training.',
      methodology: 'Renyi differential privacy accounting combined with client-level Gaussian perturbation mechanisms.',
      keyFindings: 'Privacy guarantees can be preserved up to 100 communication rounds if client sample sizes remain above 50 nodes.',
      limitations: 'Severe model accuracy degradation occurs during dynamic network churn when client participation falls below critical thresholds.',
    },
  });

  // 2. Single-paper project
  const projSingle = await Project.create({
    name: 'Single Paper Preliminary Study',
    domain: 'Medicine',
    userId: user1Id,
  });
  projectSingleId = projSingle._id.toString();

  const pSingle = await Paper.create({
    projectId: projectSingleId,
    title: 'Biomarker Extraction Using Contrastive Vision Models',
    authors: ['Dr. Sarah Connor'],
    originalFilename: 'biomarker_vision.pdf',
    storedFilename: 'biomarker_vision_stored.pdf',
    extractedText: 'We detect ocular lesions using contrastive learning. Limitations: Small cohort size (n=45) limits clinical generalization.',
    status: 'COMPLETED',
    publicationYear: 2026,
  });
  await PaperAnalysis.create({
    paperId: pSingle._id,
    projectId: projectSingleId,
    extractedKeywords: [
      { term: 'biomarker', score: 3.5, rank: 1 },
      { term: 'contrastive', score: 2.9, rank: 2 },
    ],
    structuredSummary: {
      researchProblem: 'Automated ocular lesion identification under restricted labeled dataset constraints.',
      methodology: 'Self-supervised contrastive learning with SimCLR architecture adapted for retinal imaging.',
      keyFindings: 'Achieved 89.2% AUC on 45 subject cohort.',
      limitations: 'Small sample size (n=45) limits generalizability across diverse ethnic demographic cohorts.',
    },
  });

  // 3. Empty project
  const projEmpty = await Project.create({
    name: 'Empty Gap Project',
    domain: 'General',
    userId: user1Id,
  });
  projectEmptyId = projEmpty._id.toString();

  // 4. Project owned by user2
  const projUser2 = await Project.create({
    name: 'User 2 Restricted Project',
    domain: 'Robotics',
    userId: user2Id,
  });
  projectUser2Id = projUser2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Phase 10 — Research Gap Analysis & Recommendations', () => {
  test('GET /api/projects/:id/gaps returns 401 without authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectCorpusId}/gaps`);
    expect(res.status).toBe(401);
  });

  test('GET /api/projects/:id/gaps returns 403 when accessing another user\'s project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectUser2Id}/gaps`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden|unauthorized/i);
  });

  test('GET /api/projects/:id/gaps returns INSUFFICIENT_DATA for project with zero papers', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectEmptyId}/gaps`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INSUFFICIENT_DATA');
    expect(res.body.eligiblePaperCount).toBe(0);
    expect(res.body.gaps).toHaveLength(0);
    expect(res.body.dataLimitations).toContain('At least 1 processed paper is required');
  });

  test('GET /api/projects/:id/gaps runs analysis on multi-paper corpus and returns evidence-grounded gaps', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectCorpusId}/gaps`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.eligiblePaperCount).toBe(2);
    expect(Array.isArray(res.body.gaps)).toBe(true);
    expect(res.body.gaps.length).toBeGreaterThanOrEqual(1);

    // Verify gap properties & evidence grounding
    const gap = res.body.gaps[0];
    expect(gap.title).toBeDefined();
    expect(gap.category).toBeDefined();
    expect(['Methodological', 'Empirical / Evaluation', 'Theoretical / Algorithmic', 'Application / Deployment', 'Scope & Generalizability']).toContain(gap.category);
    expect(['Explicit Gap', 'Corpus-Based Opportunity', 'Unverified Hypothesis']).toContain(gap.gapType);
    expect(gap.whyItMatters).toBeDefined();
    expect(gap.suggestedDirection).toBeDefined();
    expect(gap.confidenceScore).toBeGreaterThanOrEqual(0.1);
    expect(gap.confidenceRationale).toBeDefined();
    expect(gap.dataLimitations).toBeDefined();

    // Verify supporting papers are grounded in real corpus (no fabrication)
    expect(Array.isArray(gap.supportingPapers)).toBe(true);
    expect(gap.supportingPapers.length).toBeGreaterThanOrEqual(1);
    const paperRef = gap.supportingPapers[0];
    expect([paper1Id, paper2Id]).toContain(paperRef.paperId.toString());
    expect(['Adversarial Robustness in Federated Averaging', 'Differential Privacy Guarantees in Edge Aggregation']).toContain(paperRef.paperTitle);
    expect(paperRef.evidenceExcerpt).toBeDefined();
    expect(paperRef.evidenceExcerpt.length).toBeGreaterThan(0);
  });

  test('Distinguishes explicit gaps from corpus-based opportunities and unverified hypotheses', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectCorpusId}/gaps`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const gaps = res.body.gaps;

    const explicitGaps = gaps.filter(g => g.gapType === 'Explicit Gap');
    const corpusOpportunities = gaps.filter(g => g.gapType === 'Corpus-Based Opportunity');

    expect(explicitGaps.length).toBeGreaterThanOrEqual(1);
    // Explicit gaps must cite direct author-stated limitations or future work
    explicitGaps.forEach(g => {
      expect(g.supportingPapers[0].evidenceExcerpt).toBeTruthy();
    });
  });

  test('GET /api/projects/:id/recommendations returns actionable research directions with supporting gap linkages', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectCorpusId}/recommendations`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThanOrEqual(1);

    const rec = res.body.recommendations[0];
    expect(rec.title).toBeDefined();
    expect(rec.researchQuestion).toBeDefined();
    expect(rec.possibleMethodology).toBeDefined();
    expect(rec.expectedContribution).toBeDefined();
    expect(rec.whyRecommended).toBeDefined();
    expect(['High', 'Medium', 'Exploratory']).toContain(rec.priority);
    expect(['Literature Limitation', 'Future Work Extrapolation', 'Corpus Heuristic', 'Direct Author Suggestion', 'Synthesis']).toContain(rec.sourceType);
    expect(Array.isArray(rec.supportingPapers)).toBe(true);
    expect(rec.supportingPapers.length).toBeGreaterThanOrEqual(1);
  });

  test('Idempotency: Re-analyzing gaps does not create duplicate database records', async () => {
    // Call manual re-analysis POST endpoint
    const postRes1 = await request(app)
      .post(`/api/projects/${projectCorpusId}/gaps/analyze`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(postRes1.status).toBe(200);
    const countAfterFirst = await GapResult.countDocuments({ projectId: projectCorpusId });
    const recCountAfterFirst = await Recommendation.countDocuments({ projectId: projectCorpusId });

    // Call manual re-analysis POST endpoint a second time
    const postRes2 = await request(app)
      .post(`/api/projects/${projectCorpusId}/gaps/analyze`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(postRes2.status).toBe(200);
    const countAfterSecond = await GapResult.countDocuments({ projectId: projectCorpusId });
    const recCountAfterSecond = await Recommendation.countDocuments({ projectId: projectCorpusId });

    expect(countAfterSecond).toBe(countAfterFirst);
    expect(recCountAfterSecond).toBe(recCountAfterFirst);
  });

  test('Single paper project handles data honestly with PRELIMINARY framing', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectSingleId}/gaps`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.eligiblePaperCount).toBe(1);
    expect(res.body.dataLimitations).toMatch(/single paper|preliminary/i);
    // Any gap found must have preliminary disclaimer in its dataLimitations
    if (res.body.gaps.length > 0) {
      expect(res.body.gaps[0].dataLimitations).toMatch(/single paper|corpus/i);
    }
  });

  test('Background service: runGapAnalysisForProject updates project metadata correctly', async () => {
    const result = await runGapAnalysisForProject(projectCorpusId);
    expect(result.status).toBe('COMPLETED');
    expect(result.gapCount).toBeGreaterThanOrEqual(1);
    expect(result.recommendationCount).toBeGreaterThanOrEqual(1);

    const updatedProj = await Project.findById(projectCorpusId);
    expect(updatedProj.gapAnalysisStatus).toBe('COMPLETED');
    expect(updatedProj.lastGapAnalysisAt).toBeDefined();
    expect(updatedProj.gapCount).toBe(result.gapCount);
    expect(updatedProj.recommendationCount).toBe(result.recommendationCount);
  });

  test('Category filter on GET /api/projects/:id/gaps filters properly', async () => {
    const resAll = await request(app)
      .get(`/api/projects/${projectCorpusId}/gaps`)
      .set('Authorization', `Bearer ${user1Token}`);

    const allGaps = resAll.body.gaps;
    const cat = allGaps[0].category;

    const resFiltered = await request(app)
      .get(`/api/projects/${projectCorpusId}/gaps?category=${encodeURIComponent(cat)}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(resFiltered.status).toBe(200);
    expect(resFiltered.body.gaps.length).toBeGreaterThanOrEqual(1);
    resFiltered.body.gaps.forEach(g => {
      expect(g.category).toBe(cat);
    });
  });
});

/**
 * Phase 9 — Research Trend Analysis Tests
 */

jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock axios for NLP service keyword extraction
jest.mock('axios');
const axios = require('axios');

let mongoServer;
let app;
let User;
let Project;
let Paper;
let PaperAnalysis;
let TrendResult;

let user1Token;
let user2Token;
let user1Id;
let user2Id;
let project1Id; // Multi-year project
let project2Id; // Other user's project
let projectSingleYearId; // Project with 1 year
let projectEmptyId; // Project with 0 papers
let projectSparseId; // Project with 1 paper in 2024 and 1 paper in 2026 (sparse years)

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  process.env.JWT_SECRET = JWT_SECRET;

  app = require('../src/app');
  User = require('../src/models/User');
  Project = require('../src/models/Project');
  Paper = require('../src/models/Paper');
  PaperAnalysis = require('../src/models/PaperAnalysis');
  TrendResult = require('../src/models/TrendResult');

  // Create test users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123', salt);

  const user1 = await User.create({
    name: 'Trend Researcher One',
    email: 'researcher1_p9@example.com',
    password: passwordHash,
  });
  user1Id = user1._id;
  user1Token = jwt.sign({ id: user1._id, email: user1.email }, JWT_SECRET, { expiresIn: '1h' });

  const user2 = await User.create({
    name: 'Trend Researcher Two',
    email: 'researcher2_p9@example.com',
    password: passwordHash,
  });
  user2Id = user2._id;
  user2Token = jwt.sign({ id: user2._id, email: user2.email }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Project 1: Multi-year corpus (2022, 2024, 2026)
  const proj1 = await Project.create({
    name: 'Quantum Communications',
    domain: 'Physics',
    userId: user1Id,
  });
  project1Id = proj1._id.toString();

  // Paper 1 (2022 baseline)
  const p1 = await Paper.create({
    projectId: project1Id,
    title: 'Early Quantum Key Distribution',
    authors: ['Alice Smith'],
    originalFilename: 'qkd_2022.pdf',
    storedFilename: 'qkd_2022_stored.pdf',
    extractedText: 'Quantum cryptography principles and key distribution.',
    status: 'COMPLETED',
    publicationYear: 2022,
  });
  await PaperAnalysis.create({
    paperId: p1._id,
    projectId: project1Id,
    extractedKeywords: [
      { term: 'cryptography', score: 2.5, rank: 1 },
      { term: 'quantum', score: 2.0, rank: 2 },
      { term: 'distribution', score: 1.5, rank: 3 },
    ],
  });

  // Paper 2 (2024 recent)
  const p2 = await Paper.create({
    projectId: project1Id,
    title: 'Photonic Quantum Networks',
    authors: ['Bob Jones'],
    originalFilename: 'photonic_2024.pdf',
    storedFilename: 'photonic_2024_stored.pdf',
    extractedText: 'Photonic entanglement in quantum repeaters.',
    status: 'COMPLETED',
    publicationYear: 2024,
  });
  await PaperAnalysis.create({
    paperId: p2._id,
    projectId: project1Id,
    extractedKeywords: [
      { term: 'photonic', score: 3.1, rank: 1 },
      { term: 'quantum', score: 2.4, rank: 2 },
      { term: 'repeaters', score: 2.1, rank: 3 },
    ],
  });

  // Paper 3 (2026 recent - emerging topic 'photonic' & 'repeaters')
  const p3 = await Paper.create({
    projectId: project1Id,
    title: 'Advanced Photonic Repeaters Architecture',
    authors: ['Charlie Brown'],
    originalFilename: 'photonic_2026.pdf',
    storedFilename: 'photonic_2026_stored.pdf',
    extractedText: 'Scalable photonic repeaters for large quantum internet.',
    status: 'COMPLETED',
    publicationYear: 2026,
  });
  await PaperAnalysis.create({
    paperId: p3._id,
    projectId: project1Id,
    extractedKeywords: [
      { term: 'photonic', score: 3.5, rank: 1 },
      { term: 'repeaters', score: 2.9, rank: 2 },
      { term: 'quantum', score: 2.2, rank: 3 },
    ],
  });

  // Paper 4 (Missing year in project 1)
  const p4 = await Paper.create({
    projectId: project1Id,
    title: 'Undated Draft on Quantum Entanglement',
    authors: ['Diana Prince'],
    originalFilename: 'undated_draft.pdf',
    storedFilename: 'undated_draft_stored.pdf',
    extractedText: 'Quantum entanglement notes without publication metadata.',
    status: 'COMPLETED',
    publicationYear: null,
  });
  await PaperAnalysis.create({
    paperId: p4._id,
    projectId: project1Id,
    extractedKeywords: [
      { term: 'entanglement', score: 2.5, rank: 1 },
      { term: 'quantum', score: 2.0, rank: 2 },
    ],
  });

  // 2. Project Single Year (All papers dated 2026)
  const projSingle = await Project.create({
    name: 'Single Year Project',
    domain: 'Computer Science',
    userId: user1Id,
  });
  projectSingleYearId = projSingle._id.toString();

  const pSingle1 = await Paper.create({
    projectId: projectSingleYearId,
    title: 'Transformer Architecture In Depth',
    authors: ['Eva Green'],
    originalFilename: 'transformer.pdf',
    storedFilename: 'transformer_stored.pdf',
    extractedText: 'Attention mechanisms in modern transformer architectures.',
    status: 'COMPLETED',
    publicationYear: 2026,
  });
  await PaperAnalysis.create({
    paperId: pSingle1._id,
    projectId: projectSingleYearId,
    extractedKeywords: [
      { term: 'attention', score: 3.0, rank: 1 },
      { term: 'transformer', score: 2.8, rank: 2 },
    ],
  });

  // 3. Project Sparse: 1 paper in 2024 and 1 paper in 2026 with student author "RAJ PATIL"
  const projSparse = await Project.create({
    name: 'E-commerce & Lab Sparse Project',
    domain: 'IT',
    userId: user1Id,
  });
  projectSparseId = projSparse._id.toString();

  // 2024 Paper with flash sale terms
  const pSparse2024 = await Paper.create({
    projectId: projectSparseId,
    title: 'Flash Sale Architecture',
    authors: ['Dev Team'],
    originalFilename: 'sale.pdf',
    storedFilename: 'sale_stored.pdf',
    extractedText: 'Flash sale stock checkout price user handling.',
    status: 'COMPLETED',
    publicationYear: 2024,
  });
  await PaperAnalysis.create({
    paperId: pSparse2024._id,
    projectId: projectSparseId,
    extractedKeywords: [
      { term: 'sale', score: 3.2, rank: 1 },
      { term: 'stock', score: 3.0, rank: 2 },
      { term: 'checkout', score: 2.5, rank: 3 },
      { term: 'database', score: 2.0, rank: 4 },
    ],
  });

  // 2026 Paper with author "RAJ PATIL" and college report tokens
  const pSparse2026 = await Paper.create({
    projectId: projectSparseId,
    title: 'Practical 5 Lab',
    authors: ['RAJ PATIL'],
    originalFilename: 'Practical 5.pdf',
    storedFilename: 'Practical_5_stored.pdf',
    extractedText: 'Brainstorming ideas solution practical report RAJ PATIL.',
    status: 'COMPLETED',
    publicationYear: 2026,
  });
  await PaperAnalysis.create({
    paperId: pSparse2026._id,
    projectId: projectSparseId,
    extractedKeywords: [
      { term: 'patil', score: 3.5, rank: 1 }, // Author name should be filtered!
      { term: 'practical', score: 3.2, rank: 2 }, // Administrative noise should be filtered!
      { term: 'brainstorming', score: 2.9, rank: 3 },
      { term: 'database', score: 2.1, rank: 4 }, // Present in both!
    ],
  });

  // 4. Empty Project
  const projEmpty = await Project.create({
    name: 'Empty Workspace',
    domain: 'General',
    userId: user1Id,
  });
  projectEmptyId = projEmpty._id.toString();

  // 5. Project Owned by user 2
  const proj2 = await Project.create({
    name: 'Other User Research',
    domain: 'Biology',
    userId: user2Id,
  });
  project2Id = proj2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Phase 9 — Authentication & Project Ownership', () => {
  test('returns 401 when requesting trends without a token', async () => {
    const res = await request(app).get(`/api/projects/${project1Id}/trends`);
    expect(res.status).toBe(401);
  });

  test('returns 403 when requesting trends for a project owned by another user', async () => {
    const res = await request(app)
      .get(`/api/projects/${project2Id}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  test('returns 404 for non-existent project id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/projects/${fakeId}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(res.status).toBe(404);
  });
});

describe('Phase 9 — Empty & Single-Year Limitation States', () => {
  test('returns honest empty state for project with 0 papers', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectEmptyId}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalEligiblePapers).toBe(0);
    expect(res.body.status).toBe('NO_PAPERS');
    expect(res.body.hasSufficientHistoricalData).toBe(false);
    expect(res.body.topicTrends).toEqual([]);
    expect(res.body.dataCoverageMessage).toContain('No processed papers available');
  });

  test('returns honest single-year limitation state when all papers are from 1 year', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectSingleYearId}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalEligiblePapers).toBe(1);
    expect(res.body.papersInYearlyAnalysis).toBe(1);
    expect(res.body.distinctYears).toEqual([2026]);
    expect(res.body.hasSufficientHistoricalData).toBe(false);
    expect(res.body.status).toBe('SINGLE_YEAR');
    expect(res.body.dataCoverageMessage).toContain('Longitudinal trend velocity and emerging topic identification require');
    expect(res.body.topKeywords.length).toBeGreaterThan(0);

    // Topics in single-year snapshot must not fabricate emergence
    res.body.topicTrends.forEach(t => {
      expect(t.badge).toBe('Insufficient Data');
      expect(t.status).toBe('Insufficient Data');
      expect(t.growthTrend).toBe('N/A');
    });
  });
});

describe('Phase 9 — Sparse Years & The Patil / -100% Anomaly Prevention', () => {
  test('correctly filters author names and administrative noise (filters "patil" and "practical")', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectSparseId}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.distinctYears).toEqual([2024, 2026]);

    const topics = res.body.topicTrends.map(t => t.topic.toLowerCase());
    // Author name "patil" must be excluded
    expect(topics).not.toContain('patil');
    // Administrative stop word "practical" must be excluded
    expect(topics).not.toContain('practical');

    // Genuine research keywords like "sale", "stock", "brainstorming", "database" are preserved
    expect(topics).toContain('database');
  });

  test('does not generate -100% decline or +1000% steady on sparse 1-paper vs 1-paper comparisons', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectSparseId}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);

    // "sale" was in 2024 (1 paper) and absent in 2026 (1 paper)
    const saleTopic = res.body.topicTrends.find(t => t.topic === 'sale');
    if (saleTopic) {
      expect(saleTopic.status).toBe('Insufficient Data');
      expect(saleTopic.growthTrend).toBe('N/A');
      expect(saleTopic.growthPercentage).toBeNull();
      expect(saleTopic.badge).not.toBe('Declining');
      expect(saleTopic.growthTrend).not.toContain('-100%');
    }

    // "brainstorming" was in 2026 (1 paper) and absent in 2024 (1 paper)
    const brainstormTopic = res.body.topicTrends.find(t => t.topic === 'brainstorming');
    if (brainstormTopic) {
      expect(brainstormTopic.status).toBe('Newly Observed');
      expect(brainstormTopic.growthTrend).not.toContain('+1000%');
      expect(brainstormTopic.growthTrend).not.toContain('Steady');
      expect(brainstormTopic.growthPercentage).toBeNull();
    }

    // "database" was in both 2024 and 2026 (100% in both) -> Stable
    const dbTopic = res.body.topicTrends.find(t => t.topic === 'database');
    expect(dbTopic).toBeDefined();
    expect(dbTopic.status).toBe('Stable');
  });
});

describe('Phase 9 — Multi-Year Trend Analysis & Real Emergence', () => {
  test('correctly calculates keyword frequencies, timeline, and detects Newly Observed across multi-year corpus', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalEligiblePapers).toBe(4);
    expect(res.body.papersInYearlyAnalysis).toBe(3); // 2022, 2024, 2026
    expect(res.body.papersMissingYear).toBe(1); // 1 undated draft
    expect(res.body.distinctYears).toEqual([2022, 2024, 2026]);
    expect(res.body.hasSufficientHistoricalData).toBe(true);
    expect(res.body.status).toBe('SUFFICIENT_DATA');

    // Missing year papers list
    expect(res.body.missingYearPapers.length).toBe(1);
    expect(res.body.missingYearPapers[0].originalFilename).toBe('undated_draft.pdf');

    // Check top keywords
    const topKeywords = res.body.topKeywords;
    expect(topKeywords.length).toBeGreaterThan(0);
    const quantumKw = topKeywords.find(k => k.term === 'quantum');
    expect(quantumKw).toBeDefined();

    // Check 'photonic': absent in 2022 (baseline: 0), present in both 2024 and 2026 (2 recent papers)
    // Baseline is zero, so relative percentage is N/A, and status is 'Newly Observed'!
    const photonicTopic = res.body.topicTrends.find(t => t.topic === 'photonic');
    expect(photonicTopic).toBeDefined();
    expect(photonicTopic.badge).toBe('Newly Observed');
    expect(photonicTopic.status).toBe('Newly Observed');
    expect(photonicTopic.growthPercentage).toBeNull(); // N/A, no artificial +1000%!
    expect(photonicTopic.insight).toContain('New topic');

    // Yearly timeline verification
    expect(res.body.yearlyTimeline.length).toBe(3);
    const timeline2022 = res.body.yearlyTimeline.find(yt => yt.year === 2022);
    expect(timeline2022.paperCount).toBe(1);
    expect(timeline2022.keywords['cryptography']).toBe(1);
  });
});

describe('Phase 9 — Paper Metadata Update (PATCH /api/papers/:id)', () => {
  test('allows authenticated owner to update paper publication year', async () => {
    const draft = await Paper.findOne({ originalFilename: 'undated_draft.pdf' });
    expect(draft.publicationYear).toBeNull();

    const patchRes = await request(app)
      .patch(`/api/papers/${draft._id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ publicationYear: 2025 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.publicationYear).toBe(2025);

    // Verify trends now include 2025 and papersMissingYear decreased to 0
    const trendRes = await request(app)
      .get(`/api/projects/${project1Id}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(trendRes.body.papersMissingYear).toBe(0);
    expect(trendRes.body.papersInYearlyAnalysis).toBe(4);
    expect(trendRes.body.distinctYears).toContain(2025);
  });

  test('validates publication year range (rejects < 1900 or > 2100)', async () => {
    const draft = await Paper.findOne({ originalFilename: 'undated_draft.pdf' });
    const res = await request(app)
      .patch(`/api/papers/${draft._id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ publicationYear: 1840 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('between 1900 and 2100');
  });

  test('forbids unauthorized users from updating papers', async () => {
    const draft = await Paper.findOne({ originalFilename: 'undated_draft.pdf' });
    const res = await request(app)
      .patch(`/api/papers/${draft._id}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ publicationYear: 2023 });

    expect(res.status).toBe(404);
  });
});

describe('Phase 9 — Paper-Level Topic Details & Detailed Metric API', () => {
  test('returns paper-level topic details in topicTrends with real paper records', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/trends`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.observedYearsBreakdown).toBeDefined();
    expect(Array.isArray(res.body.observedYearsBreakdown)).toBe(true);

    const photonicTopic = res.body.topicTrends.find(t => t.topic === 'photonic');
    expect(photonicTopic).toBeDefined();
    expect(Array.isArray(photonicTopic.papers)).toBe(true);
    expect(photonicTopic.papers.length).toBeGreaterThanOrEqual(1);

    const paperEntry = photonicTopic.papers[0];
    expect(paperEntry.paperId).toBeDefined();
    expect(paperEntry.title).toBeDefined();
    expect(paperEntry.originalFilename).toBeDefined();
    expect(paperEntry.publicationYear).toBeDefined();
    expect(paperEntry.occurrencesInPaper).toBeGreaterThanOrEqual(1);

    // Verify transparent comparison fields
    expect(photonicTopic.baselineTopicPapers).toBeDefined();
    expect(photonicTopic.recentTopicPapers).toBeDefined();
    expect(photonicTopic.baselinePrevalence).toBeDefined();
    expect(photonicTopic.recentPrevalence).toBeDefined();
    expect(photonicTopic.percentagePointDiff).toBeDefined();
    expect(photonicTopic.statusCriteria).toBeDefined();
  });

  test('GET /api/projects/:id/trends/topics/:term returns dedicated paper list', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/trends/topics/photonic`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('photonic');
    expect(res.body.paperCount).toBeGreaterThanOrEqual(1);
    expect(res.body.occurrenceCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.papers)).toBe(true);
    expect(res.body.papers[0].title).toBeDefined();
  });

  test('GET /api/projects/:id/trends/topics/:term enforces project authorization', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/trends/topics/photonic`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
  });
});

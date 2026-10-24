/**
 * Phase 8 — TF-IDF + Cosine Similarity Screening Tests
 */

jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock axios for NLP service calls
jest.mock('axios');
const axios = require('axios');

let mongoServer;
let app;
let User;
let Project;
let Paper;
let PaperAnalysis;
let SimilarityResult;

let user1Token;
let user2Token;
let user1Id;
let user2Id;
let project1Id;
let project2Id;
let paper1Id;
let paper2Id;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  process.env.JWT_SECRET = JWT_SECRET;
  process.env.SIMILARITY_HIGH_THRESHOLD = '0.60';
  process.env.SIMILARITY_MODERATE_THRESHOLD = '0.30';

  app = require('../src/app');
  User = require('../src/models/User');
  Project = require('../src/models/Project');
  Paper = require('../src/models/Paper');
  PaperAnalysis = require('../src/models/PaperAnalysis');
  SimilarityResult = require('../src/models/SimilarityResult');

  // Create test users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123', salt);

  const user1 = await User.create({
    name: 'Researcher One',
    email: 'researcher1_p8@example.com',
    password: passwordHash,
  });
  user1Id = user1._id;
  user1Token = jwt.sign({ id: user1._id, email: user1.email }, JWT_SECRET, { expiresIn: '1h' });

  const user2 = await User.create({
    name: 'Researcher Two',
    email: 'researcher2_p8@example.com',
    password: passwordHash,
  });
  user2Id = user2._id;
  user2Token = jwt.sign({ id: user2._id, email: user2.email }, JWT_SECRET, { expiresIn: '1h' });

  // Create projects
  const proj1 = await Project.create({
    name: 'Wind Turbine Diagnostics',
    domain: 'Renewable Energy',
    userId: user1Id,
  });
  project1Id = proj1._id.toString();

  const proj2 = await Project.create({
    name: 'Other User Project',
    domain: 'General',
    userId: user2Id,
  });
  project2Id = proj2._id.toString();

  // Create completed papers with extracted text for project 1
  const paper1 = await Paper.create({
    projectId: project1Id,
    title: 'Vibration Signal Analysis in Wind Turbines',
    originalFilename: 'wind_vibration.pdf',
    storedFilename: 'wind_vibration_stored.pdf',
    extractedText: 'Vibration sensors monitor gearbox faults in offshore wind turbines using spectral analysis and frequency decomposition.',
    status: 'COMPLETED',
    fileSizeBytes: 1024,
  });
  paper1Id = paper1._id.toString();

  const paper2 = await Paper.create({
    projectId: project1Id,
    title: 'Acoustic Emission for Bearing Health Monitoring',
    originalFilename: 'acoustic_bearing.pdf',
    storedFilename: 'acoustic_bearing_stored.pdf',
    extractedText: 'Acoustic emissions detect crack propagation and lubrication degradation in high-speed wind turbine bearings.',
    status: 'COMPLETED',
    fileSizeBytes: 2048,
  });
  paper2Id = paper2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Phase 8 — POST /api/projects/:id/novelty', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/novelty`)
      .send({ researchIdea: 'Machine learning for wind turbines' });

    expect(res.status).toBe(401);
  });

  test('enforces project ownership with 403 when user does not own the project', async () => {
    const res = await request(app)
      .post(`/api/projects/${project2Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ researchIdea: 'Machine learning for wind turbines' });

    expect(res.status).toBe(403);
  });

  test('rejects empty or whitespace research idea with 400', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ researchIdea: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('successfully screens research idea against project papers and persists results', async () => {
    const mockNlpResponse = {
      research_idea: 'Deep learning for gearbox vibration fault detection in wind turbines',
      overall_similarity_score: 0.68,
      overall_similarity_percentage: 68.0,
      interpretation: 'High',
      interpretation_text: 'The research idea has high textual similarity to papers in the current project corpus.',
      status_badge: 'HIGH OVERLAP',
      explanation: 'This score reflects textual similarity to the available project corpus.',
      similar_papers: [
        {
          paper_id: paper1Id,
          title: 'Vibration Signal Analysis in Wind Turbines',
          original_filename: 'wind_vibration.pdf',
          similarity_score: 0.68,
          similarity_percentage: 68.0,
          matching_keywords: ['vibration', 'wind', 'turbines', 'gearbox', 'faults'],
          rank: 1,
        },
        {
          paper_id: paper2Id,
          title: 'Acoustic Emission for Bearing Health Monitoring',
          original_filename: 'acoustic_bearing.pdf',
          similarity_score: 0.25,
          similarity_percentage: 25.0,
          matching_keywords: ['wind', 'turbine'],
          rank: 2,
        },
      ],
      matching_keywords: ['gearbox', 'turbines', 'vibration', 'wind'],
      total_papers_analyzed: 2,
      thresholds_used: { high: 0.6, moderate: 0.3 },
      has_error: false,
    };

    axios.post.mockResolvedValueOnce({ data: mockNlpResponse });

    const res = await request(app)
      .post(`/api/projects/${project1Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ researchIdea: 'Deep learning for gearbox vibration fault detection in wind turbines' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.overallSimilarityPercentage).toBe(68.0);
    expect(res.body.interpretation).toBe('High');
    expect(res.body.statusBadge).toBe('HIGH OVERLAP');
    expect(res.body.explanation).toBe('This score reflects textual similarity to the available project corpus.');
    expect(res.body.similarPapers).toHaveLength(2);
    expect(res.body.similarPapers[0].rank).toBe(1);
    expect(res.body.similarPapers[0].similarity_percentage).toBe(68.0);
    expect(res.body.matchingKeywords).toEqual(['gearbox', 'turbines', 'vibration', 'wind']);

    // Verify axios received only project 1 papers
    expect(axios.post).toHaveBeenCalledTimes(1);
    const postCallArgs = axios.post.mock.calls[0];
    expect(postCallArgs[0]).toMatch(/\/similarity-screening/);
    const sentPayload = postCallArgs[1];
    expect(sentPayload.project_id).toBe(project1Id);
    expect(sentPayload.papers).toHaveLength(2);
    expect(sentPayload.papers.map((p) => p.id)).toContain(paper1Id);
    expect(sentPayload.papers.map((p) => p.id)).toContain(paper2Id);

    // Verify persisted record in SimilarityResult
    const saved = await SimilarityResult.findOne({ projectId: project1Id });
    expect(saved).not.toBeNull();
    expect(saved.targetTopic).toBe('Deep learning for gearbox vibration fault detection in wind turbines');
    expect(saved.overallSimilarityScore).toBe(68.0);
    expect(saved.interpretation).toBe('High');
    expect(saved.statusBadge).toBe('HIGH OVERLAP');
    expect(saved.explanation).toBe('This score reflects textual similarity to the available project corpus.');
    expect(saved.similarPapers).toHaveLength(2);
  });

  test('handles moderate similarity score correctly', async () => {
    const mockModerateResponse = {
      research_idea: 'Acoustic signal processing for energy systems',
      overall_similarity_score: 0.42,
      overall_similarity_percentage: 42.0,
      interpretation: 'Moderate',
      interpretation_text: 'The research idea shows moderate textual overlap with some papers in the corpus.',
      status_badge: 'MODERATE OVERLAP',
      explanation: 'This score reflects textual similarity to the available project corpus.',
      similar_papers: [
        {
          paper_id: paper2Id,
          title: 'Acoustic Emission for Bearing Health Monitoring',
          original_filename: 'acoustic_bearing.pdf',
          similarity_score: 0.42,
          similarity_percentage: 42.0,
          matching_keywords: ['acoustic'],
          rank: 1,
        },
      ],
      matching_keywords: ['acoustic'],
      total_papers_analyzed: 2,
      thresholds_used: { high: 0.6, moderate: 0.3 },
      has_error: false,
    };

    axios.post.mockResolvedValueOnce({ data: mockModerateResponse });

    const res = await request(app)
      .post(`/api/projects/${project1Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ researchIdea: 'Acoustic signal processing for energy systems' });

    expect(res.status).toBe(200);
    expect(res.body.interpretation).toBe('Moderate');
    expect(res.body.statusBadge).toBe('MODERATE OVERLAP');
  });

  test('handles NLP service errors gracefully with 502', async () => {
    axios.post.mockRejectedValueOnce(new Error('Connection refused to NLP service'));

    const res = await request(app)
      .post(`/api/projects/${project1Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ researchIdea: 'Some novel idea' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable/i);
  });
});

describe('Phase 8 — GET /api/projects/:id/novelty', () => {
  test('retrieves saved screening result for project', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(project1Id);
    expect(res.body.totalCorpusPapers).toBe(2);
    expect(res.body.result).not.toBeNull();
    expect(res.body.result.overallSimilarityPercentage).toBe(42.0);
    expect(res.body.result.explanation).toBe('This score reflects textual similarity to the available project corpus.');
  });

  test('returns null result when project has not been screened yet', async () => {
    const res = await request(app)
      .get(`/api/projects/${project2Id}/novelty`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.result).toBeNull();
  });

  test('enforces authorization for GET novelty', async () => {
    const res = await request(app)
      .get(`/api/projects/${project2Id}/novelty`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(403);
  });
});

describe('Phase 8 — Consolidated Report Integration', () => {
  test('GET /api/projects/:id/report includes similarityScreening data when available', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/report`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(project1Id);
    expect(res.body.similarityScreening).not.toBeNull();
    expect(res.body.similarityScreening.similarityPercentage).toBe(42.0);
    expect(res.body.similarityScreening.statusBadge).toBe('MODERATE OVERLAP');
    expect(res.body.similarityScreening.explanation).toBe('This score reflects textual similarity to the available project corpus.');
  });
});

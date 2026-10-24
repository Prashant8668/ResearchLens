/**
 * Paper Deletion Tests
 * Tests:
 *  1. Unauthenticated deletion returns 401
 *  2. Non-existent paper deletion returns 404
 *  3. Unauthorized deletion (User 2 attempts to delete User 1's paper) returns 403
 *  4. Successful deletion:
 *     - Database record removed
 *     - Associated PaperAnalysis removed
 *     - Physical PDF file unlinked from disk
 *     - SimilarityResult, GapResult, and Recommendation references cleaned up safely
 *     - Background gap analysis updated
 *  5. Duplicate deletion attempt returns 404
 *  6. Deleting one paper in a multi-paper project preserves remaining papers and recomputes stats
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');

// Mock axios before requiring app
jest.mock('axios');

const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Paper = require('../src/models/Paper');
const PaperAnalysis = require('../src/models/PaperAnalysis');
const SimilarityResult = require('../src/models/SimilarityResult');
const GapResult = require('../src/models/GapResult');
const Recommendation = require('../src/models/Recommendation');
const TrendResult = require('../src/models/TrendResult');

let mongoServer;
let token1, token2;
let user1Id, user2Id;
let project1Id, project2Id;
let tmpDir;

const authHeader = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-deletion-'));
  process.env.UPLOAD_DIR = tmpDir;

  const salt = await bcrypt.genSalt(10);
  const pass = await bcrypt.hash('Password123', salt);

  const u1 = new User({ name: 'User One', email: 'user1@test.com', password: pass });
  await u1.save();
  user1Id = u1._id;

  const u2 = new User({ name: 'User Two', email: 'user2@test.com', password: pass });
  await u2.save();
  user2Id = u2._id;

  const r1 = await request(app).post('/api/auth/login').send({ email: 'user1@test.com', password: 'Password123' });
  token1 = r1.body.token;

  const r2 = await request(app).post('/api/auth/login').send({ email: 'user2@test.com', password: 'Password123' });
  token2 = r2.body.token;

  const p1 = new Project({ name: 'Project Alpha', userId: user1Id });
  await p1.save();
  project1Id = p1._id;

  const p2 = new Project({ name: 'Project Beta', userId: user2Id });
  await p2.save();
  project2Id = p2._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('PDF Paper Deletion Suite', () => {
  let paper1, paper2;
  let file1Path;

  beforeEach(async () => {
    // Create physical dummy PDF file in tmpDir
    const storedFilename = `test_${Date.now()}_alpha.pdf`;
    file1Path = path.join(tmpDir, storedFilename);
    fs.writeFileSync(file1Path, '%PDF-1.4 dummy test content');

    // Create Paper owned by User 1
    paper1 = new Paper({
      projectId: project1Id,
      originalFilename: 'alpha_paper.pdf',
      storedFilename,
      status: 'COMPLETED',
      title: 'Alpha Deep Learning Study',
      extractedText: 'Transformers and self-attention mechanisms in deep learning.',
      publicationYear: 2023,
    });
    await paper1.save();

    // Create PaperAnalysis for paper1
    await PaperAnalysis.create({
      paperId: paper1._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'deep learning', score: 3.5, rank: 1 },
        { term: 'transformers', score: 2.8, rank: 2 },
      ],
    });

    // Create second paper in same project
    paper2 = new Paper({
      projectId: project1Id,
      originalFilename: 'beta_paper.pdf',
      storedFilename: 'test_beta.pdf',
      status: 'COMPLETED',
      title: 'Beta Neural Systems',
      extractedText: 'Neural networks and architectural search benchmarks.',
      publicationYear: 2024,
    });
    await paper2.save();

    await PaperAnalysis.create({
      paperId: paper2._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'neural networks', score: 3.0, rank: 1 },
      ],
    });

    // Create SimilarityResult referencing paper1 and paper2
    await SimilarityResult.create({
      projectId: project1Id,
      targetTopic: 'Deep Learning',
      similarPapers: [
        { paperId: paper1._id, title: 'Alpha Deep Learning Study', similarityScore: 0.85 },
        { paperId: paper2._id, title: 'Beta Neural Systems', similarityScore: 0.65 },
      ],
    });

    // Create GapResult referencing paper1
    await GapResult.create({
      projectId: project1Id,
      title: 'Transformer Scalability Gap',
      topic: 'Transformers',
      description: 'Lack of evaluation on low-resource hardware.',
      whyItMatters: 'Critical for edge devices.',
      suggestedDirection: 'Quantization benchmarks.',
      supportingPapers: [
        { paperId: paper1._id, title: 'Alpha Deep Learning Study' },
      ],
    });

    // Create Recommendation referencing paper1
    await Recommendation.create({
      projectId: project1Id,
      title: 'Investigate Efficient Transformers',
      researchQuestion: 'How does pruning affect attention weights?',
      possibleMethodology: 'Empirical benchmark across 5 architectures',
      expectedContribution: 'Novel pruning metric',
      whyRecommended: 'High community demand',
      supportingPapers: [
        { paperId: paper1._id, title: 'Alpha Deep Learning Study' },
      ],
      evidenceExcerpts: [
        { paperId: paper1._id, excerpt: 'Future work should explore attention pruning.', paperTitle: 'Alpha Deep Learning Study' },
      ],
    });
  });

  afterEach(async () => {
    await Paper.deleteMany({});
    await PaperAnalysis.deleteMany({});
    await SimilarityResult.deleteMany({});
    await GapResult.deleteMany({});
    await Recommendation.deleteMany({});
    await TrendResult.deleteMany({});
    if (file1Path && fs.existsSync(file1Path)) {
      try { fs.unlinkSync(file1Path); } catch (_) {}
    }
  });

  test('1. Unauthenticated deletion (no token) returns 401', async () => {
    const res = await request(app).delete(`/api/papers/${paper1._id}`);
    expect(res.statusCode).toBe(401);
  });

  test('2. Non-existent paper deletion returns 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/papers/${fakeId}`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/Paper not found/i);
  });

  test('3. Unauthorized deletion attempt (User 2 tries to delete User 1 paper) returns 403', async () => {
    const res = await request(app)
      .delete(`/api/papers/${paper1._id}`)
      .set(authHeader(token2));

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);

    // Verify paper, analysis, and file remain completely intact
    const paperStillExists = await Paper.findById(paper1._id);
    expect(paperStillExists).not.toBeNull();

    const analysisStillExists = await PaperAnalysis.findOne({ paperId: paper1._id });
    expect(analysisStillExists).not.toBeNull();

    expect(fs.existsSync(file1Path)).toBe(true);
  });

  test('4. Successful deletion: removes paper, analysis, stored PDF file, and cleans up references', async () => {
    expect(fs.existsSync(file1Path)).toBe(true);

    const res = await request(app)
      .delete(`/api/papers/${paper1._id}`)
      .set(authHeader(token1));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/Paper deleted successfully/i);
    expect(res.body.id.toString()).toBe(paper1._id.toString());
    expect(res.body.projectId.toString()).toBe(project1Id.toString());

    // 1. Paper is deleted from DB
    const paperInDb = await Paper.findById(paper1._id);
    expect(paperInDb).toBeNull();

    // 2. PaperAnalysis is deleted from DB
    const analysisInDb = await PaperAnalysis.findOne({ paperId: paper1._id });
    expect(analysisInDb).toBeNull();

    // 3. Stored physical PDF file is deleted from disk
    expect(fs.existsSync(file1Path)).toBe(false);

    // 4. SimilarityResult has paper1 reference safely removed, paper2 intact
    const similarity = await SimilarityResult.findOne({ projectId: project1Id });
    expect(similarity).not.toBeNull();
    const remainingPaperIds = similarity.similarPapers.map(p => p.paperId.toString());
    expect(remainingPaperIds).not.toContain(paper1._id.toString());
    expect(remainingPaperIds).toContain(paper2._id.toString());

    // 5. GapResult has paper1 reference pulled
    const gap = await GapResult.findOne({ projectId: project1Id });
    if (gap) {
      const gapPaperIds = gap.supportingPapers.map(p => p.paperId.toString());
      expect(gapPaperIds).not.toContain(paper1._id.toString());
    }

    // 6. Recommendation has paper1 reference pulled
    const rec = await Recommendation.findOne({ projectId: project1Id });
    if (rec) {
      const recPaperIds = rec.supportingPapers.map(p => p.paperId.toString());
      expect(recPaperIds).not.toContain(paper1._id.toString());
      const excerptPaperIds = rec.evidenceExcerpts.map(e => e.paperId.toString());
      expect(excerptPaperIds).not.toContain(paper1._id.toString());
    }
  });

  test('5. Duplicate deletion attempt on already deleted paper returns 404', async () => {
    // First deletion
    const firstRes = await request(app)
      .delete(`/api/papers/${paper1._id}`)
      .set(authHeader(token1));
    expect(firstRes.statusCode).toBe(200);

    // Immediate second deletion
    const secondRes = await request(app)
      .delete(`/api/papers/${paper1._id}`)
      .set(authHeader(token1));
    expect(secondRes.statusCode).toBe(404);
    expect(secondRes.body.error).toMatch(/Paper not found/i);
  });

  test('6. Multi-paper project: deleting paper1 preserves paper2 and updates keywords', async () => {
    // Before delete: 2 papers in project
    const beforePapers = await Paper.find({ projectId: project1Id });
    expect(beforePapers.length).toBe(2);

    // Delete paper1
    const res = await request(app)
      .delete(`/api/papers/${paper1._id}`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(200);

    // After delete: paper2 remains intact
    const afterPapers = await Paper.find({ projectId: project1Id });
    expect(afterPapers.length).toBe(1);
    expect(afterPapers[0]._id.toString()).toBe(paper2._id.toString());

    // Paper2 analysis is preserved
    const paper2Analysis = await PaperAnalysis.findOne({ paperId: paper2._id });
    expect(paper2Analysis).not.toBeNull();
    expect(paper2Analysis.extractedKeywords.some(k => k.term === 'neural networks')).toBe(true);

    // Project analysis returns only paper2 keywords
    const projAnalysis = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));
    expect(projAnalysis.statusCode).toBe(200);
    const kwTerms = (projAnalysis.body.aggregatedKeywords || []).map(k => k.term);
    expect(kwTerms).toContain('neural networks');
    expect(kwTerms).not.toContain('deep learning');
  });
});

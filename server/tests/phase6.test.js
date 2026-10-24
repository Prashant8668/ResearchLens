/**
 * Phase 6 — NLP Keyword Extraction Tests
 * Tests:
 *  1. GET /api/papers/:id/analysis (authentication, ownership, single-paper keywords)
 *  2. GET /api/projects/:id/analysis (authentication, ownership, aggregated keywords)
 *  3. PaperAnalysis upsert & duplicate prevention
 *  4. End-to-end integration: PDF upload -> processing -> keyword extraction -> analysis API
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
const axios = require('axios');

const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Paper = require('../src/models/Paper');
const PaperAnalysis = require('../src/models/PaperAnalysis');

let mongoServer;
let token1, token2;
let user1Id, user2Id;
let project1Id, project2Id;
let tmpDir;

const VALID_PDF_BUF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-phase6-'));
  process.env.UPLOAD_DIR = tmpDir;

  const salt = await bcrypt.genSalt(10);
  const pass = await bcrypt.hash('Password123', salt);

  const u1 = new User({ name: 'Alice', email: 'alice_p6@test.com', password: pass });
  await u1.save();
  user1Id = u1._id;

  const u2 = new User({ name: 'Bob', email: 'bob_p6@test.com', password: pass });
  await u2.save();
  user2Id = u2._id;

  const r1 = await request(app).post('/api/auth/login').send({ email: 'alice_p6@test.com', password: 'Password123' });
  token1 = r1.body.token;

  const r2 = await request(app).post('/api/auth/login').send({ email: 'bob_p6@test.com', password: 'Password123' });
  token2 = r2.body.token;

  const p1 = new Project({ name: 'NLP Project Alpha', userId: user1Id });
  await p1.save();
  project1Id = p1._id.toString();

  const p2 = new Project({ name: 'NLP Project Beta', userId: user2Id });
  await p2.save();
  project2Id = p2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

afterEach(async () => {
  await Paper.deleteMany({});
  await PaperAnalysis.deleteMany({});
  jest.clearAllMocks();
});

const authHeader = (tok) => ({ Authorization: 'Bearer ' + tok });

describe('Phase 6 — GET /api/papers/:id/analysis', () => {
  it('rejects unauthenticated request with 401', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/papers/${fakeId}/analysis`);
    expect(res.statusCode).toBe(401);
  });

  it('rejects request with invalid token with 401', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/papers/${fakeId}/analysis`)
      .set('Authorization', 'Bearer invalid.token');
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for nonexistent paper', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/papers/${fakeId}/analysis`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(404);
  });

  it('forbids access to another user paper', async () => {
    const paper = new Paper({
      projectId: project2Id,
      originalFilename: 'bob_paper.pdf',
      storedFilename: 'stored_bob.pdf',
      status: 'COMPLETED',
    });
    await paper.save();

    const res = await request(app)
      .get(`/api/papers/${paper._id}/analysis`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(404);
  });

  it('returns empty keywords when no analysis has been performed yet', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'new_paper.pdf',
      storedFilename: 'stored_new.pdf',
      status: 'QUEUED',
    });
    await paper.save();

    const res = await request(app)
      .get(`/api/papers/${paper._id}/analysis`)
      .set(authHeader(token1));

    expect(res.statusCode).toBe(200);
    expect(res.body.paperId).toBe(paper._id.toString());
    expect(res.body.extractedKeywords).toEqual([]);
    expect(res.body.keywordsExtractedAt).toBeNull();
  });

  it('returns real keywords when PaperAnalysis exists', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'analyzed.pdf',
      storedFilename: 'stored_analyzed.pdf',
      status: 'COMPLETED',
    });
    await paper.save();

    const analysis = new PaperAnalysis({
      paperId: paper._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'transformer', score: 1.85, rank: 1 },
        { term: 'attention', score: 1.42, rank: 2 },
      ],
      keywordsExtractedAt: new Date(),
    });
    await analysis.save();

    const res = await request(app)
      .get(`/api/papers/${paper._id}/analysis`)
      .set(authHeader(token1));

    expect(res.statusCode).toBe(200);
    expect(res.body.paperId).toBe(paper._id.toString());
    expect(res.body.extractedKeywords).toHaveLength(2);
    expect(res.body.extractedKeywords[0].term).toBe('transformer');
    expect(res.body.extractedKeywords[0].rank).toBe(1);
    expect(res.body.extractedKeywords[1].term).toBe('attention');
    expect(res.body.extractedKeywords[1].rank).toBe(2);
  });
});

describe('Phase 6 — GET /api/projects/:id/analysis', () => {
  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app).get(`/api/projects/${project1Id}/analysis`);
    expect(res.statusCode).toBe(401);
  });

  it('forbids access to another user project', async () => {
    const res = await request(app)
      .get(`/api/projects/${project2Id}/analysis`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(403);
  });

  it('returns empty aggregated keywords for project with no papers', async () => {
    const res = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));

    expect(res.statusCode).toBe(200);
    expect(res.body.projectId).toBe(project1Id);
    expect(res.body.papersAnalyzed).toBe(0);
    expect(res.body.aggregatedKeywords).toEqual([]);
  });

  it('aggregates keywords across multiple papers and sorts by score', async () => {
    const paperA = new Paper({
      projectId: project1Id,
      originalFilename: 'paperA.pdf',
      storedFilename: 'storedA.pdf',
      status: 'COMPLETED',
    });
    await paperA.save();

    const paperB = new Paper({
      projectId: project1Id,
      originalFilename: 'paperB.pdf',
      storedFilename: 'storedB.pdf',
      status: 'COMPLETED',
    });
    await paperB.save();

    await PaperAnalysis.create({
      paperId: paperA._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'transformer', score: 1.5, rank: 1 },
        { term: 'bert', score: 1.0, rank: 2 },
      ],
      keywordsExtractedAt: new Date(),
    });

    await PaperAnalysis.create({
      paperId: paperB._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'transformer', score: 2.0, rank: 1 },
        { term: 'attention', score: 1.2, rank: 2 },
      ],
      keywordsExtractedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));

    expect(res.statusCode).toBe(200);
    expect(res.body.projectId).toBe(project1Id);
    expect(res.body.papersAnalyzed).toBe(2);

    const kws = res.body.aggregatedKeywords;
    expect(kws).toBeDefined();
    expect(kws.length).toBe(3);

    // transformer was in both papers: 1.5 + 2.0 = 3.5 total score
    expect(kws[0].term).toBe('transformer');
    expect(kws[0].rank).toBe(1);
    expect(kws[0].paperCount).toBe(2);
    expect(kws[0].totalScore).toBeCloseTo(3.5, 2);

    // attention: 1.2, paperCount 1
    expect(kws[1].term).toBe('attention');
    expect(kws[1].rank).toBe(2);
    expect(kws[1].paperCount).toBe(1);

    // bert: 1.0, paperCount 1
    expect(kws[2].term).toBe('bert');
    expect(kws[2].rank).toBe(3);
    expect(kws[2].paperCount).toBe(1);
  });
});

describe('Phase 6 — Paper Upload & End-to-End Keyword Extraction Flow', () => {
  it('extracts keywords upon upload and persists to PaperAnalysis', async () => {
    // Mock FastAPI responses:
    // 1. /process-pdf/ -> returns extracted text
    // 2. /extract-keywords/ -> returns ranked keywords
    axios.post.mockImplementation((url) => {
      if (url.includes('/process-pdf')) {
        return Promise.resolve({
          data: {
            paper_id: 'test_id',
            text: 'Neural networks and deep learning algorithms achieve state-of-the-art accuracy.',
            metadata: { title: 'Deep Learning Paper', authors: ['Dr. Smith'], year: 2024 },
          },
        });
      }
      if (url.includes('/extract-keywords')) {
        return Promise.resolve({
          data: {
            paper_id: 'test_id',
            keywords: [
              { term: 'neural', score: 1.8, rank: 1 },
              { term: 'learning', score: 1.4, rank: 2 },
              { term: 'accuracy', score: 0.9, rank: 3 },
            ],
            total: 3,
          },
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'nlp_paper.pdf', contentType: 'application/pdf' });

    expect(res.statusCode).toBe(201);
    const paperId = res.body.papers[0].id;

    // Allow async processing to complete
    await new Promise((r) => setTimeout(r, 600));

    // Verify Paper record
    const paper = await Paper.findById(paperId);
    expect(paper.status).toBe('COMPLETED');

    // Verify PaperAnalysis record
    const analysis = await PaperAnalysis.findOne({ paperId });
    expect(analysis).not.toBeNull();
    expect(analysis.projectId.toString()).toBe(project1Id);
    expect(analysis.extractedKeywords).toHaveLength(3);
    expect(analysis.extractedKeywords[0].term).toBe('neural');
    expect(analysis.extractedKeywords[0].rank).toBe(1);

    // Verify via GET /api/papers/:id/analysis
    const analysisRes = await request(app)
      .get(`/api/papers/${paperId}/analysis`)
      .set(authHeader(token1));

    expect(analysisRes.statusCode).toBe(200);
    expect(analysisRes.body.extractedKeywords).toHaveLength(3);

    // Verify via GET /api/projects/:id/analysis
    const projectRes = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));

    expect(projectRes.statusCode).toBe(200);
    expect(projectRes.body.papersAnalyzed).toBe(1);
    expect(projectRes.body.aggregatedKeywords).toHaveLength(3);
  });

  it('prevents duplicate PaperAnalysis records on upsert', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'unique.pdf',
      storedFilename: 'uuid_unique.pdf',
      status: 'COMPLETED',
    });
    await paper.save();

    // Insert twice using upsert
    await PaperAnalysis.findOneAndUpdate(
      { paperId: paper._id },
      {
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: [{ term: 'first', score: 1.0, rank: 1 }],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await PaperAnalysis.findOneAndUpdate(
      { paperId: paper._id },
      {
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: [{ term: 'second', score: 2.0, rank: 1 }],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const count = await PaperAnalysis.countDocuments({ paperId: paper._id });
    expect(count).toBe(1);

    const saved = await PaperAnalysis.findOne({ paperId: paper._id });
    expect(saved.extractedKeywords[0].term).toBe('second');
  });
});

describe('Phase 6 — Controlled Keyword Count Validation & Life-Cycle Tests', () => {
  it('correctly calculates counts for Paper A (12), Paper B (30), and Paper C (47, not capped at 30)', async () => {
    // Paper A with 12 keywords
    const paperA = new Paper({
      projectId: project1Id,
      originalFilename: 'paperA.pdf',
      storedFilename: 'uuid_a.pdf',
      status: 'COMPLETED',
    });
    await paperA.save();

    const kw12 = Array.from({ length: 12 }, (_, i) => ({
      term: `alpha${i}`,
      score: 1.0 + i * 0.1,
      rank: i + 1,
    }));
    await PaperAnalysis.create({
      paperId: paperA._id,
      projectId: project1Id,
      extractedKeywords: kw12,
      keywordsExtractedAt: new Date(),
    });

    const resA = await request(app)
      .get(`/api/papers/${paperA._id}/analysis`)
      .set(authHeader(token1));
    expect(resA.statusCode).toBe(200);
    expect(resA.body.totalKeywords).toBe(12);
    expect(resA.body.extractedKeywords).toHaveLength(12);

    // Paper B with 30 keywords
    const paperB = new Paper({
      projectId: project1Id,
      originalFilename: 'paperB.pdf',
      storedFilename: 'uuid_b.pdf',
      status: 'COMPLETED',
    });
    await paperB.save();

    const kw30 = Array.from({ length: 30 }, (_, i) => ({
      term: `beta${i}`,
      score: 1.0 + i * 0.05,
      rank: i + 1,
    }));
    await PaperAnalysis.create({
      paperId: paperB._id,
      projectId: project1Id,
      extractedKeywords: kw30,
      keywordsExtractedAt: new Date(),
    });

    const resB = await request(app)
      .get(`/api/papers/${paperB._id}/analysis`)
      .set(authHeader(token1));
    expect(resB.statusCode).toBe(200);
    expect(resB.body.totalKeywords).toBe(30);
    expect(resB.body.extractedKeywords).toHaveLength(30);

    // Paper C with 47 keywords (crucial test: must not be capped at 30)
    const paperC = new Paper({
      projectId: project1Id,
      originalFilename: 'paperC.pdf',
      storedFilename: 'uuid_c.pdf',
      status: 'COMPLETED',
    });
    await paperC.save();

    const kw47 = Array.from({ length: 47 }, (_, i) => ({
      term: `gamma${i}`,
      score: 2.0 - i * 0.02,
      rank: i + 1,
    }));
    await PaperAnalysis.create({
      paperId: paperC._id,
      projectId: project1Id,
      extractedKeywords: kw47,
      keywordsExtractedAt: new Date(),
    });

    const resC = await request(app)
      .get(`/api/papers/${paperC._id}/analysis`)
      .set(authHeader(token1));
    expect(resC.statusCode).toBe(200);
    expect(resC.body.totalKeywords).toBe(47);
    expect(resC.body.extractedKeywords).toHaveLength(47);
    expect(resC.body.extractedKeywords[46].rank).toBe(47);
  });

  it('handles Paper D with duplicate terms and different casing by normalizing in aggregate', async () => {
    const paperD = new Paper({
      projectId: project1Id,
      originalFilename: 'paperD.pdf',
      storedFilename: 'uuid_d.pdf',
      status: 'COMPLETED',
    });
    await paperD.save();

    await PaperAnalysis.create({
      paperId: paperD._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'Quantum', score: 1.5, rank: 1 },
        { term: 'quantum', score: 1.2, rank: 2 },
        { term: 'QUANTUM ', score: 0.8, rank: 3 },
        { term: 'Neural', score: 1.1, rank: 4 },
      ],
      keywordsExtractedAt: new Date(),
    });

    const projRes = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));

    expect(projRes.statusCode).toBe(200);
    // Normalized into 2 unique terms: 'quantum' and 'neural'
    expect(projRes.body.totalUniqueKeywords).toBe(2);
    const quantumKw = projRes.body.aggregatedKeywords.find((k) => k.term === 'quantum');
    expect(quantumKw).toBeDefined();
    expect(quantumKw.paperCount).toBe(1); // Not triple-counted for single paper
    expect(quantumKw.totalScore).toBeCloseTo(3.5, 1);
  });

  it('handles Paper E with zero valid keywords gracefully', async () => {
    const paperE = new Paper({
      projectId: project1Id,
      originalFilename: 'paperE.pdf',
      storedFilename: 'uuid_e.pdf',
      status: 'COMPLETED',
    });
    await paperE.save();

    await PaperAnalysis.create({
      paperId: paperE._id,
      projectId: project1Id,
      extractedKeywords: [],
      keywordsExtractedAt: new Date(),
    });

    const resE = await request(app)
      .get(`/api/papers/${paperE._id}/analysis`)
      .set(authHeader(token1));

    expect(resE.statusCode).toBe(200);
    expect(resE.body.totalKeywords).toBe(0);
    expect(resE.body.extractedKeywords).toEqual([]);
  });

  it('ensures failed and processing papers do not inflate project keyword statistics', async () => {
    // 1 completed paper with 5 keywords
    const completedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'good.pdf',
      storedFilename: 'uuid_good.pdf',
      status: 'COMPLETED',
      extractedText: 'Valid text for completed paper',
    });
    await completedPaper.save();

    await PaperAnalysis.create({
      paperId: completedPaper._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'valid1', score: 1.0, rank: 1 },
        { term: 'valid2', score: 1.0, rank: 2 },
      ],
    });

    // 1 failed paper that has a leftover analysis record
    const failedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'bad.pdf',
      storedFilename: 'uuid_bad.pdf',
      status: 'FAILED',
      processingError: 'Processing service unavailable',
    });
    await failedPaper.save();

    await PaperAnalysis.create({
      paperId: failedPaper._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'ghost1', score: 5.0, rank: 1 },
        { term: 'ghost2', score: 5.0, rank: 2 },
      ],
    });

    const projRes = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));

    expect(projRes.statusCode).toBe(200);
    expect(projRes.body.papersAnalyzed).toBe(1);
    expect(projRes.body.totalUniqueKeywords).toBe(2);
    const terms = projRes.body.aggregatedKeywords.map((k) => k.term);
    expect(terms).toContain('valid1');
    expect(terms).toContain('valid2');
    expect(terms).not.toContain('ghost1');
    expect(terms).not.toContain('ghost2');
  });

  it('supports DELETE /api/papers/:id and recalculates project keyword statistics dynamically', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'to_delete.pdf',
      storedFilename: 'uuid_del.pdf',
      status: 'COMPLETED',
      extractedText: 'Text to delete',
    });
    await paper.save();

    await PaperAnalysis.create({
      paperId: paper._id,
      projectId: project1Id,
      extractedKeywords: [{ term: 'temporary', score: 2.0, rank: 1 }],
    });

    // Verify paper exists in project analysis
    let projRes = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));
    expect(projRes.body.totalUniqueKeywords).toBe(1);

    // Delete paper
    const delRes = await request(app)
      .delete(`/api/papers/${paper._id}`)
      .set(authHeader(token1));
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify paper and analysis are removed from DB
    const paperInDb = await Paper.findById(paper._id);
    expect(paperInDb).toBeNull();
    const analysisInDb = await PaperAnalysis.findOne({ paperId: paper._id });
    expect(analysisInDb).toBeNull();

    // Verify project analysis recalculated to 0
    projRes = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set(authHeader(token1));
    expect(projRes.body.papersAnalyzed).toBe(0);
    expect(projRes.body.totalUniqueKeywords).toBe(0);
  });

  describe('Phase 6 Acceptance Tests — Keyword Limit 50 & Accurate Dashboard Total', () => {
    it('accurately reports 18 unique keywords for a paper with 18 keywords', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'paper_18.pdf',
        storedFilename: 'stored_18.pdf',
        status: 'COMPLETED',
      });
      await paper.save();

      const kws18 = Array.from({ length: 18 }, (_, i) => ({
        term: `term${i + 1}`,
        score: +(2.0 - i * 0.05).toFixed(4),
        rank: i + 1,
      }));

      await PaperAnalysis.create({
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: kws18,
        keywordsExtractedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/papers/${paper._id}/analysis`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(200);
      expect(res.body.totalKeywords).toBe(18);
      expect(res.body.extractedKeywords).toHaveLength(18);
    });

    it('accurately reports 35 unique keywords for a paper with 35 keywords', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'paper_35.pdf',
        storedFilename: 'stored_35.pdf',
        status: 'COMPLETED',
      });
      await paper.save();

      const kws35 = Array.from({ length: 35 }, (_, i) => ({
        term: `keyword${i + 1}`,
        score: +(3.0 - i * 0.05).toFixed(4),
        rank: i + 1,
      }));

      await PaperAnalysis.create({
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: kws35,
        keywordsExtractedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/papers/${paper._id}/analysis`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(200);
      expect(res.body.totalKeywords).toBe(35);
      expect(res.body.extractedKeywords).toHaveLength(35);
    });

    it('accurately reports 50 unique keywords for a paper with 50 keywords', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'paper_50.pdf',
        storedFilename: 'stored_50.pdf',
        status: 'COMPLETED',
      });
      await paper.save();

      const kws50 = Array.from({ length: 50 }, (_, i) => ({
        term: `token${i + 1}`,
        score: +(5.0 - i * 0.05).toFixed(4),
        rank: i + 1,
      }));

      await PaperAnalysis.create({
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: kws50,
        keywordsExtractedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/papers/${paper._id}/analysis`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(200);
      expect(res.body.totalKeywords).toBe(50);
      expect(res.body.extractedKeywords).toHaveLength(50);
    });

    it('persists only top 50 relevant unique keywords when 65 ranked candidates exist', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'paper_65.pdf',
        storedFilename: 'stored_65.pdf',
        status: 'COMPLETED',
        extractedText: 'Extracted text for 65 candidates test',
      });
      await paper.save();

      // 65 ranked candidates from extraction service
      const mock65 = Array.from({ length: 65 }, (_, i) => ({
        term: `candidate${i + 1}`,
        score: +(10.0 - i * 0.1).toFixed(4),
        rank: i + 1,
      }));

      axios.post.mockResolvedValueOnce({
        data: {
          paper_id: paper._id.toString(),
          keywords: mock65,
          total: 65,
        },
      });

      const { extractAndPersistKeywords } = require('../src/controllers/paperController');
      const saved = await extractAndPersistKeywords(paper._id, project1Id, paper.extractedText, 50);

      expect(saved).not.toBeNull();
      expect(saved.extractedKeywords).toHaveLength(50);
      expect(saved.extractedKeywords[0].term).toBe('candidate1');
      expect(saved.extractedKeywords[49].term).toBe('candidate50');

      // Verify in DB directly
      const inDb = await PaperAnalysis.findOne({ paperId: paper._id });
      expect(inDb.extractedKeywords).toHaveLength(50);
    });

    it('normalizes duplicates with case and whitespace differences according to documented rule', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'duplicates.pdf',
        storedFilename: 'stored_dup.pdf',
        status: 'COMPLETED',
        extractedText: 'Text with casing duplicates',
      });
      await paper.save();

      const rawWithDuplicates = [
        { term: 'Quantum', score: 2.5, rank: 1 },
        { term: 'quantum', score: 2.0, rank: 2 },
        { term: '  QUANTUM  ', score: 1.8, rank: 3 },
        { term: 'Neural', score: 1.5, rank: 4 },
        { term: 'neural', score: 1.2, rank: 5 },
      ];

      axios.post.mockResolvedValueOnce({
        data: {
          paper_id: paper._id.toString(),
          keywords: rawWithDuplicates,
          total: 5,
        },
      });

      const { extractAndPersistKeywords } = require('../src/controllers/paperController');
      const saved = await extractAndPersistKeywords(paper._id, project1Id, paper.extractedText, 50);

      expect(saved).not.toBeNull();
      // Should have exactly 2 unique normalized terms: quantum and neural
      expect(saved.extractedKeywords).toHaveLength(2);
      const terms = saved.extractedKeywords.map(k => k.term);
      expect(terms).toEqual(['quantum', 'neural']);
    });

    it('correctly handles empty keywords yielding count 0', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'empty_kw.pdf',
        storedFilename: 'stored_empty.pdf',
        status: 'COMPLETED',
      });
      await paper.save();

      await PaperAnalysis.create({
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: [],
        keywordsExtractedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/papers/${paper._id}/analysis`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(200);
      expect(res.body.totalKeywords).toBe(0);
      expect(res.body.extractedKeywords).toEqual([]);
    });

    it('calculates dashboard total as SUM of per-paper counts: 35 + 50 + 42 = 127', async () => {
      // Paper A = 35 unique keywords
      const paperA = new Paper({
        projectId: project1Id,
        originalFilename: 'paperA.pdf',
        storedFilename: 'stored_a.pdf',
        status: 'COMPLETED',
      });
      await paperA.save();
      const kwsA = Array.from({ length: 35 }, (_, i) => ({
        term: `kw_a_${i + 1}`,
        score: 1.5,
        rank: i + 1,
      }));
      await PaperAnalysis.create({
        paperId: paperA._id,
        projectId: project1Id,
        extractedKeywords: kwsA,
      });

      // Paper B = 50 unique keywords
      const paperB = new Paper({
        projectId: project1Id,
        originalFilename: 'paperB.pdf',
        storedFilename: 'stored_b.pdf',
        status: 'COMPLETED',
      });
      await paperB.save();
      const kwsB = Array.from({ length: 50 }, (_, i) => ({
        term: `kw_b_${i + 1}`,
        score: 1.5,
        rank: i + 1,
      }));
      await PaperAnalysis.create({
        paperId: paperB._id,
        projectId: project1Id,
        extractedKeywords: kwsB,
      });

      // Paper C = 42 unique keywords (including some overlapping with A to test SUM vs globally unique)
      const paperC = new Paper({
        projectId: project1Id,
        originalFilename: 'paperC.pdf',
        storedFilename: 'stored_c.pdf',
        status: 'COMPLETED',
      });
      await paperC.save();
      // 10 overlapping with A, 32 distinct
      const kwsC = [
        ...Array.from({ length: 10 }, (_, i) => ({
          term: `kw_a_${i + 1}`,
          score: 1.2,
          rank: i + 1,
        })),
        ...Array.from({ length: 32 }, (_, i) => ({
          term: `kw_c_${i + 1}`,
          score: 1.1,
          rank: i + 11,
        })),
      ];
      await PaperAnalysis.create({
        paperId: paperC._id,
        projectId: project1Id,
        extractedKeywords: kwsC,
      });

      const res = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(200);
      expect(res.body.papersAnalyzed).toBe(3);

      // Verify each individual paper's keyword count
      const paMap = {};
      for (const pa of res.body.paperAnalyses) {
        paMap[pa.paperId.toString()] = pa.keywordsCount;
      }
      expect(paMap[paperA._id.toString()]).toBe(35);
      expect(paMap[paperB._id.toString()]).toBe(50);
      expect(paMap[paperC._id.toString()]).toBe(42);

      // Dashboard sum MUST be 35 + 50 + 42 = 127
      expect(res.body.totalKeywordsSum).toBe(127);

      // Globally unique keywords: 35 + 50 + 32 = 117
      expect(res.body.totalUniqueKeywords).toBe(117);
    });

    it('recalculates dashboard total correctly when a paper is deleted', async () => {
      // 2 completed papers: Paper 1 (35 kw), Paper 2 (50 kw) -> Sum 85
      const p1 = new Paper({
        projectId: project1Id,
        originalFilename: 'p1.pdf',
        storedFilename: 'stored_p1.pdf',
        status: 'COMPLETED',
      });
      await p1.save();
      await PaperAnalysis.create({
        paperId: p1._id,
        projectId: project1Id,
        extractedKeywords: Array.from({ length: 35 }, (_, i) => ({ term: `term_p1_${i}`, score: 1, rank: i + 1 })),
      });

      const p2 = new Paper({
        projectId: project1Id,
        originalFilename: 'p2.pdf',
        storedFilename: 'stored_p2.pdf',
        status: 'COMPLETED',
      });
      await p2.save();
      await PaperAnalysis.create({
        paperId: p2._id,
        projectId: project1Id,
        extractedKeywords: Array.from({ length: 50 }, (_, i) => ({ term: `term_p2_${i}`, score: 1, rank: i + 1 })),
      });

      let res = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));
      expect(res.body.totalKeywordsSum).toBe(85);

      // Delete Paper 2 (50 keywords)
      const delRes = await request(app)
        .delete(`/api/papers/${p2._id}`)
        .set(authHeader(token1));
      expect(delRes.statusCode).toBe(200);

      // Recalculated total must now be exactly 35
      res = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));
      expect(res.body.papersAnalyzed).toBe(1);
      expect(res.body.totalKeywordsSum).toBe(35);
    });

    it('prevents double counting on retry or reprocess', async () => {
      const paper = new Paper({
        projectId: project1Id,
        originalFilename: 'reproc_test.pdf',
        storedFilename: 'stored_reproc.pdf',
        status: 'COMPLETED',
        extractedText: 'Sample text to reprocess multiple times',
      });
      await paper.save();

      // Initial analysis with 20 keywords
      const initialKeywords = Array.from({ length: 20 }, (_, i) => ({
        term: `word_${i}`,
        score: 1.0,
        rank: i + 1,
      }));
      await PaperAnalysis.create({
        paperId: paper._id,
        projectId: project1Id,
        extractedKeywords: initialKeywords,
      });

      let res = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));
      expect(res.body.totalKeywordsSum).toBe(20);

      // Reprocess with updated 25 keywords
      axios.post.mockResolvedValueOnce({
        data: {
          paper_id: paper._id.toString(),
          keywords: Array.from({ length: 25 }, (_, i) => ({ term: `word_${i}`, score: 1.0, rank: i + 1 })),
          total: 25,
        },
      });

      const repRes = await request(app)
        .post(`/api/papers/${paper._id}/reprocess`)
        .set(authHeader(token1));
      expect(repRes.statusCode).toBe(200);
      expect(repRes.body.totalKeywords).toBe(25);

      // Dashboard sum must be 25, NOT 20 + 25 = 45 (no double counting!)
      res = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));
      expect(res.body.papersAnalyzed).toBe(1);
      expect(res.body.totalKeywordsSum).toBe(25);

      // DB must contain exactly 1 PaperAnalysis record for this paper
      const count = await PaperAnalysis.countDocuments({ paperId: paper._id });
      expect(count).toBe(1);
    });

    it('scopes keyword totals strictly to the selected project and authorized user', async () => {
      // Paper in Project 1 (Alice) with 15 keywords
      const paperP1 = new Paper({
        projectId: project1Id,
        originalFilename: 'alice_doc.pdf',
        storedFilename: 'alice.pdf',
        status: 'COMPLETED',
      });
      await paperP1.save();
      await PaperAnalysis.create({
        paperId: paperP1._id,
        projectId: project1Id,
        extractedKeywords: Array.from({ length: 15 }, (_, i) => ({ term: `alice_${i}`, score: 1, rank: i + 1 })),
      });

      // Paper in Project 2 (Bob) with 30 keywords
      const paperP2 = new Paper({
        projectId: project2Id,
        originalFilename: 'bob_doc.pdf',
        storedFilename: 'bob.pdf',
        status: 'COMPLETED',
      });
      await paperP2.save();
      await PaperAnalysis.create({
        paperId: paperP2._id,
        projectId: project2Id,
        extractedKeywords: Array.from({ length: 30 }, (_, i) => ({ term: `bob_${i}`, score: 1, rank: i + 1 })),
      });

      // Project 1 total for Alice must be 15
      const resP1 = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));
      expect(resP1.body.totalKeywordsSum).toBe(15);
      expect(resP1.body.papersAnalyzed).toBe(1);

      // Project 2 total for Bob must be 30
      const resP2 = await request(app)
        .get(`/api/projects/${project2Id}/analysis`)
        .set(authHeader(token2));
      expect(resP2.body.totalKeywordsSum).toBe(30);
      expect(resP2.body.papersAnalyzed).toBe(1);

      // Cross-tenant access forbidden
      const forbidRes = await request(app)
        .get(`/api/projects/${project2Id}/analysis`)
        .set(authHeader(token1));
      expect(forbidRes.statusCode).toBe(403);
    });

    it('ensures failed and processing papers do not contribute to totalKeywordsSum', async () => {
      // 1 Completed paper with 20 keywords
      const goodPaper = new Paper({
        projectId: project1Id,
        originalFilename: 'good.pdf',
        storedFilename: 'good.pdf',
        status: 'COMPLETED',
      });
      await goodPaper.save();
      await PaperAnalysis.create({
        paperId: goodPaper._id,
        projectId: project1Id,
        extractedKeywords: Array.from({ length: 20 }, (_, i) => ({ term: `good_${i}`, score: 1, rank: i + 1 })),
      });

      // 1 Failed paper with leftover analysis
      const failedPaper = new Paper({
        projectId: project1Id,
        originalFilename: 'failed.pdf',
        storedFilename: 'failed.pdf',
        status: 'FAILED',
        processingError: 'OCR timeout',
      });
      await failedPaper.save();
      await PaperAnalysis.create({
        paperId: failedPaper._id,
        projectId: project1Id,
        extractedKeywords: Array.from({ length: 40 }, (_, i) => ({ term: `bad_${i}`, score: 1, rank: i + 1 })),
      });

      // 1 Processing paper
      const processingPaper = new Paper({
        projectId: project1Id,
        originalFilename: 'proc.pdf',
        storedFilename: 'proc.pdf',
        status: 'PROCESSING',
      });
      await processingPaper.save();

      const res = await request(app)
        .get(`/api/projects/${project1Id}/analysis`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(200);
      expect(res.body.papersAnalyzed).toBe(1);
      // Only the completed paper contributes: 20
      expect(res.body.totalKeywordsSum).toBe(20);
      expect(res.body.totalUniqueKeywords).toBe(20);
    });
  });
});


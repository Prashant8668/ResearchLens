/**
 * Phase 5 — PDF Upload & Processing Tests
 * Uses mongodb-memory-server and supertest.
 * Mocks the filesystem and axios (FastAPI calls) to keep tests isolated.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');

// --- Mock axios BEFORE requiring the app (FastAPI comms) ---
jest.mock('axios');
const axios = require('axios');

const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Paper = require('../src/models/Paper');

let mongoServer;
let token1, token2;
let user1Id, user2Id;
let project1Id, project2Id;
let tmpDir;

// Create a tiny valid PDF buffer (minimal valid PDF structure)
const VALID_PDF_BUF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  // Create a temp upload dir for tests
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-uploads-'));
  process.env.UPLOAD_DIR = tmpDir;

  // Create users and get tokens
  const salt = await bcrypt.genSalt(10);
  const pass = await bcrypt.hash('Password123', salt);

  const u1 = new User({ name: 'Alice', email: 'alice@test.com', password: pass });
  await u1.save();
  user1Id = u1._id;

  const u2 = new User({ name: 'Bob', email: 'bob@test.com', password: pass });
  await u2.save();
  user2Id = u2._id;

  const r1 = await request(app).post('/api/auth/login').send({ email: 'alice@test.com', password: 'Password123' });
  token1 = r1.body.token;

  const r2 = await request(app).post('/api/auth/login').send({ email: 'bob@test.com', password: 'Password123' });
  token2 = r2.body.token;

  // Create projects
  const p1 = new Project({ name: 'Project Alpha', userId: user1Id });
  await p1.save();
  project1Id = p1._id.toString();

  const p2 = new Project({ name: 'Project Beta', userId: user2Id });
  await p2.save();
  project2Id = p2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  // Cleanup temp dir
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

afterEach(async () => {
  await Paper.deleteMany({});
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────
const authHeader = (tok) => ({ Authorization: 'Bearer ' + tok });

describe('Phase 5 — PDF Upload', () => {
  // ── Authentication ──
  it('rejects upload without token', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .attach('pdfs', VALID_PDF_BUF, { filename: 'test.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects upload with invalid token', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set('Authorization', 'Bearer invalid.token.here')
      .attach('pdfs', VALID_PDF_BUF, { filename: 'test.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(401);
  });

  // ── Authorization ──
  it('rejects upload to another user project', async () => {
    axios.post.mockResolvedValue({ data: { text: 'hello', metadata: {} } });
    const res = await request(app)
      .post(`/api/projects/${project2Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'test.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(403);
  });

  // ── Validation ──
  it('rejects non-PDF extension', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', Buffer.from('hello'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid MIME type (pdf extension but wrong MIME)', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', Buffer.from('data'), { filename: 'test.pdf', contentType: 'text/plain' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects oversized file (>25MB limit)', async () => {
    // 26MB buffer — exceeds default 25MB limit
    const bigBuf = Buffer.alloc(26 * 1024 * 1024, 'x');
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', bigBuf, { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  // ── Single valid upload ──
  it('accepts a valid PDF upload and creates Paper record', async () => {
    axios.post.mockResolvedValue({ data: { text: 'Sample text', metadata: { title: 'Test Paper', authors: ['Alice'], year: 2024 } } });
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'paper1.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(201);
    expect(res.body.papers).toHaveLength(1);
    expect(res.body.papers[0].originalFilename).toBe('paper1.pdf');
    expect(res.body.papers[0].status).toBe('QUEUED');
  });

  // ── Multiple valid upload ──
  it('accepts multiple valid PDF uploads and creates multiple Paper records', async () => {
    axios.post.mockResolvedValue({ data: { text: 'Sample text', metadata: {} } });
    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'paper_a.pdf', contentType: 'application/pdf' })
      .attach('pdfs', VALID_PDF_BUF, { filename: 'paper_b.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(201);
    expect(res.body.papers).toHaveLength(2);
  });

  // ── Paper listing ──
  it('lists papers for owned project', async () => {
    axios.post.mockResolvedValue({ data: { text: 'text', metadata: {} } });
    await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'paper1.pdf', contentType: 'application/pdf' });

    const res = await request(app)
      .get(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('forbids listing papers for another user project', async () => {
    const res = await request(app)
      .get(`/api/projects/${project2Id}/papers`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(403);
  });

  // ── Paper GET by ID ──
  it('returns paper details with ownership check', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'mine.pdf',
      storedFilename: 'uuid-mine.pdf',
      status: 'QUEUED',
    });
    await paper.save();
    const res = await request(app)
      .get(`/api/papers/${paper._id}`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(200);
    expect(res.body.originalFilename).toBe('mine.pdf');
    // storedFilename (filesystem path) must NOT be exposed
    expect(res.body.storedFilename).toBeUndefined();
  });

  it('forbids getting another user paper', async () => {
    const paper = new Paper({
      projectId: project2Id,
      originalFilename: 'theirs.pdf',
      storedFilename: 'uuid-theirs.pdf',
      status: 'QUEUED',
    });
    await paper.save();
    const res = await request(app)
      .get(`/api/papers/${paper._id}`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(404); // 404 to not leak existence
  });

  // ── Processing States ──
  it('sets paper to FAILED when FastAPI returns error', async () => {
    // Mock: FastAPI responds with an error (e.g. scanned PDF)
    axios.post.mockResolvedValue({ data: { error: 'SCANNED_PDF_UNSUPPORTED: No extractable text found.' } });

    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'scanned.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(201);

    // Give async processing time to run
    await new Promise(r => setTimeout(r, 500));

    const paperId = res.body.papers[0].id;
    const paper = await Paper.findById(paperId);
    expect(paper.status).toBe('FAILED');
    expect(paper.processingError).toContain('SCANNED_PDF_UNSUPPORTED');
  });

  it('sets paper to COMPLETED when FastAPI returns success', async () => {
    axios.post.mockResolvedValue({
      data: { text: 'Full extracted text here.', metadata: { title: 'AI Research', authors: ['Dr. Bob'], year: 2023 } }
    });

    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'valid.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(201);

    await new Promise(r => setTimeout(r, 500));

    const paperId = res.body.papers[0].id;
    const paper = await Paper.findById(paperId);
    expect(paper.status).toBe('COMPLETED');
    expect(paper.extractedText).toBe('Full extracted text here.');
    expect(paper.title).toBe('AI Research');
  });

  it('sets paper to FAILED when FastAPI is unavailable', async () => {
    axios.post.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const res = await request(app)
      .post(`/api/projects/${project1Id}/papers`)
      .set(authHeader(token1))
      .attach('pdfs', VALID_PDF_BUF, { filename: 'offline.pdf', contentType: 'application/pdf' });
    expect(res.statusCode).toBe(201);

    await new Promise(r => setTimeout(r, 500));

    const paperId = res.body.papers[0].id;
    const paper = await Paper.findById(paperId);
    expect(paper.status).toBe('FAILED');
  });

  // ── Retry ──
  it('retries a FAILED paper', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'retry_me.pdf',
      storedFilename: 'uuid-retry.pdf',
      status: 'FAILED',
      processingError: 'Previous failure',
    });
    await paper.save();

    axios.post.mockResolvedValue({
      data: { text: 'Retry success text', metadata: {} }
    });

    const res = await request(app)
      .post(`/api/papers/${paper._id}/retry`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('QUEUED');

    await new Promise(r => setTimeout(r, 500));

    const updated = await Paper.findById(paper._id);
    expect(updated.status).toBe('COMPLETED');
  });

  it('rejects retry on non-FAILED paper', async () => {
    const paper = new Paper({
      projectId: project1Id,
      originalFilename: 'processing.pdf',
      storedFilename: 'uuid-processing.pdf',
      status: 'PROCESSING',
    });
    await paper.save();

    const res = await request(app)
      .post(`/api/papers/${paper._id}/retry`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(400);
  });

  it('forbids retry on another user paper', async () => {
    const paper = new Paper({
      projectId: project2Id,
      originalFilename: 'theirs.pdf',
      storedFilename: 'uuid-theirs.pdf',
      status: 'FAILED',
    });
    await paper.save();

    const res = await request(app)
      .post(`/api/papers/${paper._id}/retry`)
      .set(authHeader(token1));
    expect(res.statusCode).toBe(404);
  });
});

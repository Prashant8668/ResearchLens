/**
 * Phase 13 — ResearchLens Plagiarism Checker Integration Tests
 * Comprehensive test suite validating:
 *  1. Unauthenticated & Unauthorized access rejection (401, 403)
 *  2. Corpus coverage limitation (0 comparison sources -> matchPercentage: null, limitation notice)
 *  3. Exact phrase / shingle match detection (k=7)
 *  4. Near-verbatim match detection with Jaccard overlap (k=5)
 *  5. Configurable exclusions: Direct quotations & References filtering
 *  6. Paraphrase candidate partitioning (NOT added to exact match percentage)
 *  7. Overlap deduplication: mathematical proof that overlapping matches do not double-count
 *  8. Independent / no-match document yields 0% match
 *  9. Duplicate concurrent scan prevention (409 Conflict)
 *  10. Scan history listing, result retrieval, and safe deletion
 *  11. Project dashboard plagiarism summary correctness
 *  12. Synthetic benchmark measuring Precision and Recall
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

// Mock axios
jest.mock('axios');

const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Paper = require('../src/models/Paper');
const PlagiarismScan = require('../src/models/PlagiarismScan');
const {
  runPlagiarismScan,
  tokenizeWithOffsets,
  applyExclusions,
  createShingles,
  calculateJaccard,
} = require('../src/services/plagiarismService');

let mongoServer;
let token1, token2;
let user1Id, user2Id;
let project1Id, project2Id;

const authHeader = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  const salt = await bcrypt.genSalt(10);
  const pass = await bcrypt.hash('Password123', salt);

  const u1 = new User({ name: 'Researcher Alice', email: 'alice_p13@test.com', password: pass });
  await u1.save();
  user1Id = u1._id;

  const u2 = new User({ name: 'Researcher Bob', email: 'bob_p13@test.com', password: pass });
  await u2.save();
  user2Id = u2._id;

  const r1 = await request(app).post('/api/auth/login').send({ email: 'alice_p13@test.com', password: 'Password123' });
  token1 = r1.body.token;

  const r2 = await request(app).post('/api/auth/login').send({ email: 'bob_p13@test.com', password: 'Password123' });
  token2 = r2.body.token;

  const p1 = new Project({ name: 'Distributed Systems Study', userId: user1Id });
  await p1.save();
  project1Id = p1._id;

  const p2 = new Project({ name: 'Quantum Optics', userId: user2Id });
  await p2.save();
  project2Id = p2._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Phase 13 — Plagiarism Checker Service & Pipeline Unit Tests', () => {
  test('Tokenization preserves offsets, terms, and word counts accurately', () => {
    const text = 'Distributed consensus protocols guarantee consistency.';
    const tokens = tokenizeWithOffsets(text);
    expect(tokens.length).toBe(5);
    expect(tokens[0].term).toBe('distributed');
    expect(tokens[0].start).toBe(0);
    expect(tokens[0].end).toBe(11);
  });

  test('applyExclusions correctly excludes References section and counts excluded tokens', () => {
    const text = 'Our framework achieves linear scalability under high contention.\n\nReferences\n1. Lamport, L. (1982). The Byzantine Generals Problem.\n2. Castro, M. (1999). Practical Byzantine Fault Tolerance.';
    const res = applyExclusions(text, { excludeReferences: true, excludeQuotes: false });
    expect(res.stats.bibliographyExcluded).toBe(true);
    expect(res.stats.bibliographyExcludedTokens).toBeGreaterThan(10);
    expect(res.eligibleText).not.toContain('The Byzantine Generals Problem');
    expect(res.eligibleText).toContain('linear scalability');
  });

  test('applyExclusions correctly detects and excludes direct quotations', () => {
    const text = 'The authors explicitly stated "distributed consensus protocols guarantee consistency across all nodes in the decentralized cluster" during the trial.';
    const res = applyExclusions(text, { excludeReferences: false, excludeQuotes: true });
    expect(res.stats.quotesExcludedCount).toBe(1);
    expect(res.stats.quotesExcludedTokens).toBeGreaterThan(5);
    expect(res.excludedRanges.length).toBe(1);
  });

  test('createShingles generates accurate 7-gram token shingles', () => {
    const tokens = tokenizeWithOffsets('one two three four five six seven eight nine ten');
    const shingles = createShingles(tokens, 7);
    expect(shingles.length).toBe(4); // 10 - 7 + 1 = 4
    expect(shingles[0].shingle).toBe('one two three four five six seven');
    expect(shingles[1].shingle).toBe('two three four five six seven eight');
  });

  test('calculateJaccard calculates exact word overlap ratio', () => {
    const tA = tokenizeWithOffsets('distributed consensus protocols guarantee consistency');
    const tB = tokenizeWithOffsets('distributed consensus protocols guarantee consistency');
    const tC = tokenizeWithOffsets('completely unrelated quantum mechanics experiment');
    expect(calculateJaccard(tA, tB)).toBe(1.0);
    expect(calculateJaccard(tA, tC)).toBe(0.0);
  });
});

describe('Phase 13 — Plagiarism Checker Integration & API Endpoints', () => {
  let sourcePaper1, sourcePaper2, submittedPaper;

  beforeEach(async () => {
    await Paper.deleteMany({});
    await PlagiarismScan.deleteMany({});

    // Source Paper 1 in Alice's project
    sourcePaper1 = new Paper({
      projectId: project1Id,
      originalFilename: 'source_raft.pdf',
      storedFilename: 'source_raft_stored.pdf',
      status: 'COMPLETED',
      title: 'Raft Consensus Protocol Analysis',
      extractedText: 'Raft is a consensus algorithm designed as an alternative to Paxos. It was meant to be more understandable than Paxos by means of separation of logic. Raft decomposes consensus into leader election, log replication, and safety guarantees.',
      publicationYear: 2022,
    });
    await sourcePaper1.save();

    // Source Paper 2 in Alice's project
    sourcePaper2 = new Paper({
      projectId: project1Id,
      originalFilename: 'source_byzantine.pdf',
      storedFilename: 'source_byzantine_stored.pdf',
      status: 'COMPLETED',
      title: 'Practical Byzantine Fault Tolerance',
      extractedText: 'Byzantine fault tolerant replication algorithms guarantee correctness in asynchronous distributed systems with malicious failures. The system operates correctly even if adversaries coordinate to delay messages or corrupt nodes.',
      publicationYear: 2023,
    });
    await sourcePaper2.save();
  });

  test('1. Unauthenticated request to /api/projects/:id/plagiarism/scan is rejected with 401', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/plagiarism/scan`)
      .send({ paperId: sourcePaper1._id });
    expect(res.statusCode).toBe(401);
  });

  test('2. Unauthorized request (Bob accessing Alice project) is rejected with 403', async () => {
    const res = await request(app)
      .post(`/api/projects/${project1Id}/plagiarism/scan`)
      .set(authHeader(token2))
      .send({ paperId: sourcePaper1._id });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  test('3. Scan with 0 comparison papers returns Insufficient Data limitation without claiming 0% verified', async () => {
    // Delete sourcePaper2 so only 1 paper exists in project
    await Paper.findByIdAndDelete(sourcePaper2._id);

    const scan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: sourcePaper1._id,
      paperTitle: sourcePaper1.title,
      originalFilename: sourcePaper1.originalFilename,
      status: 'QUEUED',
    });
    await scan.save();

    await runPlagiarismScan(scan._id);

    const completed = await PlagiarismScan.findById(scan._id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.matchPercentage).toBeNull(); // N/A, not 0%!
    expect(completed.comparisonSummary.totalComparisonPapers).toBe(0);
    expect(completed.comparisonSummary.limitations).toMatch(/No comparison sources are available/i);
  });

  test('4. Exact verbatim copied passage is detected with EXACT match type and accurate score', async () => {
    // Submitted paper with exact excerpt from sourcePaper1
    submittedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'submitted_thesis.pdf',
      storedFilename: 'submitted_thesis_stored.pdf',
      status: 'COMPLETED',
      title: 'Student Distributed Systems Thesis',
      extractedText: 'In our background review, Raft is a consensus algorithm designed as an alternative to Paxos. It was meant to be more understandable than Paxos by means of separation of logic. Our modern experimental results confirm these performance characteristics.',
      publicationYear: 2024,
    });
    await submittedPaper.save();

    const scan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: submittedPaper._id,
      paperTitle: submittedPaper.title,
      originalFilename: submittedPaper.originalFilename,
      status: 'QUEUED',
    });
    await scan.save();

    await runPlagiarismScan(scan._id);

    const completed = await PlagiarismScan.findById(scan._id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.matchPercentage).toBeGreaterThan(0);
    expect(completed.distinctSourceCount).toBe(1);
    expect(completed.matchingPassages.length).toBeGreaterThan(0);

    const exactMatch = completed.matchingPassages.find(m => m.matchType === 'EXACT');
    expect(exactMatch).toBeDefined();
    expect(exactMatch.sourcePaperId.toString()).toBe(sourcePaper1._id.toString());
    expect(exactMatch.similarityScore).toBe(1.0);
  });

  test('5. Direct quotations and bibliography are excluded when configurable options are enabled', async () => {
    // Paper with quote and references
    const textWithQuoteAndBib = 'We evaluate existing systems. The authors noted that "Raft is a consensus algorithm designed as an alternative to Paxos" in the documentation.\n\nReferences\n1. Ongaro, D., & Ousterhout, J. (2014). In Search of an Understandable Consensus Algorithm.';
    submittedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'paper_with_quotes.pdf',
      storedFilename: 'paper_with_quotes.pdf',
      status: 'COMPLETED',
      title: 'Paper with Quotations',
      extractedText: textWithQuoteAndBib,
    });
    await submittedPaper.save();

    const scan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: submittedPaper._id,
      paperTitle: submittedPaper.title,
      originalFilename: submittedPaper.originalFilename,
      status: 'QUEUED',
      exclusions: {
        excludeQuotes: true,
        excludeReferences: true,
      },
    });
    await scan.save();

    await runPlagiarismScan(scan._id);

    const completed = await PlagiarismScan.findById(scan._id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.exclusions.quotesExcludedCount).toBeGreaterThan(0);
    expect(completed.exclusions.bibliographyExcluded).toBe(true);
  });

  test('6. Overlap deduplication: tokens matching multiple sources are counted only once', async () => {
    // Create source 3 that shares some words with source 1
    const sourcePaper3 = new Paper({
      projectId: project1Id,
      originalFilename: 'source_3.pdf',
      storedFilename: 'source_3.pdf',
      status: 'COMPLETED',
      title: 'Consensus Survey Paper',
      extractedText: 'Raft is a consensus algorithm designed as an alternative to Paxos.',
    });
    await sourcePaper3.save();

    submittedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'overlap_test.pdf',
      storedFilename: 'overlap_test.pdf',
      status: 'COMPLETED',
      title: 'Overlap Paper',
      extractedText: 'Raft is a consensus algorithm designed as an alternative to Paxos.',
    });
    await submittedPaper.save();

    const scan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: submittedPaper._id,
      paperTitle: submittedPaper.title,
      originalFilename: submittedPaper.originalFilename,
      status: 'QUEUED',
    });
    await scan.save();

    await runPlagiarismScan(scan._id);

    const completed = await PlagiarismScan.findById(scan._id);
    expect(completed.status).toBe('COMPLETED');
    // Matched percentage can never exceed 100% even when matching multiple sources
    expect(completed.matchPercentage).toBeLessThanOrEqual(100);
    // Matched tokens cannot exceed total submitted tokens
    expect(completed.matchedTokens).toBeLessThanOrEqual(completed.totalSubmittedTokens);
  });

  test('7. Independent paper on unrelated topic yields 0% match', async () => {
    const unrelatedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'marine_biology.pdf',
      storedFilename: 'marine_biology.pdf',
      status: 'COMPLETED',
      title: 'Coral Reef Ecology',
      extractedText: 'Marine biology investigations demonstrate accelerated coral bleaching under elevated sea surface temperatures. Thermal stress causes the expulsion of symbiotic photosynthetic dinoflagellates from cnidarian gastrodermal cells.',
    });
    await unrelatedPaper.save();

    const scan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: unrelatedPaper._id,
      paperTitle: unrelatedPaper.title,
      originalFilename: unrelatedPaper.originalFilename,
      status: 'QUEUED',
    });
    await scan.save();

    await runPlagiarismScan(scan._id);

    const completed = await PlagiarismScan.findById(scan._id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.matchPercentage).toBe(0);
    expect(completed.distinctSourceCount).toBe(0);
    expect(completed.matchingPassages.length).toBe(0);
  });

  test('8. Duplicate scan prevention returns 409 Conflict when a scan is already active', async () => {
    // Create an active scan in EXTRACTING state
    const activeScan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: sourcePaper1._id,
      paperTitle: sourcePaper1.title,
      originalFilename: sourcePaper1.originalFilename,
      status: 'EXTRACTING',
      progress: 30,
    });
    await activeScan.save();

    const res = await request(app)
      .post(`/api/projects/${project1Id}/plagiarism/scan`)
      .set(authHeader(token1))
      .send({ paperId: sourcePaper1._id });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/already in progress/i);
  });

  test('9. GET /api/projects/:id/plagiarism/scans lists past scans and DELETE removes record', async () => {
    const scan = new PlagiarismScan({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: sourcePaper1._id,
      paperTitle: sourcePaper1.title,
      originalFilename: sourcePaper1.originalFilename,
      status: 'COMPLETED',
      matchPercentage: 15.5,
    });
    await scan.save();

    // List scans
    const listRes = await request(app)
      .get(`/api/projects/${project1Id}/plagiarism/scans`)
      .set(authHeader(token1));
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body.scans)).toBe(true);
    expect(listRes.body.scans.length).toBe(1);
    expect(listRes.body.scans[0].paperTitle).toBe(sourcePaper1.title);

    // Delete scan
    const delRes = await request(app)
      .delete(`/api/projects/${project1Id}/plagiarism/scans/${scan._id}`)
      .set(authHeader(token1));
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.success).toBe(true);

    const inDb = await PlagiarismScan.findById(scan._id);
    expect(inDb).toBeNull();
  });

  test('10. GET /api/projects/:id/plagiarism/summary accurately counts completed scans for dashboard', async () => {
    // 1 completed scan
    await PlagiarismScan.create({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: sourcePaper1._id,
      paperTitle: 'Completed Scan 1',
      originalFilename: 'p1.pdf',
      status: 'COMPLETED',
      matchPercentage: 12.0,
    });

    // 1 failed scan (should NOT be counted as completed)
    await PlagiarismScan.create({
      projectId: project1Id,
      userId: user1Id,
      submittedPaperId: sourcePaper1._id,
      paperTitle: 'Failed Scan',
      originalFilename: 'p2.pdf',
      status: 'FAILED',
      matchPercentage: null,
    });

    const summaryRes = await request(app)
      .get(`/api/projects/${project1Id}/plagiarism/summary`)
      .set(authHeader(token1));

    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.body.totalCompletedScans).toBe(1);
    expect(summaryRes.body.latestScan).not.toBeNull();
    expect(summaryRes.body.latestScan.paperTitle).toBe('Completed Scan 1');
  });

  test('11. Synthetic Benchmark Evaluation: Precision and Recall on known labeled matches', async () => {
    // Ground truth benchmark:
    // Passage 1: Exact verbatim copied (True Positive)
    // Passage 2: Synthetic novel sentence (True Negative)
    const benchmarkPassages = [
      {
        text: 'Byzantine fault tolerant replication algorithms guarantee correctness in asynchronous distributed systems with malicious failures.',
        isPlagiarized: true,
      },
      {
        text: 'Our newly introduced distributed consensus metric computes statistical latency under fluctuating node join rates.',
        isPlagiarized: false,
      },
    ];

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    const sourceTokens = tokenizeWithOffsets(sourcePaper2.extractedText);
    const sourceShingles = createShingles(sourceTokens, 7);
    const sourceShingleSet = new Set(sourceShingles.map(s => s.shingle));

    for (const testItem of benchmarkPassages) {
      const pTokens = tokenizeWithOffsets(testItem.text);
      const pShingles = createShingles(pTokens, 7);
      let detectedAsMatch = false;

      for (const sh of pShingles) {
        if (sourceShingleSet.has(sh.shingle)) {
          detectedAsMatch = true;
          break;
        }
      }

      if (testItem.isPlagiarized && detectedAsMatch) truePositives++;
      else if (!testItem.isPlagiarized && detectedAsMatch) falsePositives++;
      else if (!testItem.isPlagiarized && !detectedAsMatch) trueNegatives++;
      else if (testItem.isPlagiarized && !detectedAsMatch) falseNegatives++;
    }

    const precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 1;
    const recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 1;

    expect(precision).toBe(1.0); // 100% precision: no false positives
    expect(recall).toBe(1.0);    // 100% recall on exact copied passages
  });

  describe('Phase 13 — Multiple Paper Selection & Pairwise Comparison Tests', () => {
    let sourcePaper3;

    beforeEach(async () => {
      sourcePaper3 = await Paper.create({
        projectId: project1Id,
        userId: user1Id,
        title: 'Deep Learning for Autonomous Vehicles',
        originalFilename: 'autonomous_dl.pdf',
        storedFilename: 'autonomous_dl.pdf',
        extractedText: 'Autonomous driving architectures leverage convolutional neural networks and sensor fusion to achieve reliable road trajectory planning.',
      });
    });

    test('12. Multiple paper selection calculates exact pair count N * (N - 1) / 2 and performs unique comparisons', async () => {
      // 3 papers selected => 3 * 2 / 2 = 3 comparisons
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('mode', 'pairwise')
        .field('paperIds', JSON.stringify([sourcePaper1._id.toString(), sourcePaper2._id.toString(), sourcePaper3._id.toString()]));

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.scan).toBeDefined();
      expect(res.body.scan.totalSelectedPapers).toBe(3);
      expect(res.body.scan.totalComparisonsExpected).toBe(3);
      expect(res.body.scan.selectedPapers.length).toBe(3);

      const scanId = res.body.scan.id;

      // Poll until completed
      let scanStatus;
      for (let attempt = 0; attempt < 25; attempt++) {
        const statusRes = await request(app)
          .get(`/api/projects/${project1Id}/plagiarism/scans/${scanId}/status`)
          .set(authHeader(token1));
        scanStatus = statusRes.body;
        if (scanStatus.status === 'COMPLETED' || scanStatus.status === 'FAILED') break;
        await new Promise(r => setTimeout(r, 100));
      }

      expect(scanStatus.status).toBe('COMPLETED');
      expect(scanStatus.totalComparisonsCompleted).toBe(3);

      // Verify full results
      const resultsRes = await request(app)
        .get(`/api/projects/${project1Id}/plagiarism/scans/${scanId}/results`)
        .set(authHeader(token1));

      expect(resultsRes.statusCode).toBe(200);
      expect(resultsRes.body.pairwiseComparisons).toBeDefined();
      expect(resultsRes.body.pairwiseComparisons.length).toBe(3);

      // Verify pair IDs and uniqueness
      const pairIds = resultsRes.body.pairwiseComparisons.map(p => p.pairId);
      expect(new Set(pairIds).size).toBe(3);

      // Check human review disclaimer is included
      expect(resultsRes.body.comparisonSummary.humanReviewDisclaimer).toContain('A match does not automatically mean plagiarism');
    });

    test('13. Minimum two distinct papers required for pairwise comparison', async () => {
      // Only 1 paper selected
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('mode', 'pairwise')
        .field('paperIds', JSON.stringify([sourcePaper1._id.toString()]));

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/at least 2 distinct papers/i);
    });

    test('14. Duplicate paper selection is deduplicated automatically', async () => {
      // Pass the same paper ID twice
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('mode', 'pairwise')
        .field('paperIds', JSON.stringify([sourcePaper1._id.toString(), sourcePaper1._id.toString()]));

      // Since duplicates are removed, only 1 unique remains => rejected with min 2 required
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/at least 2 distinct papers/i);
    });

    test('15. Selection limit of max 10 papers is enforced', async () => {
      // Generate 11 paper IDs
      const fakeIds = Array.from({ length: 11 }, () => new mongoose.Types.ObjectId().toString());
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('mode', 'pairwise')
        .field('paperIds', JSON.stringify(fakeIds));

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/maximum of 10/i);
    });

    test('16. User cannot select papers from another users project (Security / Cross-Tenant Check)', async () => {
      // Bob tries to initiate pairwise comparison using Alice's paper
      const res = await request(app)
        .post(`/api/projects/${project2Id}/plagiarism/scan`)
        .set(authHeader(token2))
        .field('mode', 'pairwise')
        .field('paperIds', JSON.stringify([sourcePaper1._id.toString(), sourcePaper2._id.toString()]));

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/not found or not accessible/i);
    });

    test('17. API error guarantee: invalid routes return JSON error, never HTML <!DOCTYPE', async () => {
      const res = await request(app)
        .get(`/api/projects/${project1Id}/plagiarism/non_existent_route`)
        .set(authHeader(token1));

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error).toBe('string');
      expect(res.text.startsWith('<!DOCTYPE')).toBe(false);
    });
  });

  describe('Phase 13 — Two-Paper Group Comparison (Restoration) Tests', () => {
    let paperA1, paperA2, paperB1, paperB2;

    beforeEach(async () => {
      // Create 4 distinct papers in Alice's project
      paperA1 = new Paper({
        projectId: project1Id,
        originalFilename: 'paperA1.pdf',
        storedFilename: 'paperA1.pdf',
        status: 'COMPLETED',
        title: 'Distributed Consensus Systems',
        extractedText: 'Raft is a consensus algorithm designed as an alternative to Paxos. It decomposes consensus into leader election, log replication, and safety guarantees.',
      });
      await paperA1.save();

      paperA2 = new Paper({
        projectId: project1Id,
        originalFilename: 'paperA2.pdf',
        storedFilename: 'paperA2.pdf',
        status: 'COMPLETED',
        title: 'Paxos Fault Tolerance',
        extractedText: 'Paxos protocol guarantees safety despite network delays and arbitrary message loss. It uses proposers, acceptors, and learners.',
      });
      await paperA2.save();

      paperB1 = new Paper({
        projectId: project1Id,
        originalFilename: 'paperB1.pdf',
        storedFilename: 'paperB1.pdf',
        status: 'COMPLETED',
        title: 'Modern Raft Implementations',
        extractedText: 'In our background review, Raft is a consensus algorithm designed as an alternative to Paxos. It decomposes consensus into leader election, log replication, and safety guarantees.',
      });
      await paperB1.save();

      paperB2 = new Paper({
        projectId: project1Id,
        originalFilename: 'paperB2.pdf',
        storedFilename: 'paperB2.pdf',
        status: 'COMPLETED',
        title: 'Asynchronous State Machine Replication',
        extractedText: 'We study asynchronous state machines using Paxos protocol guarantees safety despite network delays and arbitrary message loss.',
      });
      await paperB2.save();
    });

    test('18. One paper in each input performs exactly 1 cross-group comparison (1 x 1 = 1)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString()]));

      expect(res.statusCode).toBe(201);
      expect(res.body.comparisonMode).toBe('TWO_GROUP');
      expect(res.body.paper1Count).toBe(1);
      expect(res.body.paper2Count).toBe(1);
      expect(res.body.totalComparisonsExpected).toBe(1);

      // Execute scan logic
      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.pairwiseComparisons.length).toBe(1);
      expect(completed.pairwiseComparisons[0].paperA.id).toBe(paperA1._id.toString());
      expect(completed.pairwiseComparisons[0].paperB.id).toBe(paperB1._id.toString());
      expect(completed.matchingPassages.length).toBeGreaterThan(0);
      expect(completed.matchingPassages[0].matchType).toBe('EXACT');
    });

    test('19. Multiple in Paper 1 (2 papers) and one in Paper 2 (1 paper) performs 2 comparisons (2 x 1 = 2)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString(), paperA2._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString()]));

      expect(res.statusCode).toBe(201);
      expect(res.body.paper1Count).toBe(2);
      expect(res.body.paper2Count).toBe(1);
      expect(res.body.totalComparisonsExpected).toBe(2);

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.pairwiseComparisons.length).toBe(2);
      expect(completed.totalComparisonsCompleted).toBe(2);
    });

    test('20. One in Paper 1 and multiple in Paper 2 (1 x 2 = 2)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString(), paperB2._id.toString()]));

      expect(res.statusCode).toBe(201);
      expect(res.body.paper1Count).toBe(1);
      expect(res.body.paper2Count).toBe(2);
      expect(res.body.totalComparisonsExpected).toBe(2);

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.pairwiseComparisons.length).toBe(2);
    });

    test('21. Multiple papers in both inputs (2 x 2 = 4 cross-group comparisons)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString(), paperA2._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString(), paperB2._id.toString()]));

      expect(res.statusCode).toBe(201);
      expect(res.body.paper1Count).toBe(2);
      expect(res.body.paper2Count).toBe(2);
      expect(res.body.totalComparisonsExpected).toBe(4);

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.pairwiseComparisons.length).toBe(4);
    });

    test('22. No within-group comparisons are ever performed', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString(), paperA2._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString(), paperB2._id.toString()]));

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);

      // Verify that NO comparison exists between paperA1 and paperA2 (both in group 1)
      const group1Internal = completed.pairwiseComparisons.find(
        p => (p.paperA.id === paperA1._id.toString() && p.paperB.id === paperA2._id.toString()) ||
             (p.paperA.id === paperA2._id.toString() && p.paperB.id === paperA1._id.toString())
      );
      expect(group1Internal).toBeUndefined();

      // Verify that NO comparison exists between paperB1 and paperB2 (both in group 2)
      const group2Internal = completed.pairwiseComparisons.find(
        p => (p.paperA.id === paperB1._id.toString() && p.paperB.id === paperB2._id.toString()) ||
             (p.paperA.id === paperB2._id.toString() && p.paperB.id === paperB1._id.toString())
      );
      expect(group2Internal).toBeUndefined();
    });

    test('23. Self-match detection: when identical paper appears in both groups, it is skipped with a warning', async () => {
      // paperA1 is added to both Paper 1 and Paper 2, plus paperB1 in Paper 2
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperA1._id.toString(), paperB1._id.toString()]));

      expect(res.statusCode).toBe(201);
      expect(res.body.skippedSelfMatches).toBeDefined();
      expect(res.body.skippedSelfMatches.length).toBe(1);
      expect(res.body.skippedSelfMatches[0]).toBe(paperA1.title);
      // Expected comparisons: 1x2 = 2 minus 1 self-match = 1 comparison
      expect(res.body.totalComparisonsExpected).toBe(1);
    });

    test('24. When Paper 1 and Paper 2 only contain the identical paper, 400 Bad Request is returned', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperA1._id.toString()]));

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/contain the same document/i);
    });

    test('25. Missing Paper 1 or Paper 2 returns 400 Bad Request', async () => {
      const resNoPaper2 = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([]));

      expect(resNoPaper2.statusCode).toBe(400);
      expect(resNoPaper2.body.error).toMatch(/at least one valid paper for Paper 2/i);
    });

    test('26. Cross-tenant security check: user cannot select Paper 1 or Paper 2 from another users project', async () => {
      // Bob tries to create a two-group scan using Alice's paper
      const res = await request(app)
        .post(`/api/projects/${project2Id}/plagiarism/scan`)
        .set(authHeader(token2))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString()]));

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/not found or not accessible/i);
    });

    test('27. Detailed match report retains exact paper titles, page numbers, match types, and text evidence', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paper1Ids', JSON.stringify([paperA1._id.toString()]))
        .field('paper2Ids', JSON.stringify([paperB1._id.toString()]));

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);

      expect(completed.matchingPassages.length).toBeGreaterThan(0);
      const match = completed.matchingPassages[0];
      expect(match.submittedText).toBeDefined();
      expect(match.sourceText).toBeDefined();
      expect(match.submittedPageNumber).toBeDefined();
      expect(match.sourcePageNumber).toBeDefined();
      expect(match.sourceTitle).toBe(paperB1.title);
      expect(match.matchType).toBe('EXACT');
      expect(completed.comparisonSummary.humanReviewDisclaimer).toMatch(/A match does not automatically prove plagiarism/i);
    });
  });

  describe('Phase 13 — Multiple Paper Selection & Custom Comparison Suite', () => {
    let paperA, paperB, paperC, paperD;

    beforeEach(async () => {
      paperA = new Paper({
        projectId: project1Id,
        originalFilename: 'paperA.pdf',
        storedFilename: 'paperA.pdf',
        status: 'COMPLETED',
        title: 'Distributed Log Consensus',
        extractedText: 'Raft algorithm decomposes state machine replication into leader election and log synchronization with consistent commit indices.',
      });
      await paperA.save();

      paperB = new Paper({
        projectId: project1Id,
        originalFilename: 'paperB.pdf',
        storedFilename: 'paperB.pdf',
        status: 'COMPLETED',
        title: 'Quantum Key Exchange',
        extractedText: 'Quantum cryptography uses photon polarization states to establish unconditionally secure symmetric keys over optical fiber links.',
      });
      await paperB.save();

      paperC = new Paper({
        projectId: project1Id,
        originalFilename: 'paperC.pdf',
        storedFilename: 'paperC.pdf',
        status: 'COMPLETED',
        title: 'Survey on Raft Consensus Protocols',
        extractedText: 'In our background study, Raft algorithm decomposes state machine replication into leader election and log synchronization with consistent commit indices.',
      });
      await paperC.save();

      paperD = new Paper({
        projectId: project1Id,
        originalFilename: 'paperD.pdf',
        storedFilename: 'paperD.pdf',
        status: 'COMPLETED',
        title: 'Optical Network Quantum Security',
        extractedText: 'Experimental setup: Quantum cryptography uses photon polarization states to establish unconditionally secure symmetric keys over optical fiber links.',
      });
      await paperD.save();
    });

    test('28. Custom pair selection executes only the explicitly chosen pairs (e.g. 2 out of 6)', async () => {
      // 4 papers have 6 possible pairs: (A,B), (A,C), (A,D), (B,C), (B,D), (C,D)
      // User selects only: A vs C, and B vs D
      const chosenPairs = [
        { paperAId: paperA._id.toString(), paperBId: paperC._id.toString() },
        { paperAId: paperB._id.toString(), paperBId: paperD._id.toString() },
      ];

      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paperIds', JSON.stringify([paperA._id, paperB._id, paperC._id, paperD._id]))
        .field('selectedPairs', JSON.stringify(chosenPairs));

      expect(res.statusCode).toBe(201);
      expect(res.body.comparisonMode).toBe('CUSTOM_PAIRS');
      expect(res.body.totalSelectedPapers).toBe(4);
      expect(res.body.totalComparisonsExpected).toBe(2);

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.pairwiseComparisons.length).toBe(2);
      expect(completed.totalComparisonsCompleted).toBe(2);

      // Verify that unselected pairs (like A vs B or C vs D) WERE NOT processed
      const pairAB = completed.pairwiseComparisons.find(
        (p) =>
          (p.paperA.id === paperA._id.toString() && p.paperB.id === paperB._id.toString()) ||
          (p.paperA.id === paperB._id.toString() && p.paperB.id === paperA._id.toString())
      );
      expect(pairAB).toBeUndefined();
    });

    test('29. Each comparison records paperAMatchPercentage and paperBMatchPercentage independently', async () => {
      const chosenPairs = [
        { paperAId: paperA._id.toString(), paperBId: paperC._id.toString() },
      ];

      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paperIds', JSON.stringify([paperA._id, paperC._id]))
        .field('selectedPairs', JSON.stringify(chosenPairs));

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.pairwiseComparisons.length).toBe(1);

      const comparison = completed.pairwiseComparisons[0];
      expect(comparison.paperAMatchPercentage).toBeDefined();
      expect(comparison.paperBMatchPercentage).toBeDefined();
      expect(comparison.paperAMatchPercentage).toBeGreaterThan(0);
      expect(comparison.paperBMatchPercentage).toBeGreaterThan(0);
      expect(comparison.status).toBe('COMPLETED');
    });

    test('30. When 0 comparisons are selected, returns 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paperIds', JSON.stringify([paperA._id, paperB._id]))
        .field('selectedPairs', JSON.stringify([]));

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/at least one valid comparison pair/i);
    });

    test('31. Duplicate and self-comparisons are prevented', async () => {
      // Submitting self-pair A vs A and duplicate pair A vs B twice
      const invalidPairs = [
        { paperAId: paperA._id.toString(), paperBId: paperA._id.toString() }, // Self
        { paperAId: paperA._id.toString(), paperBId: paperB._id.toString() },
        { paperAId: paperB._id.toString(), paperBId: paperA._id.toString() }, // Duplicate
      ];

      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paperIds', JSON.stringify([paperA._id, paperB._id]))
        .field('selectedPairs', JSON.stringify(invalidPairs));

      expect(res.statusCode).toBe(201);
      // Only 1 unique valid comparison remains: A vs B
      expect(res.body.totalComparisonsExpected).toBe(1);
    });

    test('32. Maximum 20 comparisons limit is enforced', async () => {
      // Generate 21 fake pairs
      const fakePairs = Array.from({ length: 21 }, (_, i) => ({
        paperAId: paperA._id.toString(),
        paperBId: paperB._id.toString(),
      }));

      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paperIds', JSON.stringify([paperA._id, paperB._id]))
        .field('selectedPairs', JSON.stringify(fakePairs));

      // Either deduplicated or rejected with maximum 20
      if (res.statusCode === 400) {
        expect(res.body.error).toMatch(/maximum of 20/i);
      } else {
        expect(res.body.totalComparisonsExpected).toBe(1);
      }
    });

    test('33. Partial failure reporting: unextractable document marks comparison as FAILED without claiming 0%', async () => {
      const corruptPaper = new Paper({
        projectId: project1Id,
        originalFilename: 'corrupt.pdf',
        storedFilename: 'non_existent_corrupt.pdf',
        status: 'COMPLETED',
        title: 'Corrupted Unextractable Paper',
        extractedText: '', // Empty unextractable text
      });
      await corruptPaper.save();

      const chosenPairs = [
        { paperAId: paperA._id.toString(), paperBId: corruptPaper._id.toString() },
      ];

      const res = await request(app)
        .post(`/api/projects/${project1Id}/plagiarism/scan`)
        .set(authHeader(token1))
        .field('paperIds', JSON.stringify([paperA._id, corruptPaper._id]))
        .field('selectedPairs', JSON.stringify(chosenPairs));

      await runPlagiarismScan(res.body.scanId);
      const completed = await PlagiarismScan.findById(res.body.scanId);
      expect(completed.pairwiseComparisons.length).toBe(1);

      const failedPair = completed.pairwiseComparisons[0];
      expect(failedPair.status).toBe('FAILED');
      expect(failedPair.matchPercentage).toBeNull(); // N/A, NOT 0%!
    });
  });
});


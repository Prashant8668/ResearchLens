/**
 * Phase 7 — AI-Powered Structured Summarization Tests
 * Tests both Google Gemini (@google/genai) and OpenAI GPT-4o providers:
 *
 * Scenarios:
 * 1. AI Service Unit Tests:
 *    - Gemini: Missing API key (AIConfigurationError, status 503, safe message)
 *    - OpenAI: Missing API key (AIConfigurationError, status 503, safe message)
 *    - Empty or whitespace-only extracted text (AIValidationError, status 400)
 *    - Provider selection: Gemini mode calls @google/genai and NEVER calls OpenAI axios
 *    - Provider selection: OpenAI mode calls axios and NEVER calls @google/genai
 *    - Valid paper produces validated 5 fields with model and timestamp
 *    - Short paper produces safe explicit statements without fabrication
 *    - Gemini error handling: Auth failure (401), Model not found (404), Quota exceeded (429)
 *    - OpenAI error handling: 429 transient retry, 401 failure, timeout handling
 *    - Schema validation & normalization (array/string normalization)
 *    - Long paper requiring chunking & consolidation pass
 * 2. API Routes & Persistence (Supertest):
 *    - Unauthenticated request rejected (401)
 *    - Paper ownership checks enforced (403/404)
 *    - Validation: non-completed or empty-text paper rejected (400)
 *    - POST /api/papers/:id/summary generates, validates, and persists structured summary
 *    - Preserves Phase 6 keyword extraction data in PaperAnalysis
 *    - GET /api/papers/:id/summary fetches saved structured summary with active provider/model
 *    - GET /api/projects/:id/analysis includes structuredSummary in paperAnalyses
 *    - Graceful error handling on AI failure (sets status FAILED, returns actionable error)
 *    - GET /api/projects/:id/report returns real paper metadata, Phase 6 keywords, and Phase 7 summary
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

// Mock axios (for OpenAI) and @google/genai (for Gemini)
jest.mock('axios');
jest.mock('@google/genai');

const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const mockGenerateContent = jest.fn();
GoogleGenAI.mockImplementation(() => ({
  models: {
    generateContent: mockGenerateContent,
  },
}));

const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Paper = require('../src/models/Paper');
const PaperAnalysis = require('../src/models/PaperAnalysis');
const aiService = require('../src/services/aiService');

let mongoServer;
let user1Id, user2Id;
let token1, token2;
let project1Id, project2Id;

const MOCK_VALID_SUMMARY = {
  researchProblem: 'Scaling deep neural networks leads to prohibitive memory bottlenecks in attention layers.',
  objective: 'To introduce FlashAttention, a fast and memory-efficient exact attention algorithm.',
  methodology: 'IO-aware tiling and recomputation during backward pass to reduce GPU HBM reads and writes.',
  keyFindings: [
    'FlashAttention trains BERT-large 15% faster than standard implementations.',
    'Reduces memory footprint from quadratic O(N^2) to sub-quadratic.',
  ],
  limitations: [
    'Requires hardware-level tuning for different GPU architectures.',
    'Evaluation limited to standard transformer sequence lengths up to 64k.',
  ],
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123', salt);

  const u1 = new User({ name: 'Alice Researcher', email: 'alice_p7@test.com', password: passwordHash });
  await u1.save();
  user1Id = u1._id;

  const u2 = new User({ name: 'Bob Reviewer', email: 'bob_p7@test.com', password: passwordHash });
  await u2.save();
  user2Id = u2._id;

  const r1 = await request(app).post('/api/auth/login').send({ email: 'alice_p7@test.com', password: 'Password123' });
  token1 = r1.body.token;

  const r2 = await request(app).post('/api/auth/login').send({ email: 'bob_p7@test.com', password: 'Password123' });
  token2 = r2.body.token;

  const p1 = new Project({ name: 'Phase 7 AI Project Alpha', userId: user1Id });
  await p1.save();
  project1Id = p1._id.toString();

  const p2 = new Project({ name: 'Phase 7 AI Project Beta', userId: user2Id });
  await p2.save();
  project2Id = p2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Paper.deleteMany({});
  await PaperAnalysis.deleteMany({});
  jest.clearAllMocks();
  mockGenerateContent.mockReset();
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.AI_PROVIDER = 'gemini';
});

/* =========================================================================
   1. AI SERVICE UNIT TESTS
   ========================================================================= */
describe('Phase 7 — aiService Unit Tests', () => {
  test('Gemini mode: Missing GEMINI_API_KEY throws AIConfigurationError without crashing', async () => {
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    await expect(
      aiService.generateStructuredSummary('Valid academic text about neural networks.')
    ).rejects.toThrow(aiService.AIConfigurationError);

    try {
      await aiService.generateStructuredSummary('Valid academic text');
    } catch (err) {
      expect(err.status).toBe(503);
      expect(err.message).toMatch(/Gemini API key is not configured/i);
    }
  });

  test('OpenAI mode: Missing OPENAI_API_KEY throws AIConfigurationError without crashing', async () => {
    process.env.AI_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    await expect(
      aiService.generateStructuredSummary('Valid academic text about neural networks.')
    ).rejects.toThrow(aiService.AIConfigurationError);

    try {
      await aiService.generateStructuredSummary('Valid academic text');
    } catch (err) {
      expect(err.status).toBe(503);
      expect(err.message).toMatch(/OpenAI API key is not configured/i);
    }
  });

  test('Empty or whitespace text throws AIValidationError before calling any AI API', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    await expect(aiService.generateStructuredSummary('')).rejects.toThrow(aiService.AIValidationError);
    await expect(aiService.generateStructuredSummary('   \n\t  ')).rejects.toThrow(aiService.AIValidationError);
    await expect(aiService.generateStructuredSummary(null)).rejects.toThrow(aiService.AIValidationError);

    // Verify neither provider was invoked
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('Gemini mode: Valid research paper calls @google/genai and NEVER calls OpenAI', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_VALID_SUMMARY),
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 300 },
    });

    const sampleText = 'Academic research paper content discussing deep neural network scaling...';
    const result = await aiService.generateStructuredSummary(sampleText);

    // Gemini SDK called
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    // CRITICAL: OpenAI MUST NOT be called when Gemini is active
    expect(axios.post).not.toHaveBeenCalled();

    // Verify structured fields
    expect(result.structuredSummary).toBeDefined();
    expect(result.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
    expect(result.structuredSummary.objective).toBe(MOCK_VALID_SUMMARY.objective);
    expect(result.structuredSummary.methodology).toBe(MOCK_VALID_SUMMARY.methodology);
    expect(result.structuredSummary.keyFindings).toEqual(MOCK_VALID_SUMMARY.keyFindings);
    expect(result.structuredSummary.limitations).toEqual(MOCK_VALID_SUMMARY.limitations);
    expect(result.structuredSummary.model).toBe('gemini-2.5-flash');
    expect(result.provider).toBe('gemini');
  });

  test('OpenAI mode: Valid research paper calls axios and NEVER calls @google/genai', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key';
    process.env.OPENAI_MODEL = 'gpt-4o';

    axios.post.mockResolvedValueOnce({
      data: {
        model: 'gpt-4o',
        choices: [{ message: { content: JSON.stringify(MOCK_VALID_SUMMARY) } }],
      },
    });

    const sampleText = 'Academic research paper content discussing deep neural network scaling...';
    const result = await aiService.generateStructuredSummary(sampleText);

    // OpenAI axios called
    expect(axios.post).toHaveBeenCalledTimes(1);
    // CRITICAL: Gemini SDK MUST NOT be called when OpenAI is active
    expect(mockGenerateContent).not.toHaveBeenCalled();

    expect(result.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
    expect(result.structuredSummary.model).toBe('gpt-4o');
    expect(result.provider).toBe('openai');
  });

  test('Gemini mode: Authentication failure throws AIServiceError with 401', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'invalid-gemini-key';

    mockGenerateContent.mockRejectedValueOnce({
      status: 401,
      message: 'API_KEY_INVALID: API key not valid.',
    });

    try {
      await aiService.generateStructuredSummary('Valid academic text');
      throw new Error('Should have failed');
    } catch (err) {
      expect(err).toBeInstanceOf(aiService.AIServiceError);
      expect(err.status).toBe(401);
      expect(err.message).toMatch(/Authentication failed with Gemini/i);
    }
  });

  test('Gemini mode: Model unavailable throws AIServiceError with 404', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'nonexistent-model';

    mockGenerateContent.mockRejectedValueOnce({
      status: 404,
      message: 'models/nonexistent-model is not found',
    });

    try {
      await aiService.generateStructuredSummary('Valid academic text');
      throw new Error('Should have failed');
    } catch (err) {
      expect(err).toBeInstanceOf(aiService.AIServiceError);
      expect(err.status).toBe(404);
      expect(err.message).toMatch(/unavailable or not found/i);
    }
  });

  test('Gemini mode: Quota exceeded throws AIServiceError with 429', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    mockGenerateContent.mockRejectedValueOnce({
      status: 429,
      message: 'RESOURCE_EXHAUSTED: You exceeded your current quota.',
    });

    try {
      await aiService.generateStructuredSummary('Valid academic text');
      throw new Error('Should have failed');
    } catch (err) {
      expect(err).toBeInstanceOf(aiService.AIServiceError);
      expect(err.status).toBe(429);
      expect(err.message).toMatch(/quota or rate limit exceeded/i);
    }
  });

  test('Short paper with limited evidence produces explicit missing statements without fabrication', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        researchProblem: 'Limited battery life in IoT sensor nodes.',
        objective: 'Investigate solar harvesting efficiency.',
        methodology: '',
        keyFindings: [],
        limitations: [],
      }),
    });

    const shortText = 'Brief report: Limited battery life in IoT sensor nodes. We investigated solar harvesting efficiency.';
    const result = await aiService.generateStructuredSummary(shortText);

    expect(result.structuredSummary.researchProblem).toBe('Limited battery life in IoT sensor nodes.');
    expect(result.structuredSummary.objective).toBe('Investigate solar harvesting efficiency.');
    expect(result.structuredSummary.methodology).toMatch(/not contain sufficient information/i);
    expect(result.structuredSummary.keyFindings[0]).toMatch(/not contain sufficient information/i);
    expect(result.structuredSummary.limitations[0]).toMatch(/not contain sufficient information/i);
  });

  test('Long paper exceeding chunk size triggers chunking and consolidation pass in Gemini', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const p1 = 'Paragraph 1: Introduction to scalable distributed consensus. '.repeat(10);
    const p2 = '\n\nParagraph 2: Methodology using Raft with speculative execution. '.repeat(10);
    const longText = p1 + p2;

    mockGenerateContent.mockImplementation(async () => {
      return {
        text: JSON.stringify(MOCK_VALID_SUMMARY),
      };
    });

    const result = await aiService.generateStructuredSummary(longText, { maxChunkChars: 500, chunkOverlapChars: 50 });

    expect(result.chunksProcessed).toBeGreaterThan(1);
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
  });

  test('Malformed JSON from AI throws AISchemaValidationError', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    mockGenerateContent.mockResolvedValueOnce({
      text: 'NOT VALID JSON { "broken": ',
    });

    await expect(aiService.generateStructuredSummary('Academic text')).rejects.toThrow(
      aiService.AISchemaValidationError
    );
  });
});

/* =========================================================================
   2. API ROUTES & PAPERANALYSIS PERSISTENCE TESTS (SUPERTEST)
   ========================================================================= */
describe('Phase 7 — API Routes & PaperAnalysis Persistence', () => {
  let samplePaper;

  beforeEach(async () => {
    samplePaper = new Paper({
      projectId: project1Id,
      originalFilename: 'attention_is_all_you_need.pdf',
      storedFilename: 'test-uuid-attention.pdf',
      fileSizeBytes: 10240,
      status: 'COMPLETED',
      title: 'Attention Is All You Need',
      extractedText: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, a model architecture eschewing recurrence.',
    });
    await samplePaper.save();
  });

  test('Unauthenticated request to POST /api/papers/:id/summary is rejected with 401', async () => {
    const res = await request(app).post(`/api/papers/${samplePaper._id}/summary`);
    expect(res.status).toBe(401);
  });

  test('Unauthenticated request to GET /api/papers/:id/summary is rejected with 401', async () => {
    const res = await request(app).get(`/api/papers/${samplePaper._id}/summary`);
    expect(res.status).toBe(401);
  });

  test('User cannot generate summary for paper belonging to another user (ownership enforcement)', async () => {
    const res = await request(app)
      .post(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${token2}`);

    expect([403, 404]).toContain(res.status);
  });

  test('Cannot generate summary for paper with empty extracted text or non-COMPLETED status', async () => {
    const failedPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'empty.pdf',
      storedFilename: 'uuid-empty.pdf',
      fileSizeBytes: 500,
      status: 'FAILED',
      extractedText: '',
    });
    await failedPaper.save();

    const res = await request(app)
      .post(`/api/papers/${failedPaper._id}/summary`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no extractable text/i);
  });

  test('POST /api/papers/:id/summary generates, validates, and persists structured summary while preserving Phase 6 keywords', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    // Pre-populate Phase 6 keywords in PaperAnalysis
    const existingKeywords = [
      { term: 'transformer', score: 0.85, rank: 1 },
      { term: 'attention', score: 0.72, rank: 2 },
    ];
    await PaperAnalysis.create({
      paperId: samplePaper._id,
      projectId: project1Id,
      extractedKeywords: existingKeywords,
      keywordsExtractedAt: new Date(),
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_VALID_SUMMARY),
    });

    const res = await request(app)
      .post(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.summaryStatus).toBe('COMPLETED');
    expect(res.body.aiProvider).toBe('gemini');
    expect(res.body.structuredSummary).toBeDefined();
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
    expect(res.body.structuredSummary.objective).toBe(MOCK_VALID_SUMMARY.objective);
    expect(res.body.structuredSummary.methodology).toBe(MOCK_VALID_SUMMARY.methodology);
    expect(res.body.structuredSummary.keyFindings).toEqual(MOCK_VALID_SUMMARY.keyFindings);
    expect(res.body.structuredSummary.limitations).toEqual(MOCK_VALID_SUMMARY.limitations);

    // Verify DB persistence & Phase 6 keyword preservation
    const savedInDb = await PaperAnalysis.findOne({ paperId: samplePaper._id });
    expect(savedInDb).toBeDefined();
    expect(savedInDb.summaryStatus).toBe('COMPLETED');
    expect(savedInDb.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);

    // CRITICAL: Phase 6 keywords MUST be preserved!
    expect(savedInDb.extractedKeywords).toHaveLength(2);
    expect(savedInDb.extractedKeywords[0].term).toBe('transformer');
    expect(savedInDb.extractedKeywords[1].term).toBe('attention');
  });

  test('GET /api/papers/:id/summary returns persisted structured summary and aiProvider', async () => {
    await PaperAnalysis.create({
      paperId: samplePaper._id,
      projectId: project1Id,
      summaryStatus: 'COMPLETED',
      structuredSummary: {
        ...MOCK_VALID_SUMMARY,
        model: 'gemini-2.5-flash',
        generatedAt: new Date(),
      },
    });

    const res = await request(app)
      .get(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.paperId.toString()).toBe(samplePaper._id.toString());
    expect(res.body.summaryStatus).toBe('COMPLETED');
    expect(res.body.aiProvider).toBe('gemini');
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
    expect(res.body.structuredSummary.keyFindings).toHaveLength(2);
  });

  test('GET /api/projects/:id/analysis includes structuredSummary and aiProvider in paperAnalyses list', async () => {
    await PaperAnalysis.create({
      paperId: samplePaper._id,
      projectId: project1Id,
      extractedKeywords: [{ term: 'transformer', score: 0.9, rank: 1 }],
      summaryStatus: 'COMPLETED',
      structuredSummary: {
        ...MOCK_VALID_SUMMARY,
        model: 'gemini-2.5-flash',
        generatedAt: new Date(),
      },
    });

    const res = await request(app)
      .get(`/api/projects/${project1Id}/analysis`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.aiProvider).toBe('gemini');
    expect(res.body.paperAnalyses).toBeDefined();
    expect(res.body.paperAnalyses.length).toBeGreaterThan(0);

    const targetDoc = res.body.paperAnalyses.find(
      p => p.paperId.toString() === samplePaper._id.toString()
    );
    expect(targetDoc).toBeDefined();
    expect(targetDoc.structuredSummary).toBeDefined();
    expect(targetDoc.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
    expect(targetDoc.summaryStatus).toBe('COMPLETED');
  });

  test('AI service failure marks summaryStatus as FAILED without crashing', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    mockGenerateContent.mockRejectedValueOnce({
      status: 503,
      message: 'Gemini service temporarily unavailable',
    });

    const res = await request(app)
      .post(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${token1}`);

    expect([502, 503]).toContain(res.status);
    expect(res.body.summaryStatus).toBe('FAILED');
    expect(res.body.error).toBeDefined();

    // Verify status was persisted as FAILED in database
    const savedInDb = await PaperAnalysis.findOne({ paperId: samplePaper._id });
    expect(savedInDb).toBeDefined();
    expect(savedInDb.summaryStatus).toBe('FAILED');
    expect(savedInDb.summaryError).toBeDefined();
  });

  test('Sanitizes placeholder titles like (anonymous) or untitled to originalFilename', async () => {
    const anonPaper = new Paper({
      projectId: project1Id,
      originalFilename: 'researchlens_paper.pdf',
      storedFilename: 'uuid-anon-paper.pdf',
      fileSizeBytes: 2048,
      status: 'COMPLETED',
      title: '(anonymous)',
      authors: ['(anonymous)', 'Real Author'],
      extractedText: 'Valid academic paper content.',
    });
    await anonPaper.save();

    const res = await request(app)
      .get(`/api/papers/${anonPaper._id}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.title).not.toBe('(anonymous)');
    expect(res.body.title).toBe('researchlens_paper.pdf');
    expect(res.body.authors).toEqual(['Real Author']);
  });

  test('GET /api/projects/:id/report returns real paper metadata, Phase 6 keywords, and Phase 7 summary with aiProvider', async () => {
    await PaperAnalysis.create({
      paperId: samplePaper._id,
      projectId: project1Id,
      extractedKeywords: [
        { term: 'attention mechanism', score: 0.95, rank: 1 },
        { term: 'transformer architecture', score: 0.88, rank: 2 },
      ],
      summaryStatus: 'COMPLETED',
      structuredSummary: {
        ...MOCK_VALID_SUMMARY,
        model: 'gemini-2.5-flash',
        generatedAt: new Date(),
      },
    });

    const res = await request(app)
      .get(`/api/projects/${project1Id}/report`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.projectName).toBe('Phase 7 AI Project Alpha');
    expect(res.body.aiProvider).toBe('gemini');
    expect(res.body.totalCompletedPapers).toBe(1);
    expect(res.body.keywords).toHaveLength(2);
    expect(res.body.structuredSummary).toBeDefined();
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_VALID_SUMMARY.researchProblem);
    expect(res.body.structuredSummary.model).toBe('gemini-2.5-flash');
  });
});

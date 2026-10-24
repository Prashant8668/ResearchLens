/**
 * Tests for Groq Provider and Gemini Fallback Configuration
 *
 * Verifies:
 * 1. AI_PROVIDER=groq routes summary requests to Groq (axios post to Groq endpoint).
 * 2. Groq success returns validated summary and does NOT call Gemini.
 * 3. Missing GROQ_API_KEY throws AIConfigurationError without crashing.
 * 4. Retryable failures trigger Gemini fallback:
 *    - 429 Rate Limit triggers fallback to Gemini.
 *    - 503 Server Outage triggers fallback to Gemini.
 *    - Request Timeout (ECONNABORTED) triggers fallback to Gemini.
 * 5. Non-retryable errors do NOT trigger fallback:
 *    - 401 Authentication failure throws immediately without calling Gemini.
 *    - 400 Bad Request throws immediately without calling Gemini.
 * 6. Finite retry behavior (no indefinite retries) when both Groq and Gemini fail.
 * 7. Supertest API routes: POST & GET /api/papers/:id/summary with Groq and fallback.
 * 8. Security verification: API keys are never printed in error messages or responses.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

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
let userId, userToken, projectId, samplePaper;

const MOCK_SUMMARY_DATA = {
  researchProblem: 'Transformer attention exhibits quadratic computational complexity with respect to context length.',
  objective: 'To develop a sub-quadratic attention mechanism that preserves representation capacity.',
  methodology: 'Empirical benchmark against standard multi-head self-attention on LRA and WikiText-103.',
  keyFindings: [
    'Achieves 2.4x speedup on 8k sequence lengths compared to standard attention.',
    'Maintains within 0.2 perplexity of the dense baseline.',
  ],
  limitations: [
    'Evaluated primarily on autoregressive language modeling tasks.',
    'Slight degradation observed on complex associative recall probes.',
  ],
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongoServer.getUri());

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123', salt);

  const user = new User({ name: 'Groq Test User', email: 'groq_test@example.com', password: passwordHash });
  await user.save();
  userId = user._id;

  const loginRes = await request(app).post('/api/auth/login').send({ email: 'groq_test@example.com', password: 'Password123' });
  userToken = loginRes.body.token;

  const project = new Project({ name: 'Groq Evaluation Project', userId });
  await project.save();
  projectId = project._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Paper.deleteMany({});
  await PaperAnalysis.deleteMany({});
  jest.clearAllMocks();
  mockGenerateContent.mockReset();

  samplePaper = new Paper({
    projectId,
    originalFilename: 'groq_attention_study.pdf',
    storedFilename: 'uuid_groq_study.pdf',
    fileSizeBytes: 20480,
    status: 'COMPLETED',
    title: 'Sub-Quadratic Attention Scaling',
    extractedText: 'We study scalable sub-quadratic attention architectures for language models. We evaluate throughput and perplexity.',
  });
  await samplePaper.save();

  process.env.AI_PROVIDER = 'groq';
  process.env.GROQ_API_KEY = 'gsk_test_groq_secret_key_12345';
  process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
  process.env.GEMINI_API_KEY = 'test_gemini_secret_key_67890';
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
});

afterEach(() => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.OPENAI_API_KEY;
  process.env.AI_PROVIDER = 'gemini';
});

describe('Groq Provider & Gemini Fallback Unit Tests', () => {
  test('AI_PROVIDER=groq routes summary requests directly to Groq endpoint and does NOT call Gemini', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        model: 'openai/gpt-oss-120b',
        choices: [{ message: { content: JSON.stringify(MOCK_SUMMARY_DATA) } }],
        usage: { prompt_tokens: 120, completion_tokens: 180 },
      },
    });

    const result = await aiService.generateStructuredSummary('Academic text evaluating language models.');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [callUrl, callBody, callConfig] = axios.post.mock.calls[0];
    expect(callUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(callConfig.headers.Authorization).toBe('Bearer gsk_test_groq_secret_key_12345');
    expect(callBody.model).toBe('openai/gpt-oss-120b');
    expect(callBody.response_format).toEqual({ type: 'json_object' });

    // Gemini MUST NOT be called when Groq succeeds
    expect(mockGenerateContent).not.toHaveBeenCalled();

    // Verify output structure
    expect(result.provider).toBe('groq');
    expect(result.structuredSummary.model).toBe('openai/gpt-oss-120b');
    expect(result.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);
    expect(result.structuredSummary.objective).toBe(MOCK_SUMMARY_DATA.objective);
    expect(result.structuredSummary.keyFindings).toEqual(MOCK_SUMMARY_DATA.keyFindings);
    expect(result.structuredSummary.limitations).toEqual(MOCK_SUMMARY_DATA.limitations);
  });

  test('Missing GROQ_API_KEY throws AIConfigurationError without crashing', async () => {
    delete process.env.GROQ_API_KEY;

    await expect(
      aiService.generateStructuredSummary('Valid academic text')
    ).rejects.toThrow(aiService.AIConfigurationError);

    expect(axios.post).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('Groq 429 Rate Limit triggers fallback to Gemini, which succeeds', async () => {
    // Groq fails with 429 Rate Limit
    axios.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { message: 'Rate limit reached for model openai/gpt-oss-120b', code: 'rate_limit_exceeded' } },
      },
    });

    // Gemini fallback succeeds
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_SUMMARY_DATA),
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 250 },
    });

    const result = await aiService.generateStructuredSummary('Valid academic text about language models.');

    // Groq was called first
    expect(axios.post).toHaveBeenCalled();
    // Gemini fallback was invoked
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Verified fallback metadata
    expect(result.provider).toBe('gemini');
    expect(result.fallbackUsed).toBe(true);
    expect(result.primaryProvider).toBe('groq');
    expect(result.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);
  });

  test('Groq 503 Service Outage triggers fallback to Gemini, which succeeds', async () => {
    // Groq fails with 503
    axios.post.mockRejectedValue({
      response: {
        status: 503,
        data: { error: { message: 'Service Unavailable: Overloaded' } },
      },
    });

    // Gemini fallback succeeds
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_SUMMARY_DATA),
    });

    const result = await aiService.generateStructuredSummary('Valid academic text.');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
    expect(result.fallbackUsed).toBe(true);
  });

  test('Groq request timeout (ECONNABORTED) triggers fallback to Gemini', async () => {
    const timeoutErr = new Error('timeout of 60000ms exceeded');
    timeoutErr.code = 'ECONNABORTED';
    axios.post.mockRejectedValue(timeoutErr);

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_SUMMARY_DATA),
    });

    const result = await aiService.generateStructuredSummary('Valid academic text.');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
    expect(result.fallbackUsed).toBe(true);
  });

  test('Groq 401 Authentication failure does NOT trigger fallback and fails immediately', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { error: { message: 'Invalid API Key provided' } },
      },
    });

    await expect(
      aiService.generateStructuredSummary('Valid academic text.')
    ).rejects.toThrow(/Authentication failed with Groq/i);

    // Gemini MUST NOT be called for authentication errors
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('Groq 400 Bad Request does NOT trigger fallback and fails immediately', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: { message: 'Invalid JSON payload structure' } },
      },
    });

    await expect(
      aiService.generateStructuredSummary('Valid academic text.')
    ).rejects.toThrow(/Groq rejected request/i);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('When both Groq and Gemini fail, terminates without indefinite retries', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { message: 'Groq quota exceeded' } },
      },
    });

    mockGenerateContent.mockRejectedValueOnce({
      status: 429,
      message: 'RESOURCE_EXHAUSTED: Gemini quota exceeded',
    });

    await expect(
      aiService.generateStructuredSummary('Valid academic text.')
    ).rejects.toThrow(/Primary provider \(Groq\) failed/i);
  });

  test('getActiveProvider returns groq and getActiveModel returns configured Groq model', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
    expect(aiService.getActiveProvider()).toBe('groq');
    expect(aiService.getActiveModel()).toBe('openai/gpt-oss-120b');
  });

  test('Dynamic environment variables: GROQ_MODEL dynamically overrides primary model', async () => {
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
    axios.post.mockResolvedValueOnce({
      data: {
        model: 'llama-3.1-8b-instant',
        choices: [{ message: { content: JSON.stringify(MOCK_SUMMARY_DATA) } }],
      },
    });

    const result = await aiService.generateStructuredSummary('Valid academic text.');
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, callBody] = axios.post.mock.calls[0];
    expect(callBody.model).toBe('llama-3.1-8b-instant');
    expect(result.structuredSummary.model).toBe('llama-3.1-8b-instant');
  });

  test('Dynamic environment variables: GEMINI_MODEL dynamically overrides fallback model', async () => {
    process.env.GEMINI_MODEL = 'gemini-1.5-pro';
    axios.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { message: 'Groq Rate Limit Exceeded' } },
      },
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_SUMMARY_DATA),
    });

    const result = await aiService.generateStructuredSummary('Valid academic text.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
    expect(result.structuredSummary.model).toBe('gemini-1.5-pro');
    expect(result.fallbackUsed).toBe(true);
  });

  test('API keys are NEVER leaked in error messages', async () => {
    const sensitiveKey = 'gsk_super_secret_key_never_leak_me';
    process.env.GROQ_API_KEY = sensitiveKey;

    axios.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { error: { message: `Authentication error with ${sensitiveKey}` } },
      },
    });

    try {
      await aiService.generateStructuredSummary('Valid academic text.');
      throw new Error('Should have failed');
    } catch (err) {
      expect(err.message).not.toContain(sensitiveKey);
    }
  });
});

describe('Groq Provider & Gemini Fallback API Integration Tests', () => {
  test('POST /api/papers/:id/summary routes to Groq and persists structuredSummary with aiProvider groq and GROQ_MODEL', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        model: 'openai/gpt-oss-120b',
        choices: [{ message: { content: JSON.stringify(MOCK_SUMMARY_DATA) } }],
      },
    });

    const res = await request(app)
      .post(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.aiProvider).toBe('groq');
    expect(res.body.aiModel).toBe('openai/gpt-oss-120b');
    expect(res.body.fallbackUsed).toBe(false);
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);

    // Verify DB persistence
    const analysis = await PaperAnalysis.findOne({ paperId: samplePaper._id });
    expect(analysis).not.toBeNull();
    expect(analysis.summaryStatus).toBe('COMPLETED');
    expect(analysis.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);
    expect(analysis.structuredSummary.model).toBe('openai/gpt-oss-120b');
    expect(analysis.summary).toContain(MOCK_SUMMARY_DATA.researchProblem);
    expect(analysis.methodology).toBe(MOCK_SUMMARY_DATA.methodology);
    expect(analysis.limitations).toEqual(MOCK_SUMMARY_DATA.limitations);
  });

  test('POST /api/papers/:id/summary falls back to Gemini on Groq 429 rate limit and persists successfully with GEMINI_MODEL', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { message: 'Groq Rate Limit Exceeded' } },
      },
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(MOCK_SUMMARY_DATA),
    });

    const res = await request(app)
      .post(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.aiProvider).toBe('gemini');
    expect(res.body.aiModel).toBe('gemini-2.5-flash');
    expect(res.body.fallbackUsed).toBe(true);
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);

    const analysis = await PaperAnalysis.findOne({ paperId: samplePaper._id });
    expect(analysis.summaryStatus).toBe('COMPLETED');
    expect(analysis.structuredSummary.model).toBe('gemini-2.5-flash');
  });

  test('POST /api/papers/:id/summary when both Groq and Gemini fail, updates analysis to FAILED and returns 502', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { message: 'Groq Rate Limit Exceeded' } },
      },
    });

    mockGenerateContent.mockRejectedValueOnce({
      status: 429,
      message: 'RESOURCE_EXHAUSTED: Gemini quota exceeded',
    });

    const res = await request(app)
      .post(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${userToken}`);

    expect([429, 502]).toContain(res.status);
    expect(res.body.summaryStatus).toBe('FAILED');
    expect(res.body.error).toMatch(/Primary provider \(Groq\) failed.*Fallback provider \(Gemini\) also failed/i);

    const analysis = await PaperAnalysis.findOne({ paperId: samplePaper._id });
    expect(analysis.summaryStatus).toBe('FAILED');
    expect(analysis.summaryError).toMatch(/Primary provider \(Groq\) failed/i);
  });

  test('GET /api/papers/:id/summary returns aiProvider groq and saved structured summary', async () => {
    const analysis = new PaperAnalysis({
      paperId: samplePaper._id,
      projectId,
      summaryStatus: 'COMPLETED',
      structuredSummary: {
        ...MOCK_SUMMARY_DATA,
        model: 'openai/gpt-oss-120b',
        generatedAt: new Date(),
      },
    });
    await analysis.save();

    const res = await request(app)
      .get(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.aiProvider).toBe('groq');
    expect(res.body.aiModel).toBe('openai/gpt-oss-120b');
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);
  });

  test('GET /api/papers/:id/summary returns aiProvider gemini when summary was generated with Gemini fallback', async () => {
    const analysis = new PaperAnalysis({
      paperId: samplePaper._id,
      projectId,
      summaryStatus: 'COMPLETED',
      structuredSummary: {
        ...MOCK_SUMMARY_DATA,
        model: 'gemini-2.5-flash',
        generatedAt: new Date(),
      },
    });
    await analysis.save();

    const res = await request(app)
      .get(`/api/papers/${samplePaper._id}/summary`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.aiProvider).toBe('gemini');
    expect(res.body.aiModel).toBe('gemini-2.5-flash');
    expect(res.body.structuredSummary.researchProblem).toBe(MOCK_SUMMARY_DATA.researchProblem);
  });
});

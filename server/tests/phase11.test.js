/**
 * Phase 11 — Research Recommendations Test Suite
 * Validates explainable, evidence-grounded future research directions, questions,
 * methodology suggestions, related papers grounding, cross-tenant isolation,
 * fallback behavior, and schema integrity.
 */

jest.setTimeout(45000);

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
const recommendationService = require('../src/services/recommendationService');
const aiService = require('../src/services/aiService');

let user1Token;
let user2Token;
let user1Id;
let user2Id;

let projectMultiId;
let projectSingleId;
let projectEmptyId;
let projectUser2Id;
let projectMissingMetaId;

let paperMulti1Id;
let paperMulti2Id;
let paperMissingMetaId;

const JWT_SECRET = process.env.JWT_SECRET || 'phase11_test_jwt_secret';

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
  const passwordHash = await bcrypt.hash('Secret1234', salt);

  const user1 = await User.create({
    name: 'Research Strategist One',
    email: 'strategist1_p11@example.com',
    password: passwordHash,
  });
  user1Id = user1._id;
  user1Token = jwt.sign({ id: user1._id, email: user1.email }, JWT_SECRET, { expiresIn: '1h' });

  const user2 = await User.create({
    name: 'Research Strategist Two',
    email: 'strategist2_p11@example.com',
    password: passwordHash,
  });
  user2Id = user2._id;
  user2Token = jwt.sign({ id: user2._id, email: user2.email }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Multi-Paper Project (Rich corpus with explicit limitations and future work)
  const projMulti = await Project.create({
    name: 'Quantum Machine Learning Inversion',
    domain: 'Quantum Computing',
    userId: user1Id,
  });
  projectMultiId = projMulti._id.toString();

  const p1 = await Paper.create({
    projectId: projectMultiId,
    title: 'Variational Quantum State Reconstruction on Noisy Intermediate-Scale Hardware',
    authors: ['Dr. Alexei Volkov', 'Maya Lin'],
    originalFilename: 'nisq_quantum_recon.pdf',
    storedFilename: 'nisq_quantum_recon_stored.pdf',
    extractedText: `
      1. Introduction
      Variational quantum eigensolvers (VQE) suffer from barren plateau phenomena during gradient descent.
      
      2. Methodology
      We utilized parameterized ansatz circuits with depth-4 entanglement layers on 16-qubit superconducting hardware.
      
      3. Limitations and Threats to Validity
      Limitations: The optimization trajectory is highly susceptible to decoherence-induced barren plateaus when circuit depth exceeds 8 layers. 
      Furthermore, error mitigation requires exponential measurement sampling overhead under non-Markovian noise.
      
      4. Future Work
      Future research should investigate Clifford-assisted shadow tomography to reduce measurement complexity and develop adaptive ansatz pruning strategies.
    `,
    status: 'COMPLETED',
    publicationYear: 2024,
  });
  paperMulti1Id = p1._id.toString();

  await PaperAnalysis.create({
    paperId: p1._id,
    projectId: projectMultiId,
    extractedKeywords: [
      { term: 'quantum state reconstruction', score: 3.8, rank: 1 },
      { term: 'barren plateau', score: 3.5, rank: 2 },
      { term: 'variational quantum', score: 3.2, rank: 3 },
      { term: 'error mitigation', score: 2.9, rank: 4 },
      { term: 'ansatz circuit', score: 2.5, rank: 5 },
    ],
    structuredSummary: {
      researchProblem: 'Mitigating optimization degradation caused by barren plateaus in variational quantum circuits.',
      methodology: 'Parameterized 16-qubit quantum circuits evaluated under depolarizing and amplitude-damping noise channels.',
      keyFindings: 'Ansatz entanglement depth directly correlates with gradient variance decay beyond 8 quantum layers.',
      limitations: 'Measurement sampling overhead scales exponentially; analysis restricted to simulated depolarizing noise models.',
    },
  });

  const p2 = await Paper.create({
    projectId: projectMultiId,
    title: 'Tensor Network Compaction for Hybrid Quantum-Classical Simulation',
    authors: ['Kenji Sato', 'Sarah Higgins'],
    originalFilename: 'tensor_quantum_compact.pdf',
    storedFilename: 'tensor_quantum_compact_stored.pdf',
    extractedText: `
      Abstract
      Simulating quantum circuits on classical HPC clusters requires compressed representations.
      
      Methodology
      We decomposed multi-qubit unitaries using Matrix Product States (MPS) with singular value thresholding.
      
      Limitations and Future Directions
      Limitations: Tensor bond dimensions grow rapidly in highly entangled quantum states, leading to severe memory bottlenecks on classical GPU nodes.
      Future work must explore randomized tensor truncation and hybrid quantum-classical state partitioning.
    `,
    status: 'COMPLETED',
    publicationYear: 2025,
  });
  paperMulti2Id = p2._id.toString();

  await PaperAnalysis.create({
    paperId: p2._id,
    projectId: projectMultiId,
    extractedKeywords: [
      { term: 'tensor network', score: 3.9, rank: 1 },
      { term: 'matrix product states', score: 3.4, rank: 2 },
      { term: 'quantum simulation', score: 3.1, rank: 3 },
      { term: 'bond dimension', score: 2.8, rank: 4 },
    ],
    structuredSummary: {
      researchProblem: 'Classical memory bottlenecks in simulating high-entanglement quantum circuits.',
      methodology: 'Singular value thresholding applied to MPS tensor network representations of 32-qubit states.',
      keyFindings: 'Compresses low-entanglement circuits up to 10x without fidelity degradation.',
      limitations: 'Bond dimension explosion occurs when entanglement entropy exceeds critical threshold.',
    },
  });

  // Seed supporting Gap in projectMulti
  await GapResult.create({
    projectId: projectMultiId,
    title: 'Barren Plateau and Entanglement Growth Bottlenecks in Hybrid Simulation',
    topic: 'Barren Plateau & Tensor Compaction',
    category: 'Theoretical / Algorithmic',
    gapType: 'Explicit Gap',
    description: 'Optimization gradients decay exponentially due to barren plateaus while tensor bond dimensions explode under deep circuit entanglement.',
    whyItMatters: 'Prevents scaling variational quantum algorithms to useful problem sizes.',
    suggestedDirection: 'Develop Clifford-assisted tensor truncation combined with adaptive ansatz pruning.',
    confidenceScore: 0.88,
    confidenceRationale: 'Explicitly corroborated by author limitation statements in both papers.',
    supportingPapers: [
      {
        paperId: p1._id,
        title: p1.title,
        originalFilename: p1.originalFilename,
        publicationYear: 2024,
        evidenceExcerpt: 'The optimization trajectory is highly susceptible to decoherence-induced barren plateaus when circuit depth exceeds 8 layers.',
        sourceSection: 'Limitations and Threats to Validity',
      },
      {
        paperId: p2._id,
        title: p2.title,
        originalFilename: p2.originalFilename,
        publicationYear: 2025,
        evidenceExcerpt: 'Tensor bond dimensions grow rapidly in highly entangled quantum states, leading to severe memory bottlenecks on classical GPU nodes.',
        sourceSection: 'Limitations and Future Directions',
      },
    ],
  });

  // 2. Single-Paper Project (Preliminary limitations)
  const projSingle = await Project.create({
    name: 'Single Paper Preliminary Study',
    domain: 'Renewable Energy',
    userId: user1Id,
  });
  projectSingleId = projSingle._id.toString();

  const pSingle = await Paper.create({
    projectId: projectSingleId,
    title: 'Perovskite Photovoltaic Degradation Under Thermal Stress',
    authors: ['Elena Gomez'],
    originalFilename: 'perovskite_thermal.pdf',
    storedFilename: 'perovskite_thermal_stored.pdf',
    extractedText: 'We study perovskite solar cell stability. Limitations: Tested only under dry nitrogen; ambient atmospheric humidity was unmonitored.',
    status: 'COMPLETED',
    publicationYear: 2025,
  });
  await PaperAnalysis.create({
    paperId: pSingle._id,
    projectId: projectSingleId,
    extractedKeywords: [
      { term: 'perovskite', score: 3.5, rank: 1 },
      { term: 'photovoltaic', score: 3.1, rank: 2 },
    ],
    structuredSummary: {
      researchProblem: 'Thermal degradation mechanisms in organic-inorganic perovskite solar cells.',
      methodology: 'Accelerated thermal aging at 85C inside a nitrogen glovebox.',
      keyFindings: 'Ion migration accelerates phase segregation at crystal grain boundaries.',
      limitations: 'Testing under dry nitrogen excludes real-world moisture and oxygen degradation factors.',
    },
  });

  // 3. Project with Missing Publication Year and Missing Author Metadata
  const projMissingMeta = await Project.create({
    name: 'Corpus with Incomplete Metadata',
    domain: 'Astrophysics',
    userId: user1Id,
  });
  projectMissingMetaId = projMissingMeta._id.toString();

  const pMissing = await Paper.create({
    projectId: projectMissingMetaId,
    title: 'Interstellar Medium Dust Polarization Spectrum',
    authors: [], // Missing authors
    originalFilename: 'interstellar_dust_raw.pdf',
    storedFilename: 'interstellar_dust_raw_stored.pdf',
    extractedText: 'Dust grain alignment in magnetic fields remains elusive. Limitations: Sample collected from single galactic quadrant.',
    status: 'COMPLETED',
    publicationYear: null, // Missing year
  });
  paperMissingMetaId = pMissing._id.toString();

  await PaperAnalysis.create({
    paperId: pMissing._id,
    projectId: projectMissingMetaId,
    extractedKeywords: [
      { term: 'dust polarization', score: 3.0, rank: 1 },
      { term: 'interstellar medium', score: 2.8, rank: 2 },
    ],
    structuredSummary: {
      researchProblem: 'Mechanism of dust grain alignment in interstellar magnetic fields.',
      methodology: 'Submillimeter polarimetry observations.',
      keyFindings: 'Polarization fraction decays with optical depth.',
      limitations: 'Restricted to a single galactic quadrant without multi-wavelength calibration.',
    },
  });

  // 4. Empty Project (Zero papers)
  const projEmpty = await Project.create({
    name: 'Empty Research Project',
    domain: 'Nanotechnology',
    userId: user1Id,
  });
  projectEmptyId = projEmpty._id.toString();

  // 5. User2 Restricted Project
  const projUser2 = await Project.create({
    name: 'User 2 Confidential Project',
    domain: 'Biodefense',
    userId: user2Id,
  });
  projectUser2Id = projUser2._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Phase 11 — Research Recommendations Backend API & Methodology', () => {

  // --- 1. Authentication & Cross-Project Isolation ---
  describe('Authentication & Authorization', () => {
    test('GET /api/projects/:id/recommendations returns 401 without Bearer token', async () => {
      const res = await request(app).get(`/api/projects/${projectMultiId}/recommendations`);
      expect(res.status).toBe(401);
    });

    test('GET /api/projects/:id/recommendations returns 403 when requesting project owned by another user', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectUser2Id}/recommendations`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|unauthorized/i);
    });

    test('POST /api/projects/:id/recommendations/generate returns 403 on unauthorized user generation attempt', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectUser2Id}/recommendations/generate`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(403);
    });

    test('Returns 404 when project ID does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/projects/${fakeId}/recommendations`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(404);
    });
  });

  // --- 2. Empty Corpus Handling ---
  describe('Empty Corpus Handling', () => {
    test('Returns INSUFFICIENT_DATA and zero recommendations for project with 0 papers', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectEmptyId}/recommendations`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('INSUFFICIENT_DATA');
      expect(res.body.count).toBe(0);
      expect(res.body.eligiblePaperCount).toBe(0);
      expect(Array.isArray(res.body.recommendations)).toBe(true);
      expect(res.body.recommendations).toHaveLength(0);
      expect(res.body.dataLimitations).toMatch(/at least 1.*required/i);
    });
  });

  // --- 3. Multi-Paper Corpus Generation & Explainability ---
  describe('Multi-Paper Corpus Recommendations & Methodology Grounding', () => {
    let recommendations = [];

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/projects/${projectMultiId}/recommendations/generate`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ deterministicOnly: true });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.count).toBeGreaterThanOrEqual(1);

      const fetchRes = await request(app)
        .get(`/api/projects/${projectMultiId}/recommendations`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(fetchRes.status).toBe(200);
      recommendations = fetchRes.body.recommendations;
    });

    test('Generates structured recommendations with research directions and researchable questions', () => {
      expect(recommendations.length).toBeGreaterThanOrEqual(1);
      recommendations.forEach(rec => {
        expect(rec.title).toBeTruthy();
        expect(rec.researchDirection).toBeTruthy();
        expect(rec.researchQuestion).toBeTruthy();
        // Research question must be a question
        expect(rec.researchQuestion).toMatch(/\?$/);
        expect(rec.targetTopic).toBeTruthy();
        expect(rec.priority).toMatch(/High|Medium|Low/);
      });
    });

    test('Provides comprehensive methodology suggestions (study design, data requirements, evaluation metrics, reasoning, limitations)', () => {
      recommendations.forEach(rec => {
        expect(rec.methodologyDetails).toBeDefined();
        const m = rec.methodologyDetails;

        expect(m.studyDesign).toBeTruthy();
        expect(typeof m.studyDesign).toBe('string');

        expect(m.dataRequirements).toBeTruthy();
        expect(typeof m.dataRequirements).toBe('string');

        expect(Array.isArray(m.evaluationMetrics)).toBe(true);
        expect(m.evaluationMetrics.length).toBeGreaterThanOrEqual(1);

        expect(m.reasoning).toBeTruthy();
        expect(m.limitations).toBeTruthy();

        // Also check top-level explanation & limitations
        expect(rec.whyRecommended).toBeTruthy();
        expect(rec.limitations).toBeTruthy();
        expect(rec.expectedContribution).toBeTruthy();
      });
    });

    test('Explicit gap grounded recommendations contain direct evidence excerpts and traceable paper IDs', () => {
      const explicitRecs = recommendations.filter(r => r.groundingLevel === 'EXPLICIT_GAP_GROUNDED');
      expect(explicitRecs.length).toBeGreaterThanOrEqual(1);

      explicitRecs.forEach(rec => {
        expect(rec.evidenceExcerpts).toBeDefined();
        expect(rec.evidenceExcerpts.length).toBeGreaterThanOrEqual(1);

        const firstExcerpt = rec.evidenceExcerpts[0];
        expect(firstExcerpt.excerpt).toBeTruthy();
        expect(firstExcerpt.paperTitle).toBeTruthy();
        expect(firstExcerpt.sourceSection).toBeTruthy();
        expect(firstExcerpt.paperId).toBeTruthy();

        // Must match one of the papers in the multi corpus
        expect([paperMulti1Id, paperMulti2Id]).toContain(firstExcerpt.paperId.toString());
      });
    });

    test('Corpus-inferred opportunities and AI hypotheses have distinct, valid groundingLevel tags', () => {
      const groundingLevels = recommendations.map(r => r.groundingLevel);
      const validLevels = ['EXPLICIT_GAP_GROUNDED', 'CORPUS_INFERRED', 'AI_HYPOTHESIS'];

      groundingLevels.forEach(lvl => {
        expect(validLevels).toContain(lvl);
      });
    });

    test('Related papers contain actual stored paper metadata and relevance explanations without fabrication', () => {
      recommendations.forEach(rec => {
        expect(Array.isArray(rec.supportingPapers)).toBe(true);
        rec.supportingPapers.forEach(sp => {
          expect(sp.paperId).toBeTruthy();
          expect([paperMulti1Id, paperMulti2Id]).toContain(sp.paperId.toString());
          expect(sp.relevanceExplanation).toBeTruthy();
          expect(typeof sp.relevanceExplanation).toBe('string');
        });
      });
    });

    test('Provenance tracks generator engine, timestamp, and eligible corpus count', () => {
      recommendations.forEach(rec => {
        expect(rec.provenance).toBeDefined();
        expect(rec.provenance.generatedBy).toBeDefined();
        expect(rec.provenance.generatedAt).toBeDefined();
        expect(rec.provenance.corpusPaperCount).toBe(2);
      });
    });
  });

  // --- 4. Filtering and Search Capabilities ---
  describe('Filtering and Querying Recommendations', () => {
    test('Filters recommendations by groundingLevel parameter', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/recommendations?groundingLevel=EXPLICIT_GAP_GROUNDED`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.recommendations)).toBe(true);
      res.body.recommendations.forEach(rec => {
        expect(rec.groundingLevel).toBe('EXPLICIT_GAP_GROUNDED');
      });
    });

    test('Filters recommendations by priority parameter', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/recommendations?priority=High`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      res.body.recommendations.forEach(rec => {
        expect(rec.priority).toBe('High');
      });
    });

    test('Filters recommendations by keyword search query', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectMultiId}/recommendations?search=quantum`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      res.body.recommendations.forEach(rec => {
        const fullText = `${rec.title} ${rec.researchDirection} ${rec.researchQuestion} ${rec.targetTopic} ${rec.whyRecommended || ''}`.toLowerCase();
        expect(fullText).toContain('quantum');
      });
    });
  });

  // --- 5. Handling Incomplete Metadata (Missing Year & Authors) ---
  describe('Robustness Against Missing Metadata', () => {
    test('Gracefully generates recommendations when paper has null publicationYear and empty authors', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectMissingMetaId}/recommendations/generate`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ deterministicOnly: true });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.eligiblePaperCount).toBe(1);

      const fetchRes = await request(app)
        .get(`/api/projects/${projectMissingMetaId}/recommendations`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.recommendations.length).toBeGreaterThanOrEqual(1);

      const rec = fetchRes.body.recommendations[0];
      expect(rec.title).toBeTruthy();
      expect(rec.supportingPapers[0].paperId.toString()).toBe(paperMissingMetaId);
      expect(rec.supportingPapers[0].publicationYear).toBeNull();
    });
  });

  // --- 6. Single Paper Preliminary Disclaimers ---
  describe('Single Paper Corpus Preliminary Framing', () => {
    test('Labels recommendations with preliminary single-paper disclaimers', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectSingleId}/recommendations`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.eligiblePaperCount).toBe(1);
      expect(res.body.dataLimitations).toMatch(/single-paper/i);

      res.body.recommendations.forEach(rec => {
        expect(rec.limitations).toMatch(/single-paper/i);
      });
    });
  });

  // --- 7. Idempotency & Re-generation ---
  describe('Idempotency & Re-generation', () => {
    test('Regenerating recommendations deletes old ones and avoids duplicates', async () => {
      // First generation
      const res1 = await request(app)
        .post(`/api/projects/${projectMultiId}/recommendations/generate`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ deterministicOnly: true });

      expect(res1.status).toBe(200);
      const count1 = await Recommendation.countDocuments({ projectId: projectMultiId });

      // Second generation
      const res2 = await request(app)
        .post(`/api/projects/${projectMultiId}/recommendations/generate`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ deterministicOnly: true });

      expect(res2.status).toBe(200);
      const count2 = await Recommendation.countDocuments({ projectId: projectMultiId });

      expect(count2).toBe(count1);
    });
  });

  // --- 8. AI Provider Failure & Deterministic Fallback ---
  describe('AI Failure & Deterministic Fallback Resilience', () => {
    test('Falls back gracefully to deterministic recommendation engine when AI service throws', async () => {
      // Spy on aiService.callGemini or isConfigured to simulate AI crash
      const originalIsConfigured = aiService.isConfigured;
      const originalCallGemini = aiService.callGemini;
      const originalGetActiveProvider = aiService.getActiveProvider;

      aiService.isConfigured = () => true;
      aiService.getActiveProvider = () => 'gemini';
      aiService.callGemini = async () => {
        throw new Error('Gemini Quota Exceeded (429 Rate Limit)');
      };

      try {
        const res = await request(app)
          .post(`/api/projects/${projectMultiId}/recommendations/generate`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ forceGaps: false });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('COMPLETED');
        expect(res.body.provider).toBe('deterministic_fallback');
        expect(res.body.count).toBeGreaterThanOrEqual(1);

        // Verify generated recommendations have full Phase 11 schema
        const rec = res.body.recommendations[0];
        expect(rec.researchDirection).toBeDefined();
        expect(rec.researchQuestion).toBeDefined();
        expect(rec.methodologyDetails.studyDesign).toBeDefined();
      } finally {
        aiService.isConfigured = originalIsConfigured;
        aiService.callGemini = originalCallGemini;
        aiService.getActiveProvider = originalGetActiveProvider;
      }
    });

    test('Falls back gracefully when AI returns malformed JSON or empty recommendations array', async () => {
      const originalIsConfigured = aiService.isConfigured;
      const originalCallGemini = aiService.callGemini;
      const originalGetActiveProvider = aiService.getActiveProvider;

      aiService.isConfigured = () => true;
      aiService.getActiveProvider = () => 'gemini';
      aiService.callGemini = async () => {
        return { parsed: { recommendations: [] } }; // Malformed empty array
      };

      try {
        const res = await request(app)
          .post(`/api/projects/${projectMultiId}/recommendations/generate`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ forceGaps: false });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('COMPLETED');
        expect(res.body.provider).toBe('deterministic_fallback');
        expect(res.body.count).toBeGreaterThanOrEqual(1);
      } finally {
        aiService.isConfigured = originalIsConfigured;
        aiService.callGemini = originalCallGemini;
        aiService.getActiveProvider = originalGetActiveProvider;
      }
    });
  });

});

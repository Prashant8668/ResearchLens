import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePdfReport } from '../../client/src/utils/generatePdfReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Populated Report
const populatedReport = {
  projectId: '654321654321654321654321',
  projectName: 'Quantum Entanglement Distribution & Routing',
  domain: 'Quantum Communication Networks',
  generatedAt: new Date().toISOString(),
  totalCompletedPapers: 3,
  availablePapers: [
    { id: 'p1', title: 'Fault-Tolerant Quantum Mesh Protocols', originalFilename: 'quantum_mesh_2024.pdf' },
    { id: 'p2', title: 'Decoherence Mitigation in Optical Quantum Channels', originalFilename: 'decoherence_2023.pdf' },
    { id: 'p3', title: 'Cryogenic Photonic Repeaters Architecture', originalFilename: 'cryo_repeaters_2024.pdf' }
  ],
  selectedPaper: {
    id: 'p1',
    title: 'Fault-Tolerant Quantum Mesh Protocols',
    originalFilename: 'quantum_mesh_2024.pdf',
    authors: ['Alice Vance', 'Bob Martinez', 'Carol Chen'],
    publicationYear: 2024,
    status: 'COMPLETED'
  },
  keywords: [
    { term: 'entanglement routing', score: 9.85, rank: 1 },
    { term: 'quantum mesh', score: 8.42, rank: 2 },
    { term: 'fault tolerance', score: 7.15, rank: 3 },
    { term: 'photonic repeater', score: 6.90, rank: 4 }
  ],
  structuredSummary: {
    researchProblem: 'Reliable distribution of entangled states across lossy optical channels with probabilistic intermediate link failures.',
    objective: 'Design and simulate an adaptive multipath entanglement routing algorithm maximizing Bell pair delivery rates.',
    methodology: 'Simulated 50-node irregular mesh topologies with Poisson-distributed channel loss rates.',
    keyFindings: [
      'Multipath routing achieved 34% higher throughput compared to static shortest-path routing.',
      'Maintained sub-10ms distribution latency under 20% simulated channel loss.'
    ],
    limitations: [
      'Evaluated exclusively in software simulation environments without physical photonic switch hardware.',
      'Network size capped at 50 nodes; asymptotic scaling beyond 100 nodes remains untested.'
    ],
    model: 'gemini-2.5-flash',
    generatedAt: new Date().toISOString()
  },
  similarityScreening: {
    researchIdea: 'Adaptive photonic entanglement routing with real-time decoherence tracking',
    similarityPercentage: 72,
    similarityScore: 0.72,
    interpretation: 'Moderate',
    statusBadge: 'MODERATE OVERLAP',
    explanation: 'This score reflects textual similarity to the available project corpus.',
    matchingKeywords: ['entanglement routing', 'decoherence mitigation', 'quantum channels'],
    similarPapers: [
      {
        rank: 1,
        title: 'Fault-Tolerant Quantum Mesh Protocols',
        similarity_percentage: 76
      }
    ],
    updatedAt: new Date().toISOString()
  },
  trends: [
    {
      topic: 'entanglement routing',
      status: 'Increasing',
      growthTrend: '+100% Emerging',
      insight: 'Significant growth in network routing protocols observed between 2023 and 2024.'
    },
    {
      topic: 'decoherence mitigation',
      status: 'Stable',
      growthTrend: 'Stable (0 pp)',
      insight: 'Consistent experimental attention across multi-year observation periods.'
    }
  ],
  gaps: [
    {
      title: 'Lack of Physical Photonic Validation for Large-Scale Quantum Meshes',
      category: 'Empirical / Evaluation',
      gapType: 'Explicit Gap',
      confidenceScore: 0.88,
      whyItMatters: 'Theoretical latency guarantees often fail when exposed to real-world optical switch jitter and thermal fluctuations.',
      suggestedDirection: 'Deploy hardware-in-the-loop benchmarks using real photonic switches.',
      supportingPapers: [
        {
          title: 'Fault-Tolerant Quantum Mesh Protocols',
          publicationYear: 2024,
          sourceSection: 'Limitations',
          evidenceExcerpt: 'The protocol was evaluated exclusively in simulation environments with under 50 nodes.'
        }
      ]
    }
  ],
  recommendations: [
    {
      title: 'Physical Photonic Testbed Evaluation of Adaptive Entanglement Routing',
      priority: 'High',
      groundingLevel: 'EXPLICIT_GAP_GROUNDED',
      researchQuestion: 'How does optical switch insertion loss impact multi-hop entanglement throughput in 10+ node physical testbeds?',
      possibleMethodology: 'Empirical hardware-in-the-loop benchmarking with optical switch matrices and cryogenic detectors.',
      expectedContribution: 'The first empirical validation of dynamic entanglement routing under realistic photonic attenuation.',
      supportingPapers: [
        {
          title: 'Fault-Tolerant Quantum Mesh Protocols',
          publicationYear: 2024,
          relevanceExplanation: 'Reports simulation boundaries that this proposal empirically executes.'
        }
      ]
    }
  ],
  corpusPapers: [
    {
      title: 'Fault-Tolerant Quantum Mesh Protocols',
      authors: ['Alice Vance', 'Bob Martinez', 'Carol Chen'],
      publicationYear: 2024,
      originalFilename: 'quantum_mesh_2024.pdf',
      status: 'COMPLETED'
    },
    {
      title: 'Decoherence Mitigation in Optical Quantum Channels',
      authors: ['David Kim', 'Elena Rostova'],
      publicationYear: 2023,
      originalFilename: 'decoherence_2023.pdf',
      status: 'COMPLETED'
    },
    {
      title: 'Cryogenic Photonic Repeaters Architecture',
      authors: ['Samuel Lee', 'Priya Patel'],
      publicationYear: 2024,
      originalFilename: 'cryo_repeaters_2024.pdf',
      status: 'COMPLETED'
    }
  ]
};

// 2. Empty Report
const emptyReport = {
  projectId: '111111111111111111111111',
  projectName: 'Nascent Astrophysics Investigation',
  domain: 'Astrophysics & Dark Matter',
  generatedAt: new Date().toISOString(),
  totalCompletedPapers: 0,
  availablePapers: [],
  selectedPaper: null,
  keywords: [],
  structuredSummary: null,
  similarityScreening: null,
  trends: [],
  gaps: [],
  recommendations: [],
  corpusPapers: []
};

// Generate Populated PDF
const popRes = generatePdfReport(populatedReport);
const popBuf = Buffer.from(popRes.doc.output('arraybuffer'));
const popPath = path.resolve(__dirname, 'test_output_populated.pdf');
fs.writeFileSync(popPath, popBuf);
console.log(`Generated populated PDF: ${popPath} (${popBuf.length} bytes, ${popRes.doc.internal.getNumberOfPages()} pages)`);

// Generate Empty PDF
const emptyRes = generatePdfReport(emptyReport);
const emptyBuf = Buffer.from(emptyRes.doc.output('arraybuffer'));
const emptyPath = path.resolve(__dirname, 'test_output_empty.pdf');
fs.writeFileSync(emptyPath, emptyBuf);
console.log(`Generated empty PDF: ${emptyPath} (${emptyBuf.length} bytes, ${emptyRes.doc.internal.getNumberOfPages()} pages)`);

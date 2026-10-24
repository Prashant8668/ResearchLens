
export const mockProjects = [
  { id: '1', name: 'Quantum Network Security', domain: 'Computer Science', papers: 12, lastUpdated: '2025-09-10' },
  { id: '2', name: 'AI in Healthcare', domain: 'Medicine', papers: 45, lastUpdated: '2025-09-08' }
];

export const mockRecentFiles = [
  { id: 'f1', name: 'Quantum_Networking_Paper.pdf', size: '3.2 MB', date: '10 Sep 2025', status: 'COMPLETED' },
  { id: 'f2', name: 'AI_Research_Papers.pdf', size: '4.7 MB', date: '8 Sep 2025', status: 'COMPLETED' },
  { id: 'f3', name: 'Research_Topic_Quantum.pdf', size: '1.2 MB', date: '8 Sep 2025', status: 'PROCESSING' }
];

export const mockKeywords = [
  { term: 'Quantum', score: 0.92 },
  { term: 'Security', score: 0.87 },
  { term: 'Network', score: 0.79 },
  { term: 'Cryptography', score: 0.68 },
  { term: 'Repeater', score: 0.54 }
];

export const mockRelatedPapers = [
  { id: 'p1', title: 'AI in Quantum Key Distribution', similarity: 28 },
  { id: 'p2', title: 'Network Security for Quantum architectures', similarity: 24 },
  { id: 'p3', title: 'Quantum Repeater Architectures', similarity: 19 },
  { id: 'p4', title: 'Security in Quantum Networks', similarity: 16 },
  { id: 'p5', title: 'Machine Learning for QKD', similarity: 12 }
];

export const mockRecommendations = [
  { id: 'r1', title: 'Quantum Network Security', gap: 'High Gap', potential: 'High Potential', description: 'Limited research activity compared to related areas.' },
  { id: 'r2', title: 'AI-assisted Quantum Communication', gap: 'Medium Gap', potential: 'Medium Potential', description: 'Growing trend with opportunities for new approaches.' },
  { id: 'r3', title: 'Quantum Repeater Optimization', gap: 'High Gap', potential: 'High Potential', description: 'Less explored area with increasing interest.' },
  { id: 'r4', title: 'Hybrid Classical-Quantum Networks', gap: 'Medium Gap', potential: 'Medium Potential', description: 'Emerging field with strong future scope.' }
];

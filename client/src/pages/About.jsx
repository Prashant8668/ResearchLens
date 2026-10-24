
import React from 'react';
import { Card } from '../components/ui/Card';

export default function About() {
  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-4xl font-bold text-text-primary mb-8 tracking-tight text-center mt-8">About ResearchLens</h1>
      <Card className="p-10 shadow-lg text-text-secondary font-medium leading-relaxed">
        <p className="mb-8 text-lg text-text-primary">ResearchLens is an AI-powered research intelligence platform designed to help students, researchers, academic faculty, and mentors make sense of collections of research literature.</p>
        
        <h3 className="text-xl font-bold text-text-primary mb-4">Our Mission</h3>
        <p className="mb-10">To drastically reduce the cognitive load of manual literature review by combining NLP-based text processing, TF-IDF cosine similarity analysis, heuristic gap detection, and AI-generated structured summaries into one accessible application.</p>
        
        <div className="bg-status-warning/10 border border-status-warning/20 p-6 rounded-2xl">
          <h3 className="text-sm font-black text-status-warning mb-3 uppercase tracking-wider">Disclaimer</h3>
          <p className="text-status-warning text-sm leading-relaxed">Gap detection and similarity scores are based on heuristic signals from your uploaded corpus. They do not constitute proven academic gaps or plagiarism certifications. Researcher judgment is always required.</p>
        </div>
      </Card>
    </div>
  );
}

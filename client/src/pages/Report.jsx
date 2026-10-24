import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Download,
  FileText,
  Tag,
  Sparkles,
  AlertTriangle,
  Target,
  Cpu,
  CheckCircle2,
  AlertCircle,
  File,
  Layers,
  ArrowLeft,
  Loader,
  ExternalLink,
  Lightbulb,
  TrendingUp,
  Compass,
  BookOpen,
} from 'lucide-react';
import { generatePdfReport } from '../utils/generatePdfReport';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { fetchApi } from '../utils/api';

const cleanPaperTitle = (paper) => {
  if (!paper) return 'Untitled Document';
  const raw = (paper.title || paper.name || '').trim();
  if (raw && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(raw.toLowerCase())) {
    return raw;
  }
  return paper.originalFilename || 'Untitled Document';
};

const stripPhaseAnnotation = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(/\s*\((?:NLP\s+)?Phase\s*\d+\)/gi, '').trim();
};

export default function Report() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activePaperId = searchParams.get('paperId') || '';

  const loadReport = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const query = activePaperId ? `?paperId=${activePaperId}` : '';
      const data = await fetchApi(`/api/projects/${projectId}/report${query}`);
      setReport(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [projectId, activePaperId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Real-time event listener for paper completion/reprocessing/deletion
  useEffect(() => {
    const handlePaperCompleted = (e) => {
      const updatedProjectId = e.detail?.projectId;
      if (!updatedProjectId || updatedProjectId.toString() === projectId?.toString()) {
        loadReport();
      }
    };

    window.addEventListener('paperProcessingCompleted', handlePaperCompleted);
    return () => window.removeEventListener('paperProcessingCompleted', handlePaperCompleted);
  }, [projectId, loadReport]);

  const handleSelectPaper = (id) => {
    if (id) {
      setSearchParams({ paperId: id });
    } else {
      setSearchParams({});
    }
  };

  // Download genuine, formatted PDF file using shared utility
  const handleDownloadPdf = () => {
    if (!report) return;
    try {
      generatePdfReport(report);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      alert('Error generating PDF report: ' + (err.message || 'Unknown error'));
    }
  };

  // Secondary Markdown download handler
  const handleDownloadMarkdown = () => {
    if (!report) return;

    const paper = report.selectedPaper;
    const isCorpus = !paper;
    const projectName = report.projectName || 'Research Project';
    const title = paper ? cleanPaperTitle(paper) : `${projectName} (Corpus Overview)`;
    const keywords = report.keywords || [];
    const summary = report.structuredSummary;
    const similarity = report.similarityScreening;
    const trends = report.trends || [];
    const gaps = report.gaps || [];
    const recommendations = report.recommendations || [];
    const corpusPapers = report.corpusPapers || report.availablePapers || [];

    let content = `# ResearchLens Analysis Report\n`;
    content += `**Project:** ${projectName}${report.domain ? ` (${report.domain})` : ''}\n`;
    content += `**Generated Date:** ${new Date().toLocaleString()}\n\n`;

    content += `---\n\n`;
    content += `## 1. Project & Document Information\n`;
    if (paper) {
      content += `- **Title:** ${title}\n`;
      content += `- **Original Filename:** ${paper?.originalFilename || 'N/A'}\n`;
      content += `- **Authors:** ${Array.isArray(paper?.authors) && paper.authors.length > 0 ? paper.authors.join(', ') : 'Not detected'}\n`;
      content += `- **Publication Year:** ${paper?.publicationYear || 'Not detected'}\n`;
      content += `- **Processing Status:** ${paper?.status || 'COMPLETED'}\n\n`;
    } else {
      content += `- **Status:** Empty Project Corpus (0 documents analyzed)\n`;
      content += `- **Notice:** Upload research papers to begin automated keyword extraction, AI summarization, trend analysis, research gap discovery, and recommendations.\n\n`;
    }

    content += `---\n\n`;
    content += `## 2. Extracted Keywords\n`;
    if (keywords.length === 0) {
      content += `_No extracted keywords available for this document._\n\n`;
    } else {
      content += `| Rank | Keyword Term | TF Score |\n`;
      content += `| :--- | :--- | :--- |\n`;
      keywords.slice(0, 30).forEach((kw, idx) => {
        const rank = kw.rank || idx + 1;
        const score = kw.score ?? kw.totalScore ?? 0;
        content += `| #${rank} | ${kw.term} | ${score} |\n`;
      });
      content += `\n`;
    }

    const modelLabel = summary?.model?.toLowerCase()?.includes('gemini')
      ? 'Gemini'
      : (summary?.model?.toLowerCase()?.includes('llama') || summary?.model?.toLowerCase()?.includes('groq') || summary?.model?.toLowerCase()?.includes('gpt-oss') || summary?.model?.toLowerCase()?.includes('qwen') ? 'Groq' : (summary?.model || 'AI'));
    content += `## 3. AI-Powered Structured Summary (${modelLabel})\n`;
    if (!summary) {
      content += `_Structured summary has not been generated for this document yet._\n`;
      content += `_Use the Analysis Dashboard to generate an AI summary._\n\n`;
    } else {
      content += `### 1. Research Problem\n${summary.researchProblem || 'N/A'}\n\n`;
      content += `### 2. Objective\n${summary.objective || 'N/A'}\n\n`;
      content += `### 3. Methodology\n${summary.methodology || 'N/A'}\n\n`;
      content += `### 4. Key Findings\n`;
      if (Array.isArray(summary.keyFindings) && summary.keyFindings.length > 0) {
        summary.keyFindings.forEach((kf) => {
          content += `- ${kf}\n`;
        });
      } else {
        content += `- None reported\n`;
      }
      content += `\n`;

      content += `### 5. Limitations\n`;
      if (Array.isArray(summary.limitations) && summary.limitations.length > 0) {
        summary.limitations.forEach((lim) => {
          content += `- ${lim}\n`;
        });
      } else {
        content += `- None reported\n`;
      }
      content += `\n`;
      content += `_Generated by ${summary.model || 'Gemini'} on ${summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : new Date().toLocaleString()} (Validated against schema)_\n\n`;
    }

    if (similarity) {
      content += `---\n\n`;
      content += `## 4. Similarity Screening\n`;
      content += `- **Research Idea:** ${similarity.researchIdea || 'N/A'}\n`;
      content += `- **Similarity Score:** ${similarity.similarityPercentage}%\n`;
      content += `- **Interpretation:** ${similarity.interpretation} (${similarity.statusBadge || 'N/A'})\n`;
      content += `- **Corpus Context:** "This score reflects textual similarity to the available project corpus."\n`;
      if (similarity.matchingKeywords?.length > 0) {
        content += `- **Matching Terms:** ${similarity.matchingKeywords.join(', ')}\n`;
      }
      content += `\n`;
    }

    if (trends.length > 0) {
      content += `---\n\n`;
      content += `## 5. Longitudinal Research Trends\n`;
      trends.forEach((t) => {
        content += `- **${stripPhaseAnnotation(t.topic)}** [${t.status || 'Stable'} | Velocity: ${t.growthTrend || 'N/A'}]: ${t.insight || ''}\n`;
      });
      content += `\n`;
    }

    if (gaps.length > 0) {
      content += `---\n\n`;
      content += `## 6. Research Gap Analysis\n`;
      gaps.forEach((g, idx) => {
        content += `### ${idx + 1}. [${g.category || 'Methodological'}] ${stripPhaseAnnotation(g.title)}\n`;
        content += `- **Type:** ${g.gapType} (${Math.round((g.confidenceScore || 0.75) * 100)}% confidence)\n`;
        content += `- **Why It Matters:** ${g.whyItMatters || g.description}\n`;
        content += `- **Suggested Direction:** ${g.suggestedDirection}\n`;
        if (g.supportingPapers?.length > 0) {
          g.supportingPapers.forEach((sp) => {
            content += `  - Citing Paper: ${sp.title || sp.paperTitle} (${sp.publicationYear || 'n.d.'}) — "${sp.evidenceExcerpt || ''}"\n`;
          });
        }
        content += `\n`;
      });
    }

    if (recommendations.length > 0) {
      content += `---\n\n`;
      content += `## 7. Research Recommendations Suite\n`;
      recommendations.forEach((r, idx) => {
        content += `### ${idx + 1}. ${stripPhaseAnnotation(r.title)} (${r.groundingLevel})\n`;
        content += `- **Research Question:** ${r.researchQuestion}\n`;
        content += `- **Methodology:** ${r.possibleMethodology || r.methodologyDetails?.studyDesign || 'N/A'}\n`;
        content += `- **Expected Contribution:** ${r.expectedContribution}\n`;
        if (r.supportingPapers?.length > 0) {
          content += `- **Backing Paper:** ${r.supportingPapers[0].title || r.supportingPapers[0].paperTitle} (${r.supportingPapers[0].publicationYear || 'n.d.'})\n`;
        }
        content += `\n`;
      });
    }

    if (corpusPapers.length > 0) {
      content += `---\n\n`;
      content += `## 8. Corpus References & Citations\n`;
      corpusPapers.forEach((p, idx) => {
        const pTitle = cleanPaperTitle(p);
        const authors = Array.isArray(p.authors) && p.authors.length > 0 ? p.authors.join(', ') : 'Authors not detected';
        const year = p.publicationYear ? String(p.publicationYear) : 'n.d.';
        content += `[${idx + 1}] ${authors} (${year}). "${pTitle}". File: ${p.originalFilename || 'N/A'}\n`;
      });
      content += `\n`;
    }

    const safeFilename = isCorpus
      ? `${projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_corpus`
      : title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `researchlens_report_${safeFilename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center py-24 h-full">
        <Loader className="animate-spin text-brand-primary" size={32} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto w-full py-12">
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center justify-between">
          <span>{error || 'Failed to load report'}</span>
          <Button variant="secondary" size="sm" onClick={loadReport}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const {
    availablePapers = [],
    selectedPaper,
    keywords = [],
    structuredSummary,
    similarityScreening,
  } = report;
  const currentPaperTitle = cleanPaperTitle(selectedPaper);

  return (
    <div className="max-w-5xl mx-auto w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/projects/${projectId}/analysis`}
              className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={13} /> Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Consolidated Paper Report</h1>
          <p className="text-base text-text-muted font-medium">
            Project: <span className="font-bold text-text-primary">{report.projectName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            className="flex items-center gap-2 w-max shadow-sm"
            onClick={handleDownloadPdf}
            disabled={loading || !report}
          >
            <Download size={17} /> Download Report (PDF)
          </Button>
          <Button
            variant="secondary"
            className="flex items-center gap-1.5 w-max text-xs"
            onClick={handleDownloadMarkdown}
            disabled={loading || !report}
            title="Export raw Markdown report"
          >
            <FileText size={14} /> .md
          </Button>
        </div>
      </div>

      {/* Document Selector Pills */}
      {availablePapers.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-1 flex items-center gap-1.5 shrink-0">
            <File size={13} /> Document:
          </span>
          {availablePapers.map((p) => {
            const isSelected = selectedPaper?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPaper(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 max-w-[240px] truncate ${
                  isSelected
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-dark-elevated text-text-muted hover:text-text-primary hover:bg-dark-border border border-dark-border'
                }`}
                title={p.title}
              >
                <File size={13} className="shrink-0" />
                <span className="truncate">{p.title}</span>
                {p.hasSummary && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-0.5" />}
              </button>
            );
          })}
        </div>
      )}

      {!selectedPaper ? (
        <Card className="p-12 text-center border-dark-border">
          <FileText size={40} className="mx-auto text-text-muted opacity-30 mb-3" />
          <h3 className="text-lg font-bold text-text-primary mb-1">No Analyzed Documents Available</h3>
          <p className="text-xs text-text-muted mb-6">
            Upload and process research papers to view consolidated reports.
          </p>
          <Link to={`/projects/${projectId}/upload`}>
            <Button variant="primary" size="sm">
              Upload Papers
            </Button>
          </Link>
        </Card>
      ) : (
        /* Consolidated Report Card */
        <Card className="p-8 md:p-10 shadow-md border-dark-border bg-dark-card space-y-8">
          {/* Document Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-dark-border">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20 shrink-0 mt-1">
                <FileText size={26} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-1">
                  {currentPaperTitle}
                </h2>
                <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                  <span>File: <strong className="text-text-secondary">{selectedPaper.originalFilename}</strong></span>
                  {selectedPaper.publicationYear && (
                    <span>Year: <strong className="text-text-secondary">{selectedPaper.publicationYear}</strong></span>
                  )}
                  {Array.isArray(selectedPaper.authors) && selectedPaper.authors.length > 0 && (
                    <span>Authors: <strong className="text-text-secondary">{selectedPaper.authors.join(', ')}</strong></span>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {selectedPaper.status}
              </span>
            </div>
          </div>

          {/* Section 1: NLP Extracted Keywords (Phase 6) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-brand-primary" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  Extracted Keywords ({keywords.length} total)
                </h3>
              </div>
              {keywords.length > 30 && (
                <span className="text-xs text-text-muted">
                  Showing top 30 of {keywords.length}
                </span>
              )}
            </div>

            {keywords.length === 0 ? (
              <p className="text-xs text-text-muted italic bg-dark-elevated p-4 rounded-xl border border-dark-border">
                No keywords extracted for this paper yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {keywords.slice(0, 30).map((kw, idx) => (
                  <span
                    key={kw.term}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-elevated border border-dark-border text-text-primary shadow-sm"
                  >
                    <span className="text-[11px] text-text-muted">#{kw.rank || idx + 1}</span>
                    <span className="font-semibold">{kw.term}</span>
                    <span className="text-[10px] font-mono text-emerald-400 ml-1">
                      {kw.score ?? kw.totalScore}
                    </span>
                  </span>
                ))}
                {keywords.length > 30 && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-elevated text-brand-primary border border-brand-primary/20">
                    +{keywords.length - 30} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 2: AI-Powered Structured Summary (Phase 7) */}
          <div className="pt-6 border-t border-dark-border">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-brand-bright" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  AI-Powered Structured Summary
                </h3>
              </div>
              <Link
                to={`/projects/${projectId}/analysis?paperId=${selectedPaper.id}`}
                className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-medium"
              >
                Open in Dashboard <ExternalLink size={12} />
              </Link>
            </div>

            {!structuredSummary ? (
              <div className="p-8 rounded-xl bg-dark-elevated border border-dark-border text-center space-y-3">
                <AlertCircle size={28} className="mx-auto text-amber-400 opacity-80" />
                <h4 className="text-base font-bold text-text-primary">
                  Structured Summary Not Generated Yet
                </h4>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  This document has not been summarized yet. Visit the Analysis Dashboard to generate and save the structured summary.
                </p>
                <Link to={`/projects/${projectId}/analysis?paperId=${selectedPaper.id}`}>
                  <Button variant="primary" size="sm" className="mt-2 flex items-center gap-1.5 mx-auto">
                    <Sparkles size={14} /> Go to Dashboard to Generate Summary
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Research Problem & 2. Objective Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                    <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                      <AlertTriangle size={14} /> 1. Research Problem
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed flex-1">
                      {structuredSummary.researchProblem}
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                    <div className="flex items-center gap-2 mb-2 text-brand-primary text-xs font-bold uppercase tracking-wider">
                      <Target size={14} /> 2. Objective
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed flex-1">
                      {structuredSummary.objective}
                    </p>
                  </div>
                </div>

                {/* 3. Methodology */}
                <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border">
                  <div className="flex items-center gap-2 mb-2 text-violet-400 text-xs font-bold uppercase tracking-wider">
                    <Cpu size={14} /> 3. Methodology
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {structuredSummary.methodology}
                  </p>
                </div>

                {/* 4. Key Findings & 5. Limitations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                    <div className="flex items-center gap-2 mb-2.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 size={14} /> 4. Key Findings
                    </div>
                    <ul className="space-y-2 flex-1">
                      {(structuredSummary.keyFindings || []).map((finding, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                    <div className="flex items-center gap-2 mb-2.5 text-rose-400 text-xs font-bold uppercase tracking-wider">
                      <AlertCircle size={14} /> 5. Limitations
                    </div>
                    <ul className="space-y-2 flex-1">
                      {(structuredSummary.limitations || []).map((limitation, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer validation notice */}
                <div className="pt-4 border-t border-dark-border text-[11px] text-text-muted flex items-center justify-between">
                  <span>
                    Model: {structuredSummary.model || 'Gemini'}
                    {structuredSummary.generatedAt && (
                      <> · Generated {new Date(structuredSummary.generatedAt).toLocaleString()}</>
                    )}
                  </span>
                  <span className="text-emerald-400 font-medium">✓ Validated against schema</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Phase 8 Similarity Screening */}
          {similarityScreening && (
            <div className="pt-6 border-t border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Lightbulb size={18} className="text-brand-primary" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Similarity Screening
                  </h3>
                </div>
                <Link
                  to={`/projects/${projectId}/novelty`}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-medium"
                >
                  View Full Screening <ExternalLink size={12} />
                </Link>
              </div>

              <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-text-muted block mb-0.5">Screened Research Idea</span>
                    <p className="text-sm font-semibold text-text-primary">{similarityScreening.researchIdea}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-2xl font-black text-brand-primary">
                      {similarityScreening.similarityPercentage}%
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                      {similarityScreening.statusBadge || `${similarityScreening.interpretation} OVERLAP`}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-text-secondary italic bg-dark-bg p-3 rounded-lg border border-dark-border">
                  &ldquo;{similarityScreening.explanation || 'This score reflects textual similarity to the available project corpus.'}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Section 4: Phase 9 Research Trends */}
          {Array.isArray(report.trends) && report.trends.length > 0 && (
            <div className="pt-6 border-t border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Longitudinal Research Trends
                  </h3>
                </div>
                <Link
                  to={`/projects/${projectId}/trends`}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-medium"
                >
                  View Trends Dashboard <ExternalLink size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.trends.slice(0, 6).map((trend, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-dark-elevated border border-dark-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-text-primary">{stripPhaseAnnotation(trend.topic)}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                        {trend.status || 'Stable'} · {trend.growthTrend || 'N/A'}
                      </span>
                    </div>
                    {trend.insight && (
                      <p className="text-xs text-text-muted leading-relaxed">{trend.insight}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Phase 10 Research Gaps */}
          {Array.isArray(report.gaps) && report.gaps.length > 0 && (
            <div className="pt-6 border-t border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Compass size={18} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Research Gap Analysis
                  </h3>
                </div>
                <Link
                  to={`/projects/${projectId}/gaps`}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-medium"
                >
                  View Gap Analysis <ExternalLink size={12} />
                </Link>
              </div>

              <div className="space-y-4">
                {report.gaps.slice(0, 4).map((gap, idx) => (
                  <div key={gap.id || idx} className="p-4 rounded-xl bg-dark-elevated border border-dark-border space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {gap.category || 'Methodological'}
                        </span>
                        <h4 className="text-sm font-bold text-text-primary">{stripPhaseAnnotation(gap.title)}</h4>
                      </div>
                      <span className="text-xs text-text-muted">
                        Confidence: <strong className="text-text-primary">{Math.round((gap.confidenceScore || 0.75) * 100)}%</strong>
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {gap.description || gap.whyItMatters}
                    </p>
                    {gap.suggestedDirection && (
                      <p className="text-xs text-brand-primary italic">
                        Suggested Direction: {gap.suggestedDirection}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Phase 11 Research Recommendations */}
          {Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
            <div className="pt-6 border-t border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Lightbulb size={18} className="text-violet-400" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Research Recommendations Suite
                  </h3>
                </div>
                <Link
                  to={`/projects/${projectId}/recommendations`}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-medium"
                >
                  View Recommendations <ExternalLink size={12} />
                </Link>
              </div>

              <div className="space-y-4">
                {report.recommendations.slice(0, 4).map((rec, idx) => (
                  <div key={rec.id || idx} className="p-4 rounded-xl bg-dark-elevated border border-dark-border space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-text-primary">{stripPhaseAnnotation(rec.title)}</h4>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {rec.groundingLevel || 'CORPUS_INFERRED'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-text-secondary">
                      Question: <span className="font-normal text-text-primary">{rec.researchQuestion}</span>
                    </p>
                    {rec.possibleMethodology && (
                      <p className="text-xs text-text-muted">
                        Methodology: {rec.possibleMethodology}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 7: Corpus Citations */}
          {Array.isArray(report.corpusPapers) && report.corpusPapers.length > 0 && (
            <div className="pt-6 border-t border-dark-border">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-text-muted" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  Corpus References & Citations ({report.corpusPapers.length} papers)
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-text-muted">
                {report.corpusPapers.map((cp, idx) => (
                  <li key={cp.id || idx} className="flex items-start gap-2">
                    <span className="font-mono text-text-secondary">[{idx + 1}]</span>
                    <span>
                      <strong className="text-text-primary">
                        {Array.isArray(cp.authors) && cp.authors.length > 0 ? cp.authors.join(', ') : 'Authors not detected'}
                      </strong>{' '}
                      ({cp.publicationYear || 'n.d.'}). &ldquo;{cleanPaperTitle(cp)}&rdquo;. Source: {cp.originalFilename || 'N/A'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

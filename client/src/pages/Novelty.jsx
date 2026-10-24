import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Lightbulb,
  Search,
  FileText,
  Tag,
  AlertCircle,
  CheckCircle2,
  Layers,
  Loader,
  ArrowRight,
  Info,
  Sparkles,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchApi } from '../utils/api';

export default function Novelty() {
  const { projectId } = useParams();
  const [researchIdea, setResearchIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [totalCorpusPapers, setTotalCorpusPapers] = useState(0);

  // Load existing results and corpus paper count on mount
  const loadExistingScreening = useCallback(async () => {
    if (!projectId) return;
    try {
      setInitialLoading(true);
      setError(null);
      const data = await fetchApi(`/api/projects/${projectId}/novelty`);
      setTotalCorpusPapers(data.totalCorpusPapers || 0);
      if (data.result) {
        setResult(data.result);
        if (data.result.researchIdea) {
          setResearchIdea(data.result.researchIdea);
        }
      }
    } catch (err) {
      // Don't hard-fail if simply no prior screening exists
      console.warn('Could not load previous similarity screening:', err.message);
    } finally {
      setInitialLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadExistingScreening();
  }, [loadExistingScreening]);

  const handleScreenSimilarity = async (e) => {
    if (e) e.preventDefault();
    if (!researchIdea.trim()) {
      setError('Please enter a research idea before screening.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetchApi(`/api/projects/${projectId}/novelty`, {
        method: 'POST',
        body: JSON.stringify({ researchIdea: researchIdea.trim() }),
      });

      if (response.hasError && response.errorMessage) {
        setError(response.errorMessage);
      } else {
        setResult(response);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('similarityScreeningUpdated', {
              detail: { projectId, result: response },
            })
          );
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to screen research idea similarity');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 60) return 'text-red-400 border-red-500/30 bg-red-500/10';
    if (percentage >= 30) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  const getInterpretationBadge = (interpretation) => {
    const inter = (interpretation || 'Low').toLowerCase();
    if (inter === 'high') {
      return <Badge variant="error">HIGH OVERLAP</Badge>;
    }
    if (inter === 'moderate') {
      return <Badge variant="warning">MODERATE OVERLAP</Badge>;
    }
    return <Badge variant="success">LOW OVERLAP</Badge>;
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Similarity Screening</h1>
          <p className="text-base text-text-muted font-medium">
            Screen a research idea against the uploaded project corpus to assess textual similarity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-dark-card border border-dark-border text-xs text-text-secondary font-medium">
            <Layers size={14} className="text-brand-primary" />
            <span>Corpus Papers: <strong className="text-text-primary">{totalCorpusPapers}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Research Idea Input */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="p-6 md:p-8 flex flex-col shadow-md border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="research-idea-input" className="font-bold text-text-primary text-lg flex items-center gap-2">
                <Lightbulb size={20} className="text-brand-primary" />
                Research Idea / Hypothesis
              </label>
              <span className="text-xs text-text-muted">TF-IDF Vector</span>
            </div>

            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Enter your research topic, abstract, or methodology. It will be converted into a TF-IDF vector and compared against all papers in this project corpus.
            </p>

            <form onSubmit={handleScreenSimilarity} className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  id="research-idea-input"
                  rows={6}
                  value={researchIdea}
                  onChange={(e) => setResearchIdea(e.target.value)}
                  placeholder="e.g., Deep learning architectures for early fault detection in industrial wind turbines using multi-sensor vibration and acoustic signals..."
                  className="w-full rounded-xl bg-dark-bg border border-dark-border p-4 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-y min-h-[140px] leading-relaxed transition-all"
                  disabled={loading}
                />
                <div className="flex justify-between items-center text-[11px] text-text-muted mt-2 px-1">
                  <span>{researchIdea.trim().split(/\s+/).filter(Boolean).length} words</span>
                  <span>{researchIdea.length} characters</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {totalCorpusPapers === 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <span className="flex-1">
                    No analyzed papers with extracted text are available in this project yet.{' '}
                    <Link to={`/projects/${projectId}/upload`} className="underline font-bold hover:text-amber-300">
                      Upload papers here
                    </Link>{' '}
                    to enable comparison.
                  </span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={loading || !researchIdea.trim()}
                className="w-full flex items-center justify-center gap-2 mt-2 shadow-sm py-3 text-sm font-bold"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Computing Similarity Vectors...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Screen Similarity
                  </>
                )}
              </Button>
            </form>

            {/* Explanatory Note */}
            <div className="mt-6 pt-6 border-t border-dark-border text-xs text-text-muted leading-relaxed flex items-start gap-2">
              <Info size={14} className="shrink-0 mt-0.5 text-text-muted" />
              <span>
                <strong>Methodology:</strong> Uses scikit-learn TF-IDF vectorization and cosine similarity. Results reflect textual similarity strictly within this project's available corpus.
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: Screening Results */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {initialLoading ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center border-dark-border min-h-[360px]">
              <Loader size={32} className="animate-spin text-brand-primary mb-4" />
              <p className="text-text-muted text-sm font-medium">Loading similarity screening data...</p>
            </Card>
          ) : result ? (
            <div className="flex flex-col gap-6">
              {/* Score & Interpretation Card */}
              <Card className="p-6 md:p-8 shadow-md border-dark-border">
                <div className="flex flex-col sm:flex-row items-center gap-8 p-6 md:p-8 bg-dark-elevated rounded-2xl border border-dark-border">
                  {/* Gauge */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center relative shadow-sm ${getScoreColor(result.overallSimilarityPercentage ?? (result.overallSimilarityScore ? result.overallSimilarityScore * 100 : 0))}`}>
                      <span className="text-3xl font-black text-text-primary tracking-tight">
                        {typeof result.overallSimilarityPercentage === 'number'
                          ? `${result.overallSimilarityPercentage}%`
                          : typeof result.overallSimilarityScore === 'number'
                            ? `${(result.overallSimilarityScore * 100).toFixed(1)}%`
                            : '0%'}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-text-muted mt-0.5 tracking-wider">Similarity</span>
                    </div>
                  </div>

                  {/* Interpretation Info */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 text-text-muted text-xs font-black uppercase tracking-wider">
                        <Lightbulb size={16} className="text-brand-primary" /> Interpretation
                      </div>
                      {getInterpretationBadge(result.interpretation)}
                    </div>

                    <p className="text-text-secondary text-sm md:text-base font-medium mb-3 leading-relaxed">
                      {result.interpretationText || 'Analysis complete for candidate research idea.'}
                    </p>

                    {/* Mandatory exact phrase */}
                    <p className="text-xs font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-3 py-2 rounded-lg">
                      &ldquo;This score reflects textual similarity to the available project corpus.&rdquo;
                    </p>
                  </div>
                </div>

                {/* Matching Keywords */}
                <div className="mt-6 pt-6 border-t border-dark-border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Tag size={14} className="text-brand-primary" /> Matching Corpus Terms
                    </h4>
                    <span className="text-xs text-text-muted">
                      {result.matchingKeywords?.length || 0} overlap terms
                    </span>
                  </div>

                  {Array.isArray(result.matchingKeywords) && result.matchingKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.matchingKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-dark-bg text-text-secondary border border-dark-border hover:border-brand-primary/50 transition-colors"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">No distinctive overlapping vocabulary terms detected.</p>
                  )}
                </div>
              </Card>

              {/* Ranked Similar Papers Card */}
              <Card className="p-6 md:p-8 shadow-md border-dark-border">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
                    <FileText size={20} className="text-brand-primary" />
                    Ranked Similar Papers
                  </h3>
                  <span className="text-xs text-text-muted font-medium">
                    {result.similarPapers?.length || 0} compared
                  </span>
                </div>

                {!result.similarPapers || result.similarPapers.length === 0 ? (
                  <div className="text-center py-10 text-text-muted border border-dashed border-dark-border rounded-xl">
                    <FileCheck size={36} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-text-secondary">No matching papers found</p>
                    <p className="text-xs text-text-muted mt-1">
                      No textual overlap was detected between the idea and papers in this project corpus.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-xs font-black text-text-muted uppercase tracking-wider border-b-2 border-dark-border">
                          <th className="pb-3 w-10">#</th>
                          <th className="pb-3">Paper Title</th>
                          <th className="pb-3 hidden sm:table-cell">Overlap Terms</th>
                          <th className="pb-3 text-right">Similarity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.similarPapers.map((p, i) => {
                          const rank = p.rank || i + 1;
                          const pct = typeof p.similarity_percentage === 'number'
                            ? p.similarity_percentage
                            : typeof p.similarity_score === 'number'
                              ? Number((p.similarity_score * 100).toFixed(1))
                              : 0;

                          return (
                            <tr
                              key={p.paper_id || i}
                              className="border-b border-dark-border last:border-0 hover:bg-dark-elevated transition-colors"
                            >
                              <td className="py-4 text-text-muted font-bold">{rank}</td>
                              <td className="py-4 pr-4">
                                <div className="font-bold text-text-primary line-clamp-1">
                                  {p.title || p.original_filename || 'Untitled Document'}
                                </div>
                                {p.original_filename && (
                                  <div className="text-[11px] text-text-muted truncate max-w-xs mt-0.5">
                                    {p.original_filename}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 pr-4 hidden sm:table-cell">
                                {Array.isArray(p.matching_keywords) && p.matching_keywords.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {p.matching_keywords.slice(0, 3).map((kw, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] px-1.5 py-0.5 bg-dark-bg text-text-muted rounded border border-dark-border"
                                      >
                                        {kw}
                                      </span>
                                    ))}
                                    {p.matching_keywords.length > 3 && (
                                      <span className="text-[10px] text-text-muted self-center">
                                        +{p.matching_keywords.length - 3}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-text-muted italic">None</span>
                                )}
                              </td>
                              <td className="py-4 font-black text-right">
                                <span
                                  className={`text-sm px-2.5 py-1 rounded-lg ${
                                    pct >= 60
                                      ? 'text-red-400 bg-red-500/10'
                                      : pct >= 30
                                        ? 'text-amber-400 bg-amber-500/10'
                                        : 'text-emerald-400 bg-emerald-500/10'
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            /* Empty / Idle State */
            <Card className="p-12 flex flex-col items-center justify-center text-center border-dark-border min-h-[360px]">
              <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary mb-4 shadow-sm">
                <Lightbulb size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">Ready for Similarity Screening</h3>
              <p className="text-sm text-text-muted max-w-md leading-relaxed mb-6">
                Type your candidate research idea or hypothesis in the input on the left and click <strong>Screen Similarity</strong> to compare against the project papers.
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-text-muted bg-dark-elevated px-4 py-2 rounded-xl border border-dark-border">
                <Sparkles size={14} className="text-brand-primary" />
                <span>Textual TF-IDF + Cosine Similarity Analysis</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

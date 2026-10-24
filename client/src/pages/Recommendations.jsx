import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Compass,
  Lightbulb,
  Target,
  BookOpen,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Clock,
  Cpu,
  BarChart2,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchApi, API_BASE_URL } from '../utils/api';

export default function Recommendations() {
  const { projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrounding, setSelectedGrounding] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [expandedRecIds, setExpandedRecIds] = useState(new Set());
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const loadRecommendations = useCallback(
    async (isSilent = false) => {
      if (!projectId) return;
      try {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        setError(null);

        const res = await fetchApi(`/api/projects/${projectId}/recommendations`);
        setData(res);
      } catch (err) {
        console.error('Failed to load recommendations:', err);
        setError(err.message || 'Failed to load research recommendations');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Listen for paper processing and gap updates
  useEffect(() => {
    const handleUpdate = (e) => {
      if (!e?.detail?.projectId || e.detail.projectId === projectId) {
        loadRecommendations(true);
      }
    };
    window.addEventListener('paperProcessingCompleted', handleUpdate);
    window.addEventListener('gapAnalysisCompleted', handleUpdate);
    return () => {
      window.removeEventListener('paperProcessingCompleted', handleUpdate);
      window.removeEventListener('gapAnalysisCompleted', handleUpdate);
    };
  }, [projectId, loadRecommendations]);

  // Trigger fresh generation
  const handleGenerateRecommendations = async () => {
    if (!projectId || generating) return;
    try {
      setGenerating(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/recommendations/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate research recommendations');
      }

      setActionSuccessMsg('Research recommendations successfully updated from latest project corpus.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadRecommendations(true);
    } catch (err) {
      alert(err.message || 'Error generating recommendations');
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpand = (recId) => {
    setExpandedRecIds((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-24">
        <RefreshCw className="animate-spin text-brand-primary mb-3" size={32} />
        <p className="text-sm font-medium text-text-muted">
          Synthesizing evidence-grounded research recommendations…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-6xl mx-auto w-full pb-12">
        <div className="p-5 bg-status-danger/10 border border-status-danger/20 rounded-xl text-status-danger flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadRecommendations()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isInsufficient = data?.status === 'INSUFFICIENT_DATA' || (data?.eligiblePaperCount === 0);
  const recommendationsList = data?.recommendations || [];
  const groundingCounts = data?.groundingCounts || {
    explicitGrounded: recommendationsList.filter(r => r.groundingLevel === 'EXPLICIT_GAP_GROUNDED').length,
    corpusInferred: recommendationsList.filter(r => r.groundingLevel === 'CORPUS_INFERRED').length,
    aiHypothesis: recommendationsList.filter(r => r.groundingLevel === 'AI_HYPOTHESIS').length,
  };

  // Filter recommendations
  const filteredRecs = recommendationsList.filter((rec) => {
    if (selectedGrounding !== 'All' && rec.groundingLevel !== selectedGrounding) return false;
    if (selectedPriority !== 'All' && rec.priority !== selectedPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (rec.title || '').toLowerCase().includes(q);
      const matchDir = (rec.researchDirection || '').toLowerCase().includes(q);
      const matchQ = (rec.researchQuestion || '').toLowerCase().includes(q);
      const matchTopic = (rec.targetTopic || '').toLowerCase().includes(q);
      const matchWhy = (rec.whyRecommended || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDir && !matchQ && !matchTopic && !matchWhy) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto w-full pb-16 space-y-8">
      {/* Toast message */}
      {actionSuccessMsg && (
        <div className="p-4 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              Research Recommendations
            </h1>
          </div>
          <p className="text-base text-text-muted">
            Evidence-grounded future directions, research questions, and methodology suggestions for{' '}
            <strong className="text-text-primary">{data?.projectName || 'Research Project'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => loadRecommendations(true)}
            disabled={refreshing || generating}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-brand-primary' : ''} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleGenerateRecommendations}
            disabled={generating || isInsufficient}
          >
            <Sparkles size={15} className={generating ? 'animate-spin' : ''} />
            <span>{generating ? 'Regenerating…' : 'Regenerate Directions'}</span>
          </Button>

          <Link to={`/projects/${projectId}/gaps`}>
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs">
              <AlertTriangle size={14} /> Gaps View
            </Button>
          </Link>
        </div>
      </div>

      {/* Insufficient Papers State */}
      {isInsufficient ? (
        <Card className="p-10 text-center border-dark-border flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
            <Compass size={28} />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Insufficient Research Corpus</h2>
          <p className="text-sm text-text-muted max-w-md mb-6 leading-relaxed">
            {data?.dataLimitations ||
              'At least 1 successfully processed research paper is required to formulate grounded future directions and research questions.'}
          </p>
          <Link to={`/projects/${projectId}/upload`}>
            <Button variant="primary" className="flex items-center gap-2">
              <BookOpen size={16} /> Upload Research Papers
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-dark-border bg-dark-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                <Compass size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Directions</p>
                <p className="text-2xl font-bold text-text-primary leading-tight">{data?.totalProjectRecommendations ?? recommendationsList.length}</p>
                <p className="text-[11px] text-text-muted truncate">Active recommendations</p>
              </div>
            </Card>

            <Card className="p-5 border-dark-border bg-dark-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Author Evidence Grounded</p>
                <p className="text-2xl font-bold text-emerald-400 leading-tight">{groundingCounts.explicitGrounded}</p>
                <p className="text-[11px] text-text-muted truncate">Explicit gap limitations</p>
              </div>
            </Card>

            <Card className="p-5 border-dark-border bg-dark-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Layers size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Corpus Inferred</p>
                <p className="text-2xl font-bold text-indigo-400 leading-tight">{groundingCounts.corpusInferred}</p>
                <p className="text-[11px] text-text-muted truncate">Cross-paper opportunities</p>
              </div>
            </Card>

            <Card className="p-5 border-dark-border bg-dark-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Lightbulb size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">AI Hypotheses</p>
                <p className="text-2xl font-bold text-amber-400 leading-tight">{groundingCounts.aiHypothesis}</p>
                <p className="text-[11px] text-text-muted truncate">Requires validation</p>
              </div>
            </Card>
          </div>

          {/* Epistemic Notice & Grounding Banner */}
          <div className="p-4 bg-dark-card rounded-xl border border-dark-border text-xs text-text-secondary flex items-start gap-3">
            <Info size={18} className="text-brand-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">
                Grounding & Epistemic Traceability Standard
              </p>
              <p className="text-text-muted leading-relaxed">
                All recommendations are synthesized strictly from the papers uploaded to your project corpus.
                Recommendations are categorized as <span className="text-emerald-400 font-semibold">Explicit Gap Grounded</span> (directly backed by author limitations in source papers),{' '}
                <span className="text-indigo-400 font-semibold">Corpus Inferred</span> (cross-document syntheses), or{' '}
                <span className="text-amber-400 font-semibold">AI Hypotheses</span> (exploratory proposals requiring experimental validation).
                Methodologies are concrete starting frameworks, not guaranteed optimal solutions.
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-dark-card p-4 rounded-xl border border-dark-border">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search directions, questions, topics, or methodology…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-elevated rounded-lg text-sm text-text-primary placeholder:text-text-muted border border-dark-border focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Grounding Level Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted font-semibold uppercase tracking-wider text-[10px]">Grounding:</span>
                <select
                  value={selectedGrounding}
                  onChange={(e) => setSelectedGrounding(e.target.value)}
                  className="bg-dark-elevated text-text-primary text-xs rounded-lg px-2.5 py-1.5 border border-dark-border focus:outline-none focus:border-brand-primary"
                >
                  <option value="All">All Levels ({recommendationsList.length})</option>
                  <option value="EXPLICIT_GAP_GROUNDED">Explicit Gap Grounded ({groundingCounts.explicitGrounded})</option>
                  <option value="CORPUS_INFERRED">Corpus Inferred ({groundingCounts.corpusInferred})</option>
                  <option value="AI_HYPOTHESIS">AI Hypothesis ({groundingCounts.aiHypothesis})</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted font-semibold uppercase tracking-wider text-[10px]">Priority:</span>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-dark-elevated text-text-primary text-xs rounded-lg px-2.5 py-1.5 border border-dark-border focus:outline-none focus:border-brand-primary"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              {(searchQuery || selectedGrounding !== 'All' || selectedPriority !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGrounding('All');
                    setSelectedPriority('All');
                  }}
                  className="text-xs text-brand-primary hover:underline font-semibold"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Recommendations Cards Grid */}
          <div className="space-y-6">
            {filteredRecs.length > 0 ? (
              filteredRecs.map((rec, index) => {
                const isExpanded = expandedRecIds.has(rec._id || index);
                const grounding = rec.groundingLevel || 'CORPUS_INFERRED';
                const mDetails = rec.methodologyDetails || {};

                return (
                  <Card
                    key={rec._id || index}
                    className="p-6 md:p-8 shadow-md border-dark-border bg-dark-card space-y-6 transition-all hover:border-dark-border/80"
                  >
                    {/* Top Row: Direction Title & Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {/* Grounding Level Badge */}
                          {grounding === 'EXPLICIT_GAP_GROUNDED' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Author Evidence Grounded
                            </span>
                          )}
                          {grounding === 'CORPUS_INFERRED' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                              <Layers size={11} /> Corpus Inferred Opportunity
                            </span>
                          )}
                          {grounding === 'AI_HYPOTHESIS' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Lightbulb size={11} /> AI Hypothesis (Requires Validation)
                            </span>
                          )}

                          {/* Priority Badge */}
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              rec.priority === 'High'
                                ? 'bg-status-success/10 text-status-success border-status-success/20'
                                : rec.priority === 'Medium'
                                ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                                : 'bg-dark-elevated text-text-muted border-dark-border'
                            }`}
                          >
                            {rec.priority || 'Medium'} Priority
                          </span>

                          {rec.targetTopic && (
                            <span className="text-[11px] font-semibold text-text-muted bg-dark-elevated px-2 py-0.5 rounded-md border border-dark-border">
                              Topic: {rec.targetTopic}
                            </span>
                          )}
                        </div>

                        <h2 className="text-xl font-bold text-text-primary tracking-tight leading-snug">
                          {rec.title}
                        </h2>
                        {rec.researchDirection && rec.researchDirection !== rec.title && (
                          <p className="text-xs font-semibold text-text-secondary">
                            Direction: <span className="text-text-primary">{rec.researchDirection}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => toggleExpand(rec._id || index)}
                        className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-dark-elevated hover:bg-dark-border text-text-muted hover:text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 border border-dark-border"
                      >
                        <span>{isExpanded ? 'Less Details' : 'Full Methodology & Papers'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {/* Research Question Callout Banner */}
                    <div className="p-4 bg-dark-bg/90 rounded-xl border border-dark-border space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1.5">
                        <Target size={13} className="text-brand-primary" />
                        <span>Core Research Question</span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary leading-relaxed">
                        "{rec.researchQuestion}"
                      </p>
                    </div>

                    {/* Why Recommended & Scientific Motivation */}
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                        Why This Direction Matters:
                      </p>
                      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                        {rec.whyRecommended}
                      </p>
                    </div>

                    {/* Methodology Summary */}
                    {rec.possibleMethodology && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                          Suggested Research Methodology:
                        </p>
                        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                          {rec.possibleMethodology}
                        </p>
                      </div>
                    )}

                    {/* Collapsible Deep-Dive: Study Design, Data Specs, Evaluation Metrics, Papers */}
                    {isExpanded && (
                      <div className="pt-4 border-t border-dark-border space-y-6 animate-fadeIn">
                        {/* Methodology Deep Dive Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Study Design */}
                          <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wider">
                              <Cpu size={14} className="text-brand-primary" />
                              <span>Study Design</span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">
                              {mDetails.studyDesign || rec.possibleMethodology}
                            </p>
                          </div>

                          {/* Data Requirements */}
                          <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wider">
                              <Database size={14} className="text-emerald-400" />
                              <span>Potential Data Requirements</span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">
                              {mDetails.dataRequirements || 'Standard domain benchmark datasets with partitioned validation sets.'}
                            </p>
                          </div>

                          {/* Evaluation Metrics */}
                          <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wider">
                              <BarChart2 size={14} className="text-indigo-400" />
                              <span>Evaluation Metrics</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {Array.isArray(mDetails.evaluationMetrics) && mDetails.evaluationMetrics.length > 0 ? (
                                mDetails.evaluationMetrics.map((met, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="px-2 py-0.5 rounded-md bg-dark-elevated text-text-primary text-[11px] font-mono border border-dark-border"
                                  >
                                    {met}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-text-muted">Standard quantitative accuracy & efficiency metrics</span>
                              )}
                            </div>
                          </div>

                          {/* Methodological Reasoning & Limitations */}
                          <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wider">
                              <AlertTriangle size={14} className="text-amber-400" />
                              <span>Reasoning & Threat to Validity</span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">
                              {mDetails.reasoning || rec.whyRecommended}
                            </p>
                            {mDetails.limitations && (
                              <p className="text-[11px] text-amber-300/80 italic pt-1 border-t border-dark-border/60">
                                Constraint: {mDetails.limitations}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Evidence Excerpts (Direct Author Grounding) */}
                        {Array.isArray(rec.evidenceExcerpts) && rec.evidenceExcerpts.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                              <FileText size={13} className="text-emerald-400" />
                              <span>Author Evidence Excerpts (From Uploaded Papers)</span>
                            </p>
                            <div className="space-y-2">
                              {rec.evidenceExcerpts.map((ev, evIdx) => (
                                <div
                                  key={evIdx}
                                  className="p-3 bg-dark-bg rounded-xl border border-dark-border text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                                    <span className="font-bold text-text-primary">{ev.paperTitle}</span>
                                    <span className="px-1.5 py-0.2 bg-dark-elevated rounded border border-dark-border text-[10px]">
                                      {ev.sourceSection || 'Limitations'}
                                    </span>
                                  </div>
                                  <div className="pl-3 border-l-2 border-emerald-500/60 text-text-muted italic leading-relaxed">
                                    "{ev.excerpt}"
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Supporting Related Papers from Corpus */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen size={13} className="text-brand-primary" />
                            <span>Related Papers from Project Corpus</span>
                          </p>
                          {Array.isArray(rec.supportingPapers) && rec.supportingPapers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {rec.supportingPapers.map((sp, spIdx) => (
                                <div
                                  key={sp.paperId || spIdx}
                                  className="p-3.5 bg-dark-bg rounded-xl border border-dark-border flex flex-col justify-between text-xs space-y-2"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-bold text-text-primary truncate">
                                        {sp.title || sp.paperTitle || sp.originalFilename || 'Corpus Paper'}
                                      </span>
                                      {sp.publicationYear && (
                                        <span className="text-[10px] font-mono text-text-muted bg-dark-elevated px-1.5 py-0.5 rounded border border-dark-border shrink-0">
                                          {sp.publicationYear}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-text-secondary leading-relaxed">
                                      {sp.relevanceExplanation || 'Provides baseline methodology relevant to this direction.'}
                                    </p>
                                  </div>
                                  {sp.paperId && (
                                    <Link
                                      to={`/projects/${projectId}/analysis?paperId=${sp.paperId}`}
                                      className="text-[11px] text-brand-primary hover:underline flex items-center gap-1 font-semibold pt-1"
                                    >
                                      <span>View Document Analysis</span>
                                      <ArrowUpRight size={12} />
                                    </Link>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-dark-bg rounded-xl border border-dark-border text-xs text-text-muted italic">
                              Corpus has insufficient specific paper references for this direction.
                            </div>
                          )}
                        </div>

                        {/* Supporting Gaps */}
                        {Array.isArray(rec.supportingGaps) && rec.supportingGaps.length > 0 && (
                          <div className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-text-secondary">Anchored Research Gap:</span>
                            {rec.supportingGaps.map((gTitle, gIdx) => (
                              <Link
                                key={gIdx}
                                to={`/projects/${projectId}/gaps`}
                                className="px-2 py-0.5 rounded bg-dark-bg text-brand-light border border-dark-border hover:underline"
                              >
                                {gTitle}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Provenance & Timestamp */}
                    <div className="pt-3 border-t border-dark-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>Generated: {new Date(rec.provenance?.generatedAt || rec.createdAt || Date.now()).toLocaleDateString()}</span>
                        </span>
                        <span>•</span>
                        <span className="bg-dark-elevated px-2 py-0.5 rounded text-[10px] font-mono border border-dark-border">
                          Engine: {rec.provenance?.generatedBy || 'deterministic'}
                        </span>
                      </div>

                      {rec.limitations && (
                        <span className="text-[10px] text-amber-400/90 italic truncate max-w-xs" title={rec.limitations}>
                          Note: {rec.limitations}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })
            ) : (
              <Card className="p-8 text-center border-dark-border">
                <p className="text-sm text-text-muted mb-3">
                  No research recommendations matching the selected filters ("{searchQuery}").
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGrounding('All');
                    setSelectedPriority('All');
                  }}
                >
                  Clear Filters
                </Button>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

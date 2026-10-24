import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Lightbulb,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Clock,
  Compass,
  UploadCloud,
  Layers,
  BookOpen,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchApi, API_BASE_URL } from '../utils/api';

const CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'Methodological', label: 'Methodology' },
  { id: 'Empirical / Evaluation', label: 'Testing & Datasets' },
  { id: 'Theoretical / Algorithmic', label: 'Theory & Algorithms' },
  { id: 'Application / Deployment', label: 'Applications' },
  { id: 'Scope & Generalizability', label: 'Scope' },
];

export default function GapAnalysis() {
  const { projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState('gaps'); // 'gaps' | 'recommendations'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [expandedGapIds, setExpandedGapIds] = useState(new Set());
  const [expandedRecIds, setExpandedRecIds] = useState(new Set());
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const loadGaps = useCallback(
    async (isSilent = false) => {
      if (!projectId) return;
      try {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        setError(null);

        const res = await fetchApi(`/api/projects/${projectId}/gaps`);
        setData(res);
      } catch (err) {
        console.error('Failed to load gap analysis:', err);
        setError(err.message || 'Failed to load research gaps');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  // Background real-time updates
  useEffect(() => {
    const handlePaperCompleted = (e) => {
      if (e?.detail?.projectId === projectId) {
        loadGaps(true);
      }
    };
    window.addEventListener('paperProcessingCompleted', handlePaperCompleted);
    window.addEventListener('gapAnalysisCompleted', handlePaperCompleted);
    return () => {
      window.removeEventListener('paperProcessingCompleted', handlePaperCompleted);
      window.removeEventListener('gapAnalysisCompleted', handlePaperCompleted);
    };
  }, [projectId, loadGaps]);

  // Trigger on-demand re-analysis
  const handleTriggerReanalysis = async () => {
    if (!projectId || analyzing) return;
    try {
      setAnalyzing(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/gaps/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to re-analyze research gaps');
      }

      setActionSuccessMsg('Gap analysis updated successfully with latest corpus insights.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadGaps(true);
    } catch (err) {
      alert(err.message || 'Error updating gap analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleExpandGap = (gapId) => {
    setExpandedGapIds((prev) => {
      const next = new Set(prev);
      if (next.has(gapId)) next.delete(gapId);
      else next.add(gapId);
      return next;
    });
  };

  const toggleExpandRec = (recId) => {
    setExpandedRecIds((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto w-full py-16 flex flex-col items-center justify-center min-h-[420px]">
        <RefreshCw size={32} className="text-brand-bright animate-spin mb-4" />
        <h3 className="text-lg font-bold text-text-primary">Finding Research Gaps...</h3>
        <p className="text-sm text-text-muted mt-1">
          Reviewing paper limitations and detecting research opportunities
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto w-full py-8">
        <Card className="p-8 border-status-error/30 bg-status-error/5">
          <div className="flex items-start gap-4">
            <AlertTriangle size={24} className="text-status-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-status-error mb-1">Failed to Load Gap Analysis</h3>
              <p className="text-sm text-text-secondary mb-4">{error}</p>
              <Button onClick={() => loadGaps()} variant="secondary" className="gap-2 text-xs">
                <RefreshCw size={14} /> Try Again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const {
    totalEligiblePapers = 0,
    gapCount = 0,
    recommendationCount = 0,
    gaps = [],
    recommendations = [],
    lastUpdated = null,
  } = data || {};

  // Filtered Gaps based on category & search
  const filteredGaps = gaps.filter((g) => {
    const matchesCategory = selectedCategory === 'All' || g.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      (g.topic && g.topic.toLowerCase().includes(q)) ||
      (g.whyItMatters && g.whyItMatters.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Gaps displayed (limit to 5 initially unless showAllGaps is true)
  const displayedGaps = showAllGaps ? filteredGaps : filteredGaps.slice(0, 5);

  // Filtered Recommendations
  const filteredRecommendations = recommendations.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.researchQuestion && r.researchQuestion.toLowerCase().includes(q)) ||
      (r.possibleMethodology && r.possibleMethodology.toLowerCase().includes(q)) ||
      (r.expectedContribution && r.expectedContribution.toLowerCase().includes(q))
    );
  });

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="max-w-6xl mx-auto w-full pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Research Gap Analysis</h1>
            {analyzing ? (
              <span className="flex items-center gap-1.5 text-xs text-brand-bright font-medium bg-brand-primary/10 px-2.5 py-0.5 rounded-full border border-brand-primary/20">
                <RefreshCw size={11} className="animate-spin" /> Analyzing Papers
              </span>
            ) : refreshing ? (
              <span className="flex items-center gap-1.5 text-xs text-text-muted font-medium bg-dark-elevated px-2.5 py-0.5 rounded-full border border-dark-border">
                <RefreshCw size={11} className="animate-spin" /> Updating Data
              </span>
            ) : null}
          </div>
          <p className="text-sm sm:text-base text-text-muted font-normal">
            Find research gaps and suggest new research ideas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {formattedDate && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-text-muted mr-1">
              <Clock size={13} />
              <span>Last checked: {formattedDate}</span>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={handleTriggerReanalysis}
            disabled={analyzing || totalEligiblePapers === 0}
            className="gap-2 text-xs font-semibold py-2"
          >
            <Sparkles size={13} className={analyzing ? 'animate-spin text-brand-bright' : 'text-brand-bright'} />
            {analyzing ? 'Analyzing...' : 'Re-Analyze Papers'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => loadGaps(true)}
            disabled={refreshing || analyzing}
            className="gap-2 text-xs font-semibold py-2"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh Data
          </Button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="mb-6 p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-xs text-status-success flex items-center gap-2 font-medium">
          <CheckCircle2 size={15} /> {actionSuccessMsg}
        </div>
      )}

      {/* 2. Summary Cards (Only 2 compact cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Card 1: Papers Analyzed */}
        <Card className="p-5 flex items-center justify-between border-dark-border shadow-sm">
          <div>
            <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
              Papers Analyzed
            </div>
            <div className="text-2xl font-black text-text-primary">{totalEligiblePapers}</div>
            <div className="text-xs text-text-muted mt-0.5">Uploaded and processed in this project</div>
          </div>
          <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-bright">
            <FileText size={22} />
          </div>
        </Card>

        {/* Card 2: Potential Research Gaps */}
        <Card className="p-5 flex items-center justify-between border-dark-border shadow-sm">
          <div>
            <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
              Potential Research Gaps
            </div>
            <div className="text-2xl font-black text-text-primary">{gapCount}</div>
            <div className="text-xs text-text-muted mt-0.5">Identified opportunities for future work</div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <AlertTriangle size={22} />
          </div>
        </Card>
      </div>

      {/* 3. Subtle One-Line Information Note */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-6 px-1">
        <Info size={14} className="text-brand-bright shrink-0" />
        <span>Analysis is based on papers uploaded to this project.</span>
      </div>

      {/* Empty State when no papers */}
      {totalEligiblePapers === 0 && (
        <Card className="p-12 text-center border-dashed border-dark-border mb-8">
          <UploadCloud size={44} className="mx-auto text-text-muted mb-3" />
          <h3 className="text-lg font-bold text-text-primary mb-1">No Papers Analyzed Yet</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
            Upload research papers to find research gaps and get suggested research ideas.
          </p>
          <Link to={`/projects/${projectId}/upload`}>
            <Button className="gap-2 text-xs">
              <UploadCloud size={15} /> Upload Research Papers
            </Button>
          </Link>
        </Card>
      )}

      {totalEligiblePapers > 0 && (
        <>
          {/* 4. Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            {/* Compact Tabs */}
            <div className="flex items-center gap-1 bg-dark-bg p-1 rounded-xl border border-dark-border self-start">
              <button
                onClick={() => setActiveTab('gaps')}
                className={`text-xs px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'gaps'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <AlertTriangle size={13} />
                Research Gaps ({gapCount})
              </button>
              <button
                onClick={() => setActiveTab('recommendations')}
                className={`text-xs px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'recommendations'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Lightbulb size={13} />
                Suggested Research Ideas ({recommendationCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder={activeTab === 'gaps' ? 'Search research gaps...' : 'Search ideas...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>

          {/* Compact Category Filter (Gaps Tab only) */}
          {activeTab === 'gaps' && (
            <div className="flex flex-wrap items-center gap-1.5 mb-5">
              <span className="text-[11px] text-text-muted font-bold mr-1.5 uppercase tracking-wider">
                Category:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-brand-primary text-white font-bold'
                      : 'bg-dark-elevated text-text-muted hover:text-text-primary border border-dark-border'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* 5. TAB 1: RESEARCH GAPS CONTENT */}
          {activeTab === 'gaps' && (
            <div className="space-y-3.5">
              {displayedGaps.length > 0 ? (
                displayedGaps.map((gap, index) => {
                  const gapKey = gap._id || index;
                  const isExpanded = expandedGapIds.has(gapKey);
                  const isAuthorStated = gap.gapType === 'Explicit Gap';

                  return (
                    <Card
                      key={gapKey}
                      className="p-5 shadow-sm border-dark-border hover:border-dark-border/80 transition-all"
                    >
                      <div className="flex flex-col gap-2.5">
                        {/* Badges & Actions Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Category Badge */}
                            {gap.category && (
                              <Badge
                                variant={
                                  gap.category === 'Methodological'
                                    ? 'warning'
                                    : gap.category === 'Empirical / Evaluation'
                                    ? 'info'
                                    : 'primary'
                                }
                              >
                                {gap.category}
                              </Badge>
                            )}

                            {/* Clear distinction: Author Stated vs System Inferred */}
                            {isAuthorStated ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                Author-Stated Limitation
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                                System-Inferred Potential Gap
                              </span>
                            )}

                            {gap.topic && (
                              <span className="text-xs text-text-muted">
                                Topic: <strong className="text-text-secondary capitalize">{gap.topic}</strong>
                              </span>
                            )}
                          </div>

                          {/* View Details Action */}
                          <button
                            onClick={() => toggleExpandGap(gapKey)}
                            className="text-xs text-brand-bright hover:text-white font-medium flex items-center gap-1 transition-colors self-start sm:self-auto"
                          >
                            <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>

                        {/* Gap Title */}
                        <h3 className="text-base font-bold text-text-primary tracking-tight">
                          {gap.title}
                        </h3>

                        {/* Short Explanation */}
                        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-normal">
                          {gap.description}
                        </p>

                        {/* Expanded Supporting Evidence & Details */}
                        {isExpanded && (
                          <div className="mt-2 pt-3 border-t border-dark-border space-y-3 animate-fadeIn">
                            {/* Notice distinguishing fact vs inferred */}
                            <div className="p-2.5 bg-dark-bg/60 rounded-lg border border-dark-border text-[11px] text-text-muted flex items-start gap-2">
                              <Info size={13} className="text-brand-bright shrink-0 mt-0.5" />
                              <span>
                                {isAuthorStated
                                  ? 'This limitation was directly stated by the original authors in the paper limitations or future work sections.'
                                  : 'This is an inferred potential research gap identified through corpus text analysis. It represents an opportunity for further study rather than a confirmed limitation.'}
                              </span>
                            </div>

                            {/* Why It Matters */}
                            {gap.whyItMatters && (
                              <div className="text-xs text-text-secondary leading-relaxed">
                                <strong className="text-text-primary block font-semibold mb-0.5">
                                  Why This Matters:
                                </strong>
                                {gap.whyItMatters}
                              </div>
                            )}

                            {/* Supporting Papers */}
                            {Array.isArray(gap.supportingPapers) && gap.supportingPapers.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-text-primary mb-1.5">
                                  Supporting Papers ({gap.supportingPapers.length}):
                                </h4>
                                <div className="space-y-2">
                                  {gap.supportingPapers.map((sp, spIdx) => (
                                    <div
                                      key={sp.paperId || spIdx}
                                      className="p-3 bg-dark-bg rounded-lg border border-dark-border text-xs space-y-1"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <span className="font-semibold text-text-primary">
                                          {sp.title || sp.originalFilename}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                          {sp.publicationYear && <span>Year: {sp.publicationYear}</span>}
                                          {sp.sourceSection && (
                                            <span className="bg-dark-elevated px-1.5 py-0.5 rounded border border-dark-border">
                                              Section: {sp.sourceSection}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {sp.evidenceExcerpt && (
                                        <div className="pl-2.5 border-l-2 border-brand-primary/50 text-text-muted italic leading-relaxed text-[11px]">
                                          "{sp.evidenceExcerpt}"
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })
              ) : (
                <Card className="p-8 text-center border-dark-border">
                  <p className="text-xs text-text-muted">
                    No research gaps matching current filters ("{searchQuery}").
                  </p>
                </Card>
              )}

              {/* View All Toggle Button */}
              {filteredGaps.length > 5 && (
                <div className="pt-2 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAllGaps((prev) => !prev)}
                    className="text-xs font-semibold"
                  >
                    {showAllGaps
                      ? 'Show Top 5 Only'
                      : `View All ${filteredGaps.length} Research Gaps`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 6. TAB 2: SUGGESTED RESEARCH IDEAS CONTENT */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {/* Preserved Navigation Banner */}
              <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Compass className="text-brand-bright shrink-0" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Research Recommendations</h4>
                    <p className="text-xs text-text-muted">Get simple research ideas for your project.</p>
                  </div>
                </div>
                <Link to={`/projects/${projectId}/recommendations`}>
                  <Button size="sm" variant="primary" className="flex items-center gap-1.5 text-xs shrink-0">
                    <span>Open Recommendations View</span>
                    <ArrowRight size={13} />
                  </Button>
                </Link>
              </div>

              {/* Grid of Idea Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRecommendations.length > 0 ? (
                  filteredRecommendations.map((rec, index) => {
                    const recKey = rec._id || index;
                    const isRecExpanded = expandedRecIds.has(recKey);

                    return (
                      <Card
                        key={recKey}
                        className="p-5 shadow-sm border-dark-border flex flex-col justify-between hover:border-dark-border/80 transition-all"
                      >
                        <div>
                          {/* Priority Badge */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                rec.priority === 'High'
                                  ? 'bg-status-success/10 text-status-success border-status-success/20'
                                  : 'bg-brand-primary/10 text-brand-bright border-brand-primary/20'
                              }`}
                            >
                              {rec.priority || 'Medium'} Priority
                            </span>

                            <button
                              onClick={() => toggleExpandRec(recKey)}
                              className="text-xs text-brand-bright hover:text-white font-medium flex items-center gap-1 transition-colors"
                            >
                              <span>{isRecExpanded ? 'Less' : 'View Details'}</span>
                              {isRecExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>

                          {/* Title */}
                          <h3 className="text-base font-bold text-text-primary tracking-tight mb-2">
                            {rec.title}
                          </h3>

                          {/* Research Question */}
                          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border mb-3 text-xs">
                            <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
                              Research Question:
                            </div>
                            <p className="font-medium text-text-secondary leading-relaxed">
                              {rec.researchQuestion}
                            </p>
                          </div>

                          {/* Expanded Details: Methodology & Contribution */}
                          {isRecExpanded && (
                            <div className="space-y-2.5 pt-1 animate-fadeIn">
                              {rec.possibleMethodology && (
                                <div className="text-xs text-text-secondary leading-relaxed">
                                  <strong className="text-text-primary block font-semibold mb-0.5">
                                    Suggested Methodology:
                                  </strong>
                                  {rec.possibleMethodology}
                                </div>
                              )}
                              {rec.expectedContribution && (
                                <div className="text-xs text-text-secondary leading-relaxed">
                                  <strong className="text-text-primary block font-semibold mb-0.5">
                                    Expected Contribution:
                                  </strong>
                                  {rec.expectedContribution}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Metadata */}
                        <div className="pt-3 mt-3 border-t border-dark-border flex items-center justify-between gap-2 text-[11px] text-text-muted">
                          {rec.supportingGaps && rec.supportingGaps.length > 0 ? (
                            <span className="truncate max-w-[200px]" title={rec.supportingGaps.join(', ')}>
                              Related Gap: <strong>{rec.supportingGaps[0]}</strong>
                            </span>
                          ) : (
                            <span>Corpus Opportunity</span>
                          )}
                          {rec.supportingPapers && rec.supportingPapers.length > 0 && (
                            <span>{rec.supportingPapers.length} paper(s)</span>
                          )}
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-2">
                    <Card className="p-8 text-center border-dark-border">
                      <p className="text-xs text-text-muted">
                        No research ideas matching current search ("{searchQuery}").
                      </p>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

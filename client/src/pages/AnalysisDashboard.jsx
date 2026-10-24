import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  FileText,
  Tag,
  Download,
  Loader,
  TrendingUp,
  Hash,
  RefreshCw,
  File,
  Layers,
  Filter,
  Sparkles,
  BookOpen,
  Target,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/MetricCard';
import { fetchApi, API_BASE_URL } from '../utils/api';
import { generatePdfReport } from '../utils/generatePdfReport';

const cleanPaperTitle = (paper) => {
  if (!paper) return 'Untitled Document';
  const raw = (paper.title || paper.name || '').trim();
  if (raw && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(raw.toLowerCase())) {
    return raw;
  }
  return paper.originalFilename || 'Untitled Document';
};

export default function AnalysisDashboard() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPaperId = searchParams.get('paperId');

  const [project, setProject] = useState(null);
  const [papers, setPapers] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(queryPaperId || 'ALL');
  const [activeSummaryDocId, setActiveSummaryDocId] = useState(queryPaperId || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingSummaryId, setGeneratingSummaryId] = useState(null);
  const [summaryActionError, setSummaryActionError] = useState(null);
  const [error, setError] = useState(null);

  // Phase 8: Real-time similarity screening score state
  const [similarityData, setSimilarityData] = useState(null);
  const [similarityLoading, setSimilarityLoading] = useState(true);
  const [similarityError, setSimilarityError] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Phase 13: Plagiarism Checker summary state
  const [plagiarismSummary, setPlagiarismSummary] = useState(null);

  const loadSimilarityData = useCallback(
    async (isSilent = false) => {
      if (!projectId) return;
      try {
        if (!isSilent) setSimilarityLoading(true);
        setSimilarityError(null);
        const data = await fetchApi(`/api/projects/${projectId}/novelty`);
        if (data && data.result) {
          setSimilarityData({
            ...data.result,
            projectId: data.projectId,
            totalCorpusPapers: data.totalCorpusPapers,
          });
        } else {
          setSimilarityData(null);
        }
      } catch (err) {
        setSimilarityError(err.message || 'Failed to load similarity screening');
      } finally {
        setSimilarityLoading(false);
      }
    },
    [projectId]
  );

  const loadDashboardData = useCallback(
    async (isSilent = false) => {
      if (!projectId) return;
      try {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        const [projData, papersData, analysisData, plagSummary] = await Promise.all([
          fetchApi(`/api/projects/${projectId}`),
          fetchApi(`/api/projects/${projectId}/papers`),
          fetchApi(`/api/projects/${projectId}/analysis`).catch(() => null),
          fetchApi(`/api/projects/${projectId}/plagiarism/summary`).catch(() => null),
        ]);
        setProject(projData);
        setPapers(Array.isArray(papersData) ? papersData : []);
        setAnalysis(analysisData);
        setPlagiarismSummary(plagSummary);
        setError(null);
        loadSimilarityData(true);
      } catch (err) {
        setError('Failed to load project dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId, loadSimilarityData]
  );

  useEffect(() => {
    // Reset similarity data immediately when projectId changes to prevent stale data
    setSimilarityData(null);
    setSimilarityError(null);
    loadDashboardData();
    loadSimilarityData();
  }, [projectId, loadDashboardData, loadSimilarityData]);

  // Phase 8: Real-time event listener for screening updates without requiring page refresh
  useEffect(() => {
    const handleScreeningUpdated = (e) => {
      const updatedProjectId = e.detail?.projectId;
      if (updatedProjectId && updatedProjectId.toString() === projectId?.toString()) {
        if (e.detail?.result) {
          const res = e.detail.result;
          const normalized = {
            ...res,
            overallSimilarityPercentage:
              res.overallSimilarityPercentage ??
              (res.overallSimilarityScore != null ? res.overallSimilarityScore * 100 : 0),
            updatedAt: res.updatedAt || new Date().toISOString(),
          };
          setSimilarityData(normalized);
          setSimilarityError(null);
          setSimilarityLoading(false);
        } else {
          loadSimilarityData(true);
        }
      }
    };

    window.addEventListener('similarityScreeningUpdated', handleScreeningUpdated);
    return () => window.removeEventListener('similarityScreeningUpdated', handleScreeningUpdated);
  }, [projectId, loadSimilarityData]);

  // Real-time event listener for paper processing, deletion, retry, and reprocessing updates
  useEffect(() => {
    const handlePaperCompleted = (e) => {
      const updatedProjectId = e.detail?.projectId;
      if (!updatedProjectId || updatedProjectId.toString() === projectId?.toString()) {
        loadDashboardData(true);
      }
    };

    window.addEventListener('paperProcessingCompleted', handlePaperCompleted);
    return () => window.removeEventListener('paperProcessingCompleted', handlePaperCompleted);
  }, [projectId, loadDashboardData]);

  // Sync selectedDocId from query params if query param changes
  useEffect(() => {
    if (queryPaperId && queryPaperId !== selectedDocId) {
      setSelectedDocId(queryPaperId);
      setActiveSummaryDocId(queryPaperId);
    }
  }, [queryPaperId]);

  // Keep activeSummaryDocId synchronized with completed papers or selectedDocId
  useEffect(() => {
    const completed = papers.filter((p) => p.status === 'COMPLETED');
    if (selectedDocId !== 'ALL') {
      setActiveSummaryDocId(selectedDocId);
    } else if (!activeSummaryDocId && completed.length > 0) {
      setActiveSummaryDocId(completed[0]._id);
    }
  }, [selectedDocId, papers, activeSummaryDocId]);

  // Auto-refresh when any paper is in QUEUED or PROCESSING state
  useEffect(() => {
    const hasPending = papers.some((p) => p.status === 'QUEUED' || p.status === 'PROCESSING');
    if (!hasPending) return;

    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 2500);

    return () => clearInterval(interval);
  }, [papers, loadDashboardData]);

  const handleSelectDocument = (docId) => {
    setSelectedDocId(docId);
    setSummaryActionError(null);
    if (docId === 'ALL') {
      setSearchParams({});
    } else {
      setActiveSummaryDocId(docId);
      setSearchParams({ paperId: docId });
    }
  };

  const handleGenerateSummary = async (paperId) => {
    if (!paperId) return;
    setGeneratingSummaryId(paperId);
    setSummaryActionError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI summary');
      }

      // Update local state smoothly
      setAnalysis((prev) => {
        if (!prev) return prev;
        const currentAnalyses = prev.paperAnalyses || [];
        const found = currentAnalyses.some(
          (pa) => (pa.paperId?.toString() || pa.paperId) === paperId.toString()
        );

        let updated;
        if (found) {
          updated = currentAnalyses.map((pa) => {
            if ((pa.paperId?.toString() || pa.paperId) === paperId.toString()) {
              return {
                ...pa,
                structuredSummary: data.structuredSummary,
                summaryStatus: 'COMPLETED',
                summaryError: null,
              };
            }
            return pa;
          });
        } else {
          updated = [
            ...currentAnalyses,
            {
              paperId,
              structuredSummary: data.structuredSummary,
              summaryStatus: 'COMPLETED',
              summaryError: null,
            },
          ];
        }

        return { ...prev, paperAnalyses: updated };
      });
    } catch (err) {
      setSummaryActionError(err.message || 'Failed to generate structured summary');
    } finally {
      setGeneratingSummaryId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center py-20 h-full">
        <Loader className="animate-spin text-brand-primary" size={32} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-4 mb-8 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 max-w-6xl mx-auto w-full flex items-center justify-between">
        <span>{error || 'Project not found'}</span>
        <Button variant="secondary" size="sm" onClick={() => loadDashboardData()}>
          Retry
        </Button>
      </div>
    );
  }

  const completedPapers = papers.filter((p) => p.status === 'COMPLETED');
  const completedCount = completedPapers.length;

  // Selected document vs All documents calculation
  const isAllDocs = selectedDocId === 'ALL';
  const paperAnalysesList = analysis?.paperAnalyses || [];

  const selectedDocAnalysis = !isAllDocs
    ? paperAnalysesList.find(
        (a) => (a.paperId?.toString() || a.paperId) === selectedDocId.toString()
      )
    : null;

  const selectedPaperInfo = !isAllDocs
    ? completedPapers.find((p) => (p._id?.toString() || p._id) === selectedDocId.toString())
    : null;

  // Keywords to display
  const activeKeywords = isAllDocs
    ? (analysis?.aggregatedKeywords || [])
    : (selectedDocAnalysis?.extractedKeywords || []);

  // Total unique keywords count (strictly dynamic from extracted data)
  // When viewing all docs: SUM of per-paper unique keyword counts across all eligible papers
  // When viewing single doc: actual unique keyword count for that document (max 50)
  const totalKeywordsSum = isAllDocs
    ? (analysis?.totalKeywordsSum != null
        ? analysis.totalKeywordsSum
        : paperAnalysesList.reduce((acc, pa) => acc + (pa.keywordsCount ?? pa.extractedKeywords?.length ?? 0), 0))
    : (selectedDocAnalysis?.keywordsCount ?? selectedDocAnalysis?.extractedKeywords?.length ?? 0);

  const globallyUniqueCount = analysis?.totalUniqueKeywords ?? activeKeywords.length;

  const maxScore =
    activeKeywords.length > 0
      ? (activeKeywords[0].totalScore ?? activeKeywords[0].score ?? 1)
      : 1;

  // Active summary target document (strictly isolated to selected document)
  const summaryTargetId = isAllDocs ? activeSummaryDocId : selectedDocId;
  const summaryTargetPaper = completedPapers.find(
    (p) => (p._id?.toString() || p._id) === (summaryTargetId?.toString() || summaryTargetId)
  );
  const summaryTargetAnalysis = paperAnalysesList.find(
    (a) => (a.paperId?.toString() || a.paperId) === (summaryTargetId?.toString() || summaryTargetId)
  );

  const structuredSummary = summaryTargetAnalysis?.structuredSummary;
  const isGeneratingThis = generatingSummaryId === summaryTargetPaper?._id?.toString();
  const summaryStatus = isGeneratingThis
    ? 'GENERATING'
    : (summaryTargetAnalysis?.summaryStatus || 'NOT_STARTED');
  const summaryErrorMessage = summaryActionError || summaryTargetAnalysis?.summaryError;

  const activeProvider = analysis?.aiProvider || 'groq';
  const activeModel = analysis?.aiModel || (activeProvider === 'groq' ? 'openai/gpt-oss-120b' : (activeProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o'));
  const activeModelBadge = structuredSummary?.model || activeModel;

  const formatModelLabel = (modelStr) => {
    if (!modelStr) return 'Groq AI';
    const lower = modelStr.toLowerCase();
    if (lower.includes('gpt-oss-120b')) return 'Groq (GPT-OSS 120B)';
    if (lower.includes('gpt-oss-20b')) return 'Groq (GPT-OSS 20B)';
    if (lower.includes('qwen')) return 'Groq (Qwen 27B)';
    if (lower.includes('llama-3.3-70b')) return 'Groq (Llama 3.3 70B)';
    if (lower.includes('llama-3.1-8b')) return 'Groq (Llama 3.1 8B)';
    if (lower.includes('llama') || lower.includes('mixtral')) return `Groq (${modelStr})`;
    if (lower.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
    if (lower.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro';
    if (lower.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
    if (lower.includes('gemini')) return 'Google Gemini';
    if (lower.includes('gpt-4o')) return 'GPT-4o';
    return modelStr;
  };

  const currentDisplayName = cleanPaperTitle(summaryTargetPaper);

  // Export report download handler — generates genuine PDF
  const handleExportReport = async () => {
    const target = summaryTargetPaper || (completedPapers.length > 0 ? completedPapers[0] : null);
    if (!target) return;

    try {
      setExportingPdf(true);
      const query = target._id ? `?paperId=${target._id}` : '';
      const reportData = await fetchApi(`/api/projects/${projectId}/report${query}`).catch(() => null);

      if (reportData) {
        generatePdfReport(reportData);
      } else {
        generatePdfReport({
          projectId,
          projectName: project?.name,
          domain: project?.domain,
          selectedPaper: {
            id: target._id,
            title: cleanPaperTitle(target),
            originalFilename: target.originalFilename,
            authors: target.authors || [],
            publicationYear: target.publicationYear,
            status: target.status,
          },
          keywords: activeKeywords,
          structuredSummary: structuredSummary,
          similarityScreening: similarityData,
        });
      }
    } catch (err) {
      console.error('Error exporting PDF report:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  // Phase 8: Compute MetricCard display for similarity score
  let similarityMetricValue;
  let similarityBgClass = 'bg-dark-elevated border border-dark-border';
  let similarityColorClass = 'text-text-muted';

  if (similarityLoading) {
    similarityMetricValue = (
      <span className="text-xl font-medium text-text-muted flex items-center gap-2">
        <Loader size={18} className="animate-spin text-brand-primary" /> Loading…
      </span>
    );
  } else if (completedCount === 0) {
    similarityMetricValue = (
      <span className="text-base font-semibold text-text-muted">No eligible papers</span>
    );
  } else if (similarityError) {
    similarityMetricValue = (
      <span className="text-base font-semibold text-red-400">Error</span>
    );
    similarityBgClass = 'bg-red-500/10 border border-red-500/20';
    similarityColorClass = 'text-red-400';
  } else if (!similarityData) {
    similarityMetricValue = (
      <span className="text-base font-semibold text-text-muted">Not screened</span>
    );
  } else {
    const pct =
      similarityData.overallSimilarityPercentage ??
      (similarityData.overallSimilarityScore != null
        ? similarityData.overallSimilarityScore * 100
        : 0);
    const pctFormatted = typeof pct === 'number' ? pct.toFixed(1) : String(pct);
    const inter = (similarityData.interpretation || 'Low').toLowerCase();

    if (inter === 'high' || pct >= 60) {
      similarityBgClass = 'bg-red-500/10 border border-red-500/20';
      similarityColorClass = 'text-red-400';
    } else if (inter === 'moderate' || pct >= 30) {
      similarityBgClass = 'bg-amber-500/10 border border-amber-500/20';
      similarityColorClass = 'text-amber-400';
    } else {
      similarityBgClass = 'bg-emerald-500/10 border border-emerald-500/20';
      similarityColorClass = 'text-emerald-400';
    }

    similarityMetricValue = (
      <div className="flex items-baseline gap-2">
        <span>{pctFormatted}%</span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            inter === 'high' || pct >= 60
              ? 'bg-red-500/20 text-red-400'
              : inter === 'moderate' || pct >= 30
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          {similarityData.interpretation || (pct >= 60 ? 'High' : pct >= 30 ? 'Moderate' : 'Low')}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Analysis Dashboard</h1>
          <p className="text-base text-text-muted font-medium">
            Results for: <span className="font-bold text-text-primary">{project.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-brand-primary' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleExportReport}
            disabled={completedCount === 0 || exportingPdf}
            title={!structuredSummary ? 'Export document report (AI summary pending)' : 'Export complete document report as PDF'}
          >
            {exportingPdf ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
            {exportingPdf ? 'Exporting PDF…' : 'Export Report (PDF)'}
          </Button>

          <Link to={`/projects/${projectId}/report${summaryTargetPaper ? `?paperId=${summaryTargetPaper._id}` : ''}`}>
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs">
              <FileText size={14} /> View Full Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Document Selection Tabs */}
      {completedCount > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-1 flex items-center gap-1.5 shrink-0">
            <Filter size={13} /> View:
          </span>
          <button
            type="button"
            onClick={() => handleSelectDocument('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              isAllDocs
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-dark-elevated text-text-muted hover:text-text-primary hover:bg-dark-border border border-dark-border'
            }`}
          >
            <Layers size={13} /> All Documents ({completedCount})
          </button>
          {completedPapers.map((paper) => {
            const isSelected = selectedDocId === paper._id;
            const paperTitle = cleanPaperTitle(paper);
            const docAnalysis = paperAnalysesList.find(
              (a) => (a.paperId?.toString() || a.paperId) === paper._id?.toString()
            );
            const kwCount = docAnalysis?.keywordsCount ?? docAnalysis?.extractedKeywords?.length ?? 0;
            return (
              <button
                key={paper._id}
                type="button"
                onClick={() => handleSelectDocument(paper._id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 max-w-[240px] truncate ${
                  isSelected
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-dark-elevated text-text-muted hover:text-text-primary hover:bg-dark-border border border-dark-border'
                }`}
                title={`${paperTitle} (${kwCount} keywords)`}
              >
                <File size={13} className="shrink-0" />
                <span className="truncate">{paperTitle}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-dark-border text-text-muted'
                  }`}
                >
                  {kwCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title={isAllDocs ? 'Successfully Analyzed' : 'Document Status'}
          value={isAllDocs ? completedCount.toString() : 'Analyzed (1)'}
          icon={FileText}
          bgClass="bg-brand-primary/10 border border-brand-primary/20"
          colorClass="text-brand-primary"
        />
        <MetricCard
          title={isAllDocs ? 'Total Keywords (Sum)' : 'Document Keywords'}
          value={
            isAllDocs ? (
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span>{completedCount > 0 ? totalKeywordsSum.toString() : '0'}</span>
                {completedCount > 0 && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    title="Globally unique keywords across the project corpus"
                  >
                    {globallyUniqueCount} globally unique
                  </span>
                )}
              </div>
            ) : (
              <span>
                {selectedDocAnalysis
                  ? (selectedDocAnalysis.keywordsCount ?? selectedDocAnalysis.extractedKeywords?.length ?? 0).toString()
                  : '0'}
              </span>
            )
          }
          icon={Tag}
          bgClass={
            (isAllDocs ? totalKeywordsSum : (selectedDocAnalysis?.keywordsCount ?? selectedDocAnalysis?.extractedKeywords?.length ?? 0)) > 0
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-dark-elevated border border-dark-border'
          }
          colorClass={
            (isAllDocs ? totalKeywordsSum : (selectedDocAnalysis?.keywordsCount ?? selectedDocAnalysis?.extractedKeywords?.length ?? 0)) > 0
              ? 'text-emerald-400'
              : 'text-text-muted'
          }
        />
        <MetricCard
          title="Corpus Textual Similarity"
          value={similarityMetricValue}
          icon={TrendingUp}
          bgClass={similarityBgClass}
          colorClass={similarityColorClass}
        />
      </div>

      {/* Main Analysis Section: Keywords & Future Similarity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Keywords Card */}
        <Card className="p-8 flex flex-col shadow-md min-h-[340px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
              <Tag size={18} className="text-brand-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-text-primary text-lg leading-tight truncate">
                {isAllDocs
                  ? 'Top Keywords (Aggregated)'
                  : `Top Keywords: ${cleanPaperTitle(selectedPaperInfo)}`}
              </h3>
              <p className="text-xs text-text-muted truncate">
                {isAllDocs
                  ? `Showing top ${Math.min(activeKeywords.length, 30)} of ${globallyUniqueCount} globally unique terms (Total Sum: ${totalKeywordsSum}) across ${completedCount} paper${completedCount !== 1 ? 's' : ''}`
                  : `Showing top ${Math.min(activeKeywords.length, 30)} of ${selectedDocAnalysis?.keywordsCount ?? activeKeywords.length} unique keywords (max 50)`}
              </p>
            </div>
          </div>

          {activeKeywords.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Hash size={40} className="text-text-muted opacity-20 mb-3" />
              <p className="text-sm text-text-muted text-center max-w-xs">
                {completedCount === 0
                  ? 'Upload and process papers to see keyword analysis.'
                  : 'No keywords available for the selected view.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-80 pr-1">
              {activeKeywords.slice(0, 30).map((kw, idx) => {
                const scoreVal = kw.totalScore ?? kw.score ?? 0;
                const rankVal = kw.rank ?? idx + 1;
                const pct = maxScore > 0 ? Math.round((scoreVal / maxScore) * 100) : 0;
                return (
                  <div key={kw.term} className="flex items-center gap-3">
                    <span className="text-xs text-text-muted w-6 text-right shrink-0">#{rankVal}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-text-primary truncate">{kw.term}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-xs font-mono text-emerald-400 font-semibold">{scoreVal}</span>
                          {kw.paperCount != null && (
                            <span className="text-xs text-text-muted">
                              ({kw.paperCount} paper{kw.paperCount > 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-dark-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-primary to-emerald-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Phase 8: Real-Time Similarity Screening Card */}
        <Card className="p-8 flex flex-col shadow-md min-h-[340px]">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
                <Lightbulb size={18} className="text-brand-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-text-primary text-lg leading-tight truncate">
                  Similarity Screening
                </h3>
                <p className="text-xs text-text-muted truncate">
                  Latest screening against project corpus
                </p>
              </div>
            </div>
            <Link to={`/projects/${projectId}/novelty`} className="shrink-0">
              <Button variant="secondary" size="sm" className="text-xs flex items-center gap-1.5">
                <Lightbulb size={13} /> Screen Idea
              </Button>
            </Link>
          </div>

          {similarityLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <Loader className="animate-spin text-brand-primary mb-2" size={28} />
              <p className="text-sm text-text-muted">Loading similarity screening…</p>
            </div>
          ) : completedCount === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <Layers size={36} className="text-text-muted opacity-30 mb-2" />
              <p className="text-sm text-text-muted max-w-xs">
                No eligible papers in project corpus. Upload and process papers before screening similarity.
              </p>
            </div>
          ) : similarityError ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle size={36} className="text-red-400 opacity-80 mb-2" />
              <p className="text-sm text-red-400 max-w-xs mb-3">{similarityError}</p>
              <Button variant="secondary" size="sm" onClick={() => loadSimilarityData()}>
                Retry
              </Button>
            </div>
          ) : !similarityData ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <Lightbulb size={36} className="text-text-muted opacity-25 mb-3" />
              <h4 className="font-semibold text-text-primary text-base mb-1">
                No Screening Recorded
              </h4>
              <p className="text-xs text-text-muted max-w-xs mb-4 leading-relaxed">
                Screen a candidate research idea to assess its textual overlap against this project's uploaded papers.
              </p>
              <Link to={`/projects/${projectId}/novelty`}>
                <Button variant="secondary" size="sm" className="text-xs flex items-center gap-1.5">
                  <Lightbulb size={13} /> Screen a Research Idea
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                {/* Score & Interpretation Banner */}
                <div className="flex items-center justify-between p-3.5 bg-dark-elevated rounded-xl border border-dark-border mb-3">
                  <div>
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-0.5">
                      Corpus Similarity Score
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-text-primary">
                        {(
                          similarityData.overallSimilarityPercentage ??
                          (similarityData.overallSimilarityScore != null
                            ? similarityData.overallSimilarityScore * 100
                            : 0)
                        ).toFixed(1)}
                        %
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          (similarityData.interpretation || '').toLowerCase() === 'high' ||
                          (similarityData.overallSimilarityPercentage ?? 0) >= 60
                            ? 'bg-red-500/20 text-red-400'
                            : (similarityData.interpretation || '').toLowerCase() === 'moderate' ||
                              (similarityData.overallSimilarityPercentage ?? 0) >= 30
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {similarityData.statusBadge ||
                          `${similarityData.interpretation || 'Low'} Overlap`}
                      </span>
                    </div>
                  </div>
                  {similarityData.updatedAt && (
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted block">Latest Screened</span>
                      <span className="text-xs font-medium text-text-secondary">
                        {new Date(similarityData.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Screened Idea */}
                {similarityData.researchIdea && (
                  <div className="mb-3">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                      Screened Research Idea
                    </span>
                    <p
                      className="text-xs text-text-secondary bg-dark-bg/60 p-2.5 rounded-lg border border-dark-border line-clamp-2"
                      title={similarityData.researchIdea}
                    >
                      {similarityData.researchIdea}
                    </p>
                  </div>
                )}

                {/* Explicit Textual Similarity Label & Disclaimer */}
                <p className="text-[11px] text-text-muted italic leading-relaxed mb-3">
                  This score reflects textual similarity to the available project corpus. It does not measure plagiarism or guarantee research originality.
                </p>

                {/* Matching Terms */}
                {Array.isArray(similarityData.matchingKeywords) &&
                  similarityData.matchingKeywords.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Matching Corpus Terms
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                        {similarityData.matchingKeywords.slice(0, 8).map((term) => (
                          <span
                            key={term}
                            className="px-2 py-0.5 rounded text-[11px] bg-dark-elevated text-text-secondary border border-dark-border"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Top Similar Papers */}
                {Array.isArray(similarityData.similarPapers) &&
                  similarityData.similarPapers.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Top Similar Corpus Papers
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {similarityData.similarPapers.slice(0, 2).map((sp, idx) => {
                          const spPct =
                            sp.similarity_percentage ??
                            ((sp.similarity_score || 0) * 100).toFixed(1);
                          const spTitle = sp.title || sp.original_filename || 'Document';
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-dark-bg/40 border border-dark-border"
                            >
                              <span className="text-text-secondary truncate max-w-[220px]" title={spTitle}>
                                #{sp.rank || idx + 1} {spTitle}
                              </span>
                              <span className="font-mono text-brand-primary font-semibold ml-2 shrink-0">
                                {spPct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>

              {/* Bottom Link */}
              <Link
                to={`/projects/${projectId}/novelty`}
                className="text-xs text-brand-primary hover:underline flex items-center gap-1 pt-3 border-t border-dark-border mt-2 font-medium"
              >
                <span>View Full Similarity Screening & Ranked Papers</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Phase 7: AI-Powered Structured Summarization Section */}
      <Card className="p-8 shadow-md border-dark-border" id="structured-summary-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-dark-border">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-primary/20 to-violet-500/20 border border-brand-primary/30 flex items-center justify-center shrink-0">
              <Sparkles size={22} className="text-brand-bright" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-text-primary tracking-tight">
                  AI-Powered Structured Summary
                </h2>
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2.5 py-0.5 rounded-full">
                  {formatModelLabel(activeModelBadge)}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {summaryTargetPaper
                  ? `Structured research summary for: ${currentDisplayName}`
                  : 'Select an analyzed document to inspect its structured summary'}
              </p>
            </div>
          </div>

          {/* Document switcher inside summary card if in All Documents view */}
          <div className="flex items-center gap-2 shrink-0">
            {isAllDocs && completedCount > 1 && (
              <select
                value={activeSummaryDocId || ''}
                onChange={(e) => {
                  setActiveSummaryDocId(e.target.value);
                  setSummaryActionError(null);
                }}
                className="bg-dark-elevated text-xs text-text-primary border border-dark-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-primary"
              >
                {completedPapers.map((p) => (
                  <option key={p._id} value={p._id}>
                    {cleanPaperTitle(p)}
                  </option>
                ))}
              </select>
            )}

            {summaryTargetPaper && (
              <Button
                variant={structuredSummary ? 'secondary' : 'primary'}
                size="sm"
                className="flex items-center gap-2 text-xs"
                onClick={() => handleGenerateSummary(summaryTargetPaper._id)}
                disabled={summaryStatus === 'GENERATING'}
              >
                {summaryStatus === 'GENERATING' ? (
                  <>
                    <Loader size={14} className="animate-spin text-brand-primary" />
                    Generating…
                  </>
                ) : structuredSummary ? (
                  <>
                    <RotateCcw size={14} /> Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Generate Summary
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Content States: Loading, Error, Empty, and Structured Display */}
        {summaryStatus === 'GENERATING' ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="relative mb-4">
              <Loader size={44} className="animate-spin text-brand-primary" />
              <Sparkles size={18} className="text-brand-bright absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h4 className="text-base font-bold text-text-primary mb-1">
              Analyzing Document with {formatModelLabel(activeModelBadge)}
            </h4>
            <p className="text-xs text-text-muted max-w-sm">
              Extracting research problem, objectives, methodology, key findings, and limitations from {currentDisplayName}…
            </p>
          </div>
        ) : summaryStatus === 'FAILED' || summaryErrorMessage ? (
          <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-300">
                  {summaryErrorMessage && (summaryErrorMessage.includes('API_KEY') || summaryErrorMessage.includes('key is not configured'))
                    ? `${activeProvider === 'gemini' ? 'Gemini' : 'OpenAI'} Configuration Required`
                    : summaryErrorMessage && (summaryErrorMessage.includes('quota') || summaryErrorMessage.includes('credits') || summaryErrorMessage.includes('billing'))
                    ? 'AI Quota / Rate Limit Exceeded'
                    : 'Summarization Encountered an Issue'}
                </p>
                <p className="text-xs text-red-400/90 mt-0.5">{summaryErrorMessage || 'AI service error'}</p>
                {summaryErrorMessage && (summaryErrorMessage.includes('API_KEY') || summaryErrorMessage.includes('key is not configured')) && (
                  <p className="text-[11px] text-text-muted mt-2">
                    To enable live {formatModelLabel(activeModelBadge)} summarization: configure{' '}
                    <code className="text-brand-bright bg-dark-bg px-1.5 py-0.5 rounded">
                      {activeProvider === 'gemini' ? 'GEMINI_API_KEY=your_key' : 'OPENAI_API_KEY=your_key'}
                    </code>{' '}
                    in <code className="text-brand-bright bg-dark-bg px-1.5 py-0.5 rounded">server/.env</code> and restart the server.
                  </p>
                )}
              </div>
            </div>
            {summaryTargetPaper && (
              <Button
                variant="secondary"
                size="sm"
                className="text-xs border-red-500/30 text-red-300 hover:bg-red-500/20 shrink-0"
                onClick={() => handleGenerateSummary(summaryTargetPaper._id)}
              >
                Retry Summary
              </Button>
            )}
          </div>
        ) : !structuredSummary ? (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-dark-elevated border border-dark-border flex items-center justify-center mb-4 text-text-muted">
              <BookOpen size={28} className="opacity-40" />
            </div>
            <h4 className="text-base font-bold text-text-primary mb-1">
              {completedCount === 0
                ? 'No Analyzed Papers Available'
                : `No Summary Generated for ${currentDisplayName} Yet`}
            </h4>
            <p className="text-xs text-text-muted max-w-md mb-6">
              {completedCount === 0
                ? 'Upload research papers in the Upload/Analyze screen to enable AI summarization.'
                : 'Generate a structured summary containing research problem, objective, methodology, key findings, and limitations.'}
            </p>
            {summaryTargetPaper && (
              <Button
                variant="primary"
                size="sm"
                className="flex items-center gap-2 px-5 shadow-sm"
                onClick={() => handleGenerateSummary(summaryTargetPaper._id)}
              >
                <Sparkles size={16} /> Generate AI Summary ({formatModelLabel(activeModelBadge)})
              </Button>
            )}
          </div>
        ) : (
          /* 5 Structured Sections Display */
          <div className="space-y-6">
            {/* 1. Research Problem & 2. Objective Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Research Problem */}
              <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={15} className="text-amber-400" />
                  </div>
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    1. Research Problem
                  </h4>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed flex-1">
                  {structuredSummary.researchProblem}
                </p>
              </div>

              {/* Objective */}
              <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
                    <Target size={15} className="text-brand-primary" />
                  </div>
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    2. Objective
                  </h4>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed flex-1">
                  {structuredSummary.objective}
                </p>
              </div>
            </div>

            {/* 3. Methodology */}
            <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Cpu size={15} className="text-violet-400" />
                </div>
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  3. Methodology
                </h4>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {structuredSummary.methodology}
              </p>
            </div>

            {/* 4. Key Findings & 5. Limitations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Key Findings */}
              <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  </div>
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    4. Key Findings
                  </h4>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {(structuredSummary.keyFindings || []).map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Limitations */}
              <div className="p-5 rounded-xl bg-dark-elevated border border-dark-border flex flex-col">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle size={15} className="text-rose-400" />
                  </div>
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    5. Limitations
                  </h4>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {(structuredSummary.limitations || []).map((limitation, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Summary Metadata Footer */}
            <div className="pt-4 border-t border-dark-border/60 flex items-center justify-between text-[11px] text-text-muted">
              <span>
                Generated by {formatModelLabel(structuredSummary.model || activeModelBadge)}
                {structuredSummary.generatedAt && (
                  <> · {new Date(structuredSummary.generatedAt).toLocaleString()}</>
                )}
              </span>
              <span className="text-emerald-400/90 font-medium">✓ Validated against schema</span>
            </div>
          </div>
        )}
      </Card>

      {/* Phase 13: Plagiarism Checker Summary Section */}
      <Card className="p-6 mt-8 border-dark-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text-primary text-base">Plagiarism Checker</h3>
                <span className="text-[10px] bg-dark-elevated text-text-muted px-2 py-0.5 rounded-full border border-dark-border">
                  {plagiarismSummary?.totalCompletedScans || 0} completed scan{plagiarismSummary?.totalCompletedScans !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {plagiarismSummary?.latestScan
                  ? `Latest scan on ${new Date(plagiarismSummary.latestScan.date).toLocaleDateString()} for "${plagiarismSummary.latestScan.paperTitle}": ${plagiarismSummary.latestScan.matchPercentage == null ? 'No comparison corpus' : `${plagiarismSummary.latestScan.matchPercentage}% text overlap`}`
                  : 'No plagiarism scans have been executed for this project yet.'}
              </p>
            </div>
          </div>

          <Link to={`/projects/${projectId}/plagiarism`}>
            <Button variant="secondary" size="sm" className="flex items-center gap-2 text-xs shrink-0 font-medium">
              Open Plagiarism Checker <ArrowRight size={13} />
            </Button>
          </Link>
        </div>

        {plagiarismSummary?.recentScans && plagiarismSummary.recentScans.length > 0 && (
          <div className="mt-4 pt-4 border-t border-dark-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {plagiarismSummary.recentScans.slice(0, 3).map((rs) => (
              <div key={rs.id} className="p-2.5 rounded-lg bg-dark-bg border border-dark-border text-xs flex items-center justify-between">
                <span className="text-text-primary font-medium truncate mr-2" title={rs.paperTitle}>
                  {rs.paperTitle}
                </span>
                <span className={`font-bold shrink-0 ${
                  rs.matchPercentage == null
                    ? 'text-yellow-400'
                    : rs.matchPercentage >= 25
                    ? 'text-red-400'
                    : rs.matchPercentage >= 10
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {rs.matchPercentage == null ? 'N/A' : `${rs.matchPercentage}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  Info,
  Calendar,
  FileText,
  Sparkles,
  Search,
  CheckCircle2,
  X,
  UploadCloud,
  BookOpen,
  HelpCircle,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { fetchApi, API_BASE_URL } from '../utils/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const KEYWORD_COLORS = [
  { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' }, // Blue
  { border: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' }, // Emerald
  { border: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' }, // Purple
  { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' }, // Amber
  { border: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' }, // Pink
  { border: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' },  // Cyan
];

export default function Trends() {
  const { projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [trendData, setTrendData] = useState(null);

  // Filter States
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lineChartMetric, setLineChartMetric] = useState('paperCount'); // 'paperCount' | 'prevalence' | 'occurrences'

  // Modals
  const [showYearEditor, setShowYearEditor] = useState(false);
  const [editingYears, setEditingYears] = useState({});
  const [savingPaperId, setSavingPaperId] = useState(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState(null);
  const [selectedTopicDetail, setSelectedTopicDetail] = useState(null);
  const [showAllTopics, setShowAllTopics] = useState(false);

  const loadTrends = useCallback(
    async (isSilent = false) => {
      if (!projectId) return;
      try {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        setError(null);

        const data = await fetchApi(`/api/projects/${projectId}/trends`);
        setTrendData(data);

        // Pre-select top 3 keywords if not selected yet
        if (data && Array.isArray(data.topKeywords)) {
          setSelectedKeywords((prev) => {
            if (prev.length > 0) return prev;
            return data.topKeywords.slice(0, 3).map((k) => k.term);
          });
        }

        // Initialize year filters if not set yet
        if (data && Array.isArray(data.distinctYears) && data.distinctYears.length > 0) {
          setFromYear((prev) => (prev ? prev : String(data.distinctYears[0])));
          setToYear((prev) =>
            prev ? prev : String(data.distinctYears[data.distinctYears.length - 1])
          );
        }
      } catch (err) {
        console.error('Failed to load trends:', err);
        setError(err.message || 'Failed to load research trends');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  // Real-time update on paper completion
  useEffect(() => {
    const handlePaperCompleted = (e) => {
      if (e?.detail?.projectId === projectId) {
        loadTrends(true);
      }
    };
    window.addEventListener('paperProcessingCompleted', handlePaperCompleted);
    return () => {
      window.removeEventListener('paperProcessingCompleted', handlePaperCompleted);
    };
  }, [projectId, loadTrends]);

  // Publication Year Editor Handlers
  const handleOpenYearEditor = () => {
    if (trendData?.allProjectPapers) {
      const initial = {};
      trendData.allProjectPapers.forEach((p) => {
        initial[p.id] = p.publicationYear !== null ? String(p.publicationYear) : '';
      });
      setEditingYears(initial);
    }
    setEditSuccessMsg(null);
    setShowYearEditor(true);
  };

  const handleSavePaperYear = async (paperId) => {
    const token = localStorage.getItem('token');
    const inputVal = editingYears[paperId];
    let parsedYear = null;

    if (inputVal && inputVal.trim()) {
      const num = parseInt(inputVal.trim(), 10);
      if (isNaN(num) || num < 1900 || num > 2100) {
        alert('Please enter a valid 4-digit year between 1900 and 2100');
        return;
      }
      parsedYear = num;
    }

    try {
      setSavingPaperId(paperId);
      const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ publicationYear: parsedYear }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update publication year');
      }

      setEditSuccessMsg('Publication year updated. Recalculating trends...');
      setTimeout(() => setEditSuccessMsg(null), 3000);
      await loadTrends(true);
    } catch (err) {
      alert(err.message || 'Error saving publication year');
    } finally {
      setSavingPaperId(null);
    }
  };

  const toggleKeyword = (term) => {
    setSelectedKeywords((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  };

  // Base data extracted from response
  const {
    totalEligiblePapers = 0,
    papersInYearlyAnalysis = 0,
    distinctYears = [],
    yearlyTimeline = [],
    topKeywords = [],
    topicTrends = [],
  } = trendData || {};

  // Year filter boundaries
  const parsedFrom = fromYear ? parseInt(fromYear, 10) : distinctYears[0] || 0;
  const parsedTo = toYear ? parseInt(toYear, 10) : distinctYears[distinctYears.length - 1] || 9999;
  const validMinYear = Math.min(parsedFrom, parsedTo);
  const validMaxYear = Math.max(parsedFrom, parsedTo);

  // Filter yearly timeline based on selected valid year range
  const filteredTimeline = useMemo(() => {
    if (!yearlyTimeline || yearlyTimeline.length === 0) return [];
    return yearlyTimeline.filter(
      (yt) => yt.year >= validMinYear && yt.year <= validMaxYear
    );
  }, [yearlyTimeline, validMinYear, validMaxYear]);

  const filteredYears = useMemo(() => {
    return filteredTimeline.map((yt) => yt.year);
  }, [filteredTimeline]);

  // Total papers across filtered years
  const papersInSelectedRange = useMemo(() => {
    return filteredTimeline.reduce((acc, yt) => acc + (yt.paperCount || 0), 0);
  }, [filteredTimeline]);

  // Recalculate topic metrics within selected year range
  const topicsInRange = useMemo(() => {
    if (!topicTrends || topicTrends.length === 0) return [];

    return topicTrends
      .map((t) => {
        let rangePaperCount = 0;
        let rangeOccurrences = 0;

        filteredTimeline.forEach((yt) => {
          if (yt.keywords && yt.keywords[t.topic]) {
            rangePaperCount += yt.keywords[t.topic] || 0;
          }
          if (yt.keywordOccurrences && yt.keywordOccurrences[t.topic]) {
            rangeOccurrences += yt.keywordOccurrences[t.topic] || 0;
          }
        });

        // Use precomputed paper count if timeline is single year or empty
        const count =
          filteredTimeline.length > 0
            ? rangePaperCount
            : t.paperCount;

        const presencePct =
          papersInSelectedRange > 0
            ? Math.round((count / papersInSelectedRange) * 100)
            : t.prevalencePercentage || 0;

        return {
          ...t,
          rangePaperCount: count,
          rangeOccurrences: rangeOccurrences || t.occurrenceCount,
          rangePrevalence: presencePct,
        };
      })
      .sort((a, b) => b.rangePaperCount - a.rangePaperCount);
  }, [topicTrends, filteredTimeline, papersInSelectedRange]);

  // Top 5 topics in range
  const top5Topics = useMemo(() => {
    return topicsInRange.slice(0, 5);
  }, [topicsInRange]);

  // Top Research Topic (Card 2)
  const topResearchTopic = useMemo(() => {
    if (topicsInRange.length > 0 && topicsInRange[0].rangePaperCount > 0) {
      return topicsInRange[0];
    }
    if (topKeywords.length > 0) {
      return { topic: topKeywords[0].term, rangePaperCount: topKeywords[0].paperCount };
    }
    return null;
  }, [topicsInRange, topKeywords]);

  // Emerging Topic (Card 3: only when genuinely identified)
  const emergingTopic = useMemo(() => {
    const genuinelyEmerging = topicsInRange.find(
      (t) =>
        t.isEmerging === true ||
        t.status === 'Newly Observed' ||
        (t.status === 'Increasing' && t.percentagePointDiff >= 15)
    );
    return genuinelyEmerging || null;
  }, [topicsInRange]);

  // Search filter for topics
  const displayedTopics = useMemo(() => {
    const list = showAllTopics ? topicsInRange : top5Topics;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return topicsInRange.filter((t) => t.topic.toLowerCase().includes(q));
  }, [showAllTopics, topicsInRange, top5Topics, searchQuery]);

  // Build Line Chart Datasets for ONE clean chart
  const lineLabels = filteredYears.map(String);
  const lineDatasets = useMemo(() => {
    if (filteredYears.length === 0) return [];

    const datasets = [
      {
        type: 'line',
        label:
          lineChartMetric === 'prevalence'
            ? 'Total Published Benchmark'
            : 'Total Papers Published',
        data:
          lineChartMetric === 'prevalence'
            ? filteredTimeline.map(() => 100)
            : filteredTimeline.map((yt) => yt.paperCount),
        borderColor: '#64748B',
        backgroundColor: 'rgba(100, 116, 139, 0.05)',
        borderDash: [5, 5],
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: '#0B1220',
        pointBorderColor: '#64748B',
        tension: 0.2,
      },
    ];

    selectedKeywords.forEach((kw, i) => {
      const color = KEYWORD_COLORS[i % KEYWORD_COLORS.length];
      const dataPoints = filteredTimeline.map((yt) => {
        if (lineChartMetric === 'prevalence') {
          return (
            yt.keywordPrevalence?.[kw] ??
            (yt.paperCount > 0
              ? Math.round(((yt.keywords?.[kw] || 0) / yt.paperCount) * 100)
              : 0)
          );
        } else if (lineChartMetric === 'occurrences') {
          return yt.keywordOccurrences?.[kw] ?? yt.keywords?.[kw] ?? 0;
        } else {
          return yt.keywords?.[kw] || 0;
        }
      });

      datasets.push({
        type: 'line',
        label: kw,
        data: dataPoints,
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0B1220',
        pointBorderColor: color.border,
        pointBorderWidth: 2,
        tension: 0.3,
        fill: true,
      });
    });

    return datasets;
  }, [filteredYears, filteredTimeline, lineChartMetric, selectedKeywords]);

  const lineData = {
    labels: lineLabels,
    datasets: lineDatasets,
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#94A3B8',
          font: { family: 'Inter', size: 12, weight: '500' },
          usePointStyle: true,
          boxWidth: 7,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#F8FAFC',
        bodyColor: '#94A3B8',
        borderColor: '#26344D',
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        callbacks: {
          title: (items) => `Publication Year: ${items[0]?.label || ''}`,
          label: (context) => {
            const yr = Number(context.label);
            const yt = filteredTimeline.find((t) => t.year === yr);
            const totalInYr = yt ? yt.paperCount : 0;
            if (context.datasetIndex === 0) {
              return lineChartMetric === 'prevalence'
                ? `Benchmark: 100% (${totalInYr} total papers in ${yr})`
                : `Total Papers Published: ${context.parsed.y}`;
            }
            const kw = selectedKeywords[context.datasetIndex - 1];
            const pCount = yt?.keywords?.[kw] || 0;
            const prev =
              yt?.keywordPrevalence?.[kw] ??
              (totalInYr > 0 ? Math.round((pCount / totalInYr) * 100) : 0);
            const occ = yt?.keywordOccurrences?.[kw] ?? pCount;

            if (lineChartMetric === 'paperCount') {
              return `${kw}: ${pCount} paper(s) (${prev}% of ${yr} papers)`;
            } else if (lineChartMetric === 'prevalence') {
              return `${kw}: ${prev}% (${pCount} of ${totalInYr} papers in ${yr})`;
            } else {
              return `${kw}: ${occ} text mention(s) across ${pCount} paper(s)`;
            }
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text:
            lineChartMetric === 'paperCount'
              ? 'Number of Papers'
              : lineChartMetric === 'prevalence'
              ? 'Topic Prevalence (%)'
              : 'Text Mentions',
          color: '#94A3B8',
          font: { family: 'Inter', size: 11, weight: '600' },
        },
        ticks: {
          stepSize: lineChartMetric === 'prevalence' ? 25 : 1,
          font: { family: 'Inter', size: 11 },
          color: '#94A3B8',
        },
        grid: { color: 'rgba(38, 52, 77, 0.4)' },
        border: { display: false },
      },
      x: {
        title: {
          display: true,
          text: 'Publication Year',
          color: '#94A3B8',
          font: { family: 'Inter', size: 11, weight: '600' },
        },
        grid: { display: false },
        border: { display: false },
        ticks: { font: { family: 'Inter', size: 11 }, color: '#94A3B8' },
      },
    },
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto w-full py-16 flex flex-col items-center justify-center min-h-[420px]">
        <RefreshCw size={32} className="text-brand-bright animate-spin mb-4" />
        <h3 className="text-lg font-bold text-text-primary">Loading Research Trends...</h3>
        <p className="text-sm text-text-muted mt-1">Aggregating topic frequencies and publication timelines</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto w-full py-8">
        <Card className="p-8 border-status-error/30 bg-status-error/5">
          <div className="flex items-start gap-4">
            <AlertCircle size={24} className="text-status-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-status-error mb-1">Failed to Load Trend Analysis</h3>
              <p className="text-sm text-text-secondary mb-4">{error}</p>
              <Button onClick={() => loadTrends()} variant="secondary" className="gap-2 text-xs">
                <RefreshCw size={14} /> Try Again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Research Trends</h1>
            {refreshing && (
              <span className="flex items-center gap-1.5 text-xs text-brand-bright font-medium bg-brand-primary/10 px-2.5 py-0.5 rounded-full border border-brand-primary/20">
                <RefreshCw size={11} className="animate-spin" /> Updating Data
              </span>
            )}
          </div>
          <p className="text-sm sm:text-base text-text-muted font-normal">
            Explore how research topics change over time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={handleOpenYearEditor}
            className="gap-2 text-xs font-semibold py-2"
          >
            <Calendar size={14} /> Check Publication Years
          </Button>
          <Button
            variant="secondary"
            onClick={() => loadTrends(true)}
            disabled={refreshing}
            className="gap-2 text-xs font-semibold py-2"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* 2. Filters Bar: From Year / To Year + Quick Search */}
      {distinctYears.length > 0 && (
        <Card className="p-4 mb-6 border-dark-border bg-dark-card/70 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Year Range Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Filter size={13} className="text-brand-bright" />
                Year Range:
              </span>

              <div className="flex items-center gap-2">
                <label className="text-xs text-text-secondary font-medium">From</label>
                <select
                  value={fromYear}
                  onChange={(e) => setFromYear(e.target.value)}
                  className="bg-dark-bg border border-dark-border text-xs text-text-primary rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-primary font-medium"
                >
                  {distinctYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-text-secondary font-medium">To</label>
                <select
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                  className="bg-dark-bg border border-dark-border text-xs text-text-primary rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-primary font-medium"
                >
                  {distinctYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {(fromYear !== String(distinctYears[0]) ||
                toYear !== String(distinctYears[distinctYears.length - 1])) && (
                <button
                  onClick={() => {
                    setFromYear(String(distinctYears[0]));
                    setToYear(String(distinctYears[distinctYears.length - 1]));
                  }}
                  className="text-xs text-brand-bright hover:text-white font-medium ml-1 transition-colors"
                >
                  Reset Years
                </button>
              )}
            </div>

            {/* Quick Topic Search */}
            <div className="relative w-full md:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Filter topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>
        </Card>
      )}

      {/* 3. Summary Cards (2–3 compact cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Papers Analyzed */}
        <Card className="p-5 flex items-center justify-between border-dark-border shadow-sm">
          <div>
            <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
              Papers Analyzed
            </div>
            <div className="text-2xl font-black text-text-primary">
              {filteredTimeline.length > 0 ? papersInSelectedRange : totalEligiblePapers}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {distinctYears.length > 1
                ? `${validMinYear} – ${validMaxYear} timeline`
                : 'Processed project papers'}
            </div>
          </div>
          <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-bright">
            <FileText size={20} />
          </div>
        </Card>

        {/* Card 2: Top Research Topic */}
        <Card className="p-5 flex items-center justify-between border-dark-border shadow-sm">
          <div>
            <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
              Top Research Topic
            </div>
            <div className="text-xl font-bold text-text-primary capitalize truncate max-w-[190px]">
              {topResearchTopic ? topResearchTopic.topic : 'None Yet'}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {topResearchTopic
                ? `${topResearchTopic.rangePaperCount} paper(s) (${topResearchTopic.rangePrevalence || Math.round((topResearchTopic.rangePaperCount / Math.max(1, papersInSelectedRange || totalEligiblePapers)) * 100)}%)`
                : 'Upload papers to identify topics'}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <TrendingUp size={20} />
          </div>
        </Card>

        {/* Card 3: Emerging Topic (only when genuinely identified) */}
        <Card className="p-5 flex items-center justify-between border-dark-border shadow-sm">
          <div>
            <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
              Emerging Topic
            </div>
            <div className="text-xl font-bold text-text-primary capitalize truncate max-w-[190px]">
              {emergingTopic ? emergingTopic.topic : 'Steady Trends'}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {emergingTopic ? (
                <span className="text-brand-bright font-medium">
                  {emergingTopic.status === 'Newly Observed'
                    ? 'Seen in recent papers'
                    : 'Gaining research momentum'}
                </span>
              ) : (
                'Consistent across years'
              )}
            </div>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
            <Sparkles size={20} />
          </div>
        </Card>
      </div>

      {/* Empty State when no papers */}
      {totalEligiblePapers === 0 && (
        <Card className="p-12 text-center border-dashed border-dark-border mb-8">
          <UploadCloud size={44} className="mx-auto text-text-muted mb-3" />
          <h3 className="text-lg font-bold text-text-primary mb-1">No Papers Analyzed Yet</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
            Upload research papers to analyze research topics and observe changes over time.
          </p>
          <Link to={`/projects/${projectId}/upload`}>
            <Button className="gap-2 text-xs">
              <UploadCloud size={15} /> Upload Research Papers
            </Button>
          </Link>
        </Card>
      )}

      {/* 4. Main Content: ONE clean chart & Top 5 Topics */}
      {totalEligiblePapers > 0 && (
        <div className="space-y-6 mb-8">
          {/* ONE Clean, Readable Research Trends Over Time Chart */}
          <Card className="p-6 flex flex-col shadow-sm border-dark-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-text-primary text-lg">Research Trends Over Time</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {filteredYears.length >= 2
                    ? `Comparing topic presence across ${validMinYear} – ${validMaxYear}`
                    : `Topic distribution snapshot for ${filteredYears[0] || 'active dataset'}`}
                </p>
              </div>

              {/* Metric Switcher Controls */}
              <div className="flex items-center gap-1 bg-dark-bg p-1 rounded-lg border border-dark-border self-start sm:self-auto">
                <button
                  onClick={() => setLineChartMetric('paperCount')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    lineChartMetric === 'paperCount'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title="Show number of distinct papers containing the topic in each year"
                >
                  Paper Count
                </button>
                <button
                  onClick={() => setLineChartMetric('prevalence')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    lineChartMetric === 'prevalence'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title="Show percentage of papers published in that year containing the topic"
                >
                  Prevalence (%)
                </button>
                <button
                  onClick={() => setLineChartMetric('occurrences')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    lineChartMetric === 'occurrences'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title="Show raw text mentions across paper contents"
                >
                  Text Mentions
                </button>
              </div>
            </div>

            {/* Keyword selector chips */}
            {topKeywords.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-dark-border">
                <span className="text-xs text-text-muted font-medium mr-1">Display Topics:</span>
                {topKeywords.slice(0, 8).map((kw, i) => {
                  const isSelected = selectedKeywords.includes(kw.term);
                  const color = KEYWORD_COLORS[i % KEYWORD_COLORS.length];
                  return (
                    <button
                      key={kw.term}
                      onClick={() => toggleKeyword(kw.term)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all capitalize ${
                        isSelected
                          ? 'border text-white'
                          : 'bg-dark-elevated text-text-muted hover:text-text-secondary border border-transparent'
                      }`}
                      style={{
                        borderColor: isSelected ? color.border : 'transparent',
                        backgroundColor: isSelected ? color.bg : undefined,
                      }}
                    >
                      {kw.term}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Chart Area */}
            <div className="relative w-full h-[320px] pb-2">
              {filteredYears.length >= 2 ? (
                <Line options={lineOptions} data={lineData} />
              ) : filteredYears.length === 1 ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-dark-bg/40 rounded-xl border border-dark-border">
                  <Calendar size={28} className="text-brand-bright mb-2 opacity-80" />
                  <h4 className="text-sm font-bold text-text-primary mb-1">
                    Single Publication Year ({filteredYears[0]})
                  </h4>
                  <p className="text-xs text-text-muted max-w-sm mb-4">
                    All dated papers in this selection share publication year {filteredYears[0]}. Add papers with different publication years to plot a historical multi-year line.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {topKeywords.slice(0, 5).map((k) => (
                      <span
                        key={k.term}
                        onClick={() => setSelectedTopicDetail(k)}
                        className="text-xs bg-dark-elevated hover:bg-dark-border cursor-pointer px-3 py-1.5 rounded-lg text-text-secondary border border-dark-border font-medium transition-colors"
                      >
                        {k.term}: <strong className="text-text-primary">{k.paperCount} paper(s)</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                  No publication year metadata available to plot timeline.
                </div>
              )}
            </div>
          </Card>

          {/* Top 5 Research Topics (Below Chart) */}
          <Card className="p-6 shadow-sm border-dark-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-dark-border">
              <div>
                <h3 className="font-bold text-text-primary text-base">
                  {showAllTopics ? 'All Research Topics' : 'Top 5 Research Topics'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Most frequent topics in the {validMinYear} – {validMaxYear} publication window
                </p>
              </div>

              {topicsInRange.length > 5 && !searchQuery.trim() && (
                <button
                  onClick={() => setShowAllTopics((prev) => !prev)}
                  className="text-xs text-brand-bright hover:text-white font-semibold transition-colors self-start sm:self-auto"
                >
                  {showAllTopics ? 'Show Top 5 Only' : `View All (${topicsInRange.length}) Topics →`}
                </button>
              )}
            </div>

            {/* Clean Topic List */}
            <div className="divide-y divide-dark-border">
              {displayedTopics.length > 0 ? (
                displayedTopics.map((topicItem, idx) => {
                  const statusVal = topicItem.status || topicItem.badge;
                  const paperCount = topicItem.rangePaperCount ?? topicItem.paperCount;
                  const prevalence = topicItem.rangePrevalence ?? topicItem.prevalencePercentage;

                  return (
                    <div
                      key={topicItem.topic}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-dark-elevated/40 px-2 rounded-lg transition-colors group"
                    >
                      {/* Topic Name & Rank */}
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <span className="w-6 h-6 rounded-full bg-dark-bg border border-dark-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-text-primary capitalize group-hover:text-brand-bright transition-colors">
                            {topicItem.topic}
                          </span>
                          <div className="text-[11px] text-text-muted sm:hidden mt-0.5">
                            {paperCount} paper(s) • {prevalence}%
                          </div>
                        </div>
                      </div>

                      {/* Paper Count Progress */}
                      <div className="hidden sm:flex flex-col w-48">
                        <div className="flex items-center justify-between text-xs text-text-muted mb-1 font-medium">
                          <span>{paperCount} paper(s)</span>
                          <span>{prevalence}%</span>
                        </div>
                        <ProgressBar
                          progress={prevalence}
                          colorClass={
                            statusVal === 'Increasing'
                              ? 'bg-status-success'
                              : statusVal === 'Newly Observed'
                              ? 'bg-brand-primary'
                              : statusVal === 'Decreasing'
                              ? 'bg-status-error'
                              : 'bg-purple-500'
                          }
                        />
                      </div>

                      {/* Trend Direction Badge */}
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <div>
                          {statusVal === 'Increasing' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-success bg-status-success/10 px-2.5 py-1 rounded-full border border-status-success/20">
                              <TrendingUp size={12} /> Increasing
                            </span>
                          ) : statusVal === 'Decreasing' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-error bg-status-error/10 px-2.5 py-1 rounded-full border border-status-error/20">
                              <TrendingDown size={12} /> Decreasing
                            </span>
                          ) : statusVal === 'Newly Observed' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-bright bg-brand-primary/10 px-2.5 py-1 rounded-full border border-brand-primary/20">
                              <Sparkles size={12} /> Newly Observed
                            </span>
                          ) : statusVal === 'Stable' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                              <Minus size={12} /> Stable
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted bg-dark-bg px-2.5 py-1 rounded-full border border-dark-border">
                              Consistent
                            </span>
                          )}
                        </div>

                        {/* View Papers Button */}
                        <button
                          onClick={() => setSelectedTopicDetail(topicItem)}
                          className="text-xs text-brand-bright hover:text-white font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-brand-primary/15 transition-colors"
                        >
                          View Papers <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-text-muted">
                  No topics matching "{searchQuery}".
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* PAPER-LEVEL TOPIC DETAILS MODAL */}
      {selectedTopicDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-dark-border bg-dark-bg/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-bright">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary capitalize">
                    {selectedTopicDetail.topic}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Papers containing this research topic in your project
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTopicDetail(null)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-dark-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Metric Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">
                  <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
                    Papers With Topic
                  </div>
                  <div className="text-base font-black text-text-primary">
                    {selectedTopicDetail.rangePaperCount ?? selectedTopicDetail.paperCount}{' '}
                    <span className="text-xs text-text-muted font-normal">
                      / {papersInSelectedRange || totalEligiblePapers} papers
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">
                  <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
                    Text Mentions
                  </div>
                  <div className="text-base font-black text-text-primary">
                    {selectedTopicDetail.rangeOccurrences ?? selectedTopicDetail.occurrenceCount ?? selectedTopicDetail.paperCount}
                  </div>
                </div>
              </div>

              {/* Real Papers List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Paper Records
                </h4>
                {selectedTopicDetail.papers && selectedTopicDetail.papers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTopicDetail.papers.map((p, idx) => (
                      <div
                        key={p.paperId || idx}
                        className="p-3 bg-dark-bg rounded-xl border border-dark-border text-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text-primary truncate">
                            {p.title || p.originalFilename}
                          </div>
                          {p.publicationYear && (
                            <div className="text-[11px] text-text-muted mt-0.5">
                              Year: {p.publicationYear}
                            </div>
                          )}
                        </div>
                        {p.occurrences && (
                          <span className="text-[11px] bg-dark-elevated px-2 py-0.5 rounded border border-dark-border text-text-muted shrink-0">
                            {p.occurrences} mention(s)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-dark-bg rounded-xl border border-dark-border text-xs text-text-muted text-center">
                    Document matches found in processed corpus text.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-dark-bg/40 border-t border-dark-border flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedTopicDetail(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLICATION YEAR EDITOR MODAL */}
      {showYearEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between p-5 border-b border-dark-border bg-dark-bg/60">
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-brand-bright" />
                <h3 className="text-base font-bold text-text-primary">
                  Publication Year Metadata
                </h3>
              </div>
              <button
                onClick={() => setShowYearEditor(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-dark-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-text-muted leading-relaxed">
                Publication years are extracted from paper headers or metadata. You can confirm or update publication years below to align the timeline.
              </p>

              {editSuccessMsg && (
                <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-xs text-status-success flex items-center gap-2 font-medium">
                  <CheckCircle2 size={14} /> {editSuccessMsg}
                </div>
              )}

              <div className="space-y-2">
                {trendData?.allProjectPapers && trendData.allProjectPapers.length > 0 ? (
                  trendData.allProjectPapers.map((paper) => (
                    <div
                      key={paper.id}
                      className="p-3 bg-dark-bg rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-text-primary truncate">
                          {paper.title || paper.originalFilename}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {paper.publicationYear ? `Extracted Year: ${paper.publicationYear}` : 'Year missing'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          placeholder="YYYY"
                          min="1900"
                          max="2100"
                          value={editingYears[paper.id] || ''}
                          onChange={(e) =>
                            setEditingYears({ ...editingYears, [paper.id]: e.target.value })
                          }
                          className="w-20 px-2 py-1 bg-dark-card border border-dark-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-primary"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSavePaperYear(paper.id)}
                          disabled={savingPaperId === paper.id}
                          className="text-xs py-1"
                        >
                          {savingPaperId === paper.id ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-text-muted py-4 text-center">
                    No papers found in this project.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-dark-bg/40 border-t border-dark-border flex justify-end">
              <Button variant="secondary" onClick={() => setShowYearEditor(false)} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

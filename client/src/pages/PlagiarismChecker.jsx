import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  History,
  X,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Layers,
  ArrowRight,
  CheckSquare,
  Square,
  FileCheck2,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchApi, API_BASE_URL } from '../utils/api';

const MAX_PDF_SIZE_MB = 25;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
const MAX_PAPERS_TOTAL = 10;
const MAX_COMPARISONS_LIMIT = 20;

// Simple stage mapping
const getSimpleStatusLabel = (status, currentStage) => {
  if (currentStage) {
    const s = currentStage.toLowerCase();
    if (s.includes('reading') || s.includes('extract')) return 'Reading Papers';
    if (s.includes('comparing')) return 'Comparing Selected Pairs';
    if (s.includes('preparing') || s.includes('verifying')) return 'Preparing Results';
    if (s.includes('waiting') || s.includes('queued')) return 'Waiting in Queue';
    if (s.includes('completed')) return 'Completed';
    if (s.includes('failed')) return 'Failed';
  }
  if (status === 'QUEUED') return 'Waiting in Queue';
  if (status === 'EXTRACTING') return 'Reading Papers';
  if (status === 'COMPARING') return 'Comparing Selected Pairs';
  if (status === 'VERIFYING') return 'Preparing Results';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'FAILED') return 'Failed';
  return status || 'Processing';
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function PlagiarismChecker() {
  const { projectId } = useParams();
  const fileInputRef = useRef(null);

  // Existing project papers
  const [papers, setPapers] = useState([]);
  const [selectedExistingIds, setSelectedExistingIds] = useState(new Set());

  // Uploaded PDFs queue
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  // Selected Comparison Pairs keys
  const [selectedComparisonKeys, setSelectedComparisonKeys] = useState(new Set());

  // Configuration options
  const [excludeQuotes, setExcludeQuotes] = useState(true);
  const [excludeReferences, setExcludeReferences] = useState(true);

  // Active Scan & Polling
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanId, setActiveScanId] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  // Expandable cards & filters in results
  const [expandedPairs, setExpandedPairs] = useState(new Set());
  const [matchTypeFilter, setMatchTypeFilter] = useState('ALL'); // 'ALL' | 'EXACT'

  // History Drawer
  const [showHistory, setShowHistory] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingScanId, setDeletingScanId] = useState(null);

  // Filter completed eligible papers in project
  const eligiblePapers = useMemo(() => {
    return papers.filter((p) => p.status === 'COMPLETED');
  }, [papers]);

  // Load project papers
  useEffect(() => {
    if (!projectId) return;
    const loadProjectPapers = async () => {
      try {
        const data = await fetchApi(`/api/projects/${projectId}/papers`);
        const list = Array.isArray(data) ? data : [];
        setPapers(list);
      } catch (err) {
        console.error('Failed to load project papers:', err);
      }
    };
    loadProjectPapers();
  }, [projectId]);

  // Load scan history
  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      setHistoryLoading(true);
      const res = await fetchApi(`/api/projects/${projectId}/plagiarism/scans`);
      setScanHistory(res?.scans || []);
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Poll active scan status
  useEffect(() => {
    if (!activeScanId || !isScanning) return;
    let timer;
    const poll = async () => {
      try {
        const statusData = await fetchApi(
          `/api/projects/${projectId}/plagiarism/scans/${activeScanId}`
        );
        setScanStatus(statusData);

        if (statusData.status === 'COMPLETED') {
          setIsScanning(false);
          const resultData = await fetchApi(
            `/api/projects/${projectId}/plagiarism/scans/${activeScanId}/results`
          );
          setScanResult(resultData);
          loadHistory();
        } else if (statusData.status === 'FAILED') {
          setIsScanning(false);
          setScanError(statusData.error || 'Scan failed. Please try again.');
        } else {
          timer = setTimeout(poll, 1200);
        }
      } catch (err) {
        console.error('Polling error:', err);
        timer = setTimeout(poll, 2500);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, [activeScanId, isScanning, projectId, loadHistory]);

  // Handle toggling an existing paper
  const handleToggleExistingPaper = (paperId) => {
    setSelectedExistingIds((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        if (next.size + uploadedFiles.length >= MAX_PAPERS_TOTAL) {
          alert(`You can select a maximum of ${MAX_PAPERS_TOTAL} papers in total.`);
          return prev;
        }
        next.add(paperId);
      }
      return next;
    });
  };

  // Select all eligible existing papers
  const handleSelectAllExisting = () => {
    const availableSlots = MAX_PAPERS_TOTAL - uploadedFiles.length;
    if (availableSlots <= 0) {
      alert(`Maximum of ${MAX_PAPERS_TOTAL} papers reached.`);
      return;
    }
    const idsToSelect = eligiblePapers.slice(0, availableSlots).map((p) => p._id);
    setSelectedExistingIds(new Set(idsToSelect));
  };

  // Clear all existing paper selections
  const handleClearExisting = () => {
    setSelectedExistingIds(new Set());
  };

  // Handle file uploads
  const handleFilesSelected = (e) => {
    setUploadError(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validNewFiles = [];
    const seenNames = new Set(uploadedFiles.map((f) => f.name.toLowerCase()));

    for (const f of files) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        setUploadError(`"${f.name}" is not a valid PDF file.`);
        continue;
      }
      if (f.size > MAX_PDF_SIZE_BYTES) {
        setUploadError(`"${f.name}" exceeds the maximum size of ${MAX_PDF_SIZE_MB}MB.`);
        continue;
      }
      if (seenNames.has(f.name.toLowerCase())) {
        continue; // deduplicate
      }
      seenNames.add(f.name.toLowerCase());

      validNewFiles.push({
        id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
        status: 'Ready',
      });
    }

    if (selectedExistingIds.size + uploadedFiles.length + validNewFiles.length > MAX_PAPERS_TOTAL) {
      alert(`You can compare a maximum of ${MAX_PAPERS_TOTAL} papers in total.`);
      return;
    }

    setUploadedFiles((prev) => [...prev, ...validNewFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove a pending uploaded file
  const handleRemoveUploadedFile = (id) => {
    setUploadedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Unified list of all selected documents
  const allCombinedPapers = useMemo(() => {
    const list = [];
    selectedExistingIds.forEach((id) => {
      const p = papers.find((item) => item._id === id);
      if (p) {
        list.push({
          id: p._id,
          key: p._id,
          title: p.title || p.originalFilename || 'Untitled Paper',
          filename: p.originalFilename || p.storedFilename,
          isUploaded: false,
        });
      }
    });

    uploadedFiles.forEach((f) => {
      list.push({
        id: f.id,
        key: f.id,
        title: f.name.replace(/\.pdf$/i, ''),
        filename: f.name,
        size: f.size,
        file: f.file,
        isUploaded: true,
      });
    });

    return list;
  }, [selectedExistingIds, papers, uploadedFiles]);

  // Generate all unique paper combinations: N * (N - 1) / 2
  const availableComparisons = useMemo(() => {
    const pairs = [];
    const n = allCombinedPapers.length;
    if (n < 2) return pairs;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const pA = allCombinedPapers[i];
        const pB = allCombinedPapers[j];
        const pairKey = `${pA.key}___${pB.key}`;
        pairs.push({
          pairKey,
          paperA: pA,
          paperB: pB,
        });
      }
    }
    return pairs;
  }, [allCombinedPapers]);

  // Keep selected comparisons synchronized when papers are added or removed
  useEffect(() => {
    setSelectedComparisonKeys((prev) => {
      const next = new Set();
      const availableKeySet = new Set(availableComparisons.map((p) => p.pairKey));
      prev.forEach((k) => {
        if (availableKeySet.has(k)) next.add(k);
      });
      // Default: if no comparisons previously selected and available pairs exist, select all available
      if (next.size === 0 && availableComparisons.length > 0) {
        availableComparisons.forEach((p) => next.add(p.pairKey));
      }
      return next;
    });
  }, [availableComparisons]);

  // Toggle individual comparison pair
  const handleToggleComparison = (pairKey) => {
    setSelectedComparisonKeys((prev) => {
      const next = new Set(prev);
      if (next.has(pairKey)) {
        next.delete(pairKey);
      } else {
        if (next.size >= MAX_COMPARISONS_LIMIT) {
          alert(`You can select a maximum of ${MAX_COMPARISONS_LIMIT} comparisons at once.`);
          return prev;
        }
        next.add(pairKey);
      }
      return next;
    });
  };

  // Select all comparison pairs
  const handleSelectAllComparisons = () => {
    if (availableComparisons.length > MAX_COMPARISONS_LIMIT) {
      alert(`Selecting the first ${MAX_COMPARISONS_LIMIT} comparisons (maximum scan limit).`);
      setSelectedComparisonKeys(
        new Set(availableComparisons.slice(0, MAX_COMPARISONS_LIMIT).map((p) => p.pairKey))
      );
      return;
    }
    setSelectedComparisonKeys(new Set(availableComparisons.map((p) => p.pairKey)));
  };

  // Clear all comparison selections
  const handleClearComparisons = () => {
    setSelectedComparisonKeys(new Set());
  };

  // Start Plagiarism Scan
  const handleStartScan = async () => {
    if (selectedComparisonKeys.size === 0) {
      alert('Please select at least one comparison pair to scan.');
      return;
    }

    const chosenPairs = availableComparisons
      .filter((c) => selectedComparisonKeys.has(c.pairKey))
      .map((c, idx) => ({
        pairId: `pair_${idx + 1}`,
        paperAId: c.paperA.isUploaded ? c.paperA.filename : c.paperA.id,
        paperBId: c.paperB.isUploaded ? c.paperB.filename : c.paperB.id,
        paperATitle: c.paperA.title,
        paperBTitle: c.paperB.title,
        paperAFilename: c.paperA.filename,
        paperBFilename: c.paperB.filename,
      }));

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const formData = new FormData();

      // Existing paper IDs
      const existingIdsArr = Array.from(selectedExistingIds);
      if (existingIdsArr.length > 0) {
        formData.append('paperIds', JSON.stringify(existingIdsArr));
      }

      // Uploaded PDF files
      uploadedFiles.forEach((f) => {
        formData.append('pdfs', f.file, f.name);
      });

      // Explicitly chosen comparisons
      formData.append('selectedPairs', JSON.stringify(chosenPairs));

      // Exclusions
      formData.append('excludeQuotes', String(excludeQuotes));
      formData.append('excludeReferences', String(excludeReferences));

      const token = localStorage.getItem('token') || '';
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/plagiarism/scan`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start plagiarism scan');
      }

      setActiveScanId(data.scanId);
      setScanStatus({ status: 'QUEUED', progress: 5, currentStage: 'Waiting' });
    } catch (err) {
      console.error('Error starting plagiarism scan:', err);
      setScanError(err.message || 'Error initiating scan');
      setIsScanning(false);
    }
  };

  // Toggle pair expanded details in results
  const togglePairExpanded = (pairId) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(pairId)) next.delete(pairId);
      else next.add(pairId);
      return next;
    });
  };

  // Delete history scan
  const handleDeleteScan = async (scanId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this scan record?')) return;
    try {
      setDeletingScanId(scanId);
      await fetchApi(`/api/projects/${projectId}/plagiarism/scans/${scanId}`, {
        method: 'DELETE',
      });
      setScanHistory((prev) => prev.filter((s) => s.id !== scanId));
      if (activeScanId === scanId) {
        setScanResult(null);
        setActiveScanId(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete scan record');
    } finally {
      setDeletingScanId(null);
    }
  };

  // Load a past scan result
  const handleSelectPastScan = async (pastScan) => {
    setShowHistory(false);
    setActiveScanId(pastScan.id);
    setIsScanning(false);
    try {
      const res = await fetchApi(
        `/api/projects/${projectId}/plagiarism/scans/${pastScan.id}/results`
      );
      setScanResult(res);
      setScanStatus({ status: 'COMPLETED', progress: 100, currentStage: 'Completed' });
    } catch (err) {
      alert(err.message || 'Failed to load scan findings');
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Plagiarism Checker</h1>
          </div>
          <p className="text-sm sm:text-base text-text-muted font-normal">
            Select multiple papers and choose exact comparisons to check for matching text passages.
          </p>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-dark-card hover:bg-dark-elevated text-text-secondary hover:text-text-primary text-xs font-semibold rounded-xl border border-dark-border transition-colors self-start sm:self-auto shadow-sm"
        >
          <History size={15} />
          <span>Scan History</span>
          {scanHistory.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-brand-primary/20 text-brand-bright rounded-full text-[10px] font-bold">
              {scanHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {scanError && (
        <div className="mb-6 p-4 bg-status-error/10 border border-status-error/30 rounded-xl flex items-start justify-between text-xs text-status-error animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>{scanError}</span>
          </div>
          <button onClick={() => setScanError(null)} className="text-status-error hover:opacity-80 p-0.5">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. SECTION 1: SELECT PAPERS TO COMPARE */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-brand-bright" />
            <h2 className="text-lg font-bold text-text-primary">Select Papers to Compare</h2>
          </div>
          <span className="text-xs font-semibold text-text-muted">
            {allCombinedPapers.length} / {MAX_PAPERS_TOTAL} papers selected
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sub-panel A: Select Existing Papers */}
          <Card className="p-5 border-dark-border flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-dark-border mb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 size={16} className="text-brand-bright" />
                  <h3 className="font-bold text-text-primary text-sm">Existing Project Papers</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllExisting}
                    disabled={isScanning || eligiblePapers.length === 0}
                    className="text-[11px] text-brand-bright hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted text-[11px]">•</span>
                  <button
                    type="button"
                    onClick={handleClearExisting}
                    disabled={isScanning || selectedExistingIds.size === 0}
                    className="text-[11px] text-text-muted hover:text-text-primary font-medium"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {eligiblePapers.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {eligiblePapers.map((p) => {
                    const isSelected = selectedExistingIds.has(p._id);
                    return (
                      <div
                        key={p._id}
                        onClick={() => !isScanning && handleToggleExistingPaper(p._id)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-brand-primary/10 border-brand-primary/40'
                            : 'bg-dark-bg/60 border-dark-border hover:border-dark-border/80 hover:bg-dark-bg'
                        }`}
                      >
                        <div className="pt-0.5 text-brand-bright">
                          {isSelected ? (
                            <CheckSquare size={15} className="text-brand-bright" />
                          ) : (
                            <Square size={15} className="text-text-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text-primary truncate">
                            {p.title || p.originalFilename}
                          </div>
                          <div className="text-[11px] text-text-muted truncate mt-0.5">
                            {p.originalFilename} {p.publicationYear ? `• ${p.publicationYear}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-text-muted">
                  No completed papers found in this project. Upload new PDFs on the right.
                </div>
              )}
            </div>

            <div className="pt-3 text-[11px] text-text-muted border-t border-dark-border mt-3 flex justify-between">
              <span>{selectedExistingIds.size} existing paper(s) chosen</span>
              <span>Total available: {eligiblePapers.length}</span>
            </div>
          </Card>

          {/* Sub-panel B: Upload New PDFs */}
          <Card className="p-5 border-dark-border flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-dark-border mb-3">
                <div className="flex items-center gap-2">
                  <UploadCloud size={16} className="text-purple-400" />
                  <h3 className="font-bold text-text-primary text-sm">Upload New PDFs</h3>
                </div>
                {uploadedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="text-[11px] text-purple-400 hover:text-white font-semibold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add more
                  </button>
                )}
              </div>

              {/* Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf"
                onChange={handleFilesSelected}
                disabled={isScanning}
                className="hidden"
              />

              <div
                onClick={() => !isScanning && fileInputRef.current?.click()}
                className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors mb-3 ${
                  isScanning
                    ? 'border-dark-border opacity-50 cursor-not-allowed'
                    : 'border-dark-border hover:border-purple-500 bg-dark-bg/40 hover:bg-dark-bg'
                }`}
              >
                <UploadCloud size={24} className="text-purple-400 mb-1" />
                <span className="text-xs font-semibold text-text-primary">
                  Click to select PDF file(s)
                </span>
                <span className="text-[11px] text-text-muted mt-0.5">
                  Select multiple PDFs up to {MAX_PDF_SIZE_MB}MB each
                </span>
              </div>

              {uploadError && (
                <div className="p-2 mb-3 bg-status-error/10 border border-status-error/30 rounded-lg text-[11px] text-status-error">
                  {uploadError}
                </div>
              )}

              {/* Uploaded Files Queue */}
              {uploadedFiles.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2 bg-dark-bg rounded-lg border border-dark-border text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText size={13} className="text-purple-400 shrink-0" />
                        <span className="font-medium text-text-primary truncate">{f.name}</span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          ({formatFileSize(f.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedFile(f.id)}
                        disabled={isScanning}
                        className="text-text-muted hover:text-status-error p-1 transition-colors"
                        title="Remove file"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-text-muted">
                  No new PDF files queued for upload.
                </div>
              )}
            </div>

            <div className="pt-3 text-[11px] text-text-muted border-t border-dark-border mt-3 flex justify-between">
              <span>{uploadedFiles.length} file(s) queued</span>
              <span>Limit: 25MB per PDF</span>
            </div>
          </Card>
        </div>

        {/* Selected Papers Pool Summary Badge */}
        <div className="mt-4 p-3 bg-dark-bg rounded-xl border border-dark-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-status-success shrink-0" />
            <span className="text-text-primary font-semibold">
              Selected Pool: {allCombinedPapers.length} distinct paper{allCombinedPapers.length === 1 ? '' : 's'}
            </span>
            <span className="text-text-muted">
              ({selectedExistingIds.size} existing, {uploadedFiles.length} uploaded)
            </span>
          </div>
          {allCombinedPapers.length < 2 && (
            <span className="text-text-muted italic">
              Please select at least 2 distinct papers to configure comparisons.
            </span>
          )}
        </div>
      </div>

      {/* 3. SECTION 2: CHOOSE EXACTLY WHICH PAPERS TO COMPARE */}
      {allCombinedPapers.length >= 2 && (
        <Card className="p-6 mb-8 border-dark-border shadow-md animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-dark-border mb-4 gap-2">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <span>Choose Comparisons</span>
                <Badge variant="primary" className="text-[11px]">
                  {selectedComparisonKeys.size} of {availableComparisons.length} Selected
                </Badge>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Choose the exact paper combinations you want to compare. Unselected pairs will not be scanned.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllComparisons}
                disabled={isScanning || availableComparisons.length === 0}
                className="text-xs text-brand-bright hover:underline font-semibold"
              >
                Select All Comparisons
              </button>
              <span className="text-text-muted text-xs">•</span>
              <button
                type="button"
                onClick={handleClearComparisons}
                disabled={isScanning || selectedComparisonKeys.size === 0}
                className="text-xs text-text-muted hover:text-text-primary font-medium"
              >
                Clear Comparisons
              </button>
            </div>
          </div>

          {/* List of Available Comparison Pairs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-h-72 overflow-y-auto pr-1">
            {availableComparisons.map((c) => {
              const isChecked = selectedComparisonKeys.has(c.pairKey);
              return (
                <div
                  key={c.pairKey}
                  onClick={() => !isScanning && handleToggleComparison(c.pairKey)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center gap-3 ${
                    isChecked
                      ? 'bg-brand-primary/10 border-brand-primary/50 text-text-primary shadow-sm'
                      : 'bg-dark-bg border-dark-border text-text-muted hover:border-dark-border/80 hover:bg-dark-elevated/40'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    {isChecked ? (
                      <CheckSquare size={16} className="text-brand-bright" />
                    ) : (
                      <Square size={16} className="text-text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-text-primary truncate">
                        {c.paperA.title}
                      </span>
                      {c.paperA.isUploaded && (
                        <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[9px] font-bold shrink-0">
                          PDF
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-text-muted my-0.5">
                      <ArrowRight size={11} className="text-brand-bright shrink-0" />
                      <span>compared against</span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-text-primary truncate">
                        {c.paperB.title}
                      </span>
                      {c.paperB.isUploaded && (
                        <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[9px] font-bold shrink-0">
                          PDF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scan Options and Launch Button */}
          <div className="pt-4 border-t border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-5 text-xs text-text-muted">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeQuotes}
                  onChange={(e) => setExcludeQuotes(e.target.checked)}
                  disabled={isScanning}
                  className="rounded border-dark-border text-brand-primary focus:ring-0"
                />
                <span>Exclude Quotes</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeReferences}
                  onChange={(e) => setExcludeReferences(e.target.checked)}
                  disabled={isScanning}
                  className="rounded border-dark-border text-brand-primary focus:ring-0"
                />
                <span>Exclude References</span>
              </label>
            </div>

            <Button
              onClick={handleStartScan}
              disabled={isScanning || selectedComparisonKeys.size === 0}
              variant="primary"
              className="px-6 py-2.5 text-xs font-bold shrink-0 shadow-lg shadow-brand-primary/20"
            >
              {isScanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin mr-2" />
                  <span>Processing Scans...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} className="mr-2" />
                  <span>
                    Start Plagiarism Scan ({selectedComparisonKeys.size} comparison
                    {selectedComparisonKeys.size === 1 ? '' : 's'})
                  </span>
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* 4. LIVE SCANNING PROGRESS CARD */}
      {isScanning && scanStatus && (
        <Card className="p-6 mb-8 border-brand-primary/30 bg-brand-primary/5 shadow-md animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <RefreshCw size={16} className="text-brand-bright animate-spin" />
              <span className="text-sm font-bold text-text-primary">
                {getSimpleStatusLabel(scanStatus.status, scanStatus.currentStage)}
              </span>
            </div>
            <span className="text-xs font-bold text-brand-bright">
              {scanStatus.progress || 10}%
            </span>
          </div>

          <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-brand-primary transition-all duration-300"
              style={{ width: `${scanStatus.progress || 10}%` }}
            />
          </div>

          <p className="text-xs text-text-muted">
            Analyzing document text and cross-comparing passage shingles for each selected pair...
          </p>
        </Card>
      )}

      {/* 5. DETAILED MATCH REPORT (Completed Scan) */}
      {scanResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 border-dark-border shadow-sm">
              <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
                Papers Selected
              </div>
              <div className="text-2xl font-black text-brand-bright">
                {scanResult.totalSelectedPapers || scanResult.selectedPapers?.length || 2}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">Documents in pool</div>
            </Card>

            <Card className="p-4 border-dark-border shadow-sm">
              <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
                Comparisons Executed
              </div>
              <div className="text-2xl font-black text-purple-400">
                {scanResult.totalComparisonsCompleted || scanResult.pairwiseComparisons?.length || 1}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">Chosen pairs checked</div>
            </Card>

            <Card className="p-4 border-dark-border shadow-sm">
              <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
                Highest Match %
              </div>
              <div
                className={`text-2xl font-black ${
                  (scanResult.matchPercentage || 0) > 20
                    ? 'text-status-error'
                    : (scanResult.matchPercentage || 0) > 0
                    ? 'text-status-warning'
                    : 'text-status-success'
                }`}
              >
                {scanResult.matchPercentage !== null && scanResult.matchPercentage !== undefined
                  ? `${scanResult.matchPercentage}%`
                  : '0%'}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">Max pair similarity</div>
            </Card>

            <Card className="p-4 border-dark-border shadow-sm">
              <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider mb-1">
                Matched Passages
              </div>
              <div className="text-2xl font-black text-text-primary">
                {scanResult.matchingPassageCount || scanResult.matchingPassages?.length || 0}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">Total across pairs</div>
            </Card>
          </div>

          {/* Academic Integrity Notice */}
          <div className="p-4 bg-dark-card border border-dark-border rounded-xl text-xs text-text-muted flex items-start gap-2.5">
            <Info size={16} className="text-brand-bright shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-text-primary mr-1">Academic Integrity Note:</strong>
              These results show matching text between the selected papers. A match does not automatically mean plagiarism.
              Always review context, quotations, and common academic formulas.
            </div>
          </div>

          {/* Filter Bar for Match Types */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <h2 className="text-lg font-bold text-text-primary">
              Comparison Findings ({scanResult.pairwiseComparisons?.length || 0} Pair
              {scanResult.pairwiseComparisons?.length === 1 ? '' : 's'})
            </h2>

            <div className="flex items-center gap-1.5 bg-dark-bg p-1 rounded-lg border border-dark-border text-xs">
              <button
                onClick={() => setMatchTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  matchTypeFilter === 'ALL'
                    ? 'bg-brand-primary text-white font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                All Matches
              </button>
              <button
                onClick={() => setMatchTypeFilter('EXACT')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  matchTypeFilter === 'EXACT'
                    ? 'bg-brand-primary text-white font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Exact Only
              </button>
            </div>
          </div>

          {/* Detailed Pairwise Comparison Cards */}
          <div className="space-y-4">
            {scanResult.pairwiseComparisons && scanResult.pairwiseComparisons.length > 0 ? (
              scanResult.pairwiseComparisons.map((pair, pIdx) => {
                const pairKey = pair.pairId || `pair_${pIdx}`;
                const isExpanded = expandedPairs.has(pairKey);

                // Filter passages by selected match type
                const displayedPassages = (pair.matchingPassages || []).filter((m) => {
                  if (matchTypeFilter === 'EXACT') return m.matchType === 'EXACT';
                  return true;
                });

                const isFailed = pair.status === 'FAILED';

                return (
                  <Card
                    key={pairKey}
                    className="p-5 border-dark-border shadow-sm hover:border-dark-border/80 transition-all"
                  >
                    {/* Pair Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dark-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                          <span className="font-bold text-brand-bright bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                            Paper A: {pair.paperA?.title}
                          </span>
                          <span className="text-text-muted font-bold">vs</span>
                          <span className="font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                            Paper B: {pair.paperB?.title}
                          </span>
                        </div>

                        {/* Separate Paper A and Paper B Match % */}
                        {!isFailed && (
                          <div className="text-[11px] text-text-muted flex items-center gap-3 mt-1.5">
                            <span>
                              Paper A Match:{' '}
                              <strong className="text-text-primary">
                                {pair.paperAMatchPercentage !== undefined
                                  ? `${pair.paperAMatchPercentage}%`
                                  : `${pair.matchPercentage}%`}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Paper B Match:{' '}
                              <strong className="text-text-primary">
                                {pair.paperBMatchPercentage !== undefined
                                  ? `${pair.paperBMatchPercentage}%`
                                  : `${pair.matchPercentage}%`}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isFailed ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-status-error/10 text-status-error border-status-error/20">
                            Failed Processing
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                              pair.matchPercentage > 20
                                ? 'bg-status-error/10 text-status-error border-status-error/20'
                                : pair.matchPercentage > 0
                                ? 'bg-status-warning/10 text-status-warning border-status-warning/20'
                                : 'bg-status-success/10 text-status-success border-status-success/20'
                            }`}
                          >
                            {pair.matchPercentage}% Match ({pair.matchingPassageCount || 0} passage
                            {pair.matchingPassageCount === 1 ? '' : 's'})
                          </span>
                        )}

                        {!isFailed && pair.matchPercentage > 0 && (
                          <button
                            type="button"
                            onClick={() => togglePairExpanded(pairKey)}
                            className="text-xs text-brand-bright hover:text-white font-medium flex items-center gap-1 transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Evidence' : 'View Evidence'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Failed Error Message */}
                    {isFailed && (
                      <div className="pt-3 text-xs text-status-error flex items-center gap-1.5 font-medium">
                        <AlertCircle size={14} />
                        <span>{pair.error || 'Failed to extract text from one or more documents in this pair.'}</span>
                      </div>
                    )}

                    {/* Zero Matches Notification */}
                    {!isFailed && pair.matchPercentage === 0 && (
                      <div className="pt-3 text-xs text-status-success flex items-center gap-1.5 font-medium">
                        <CheckCircle size={14} />
                        <span>No matching text was found between these two papers.</span>
                      </div>
                    )}

                    {/* Passages List */}
                    {isExpanded && !isFailed && pair.matchPercentage > 0 && (
                      <div className="pt-4 space-y-3.5 animate-fadeIn">
                        {displayedPassages.length > 0 ? (
                          displayedPassages.map((passage, passIdx) => (
                            <div
                              key={passage.passageId || passIdx}
                              className="p-4 bg-dark-bg rounded-xl border border-dark-border text-xs space-y-2.5"
                            >
                              {/* Passage Reference Banner */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dark-border/60">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="font-bold text-brand-bright">
                                    Paper A: {pair.paperA?.title}
                                  </span>
                                  <span className="text-text-muted">
                                    (Page: {passage.submittedPageNumber || 'Page unavailable'}, Section:{' '}
                                    {passage.submittedSection || 'General'})
                                  </span>
                                  <span className="text-text-muted font-bold">↔</span>
                                  <span className="font-bold text-purple-300">
                                    Paper B: {pair.paperB?.title}
                                  </span>
                                  <span className="text-text-muted">
                                    (Page: {passage.sourcePageNumber || 'Page unavailable'}, Section:{' '}
                                    {passage.sourceSection || 'General'})
                                  </span>
                                </div>

                                <Badge variant={passage.matchType === 'EXACT' ? 'error' : 'warning'}>
                                  {passage.matchType === 'EXACT' ? 'Exact Phrase' : 'Similar Text'}
                                </Badge>
                              </div>

                              {/* Side-by-Side Highlighted Passages */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Paper A Text */}
                                <div className="p-3 bg-brand-primary/5 rounded-lg border-l-3 border-brand-bright">
                                  <div className="text-[10px] uppercase font-bold text-brand-bright tracking-wider mb-1">
                                    Paper A Matched Text:
                                  </div>
                                  <p className="text-xs text-text-primary leading-relaxed font-normal">
                                    "{passage.submittedText}"
                                  </p>
                                </div>

                                {/* Paper B Text */}
                                <div className="p-3 bg-purple-500/5 rounded-lg border-l-3 border-purple-400">
                                  <div className="text-[10px] uppercase font-bold text-purple-300 tracking-wider mb-1">
                                    Paper B Corresponding Text:
                                  </div>
                                  <p className="text-xs text-text-primary leading-relaxed font-normal">
                                    "{passage.sourceText}"
                                  </p>
                                </div>
                              </div>

                              <div className="text-[10px] text-text-muted pt-1">
                                {passage.matchedTokenCount || 7} words matched •{' '}
                                {Math.round((passage.similarityScore || 1) * 100)}% match confidence
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs text-text-muted">
                            No passages matching filter "{matchTypeFilter}".
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <Card className="p-8 text-center border-dark-border">
                <p className="text-xs text-text-muted">
                  No matching text detected between the selected comparison pairs.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 6. SCAN HISTORY DRAWER */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-dark-card border-l border-dark-border h-full flex flex-col p-6 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-dark-border mb-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-brand-bright" />
                <h3 className="font-bold text-text-primary text-base">Past Comparison Scans</h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-dark-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {historyLoading ? (
                <div className="py-12 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-brand-bright" />
                  <span>Loading history...</span>
                </div>
              ) : scanHistory.length > 0 ? (
                scanHistory.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleSelectPastScan(h)}
                    className="p-3.5 bg-dark-bg hover:bg-dark-elevated/70 rounded-xl border border-dark-border cursor-pointer transition-colors space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-text-primary text-xs truncate">
                        {h.paperTitle}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteScan(h.id, e)}
                        disabled={deletingScanId === h.id}
                        className="text-text-muted hover:text-status-error p-1 transition-colors"
                        title="Delete scan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                      <span
                        className={`font-bold ${
                          (h.matchPercentage || 0) > 20
                            ? 'text-status-error'
                            : (h.matchPercentage || 0) > 0
                            ? 'text-status-warning'
                            : 'text-status-success'
                        }`}
                      >
                        {h.matchPercentage !== null && h.matchPercentage !== undefined
                          ? `${h.matchPercentage}% match`
                          : 'Completed'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-text-muted">
                  No past comparison scans recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

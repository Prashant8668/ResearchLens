import React, { useState, useRef, useCallback, useContext, useEffect } from 'react';
import { UploadCloud, FileText, ChevronRight, X, RefreshCw, CheckCircle, AlertCircle, Loader, Copy, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/api';

const MAX_PDF_SIZE_MB = 25;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const STATUS_COLORS = {
  QUEUED: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
  VALIDATING: 'warning',
  UPLOADING: 'info',
};

const StatusIcon = ({ status }) => {
  if (status === 'COMPLETED') return <CheckCircle size={16} className="text-green-400" />;
  if (status === 'FAILED') return <AlertCircle size={16} className="text-red-400" />;
  if (status === 'PROCESSING' || status === 'UPLOADING') return <Loader size={16} className="text-blue-400 animate-spin" />;
  return <FileText size={16} className="text-yellow-400" />;
};

const getCleanPaperTitle = (paper) => {
  if (!paper) return 'Untitled Document';
  const raw = (paper.title || paper.name || '').trim();
  if (raw && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(raw.toLowerCase())) {
    return raw;
  }
  return paper.name || paper.originalFilename || 'Untitled Document';
};

export default function UploadAnalyze() {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  const [papers, setPapers] = useState([]);
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [loadingPaperId, setLoadingPaperId] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Close delete modal on Escape key if not currently deleting
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && paperToDelete && !isDeleting) {
        setPaperToDelete(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paperToDelete, isDeleting]);

  const selectedPaper = selectedPaperId
    ? papers.find(p => p.id === selectedPaperId || (p.dbId && p.dbId === selectedPaperId)) || null
    : null;

  const pollStatus = useCallback(async (dbId, localId) => {
    if (!dbId || !localId) return;
    const token = localStorage.getItem('token');

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/papers/${dbId}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) return;
        const paper = await res.json();

        setPapers(prev =>
          prev.map(p =>
            p.id === localId || (p.dbId && p.dbId === dbId)
              ? {
                  ...p,
                  status: paper.status,
                  error: paper.processingError || null,
                  extractedText: paper.extractedText || null,
                  title: paper.title || p.title,
                  authors: paper.authors || p.authors || [],
                  publicationYear: paper.publicationYear || p.publicationYear || null,
                  abstract: paper.abstract || p.abstract || null,
                  fileSizeBytes: paper.fileSizeBytes || p.fileSizeBytes,
                }
              : p
          )
        );

        if (paper.status === 'QUEUED' || paper.status === 'PROCESSING') {
          setTimeout(poll, 2000);
        } else if (paper.status === 'COMPLETED' || paper.status === 'FAILED') {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('paperProcessingCompleted', {
                detail: { projectId, paperId: dbId, status: paper.status },
              })
            );
          }
        }
      } catch (_) {
        setTimeout(poll, 3000);
      }
    };
    setTimeout(poll, 1500);
  }, []);

  const handleSelectPaper = async (paper) => {
    if (!paper) return;
    setSelectedPaperId(paper.id);
    if (!paper.extractedText && paper.dbId) {
      setLoadingPaperId(paper.id);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE_URL}/api/papers/${paper.dbId}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (res.ok) {
          const fresh = await res.json();
          setPapers(prev =>
            prev.map(p =>
              p.id === paper.id || (p.dbId && p.dbId === paper.dbId)
                ? {
                    ...p,
                    status: fresh.status || p.status,
                    error: fresh.processingError || null,
                    extractedText: fresh.extractedText || null,
                    title: fresh.title || p.title,
                    authors: fresh.authors || p.authors || [],
                    publicationYear: fresh.publicationYear || p.publicationYear || null,
                    abstract: fresh.abstract || p.abstract || null,
                  }
                : p
            )
          );
        }
      } catch (err) {
        console.error('Failed to load paper details', err);
      } finally {
        setLoadingPaperId(null);
      }
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  useEffect(() => {
    if (!projectId) return;
    let isMounted = true;
    const fetchExistingPapers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/papers`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (Array.isArray(data)) {
          const existingPapers = data.map(p => ({
            id: p._id,
            name: p.originalFilename || 'Untitled',
            status: p.status || 'UNKNOWN',
            error: p.processingError || null,
            dbId: p._id,
            title: p.title || p.originalFilename || 'Untitled',
            authors: Array.isArray(p.authors) ? p.authors : [],
            publicationYear: p.publicationYear || null,
            abstract: p.abstract || null,
            extractedText: p.extractedText || null,
            fileSizeBytes: p.fileSizeBytes || null,
          }));

          setPapers(existingPapers);

          existingPapers.forEach(p => {
            if (p.status === 'QUEUED' || p.status === 'PROCESSING') {
              pollStatus(p.dbId, p.id);
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch existing papers', err);
      }
    };

    fetchExistingPapers();
    return () => {
      isMounted = false;
    };
  }, [projectId, pollStatus]);

  const validateFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf') return 'Only .pdf files are accepted';
    if (file.type !== 'application/pdf') return 'MIME type must be application/pdf';
    if (file.size > MAX_PDF_SIZE_BYTES) return `File exceeds maximum size of ${MAX_PDF_SIZE_MB}MB`;
    return null;
  };

  const addFiles = (files) => {
    const fileArray = Array.from(files);
    const newPapers = fileArray.map((file) => {
      const validationError = validateFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        status: validationError ? 'FAILED' : 'QUEUED',
        error: validationError || null,
        dbId: null,
      };
    });
    setPapers(prev => [...prev, ...newPapers]);

    // Upload valid files
    const validPapers = newPapers.filter(p => p.status === 'QUEUED');
    if (validPapers.length > 0 && projectId) {
      uploadFiles(validPapers, newPapers);
    }
  };

  const uploadFiles = async (validPapers, allNewPapers) => {
    // Mark as UPLOADING
    setPapers(prev =>
      prev.map(p =>
        validPapers.find(vp => vp.id === p.id) ? { ...p, status: 'UPLOADING' } : p
      )
    );

    const formData = new FormData();
    validPapers.forEach(p => formData.append('pdfs', p.file));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/papers`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData,
      });

      let data = {};
      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }

      if (!response.ok) {
        const errorMsg = data?.error || 'Upload failed';
        setPapers(prev =>
          prev.map(p =>
            validPapers.find(vp => vp.id === p.id)
              ? { ...p, status: 'FAILED', error: errorMsg }
              : p
          )
        );
        return;
      }

      // Map returned papers back to local state entries
      const returnedPapers = Array.isArray(data?.papers) ? data.papers : [];
      setPapers(prev =>
        prev.map(p => {
          const match = returnedPapers.find(
            rp => rp.originalFilename === p.name && validPapers.find(vp => vp.id === p.id)
          );
          if (match) {
            return { ...p, status: match.status || 'QUEUED', dbId: match.id };
          }
          return p;
        })
      );

      // Poll status for QUEUED/PROCESSING papers
      returnedPapers.forEach(rp => {
        if (rp?.id) {
          const matchedLocal = validPapers.find(vp => vp.name === rp.originalFilename);
          if (matchedLocal?.id) {
            pollStatus(rp.id, matchedLocal.id);
          }
        }
      });
    } catch (err) {
      const errorMsg = 'Network error — could not reach server';
      setPapers(prev =>
        prev.map(p =>
          validPapers.find(vp => vp.id === p.id)
            ? { ...p, status: 'FAILED', error: errorMsg }
            : p
        )
      );
    }
  };

  const handleRetry = async (paper) => {
    if (!paper || !paper.dbId) return;
    const token = localStorage.getItem('token');

    setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'QUEUED', error: null } : p));

    try {
      const res = await fetch(`${API_BASE_URL}/api/papers/${paper.dbId}/retry`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        pollStatus(paper.dbId, paper.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'FAILED', error: data?.error || 'Retry failed' } : p));
      }
    } catch (_) {
      setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'FAILED', error: 'Network error during retry' } : p));
    }
  };

  const handleReprocess = async (paper) => {
    if (!paper || !paper.dbId) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/papers/${paper.dbId}/reprocess`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('paperProcessingCompleted', {
              detail: { projectId, paperId: paper.dbId, status: 'COMPLETED' },
            })
          );
        }
      }
    } catch (err) {
      console.error('Reprocess failed', err);
    }
  };

  const handleCrossClick = (paper) => {
    if (!paper) return;

    // For pending, not-yet-uploaded PDFs, × simply removes file from queue without confirmation
    if (!paper.dbId) {
      setPapers(prev => prev.filter(p => p.id !== paper.id));
      if (selectedPaperId === paper.id) {
        setSelectedPaperId(null);
      }
      return;
    }

    // For already uploaded papers, open confirmation modal
    setDeleteError(null);
    setPaperToDelete(paper);
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setPaperToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!paperToDelete || isDeleting) return;

    const targetDbId = paperToDelete.dbId;
    const targetLocalId = paperToDelete.id;
    const token = localStorage.getItem('token');

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/papers/${targetDbId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setIsDeleting(false);
        setDeleteError(data?.error || 'Failed to delete paper. Please try again.');
        return;
      }

      // Success: Remove from UI
      setPapers(prev => prev.filter(p => p.id !== targetLocalId && p.dbId !== targetDbId));
      if (
        selectedPaperId === targetLocalId ||
        selectedPaperId === targetDbId ||
        (selectedPaper && (selectedPaper.id === targetLocalId || selectedPaper.dbId === targetDbId))
      ) {
        setSelectedPaperId(null);
      }

      // Refresh dashboard & other views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('paperProcessingCompleted', {
            detail: { projectId, paperId: targetDbId, status: 'DELETED' },
          })
        );
      }

      setIsDeleting(false);
      setPaperToDelete(null);
      setDeleteSuccess('Paper permanently deleted successfully.');
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to delete paper from server', err);
      setIsDeleting(false);
      setDeleteError('Network error — could not reach server to delete paper.');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const badgeVariantFor = (status) => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'FAILED') return 'error';
    return 'warning';
  };

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Research Paper Analysis</h1>
        <p className="text-base text-text-muted font-medium">
          Upload PDF research papers to extract text and metadata.
          {!projectId && (
            <span className="text-yellow-400 ml-2 font-semibold">⚠ Open a project to upload papers.</span>
          )}
        </p>
      </div>

      {/* Deletion Success Toast */}
      {deleteSuccess && (
        <div className="fixed top-6 right-6 z-50 max-w-md p-4 rounded-xl bg-dark-elevated border border-green-500/40 text-green-400 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="shrink-0 text-green-400" />
            <span className="text-sm font-medium text-text-primary">{deleteSuccess}</span>
          </div>
          <button
            onClick={() => setDeleteSuccess(null)}
            className="text-text-muted hover:text-text-primary transition-colors p-1 ml-2"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer min-h-[220px] mb-10
          ${isDragging
            ? 'border-brand-primary bg-brand-primary/15'
            : 'border-brand-primary/30 bg-brand-primary/5 hover:bg-brand-primary/10 hover:border-brand-primary/50'
          }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="w-16 h-16 bg-dark-elevated text-brand-primary rounded-full flex items-center justify-center mb-6 shadow-sm border border-dark-border">
          <UploadCloud size={32} />
        </div>
        <p className="font-bold text-text-primary mb-2 text-lg">Drag & drop PDFs here</p>
        <p className="text-sm font-medium text-text-muted mb-6">or click to browse</p>
        <Button variant="primary" className="px-8 shadow-sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
          Choose Files
        </Button>
        <p className="text-xs text-text-secondary mt-6 font-semibold uppercase tracking-wider">
          PDF only · Max {MAX_PDF_SIZE_MB}MB per file · Multiple files supported
        </p>
      </div>

      {/* Paper List */}
      {papers.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-text-primary text-xl">
              Uploaded Papers <span className="text-text-muted font-normal text-base">({papers.length})</span>
            </h3>
            <p className="text-xs text-text-muted">Click any paper to inspect extracted text and metadata</p>
          </div>
          <Card className="overflow-hidden border-dark-border">
            {papers.map((paper) => {
              const isSelected = Boolean(selectedPaper && (selectedPaper.id === paper.id || (selectedPaper.dbId && selectedPaper.dbId === paper.dbId)));
              return (
                <div
                  key={paper.id}
                  onClick={() => handleSelectPaper(paper)}
                  className={`flex items-center justify-between p-5 border-b border-dark-border last:border-0 hover:bg-dark-elevated transition-colors cursor-pointer group ${
                    isSelected ? 'bg-dark-elevated/70 border-l-4 border-l-brand-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-dark-elevated flex items-center justify-center shrink-0 border border-dark-border">
                      <StatusIcon status={paper.status} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-text-primary text-sm truncate max-w-sm">
                          {getCleanPaperTitle(paper)}
                        </p>
                        {paper.extractedText && (
                          <span className="text-[10px] bg-brand-primary/15 text-brand-primary font-semibold px-2 py-0.5 rounded-full shrink-0">
                            Text Extracted
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted truncate max-w-sm mt-0.5">
                        {paper.name} {paper.publicationYear ? `· ${paper.publicationYear}` : ''}
                      </p>
                      {paper.error && (
                        <p className="text-xs text-red-400 font-medium mt-1">{paper.error}</p>
                      )}
                      {(paper.status === 'UPLOADING') && (
                        <p className="text-xs text-blue-400 font-medium mt-1">Uploading…</p>
                      )}
                      {(paper.status === 'PROCESSING') && (
                        <p className="text-xs text-blue-400 font-medium mt-1">Extracting text & metadata…</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={badgeVariantFor(paper.status)}>{paper.status}</Badge>
                    <Button
                      size="sm"
                      variant={isSelected ? 'primary' : 'secondary'}
                      className="text-xs px-3 py-1.5 hidden sm:inline-flex"
                      onClick={() => handleSelectPaper(paper)}
                    >
                      {isSelected ? 'Viewing' : 'Inspect'}
                    </Button>
                    {paper.status === 'COMPLETED' && paper.dbId && (
                      <button
                        onClick={() => handleReprocess(paper)}
                        title="Re-extract keywords dynamically"
                        className="flex items-center gap-1 text-xs text-text-muted hover:text-brand-primary font-medium transition-colors"
                      >
                        <RefreshCw size={12} /> Reprocess
                      </button>
                    )}
                    {paper.status === 'FAILED' && paper.dbId && (
                      <button
                        onClick={() => handleRetry(paper)}
                        className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-bright font-semibold transition-colors"
                      >
                        <RefreshCw size={13} /> Retry
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCrossClick(paper);
                      }}
                      title={paper.dbId ? "Delete paper permanently" : "Remove from queue"}
                      aria-label={paper.dbId ? "Delete paper" : "Remove from queue"}
                      className="text-text-muted hover:text-red-400 transition-colors ml-1 p-1 rounded-lg hover:bg-red-500/10"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Paper Details & Extracted Text Section */}
      {selectedPaper && (
        <div className="mb-10" id="paper-details">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-text-primary text-xl flex items-center gap-2">
              <FileText className="text-brand-primary" size={20} />
              Paper Details & Extracted Text
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant={badgeVariantFor(selectedPaper.status)}>
                {selectedPaper.status}
              </Badge>
              {selectedPaper.extractedText && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-1.5 text-xs py-1 px-2.5"
                  onClick={() => handleCopy(selectedPaper.extractedText)}
                >
                  {copiedText ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  {copiedText ? 'Copied' : 'Copy Text'}
                </Button>
              )}
            </div>
          </div>

          <Card className="p-6 border-dark-border">
            {/* Header Metadata */}
            <div className="mb-6 pb-6 border-b border-dark-border">
              <h4 className="text-xl font-bold text-text-primary mb-2">
                {getCleanPaperTitle(selectedPaper)}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-4">
                <div className="bg-dark-bg p-3 rounded-xl border border-dark-border">
                  <span className="text-text-muted block font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Original File
                  </span>
                  <span className="text-text-primary font-medium truncate block">
                    {selectedPaper.name}
                  </span>
                </div>
                <div className="bg-dark-bg p-3 rounded-xl border border-dark-border">
                  <span className="text-text-muted block font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Publication Year
                  </span>
                  <span className="text-text-primary font-medium">
                    {selectedPaper.publicationYear || 'Not detected'}
                  </span>
                </div>
                <div className="bg-dark-bg p-3 rounded-xl border border-dark-border">
                  <span className="text-text-muted block font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Authors
                  </span>
                  <span className="text-text-primary font-medium truncate block">
                    {Array.isArray(selectedPaper.authors) && selectedPaper.authors.filter(a => a && !['(anonymous)', 'anonymous', 'unknown'].includes(a.trim().toLowerCase())).length > 0
                      ? selectedPaper.authors.filter(a => a && !['(anonymous)', 'anonymous', 'unknown'].includes(a.trim().toLowerCase())).join(', ')
                      : 'Not detected'}
                  </span>
                </div>
                <div className="bg-dark-bg p-3 rounded-xl border border-dark-border">
                  <span className="text-text-muted block font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Status
                  </span>
                  <span className="text-text-primary font-medium">
                    {selectedPaper.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Extracted Document Text */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-semibold text-xs text-text-secondary uppercase tracking-wider">
                  Extracted Document Text
                </h5>
                {selectedPaper.extractedText && (
                  <span className="text-xs text-text-muted font-mono">
                    {selectedPaper.extractedText.length.toLocaleString()} characters
                  </span>
                )}
              </div>

              {loadingPaperId === selectedPaper.id ? (
                <div className="p-8 bg-dark-bg rounded-xl border border-dark-border text-center text-text-muted flex flex-col items-center justify-center gap-3">
                  <Loader className="animate-spin text-brand-primary" size={24} />
                  <p className="text-sm font-medium">Loading paper details...</p>
                </div>
              ) : selectedPaper.status === 'COMPLETED' ? (
                selectedPaper.extractedText ? (
                  <div className="relative">
                    <pre className="p-5 bg-dark-bg rounded-xl border border-dark-border text-sm text-text-primary font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-text shadow-inner">
                      {selectedPaper.extractedText}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">
                    No extractable text was found in this document.
                  </div>
                )
              ) : selectedPaper.status === 'FAILED' ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <span className="font-semibold block mb-1">Extraction Failed</span>
                  {selectedPaper.error || 'Text extraction failed for this PDF.'}
                </div>
              ) : (
                <div className="p-8 bg-dark-bg rounded-xl border border-dark-border text-center text-text-muted flex flex-col items-center justify-center gap-3">
                  <Loader className="animate-spin text-brand-primary" size={24} />
                  <p className="text-sm font-medium">Extracting text and metadata from PDF...</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Paper Permanent Deletion Confirmation Dialog */}
      {paperToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-dark-bg/80 backdrop-blur-sm"
            onClick={() => !isDeleting && handleCancelDelete()}
          />
          <Card className="relative w-full max-w-md p-6 shadow-2xl border-dark-border animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 border border-red-500/20">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">
                    Delete Paper Permanently?
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Irreversible database and file deletion
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && handleCancelDelete()}
                disabled={isDeleting}
                aria-label="Close dialog"
                className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Are you sure you want to permanently delete this paper? This action cannot be undone.
            </p>

            {/* Paper details snippet */}
            <div className="mt-4 p-3 rounded-xl bg-dark-bg border border-dark-border flex items-center gap-3 min-w-0">
              <FileText size={18} className="text-brand-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-primary truncate">
                  {getCleanPaperTitle(paperToDelete)}
                </p>
                <p className="text-[11px] text-text-muted truncate mt-0.5">
                  {paperToDelete.name || paperToDelete.originalFilename}
                </p>
              </div>
            </div>

            {/* Failure / Error state */}
            {deleteError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Action Buttons: Yes, Delete | No, Cancel */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                No, Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-2 focus:ring-red-500"
              >
                {isDeleting && <Loader size={14} className="animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

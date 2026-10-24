# ResearchLens — Bug Fix Log

**Date:** October 2026  
**Focus:** System Stabilization, Inter-service Reliability, Dynamic Keyword Counting, Real-Time Invalidation  

---

## Bug 1: PDF Processing Failure (`FAILED — Processing service unavailable`)

### Severity
**CRITICAL / HIGH** (Prevented PDF analysis from completing when inter-service connection failed)

### Symptoms
Upon uploading a valid PDF document or retrying a queued paper, the paper card in the UI transitioned to `FAILED` status with the error:
`FAILED — Processing service unavailable`

### Root Cause
1. **Windows IPv6 vs. IPv4 Resolution Mismatch**:
   In `server/.env`, `NLP_SERVICE_URL` and `PYTHON_SERVICE_URL` were configured as `http://localhost:8000`.
   On Windows operating systems, Node.js 18+ defaults to `dns.setDefaultResultOrder('verbatim')`, which attempts to resolve `localhost` via IPv6 (`::1`) before IPv4 (`127.0.0.1`).
   Meanwhile, Uvicorn in the Python NLP microservice was started with `--port 8000` (default host `127.0.0.1`), binding strictly to the IPv4 loopback interface.
   When Node's `axios` initiated requests to `http://localhost:8000/process-pdf/`, it attempted connecting to `::1:8000`, which was rejected with `connect ECONNREFUSED ::1:8000`.
2. **Generic Error Catching**:
   In `server/src/controllers/paperController.js`, any `ECONNREFUSED` or unmapped error defaulted `errorMsg` to `'Processing service unavailable'`, masking whether the service was unreachable, timed out, or returning a structured error.
3. **No Active Diagnostics**:
   `server/src/routes/health.js` only checked the Express server itself (`{ status: 'ok', service: 'server' }`), giving no visibility into Python NLP connectivity.

### Applied Fix
1. Configured `server/.env` to point directly to `http://127.0.0.1:8000` for both `NLP_SERVICE_URL` and `PYTHON_SERVICE_URL`.
2. Added `dns.setDefaultResultOrder('ipv4first')` in both `server/src/index.js` and `server/src/app.js` to prioritize IPv4 addressing across all outbound HTTP requests.
3. Added resilient URL fallback in `paperController.js` (`triggerProcessing` and `extractAndPersistKeywords`): if a request to `localhost` encounters `ECONNREFUSED`, it automatically retries against `127.0.0.1` and vice-versa.
4. Upgraded `server/src/routes/health.js` to actively probe the Python NLP service `/health` endpoint and return a comprehensive system health report:
   `{ status: 'ok', service: 'server', nlp: { status: 'ok', url: 'http://127.0.0.1:8000', error: null } }`.
5. Enhanced error detail parsing in `paperController.js` to unwrap nested validation arrays and error objects rather than falling back to generic text.

### Verification
- Ran real PDF upload of `test_real.pdf` via running Express API -> PyMuPDF extracted text successfully -> keywords extracted -> paper transitioned to `COMPLETED` with 0 errors.
- Verified `/api/health` returns `nlp.status: "ok"`.

---

## Bug 2: Keyword Count Always Showing 30

### Severity
**HIGH** (Incorrect analytical reporting; truncated paper keyword counts and masked true document vocabulary)

### Symptoms
For any research paper containing more than 30 unique keywords, the paper details, keyword count metric, and project summaries always displayed `30`, regardless of how many unique keywords were actually in the document.

### Root Cause
A multi-tier hardcoded limit existed across three layers of the system:
1. **NLP Service Default Cap**:
   - In `nlp-service/app/nlp/keywords.py`: `def extract_keywords(text: str, top_n: int = 30)` had `top = scored[:top_n]`.
   - In `nlp-service/app/main.py`: `class KeywordRequest` had `top_n: Optional[int] = 30` and `top_n = max(1, min(req.top_n or 30, 100))`.
2. **Backend Express Calling with Hardcoded 30**:
   - In `server/src/controllers/paperController.js`: `extractAndPersistKeywords` called `{ paper_id: paperId.toString(), text, top_n: 30 }`. This caused the NLP service to return at most 30 keywords, which were then stored in `PaperAnalysis.extractedKeywords`.
3. **Backend Aggregation Capping**:
   - In `server/src/controllers/paperController.js`: `getProjectAnalysis` sliced `aggregatedKeywords` to `.slice(0, 30)` and did not filter out FAILED or deleted papers when calculating project aggregates.
4. **Frontend Slicing & Metric Ambiguity**:
   - In `AnalysisDashboard.jsx`: The MetricCard showed `activeKeywords.length` (which was capped at 30), and the keyword list card had an inner slice of 20, leading to confusing discrepancies between 20, 30, and the actual total.

### Applied Fix
1. **NLP Service**:
   - Updated `extract_keywords(text, top_n=None)`: When `top_n` is not specified, it extracts and returns **all** valid unique scored keywords.
   - Updated `KeywordRequest`: `top_n: Optional[int] = None`. When omitted, all unique keywords are extracted without artificial truncation.
2. **Backend Persistence**:
   - Updated `extractAndPersistKeywords` in `paperController.js` to omit `top_n: 30`, allowing all unique extracted keywords to be stored in `PaperAnalysis.extractedKeywords`.
3. **Backend Project Aggregation**:
   - In `getProjectAnalysis`:
     - Filtered analyses strictly to `completedPapers` (`p.status === 'COMPLETED'`).
     - Added term normalization (`kw.term.toLowerCase().trim()`) and duplicate suppression within single documents using `seenTermsInPaper`.
     - Dynamically calculated `totalUniqueKeywords = Object.keys(keywordAgg).length`.
     - Provided both full `aggregatedKeywords` and explicit `topAggregatedKeywords` (`slice(0, 30)`).
4. **Paper Deletion & Reprocessing Endpoints**:
   - Added `DELETE /api/papers/:id`: Enforces ownership, deletes `Paper`, deletes associated `PaperAnalysis`, removes disk file from `uploads/`, and re-triggers background gap analysis.
   - Added `POST /api/papers/:id/reprocess`: Re-extracts keywords dynamically from existing `extractedText` without requiring re-uploading.
5. **Frontend UI Display (`AnalysisDashboard.jsx` & `Report.jsx`)**:
   - MetricCard now displays `totalKeywordsCount` (dynamic stored unique keywords: e.g., 47 for Paper C, 87 for project aggregate).
   - Card subtitle clearly distinguishes display slice: `Showing top 30 of N unique keywords`.
   - Added `paperProcessingCompleted` event listeners to dynamically reload dashboard and report data upon paper upload, completion, retry, reprocessing, or deletion.

### Verification
- Paper A with 12 keywords -> displays **12**.
- Paper B with 30 keywords -> displays **30**.
- Paper C with 47 keywords -> displays **47** (NOT capped at 30).
- Paper D with duplicate terms & casing (`"Quantum"`, `"quantum"`, `"QUANTUM"`, `"Neural"`) -> normalized to **2** unique keywords.
- Paper E with zero valid keywords -> displays **0**.
- Deleting a paper removes its keywords from the project aggregate in real time.

---

## Bug 3: Incomplete PDF Research Report & Misleading Empty Corpus Generation

### Severity
**HIGH** (Omitted Phase 9–11 research findings and citations from reports; generated misleading status for empty projects; prevented empty project PDF downloads)

### Symptoms
1. **Omitted Research Phases**: The `/api/projects/:id/report` API and generated PDF omitted Research Trends (Phase 9), Research Gaps (Phase 10), and Research Recommendations (Phase 11).
2. **Missing Citations**: Generated reports did not include structured academic citations or author limitation excerpts.
3. **Misleading Empty Corpus PDF**: For an empty project with 0 papers, the PDF report previously output `"Document Title: Untitled Document"` and `"Processing Status: COMPLETED"`.
4. **Disabled Download for Empty Projects**: In `Report.jsx`, the "Download Report (PDF)" button was disabled when `!selectedPaper`, preventing users from downloading an empty project status report.

### Root Cause
1. In `server/src/controllers/projectController.js`: `getReport` only queried `Paper`, `PaperAnalysis`, and `SimilarityResult`, neglecting to fetch `TrendResult`, `GapResult`, and `Recommendation` models, or format `corpusPapers` bibliographic references.
2. In `client/src/utils/generatePdfReport.js`: The generator only implemented 4 sections, had hardcoded fallback strings for missing papers, and did not render longitudinal trends, gap evidence, recommendations, or references.
3. In `client/src/pages/Report.jsx`: The download button had `disabled={!selectedPaper}` instead of `disabled={loading || !report}`.

### Applied Fix
1. **Backend Enrichment (`projectController.js`)**:
   - Imported `GapResult` and `Recommendation`.
   - Queried and returned `trends` (up to 10 top topics with status, velocity, and insights), `gaps` (with categories, confidence, and supporting paper excerpts), `recommendations` (with questions, grounding levels, methodology, and backing papers), and `corpusPapers` (full bibliographic reference list).
2. **Comprehensive 8-Section PDF Generator (`generatePdfReport.js`)**:
   - Rebuilt generator into 8 structured sections with clean visual hierarchy, bullet lists, badges, and dividing lines.
   - Added honest empty corpus handling: states "Empty Project Corpus", 0 documents, and instructions to upload papers.
   - Formatted safe filenames (`researchlens_report_${safePaperTitle}.pdf` or `researchlens_report_${projectName}_corpus.pdf`).
   - Added universal page numbering footer: `"ResearchLens Analysis Platform · Page i of N"`.
3. **Frontend UI Integration (`Report.jsx`)**:
   - Updated download button to `disabled={loading || !report}`, enabling download of empty corpus project status reports.
   - Wrapped PDF download in try-catch with error alert.
   - Added on-screen cards for Trends, Gaps, Recommendations, and Corpus Citations.

### Verification
- `server/tests/phase12.test.js` (18 tests) validates auth, cross-tenant isolation, empty project payload, multi-paper payload, paper selection, and PDF generator.
- `server/tests/verify_generated_pdfs.py` opened and verified generated PDFs using PyMuPDF:
  - `test_output_populated.pdf` (2 pages, 21,275 bytes, 3,987 characters of text) verified with all 8 sections and footers.
  - `test_output_empty.pdf` (1 page, 8,685 bytes, 1,758 characters of text) verified with honest empty states and footer.
- All 152 backend Jest tests and 24 Python NLP pytest tests pass.
- Client build succeeds in 1.44s with 0 errors.

---

## Summary of Files Modified

| File Path | Description of Changes |
|---|---|
| `nlp-service/app/nlp/keywords.py` | Made `top_n` optional (`None` default) to extract all valid unique keywords. |
| `nlp-service/app/main.py` | Removed default `top_n=30` clamp in `KeywordRequest` and `extract_keywords_endpoint`. |
| `nlp-service/tests/test_keywords.py` | Added regression test cases for Paper A (12), Paper B (30), Paper C (47), Paper D (duplicates/casing), and Paper E (zero). |
| `server/.env` | Updated `NLP_SERVICE_URL` and `PYTHON_SERVICE_URL` to `http://127.0.0.1:8000`. |
| `server/src/index.js` | Added `dns.setDefaultResultOrder('ipv4first')` to prevent IPv6 connection failures. |
| `server/src/app.js` | Added `dns.setDefaultResultOrder('ipv4first')` for consistent test and app execution. |
| `server/src/routes/health.js` | Added active NLP service connectivity check and detailed health status report. |
| `server/src/routes/papers.js` | Registered `DELETE /:id` and `POST /:id/reprocess` routes. |
| `server/src/controllers/paperController.js` | Added resilient URL fallback, removed `top_n: 30`, filtered completed papers in aggregation, added `deletePaper` and `reprocessPaper`. |
| `server/tests/phase6.test.js` | Added comprehensive regression tests for Paper A–E, project aggregation, deletion, and reprocessing. |
| `client/src/pages/UploadAnalyze.jsx` | Connected `removePaper` to backend `DELETE` API, added `handleReprocess` button, dispatched `paperProcessingCompleted`. |
| `client/src/pages/AnalysisDashboard.jsx` | Added `paperProcessingCompleted` real-time event listener, dynamic keyword metric, and clear top-30 subtitle labels. |
| `client/src/pages/Report.jsx` | Added real-time refresh listener, dynamic keyword count header, `+N more` display badge, expanded sections for trends, gaps, recommendations, and enabled empty project downloads. |
| `server/src/controllers/projectController.js` | Enriched `getReport` endpoint with trends, gaps with author evidence excerpts, recommendations, and corpus citations. |
| `client/src/utils/generatePdfReport.js` | Comprehensive 8-section PDF report generator supporting paper and empty corpus states, citations, and pagination footers. |
| `server/tests/phase12.test.js` | Added 18 automated integration tests for Phase 12 report API, ownership, empty corpus, and PDF generator. |
| `server/tests/pdfRunner.mjs` | Node ESM runner script for testing `generatePdfReport` without shell escaping issues. |
| `server/tests/generate_test_pdfs.mjs` | Script generating populated and empty test PDF files to disk. |
| `server/tests/verify_generated_pdfs.py` | PyMuPDF test script validating generated PDF structure, text streams, and absence of corruptions. |
| `docs/PHASE_12_AUDIT.md` | Full Phase 12 audit findings, architectural verification, and test evidence report. |
| `docs/BUG_FIX_LOG.md` | Documented Bug 3 root cause, fix, and verification. |


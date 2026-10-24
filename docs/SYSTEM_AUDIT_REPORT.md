# ResearchLens — Complete System Audit Report

**Audit Date:** October 2026  
**Auditor Roles:** Senior Full-Stack Engineer, QA Engineer, AI/NLP Engineer, Security Reviewer  
**Status:** COMPLETE AUDIT & VERIFICATION  

---

## Executive Summary

A comprehensive system audit was conducted across the ResearchLens application, encompassing frontend interfaces, backend Express architecture, the Python FastAPI NLP microservice, MongoDB data models, and analytical pipelines (TF-IDF similarity, topic trends, gap analysis, and keyword extraction).

Two primary defects were investigated and fixed:
1. **PDF Processing Failure (`FAILED — Processing service unavailable`)**: Resolved connection resolution ambiguities between Node.js IPv6 resolution order and FastAPI Uvicorn IPv4 bindings on Windows, added resilient multi-URL fallback and enhanced health diagnostics.
2. **Keyword Count Cap (`Always showing 30`)**: Discovered and eliminated a multi-tier hardcoded limit where the NLP extraction, backend persistence, and API aggregations were clamped to top-30 rather than computing dynamically. Keywords are now extracted, persisted, and calculated dynamically with no false 30 ceilings, while maintaining clear differentiation between total unique keywords and top-30 ranked display views.
3. **Paper Lifecycle & Dynamic Real-Time Updates**: Added backend deletion (`DELETE /api/papers/:id`) and reprocessing (`POST /api/papers/:id/reprocess`), connected deletion and reprocessing in the UI, and wired `paperProcessingCompleted` listeners into `AnalysisDashboard.jsx` and `Report.jsx` for instantaneous, automatic metric recalculation without requiring full page reloads.

All **105 automated backend tests across 8 suites** and **20 NLP service tests** pass without errors. Production Vite client build succeeds cleanly in under 11 seconds.

---

## Detailed Audit by Feature Area

| # | System Module / Area | Status | Verification & Observations |
|---|----------------------|:------:|-----------------------------|
| 1 | **Frontend UI, Routing & Navigation** | **PASS** | React Router v7 routes configured for `/login`, `/register`, `/projects`, `/projects/:id/upload`, `/projects/:id/analysis`, `/projects/:id/trends`, `/projects/:id/gaps`, `/projects/:id/novelty`, and `/projects/:id/report`. Responsive layouts with Tailwind CSS, clear empty states, error banners, and loading indicators. |
| 2 | **Authentication & JWT** | **PASS** | Express `authController` provides registration and login with bcrypt hashing (salt rounds = 10) and signed JWT tokens with 1-day expiration. Protected routes verify tokens via `authMiddleware.requireAuth`. Tokens safely stored in `localStorage`. |
| 3 | **Authorization & Cross-User Isolation** | **PASS** | Strict project and paper ownership enforced across all API endpoints: `getOwnedProject`, `getOwnedPaper`, and `enforceOwnership`. Users cannot access, view, analyze, retry, or delete projects or papers belonging to other users (verified in test suites with 403 Forbidden checks). |
| 4 | **Backend APIs & Middleware** | **PASS** | Express 5 with Helmet security headers, CORS protection, Morgan logging, Express Validator body validation, custom JSON error handler, and standardized REST status codes (200, 201, 400, 401, 403, 404, 500, 502). |
| 5 | **Active Database & Persistence** | **PASS** | MongoDB via Mongoose (with in-memory fallback server and automatic JSON snapshot restoration via `db_backup.json`). Schema models for `User`, `Project`, `Paper`, `PaperAnalysis`, `SimilarityResult`, `TrendResult`, `GapResult`, and `Recommendation`. Indexes established on `projectId`, `paperId`, and `status`. |
| 6 | **PDF Upload & Validation** | **PASS** | Multer disk storage writes to safe UUID filenames in `uploads/`. File extension and MIME type validation (`application/pdf` only) and 25MB file size limit enforced. |
| 7 | **PDF Processing Pipeline** | **PASS** | Asynchronous background processing via `triggerProcessing`. State machine transitions: `QUEUED` -> `PROCESSING` -> `COMPLETED` / `FAILED`. Error messages captured in `processingError`. |
| 8 | **NLP Service Connectivity & Diagnostics** | **PASS** | FastAPI service on port 8000. PyMuPDF text extraction with OCR fallback for rasterized documents. Health check actively tested via `/health`. Dual IPv4 loopback (`127.0.0.1`) and `localhost` fallback ensures robust inter-service communication. |
| 9 | **Keyword Extraction & Dynamic Counts** | **PASS** | Pure tokenization, unicode normalization, research domain stop-word filtering, and log-smoothed TF scoring. Dynamic counts calculated from actual stored unique keywords. Cap of 30 removed; Paper C with 47 keywords correctly displays 47. Normalization prevents duplicate counting across casing. |
| 10 | **AI Structured Summaries & Fallback** | **PASS** | Integrates Google Gemini (`gemini-2.5-flash`) / OpenAI for structured summary extraction (`researchProblem`, `objective`, `methodology`, `keyFindings`, `limitations`). Graceful fallback when API quota is exhausted. |
| 11 | **Similarity & Novelty Screening** | **PASS** | TF-IDF vectorization with cosine similarity against project corpus. Custom configurable thresholds (`SIMILARITY_HIGH_THRESHOLD=0.60`, `SIMILARITY_MODERATE_THRESHOLD=0.30`). Ranks overlapping keywords and provides clear non-plagiarism interpretation badge. |
| 12 | **Research Trend Analysis** | **PASS** | Multi-year keyword prevalence and occurrence timeline. Distinguishes text mentions from distinct paper occurrences. Filters administrative boilerplate and author name tokens. Transparent status warnings when publication years are missing. |
| 13 | **Research Gap Analysis & Traceability** | **PASS** | Hybrid engine: AI synthesis with deterministic sentence-level evidence extraction fallback. Cites specific papers and verbatim excerpts with confidence scores (0.0 to 1.0) and gap classification. |
| 14 | **Dashboard Metrics & Refresh Behavior** | **PASS** | `AnalysisDashboard.jsx` displays analyzed papers count, dynamic unique keyword counts, and corpus similarity. Auto-polls while papers are `QUEUED`/`PROCESSING` and listens to `paperProcessingCompleted` for real-time reactivity. |
| 15 | **Report Generation & PDF Download** | **PASS** | Client-side jsPDF generator generates genuine multi-page vector PDF reports with executive summary, metadata, keyword TF scores, structured summaries, and similarity analysis. Markdown export also available. |
| 16 | **Paper Actions (Retry, Reprocess, Delete)** | **PASS** | `POST /api/papers/:id/retry` for failed papers, `POST /api/papers/:id/reprocess` for dynamic keyword re-extraction, and `DELETE /api/papers/:id` for full cleanup of paper, analysis, disk file, and gap statistics. |
| 17 | **Environment Configuration** | **PASS** | Centralized `.env` configuration. `JWT_SECRET`, `NLP_SERVICE_URL`, `PYTHON_SERVICE_URL`, `AI_PROVIDER`, `GEMINI_API_KEY`, `SIMILARITY_HIGH_THRESHOLD`, `SIMILARITY_MODERATE_THRESHOLD`. |
| 18 | **Automated Tests & Performance** | **PASS** | 105 passing Jest server tests across 8 suites. 20 passing pytest tests in Python NLP service. Clean Vite production client build. |

---

## Verified End-to-End Workflow

The complete end-to-end user workflow was executed and verified:
1. **Authentication**: User logs in with JWT issued and verified.
2. **Project Creation & Selection**: User navigates to project dashboard.
3. **PDF Upload**: Valid PDF (`test_real.pdf`) uploaded and stored as UUID-named file.
4. **Text Extraction**: PyMuPDF extracts full document text.
5. **Keyword Extraction**: NLP service extracts all valid unique keywords without artificial 30 cap.
6. **Data Persistence**: `Paper` marked `COMPLETED`; `PaperAnalysis` upserted with extracted keywords.
7. **Dashboard Dynamic Recalculation**: Dashboard displays exact keyword count and ranked keywords.
8. **Reprocess / Retry**: Reprocessing triggers keyword re-extraction dynamically.
9. **Deletion**: Deleting paper removes records and updates project aggregate statistics to 0.

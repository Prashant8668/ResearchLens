# ResearchLens — Release Readiness Assessment

**Assessment Date:** October 2026  
**Overall Readiness Status:** **READY**  

---

## 1. Readiness Checklist

| Category | Verification Item | Result | Notes |
|---|---|:---:|---|
| **Core Workflows** | End-to-end PDF Upload & Processing | **PASS** | Verified with real research PDF (`test_real.pdf`). Status transitions `QUEUED` -> `PROCESSING` -> `COMPLETED`. |
| **Defect Resolution** | PDF Processing Failure Fixed | **PASS** | `ECONNREFUSED` / `localhost` resolution resolved with IPv4 loopback enforcement and dual URL fallback. |
| **Defect Resolution** | Dynamic Keyword Count Fixed | **PASS** | Cap of 30 removed across NLP service, backend persistence, and frontend display. 47 keywords correctly display 47. |
| **Real-Time Reactivity**| Real-Time Dashboard & Report Invalidation | **PASS** | `paperProcessingCompleted` event triggers silent data re-fetch on upload, retry, reprocess, and delete. |
| **Data Integrity** | Existing User Data Preserved | **PASS** | In-memory MongoDB restores all collections and documents from `db_backup.json` without schema or data loss. |
| **Authorization** | Multi-User Isolation Enforced | **PASS** | Strict user ownership checks prevent cross-user project or paper access (returns 403 Forbidden). |
| **Automated Testing**| Backend Express Tests Passing | **PASS** | 105 passed across 8 test suites (`api`, `crud`, `phase5` through `phase10`). |
| **Automated Testing**| Python NLP Tests Passing | **PASS** | 20 passed in `pytest` (`test_keywords.py`, `test_similarity.py`). |
| **Frontend Health** | Production Vite Client Build | **PASS** | Builds in 10.98s with 0 syntax or bundling errors. |

---

## 2. Startup Commands

### Terminal 1: Python NLP Microservice (Port 8000)
```powershell
cd "reasearch lens\nlp-service"
.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2: Node.js Backend Server (Port 5000)
```powershell
cd "reasearch lens\server"
node src/index.js
```

### Terminal 3: React / Vite Frontend Client (Port 5173)
```powershell
cd "reasearch lens\client"
npm run dev
```

---

## 3. Test Execution Commands

### Run All Backend Server Tests:
```powershell
cd "reasearch lens\server"
npm test
```

### Run Python NLP Microservice Tests:
```powershell
cd "reasearch lens\nlp-service"
.venv\Scripts\python -m pytest
```

---

## 4. Known Limitations & Operational Guidance

1. **Third-Party AI Provider Rate Limits**:
   - The application is configured to use Google Gemini (`gemini-2.5-flash`) for structured summaries and AI gap synthesis.
   - When Gemini free-tier daily quotas are reached (`RESOURCE_EXHAUSTED` 429), the system automatically and gracefully falls back to the internal deterministic evidence engine. Research gap analysis and evidence extraction continue functioning without interruption.
2. **Scanned & Rasterized PDFs**:
   - PyMuPDF extracts text streams from standard digital PDFs. For scanned or image-only PDFs without extractable text, an OCR fallback is attempted using Windows OCR (`winocr`). If OCR cannot extract text, the paper is cleanly flagged as `SCANNED_PDF_UNSUPPORTED`.
3. **Publication Year Metadata**:
   - Multi-year trend analysis requires valid publication years (1900–2100). When PDF metadata lacks publication dates, papers are clearly grouped as "Missing Year" and users can update publication years manually via the UI.

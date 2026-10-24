# Phase 13 — ResearchLens Plagiarism Checker

## Overview
Phase 13 introduces a dedicated, evidence-based Plagiarism Checker to ResearchLens. It provides transparent textual overlap detection against the user's authorized project corpus, passage-level alignment, configurable exclusions, overlap deduplication, side-by-side evidence inspection, and dashboard integration.

---

## 1. Architecture & Isolation
- **Isolated Data Model**: All scan parameters, progress stages, and findings are stored in the `PlagiarismScan` collection (`server/src/models/PlagiarismScan.js`).
- **Zero Schema Collisions**: Does not alter existing `Paper`, `Project`, `SimilarityResult`, `TrendResult`, `GapResult`, or `Recommendation` models.
- **Dedicated Route Group**: Sub-routes mounted under `/api/projects/:id/plagiarism/*` protected by `requireAuth` and `enforceProjectOwnership`.
- **Existing Service Compatibility**: Works with PyMuPDF text extraction (`nlp-service`) and incorporates safe fallbacks for test and detached environments.

---

## 2. Plagiarism Checker API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/projects/:id/plagiarism/scan` | Initiates a new scan on an existing paper or uploaded PDF |
| `GET` | `/api/projects/:id/plagiarism/scans` | Lists past scans for the project sorted by creation date |
| `GET` | `/api/projects/:id/plagiarism/scans/:scanId` | Retrieves live scan status, current stage, and progress % |
| `GET` | `/api/projects/:id/plagiarism/scans/:scanId/results` | Retrieves complete scan findings and matching passages |
| `DELETE` | `/api/projects/:id/plagiarism/scans/:scanId` | Deletes a past scan record with safe ownership validation |
| `POST` | `/api/projects/:id/plagiarism/scans/:scanId/cancel` | Cancels an ongoing scan in progress |
| `GET` | `/api/projects/:id/plagiarism/summary` | Lightweight summary metrics for the main Analysis Dashboard |

---

## 3. Comparison Sources & Boundaries
1. **Authorized Project Corpus (`PROJECT_CORPUS`)**:
   - Compares against all other `COMPLETED` papers in the user's active project.
   - If 0 comparison papers exist, the system returns `matchPercentage: null` with an explicit limitation notice: *"No comparison sources are available in this project corpus"*.
   - Never returns 0% when no sources exist.
2. **External Academic / Web Sources (`EXTERNAL_SOURCES`)**:
   - Explicitly marked as *"Provider Configuration Required"* in the UI.
   - The system transparently documents that third-party web indexing requires a licensed API provider (e.g., CrossRef Similarity Check or Turnitin). No fake scores are generated.

---

## 4. Security & Privacy
- **Workspace Isolation**: Documents and scans are strictly scoped to the authenticated project owner.
- **Zero Public Indexing**: Uploaded documents are not submitted to public search indices or used as public training data.
- **Transient Upload Cleanup**: Files uploaded strictly for scanning without project persistence are stored in access-controlled temporary storage.
- **Cross-Tenant Protection**: Validates both project ID and user ownership before returning or deleting any scan record.

---

## 5. UI Integration
- **Sidebar**: Added `Plagiarism Checker` with `ShieldCheck` icon.
- **Page Layout**:
  - Tabbed input: Select Existing Paper vs Upload New PDF.
  - Configurable exclusions checkboxes (Quotations, Bibliography).
  - Live progress card showing actual processing stages.
  - Metric cards: Match score, matching tokens, source count, passage count.
  - Academic disclaimer: Human review requirement.
  - Candidate source cards with contribution percentages.
  - Side-by-side evidence explorer with match type filters (`Exact`, `Near-Verbatim`, `Paraphrase Candidate`).
  - Scan History drawer with individual deletion.
- **Dashboard Integration**:
  - Added a compact Plagiarism Checker summary card to the bottom of the Analysis Dashboard displaying total completed scans, latest scan result, and a quick shortcut.

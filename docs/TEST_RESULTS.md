# ResearchLens — Test Results & Accuracy Validation

**Test Date:** October 2026  
**Environment:** Windows Server / Node.js 18+ / Python 3.14 (FastAPI + PyMuPDF + scikit-learn) / MongoDB (in-memory fallback with snapshot persistence)  
**Overall Result:** **ALL 176 AUTOMATED TESTS PASS (100% Pass Rate)**

---

## 1. Automated Test Suites Summary

### Backend Express Tests (Jest)

| Test Suite | File | Tests Run | Passed | Failed | Status |
|---|---|:---:|:---:|:---:|:---:|
| API Health & Routing | `tests/api.test.js` | 13 | 13 | 0 | **PASS** |
| Project & Paper CRUD | `tests/crud.test.js` | 6 | 6 | 0 | **PASS** |
| Phase 5: PDF Processing & Extraction | `tests/phase5.test.js` | 12 | 12 | 0 | **PASS** |
| Phase 6: Keyword Extraction & Dynamic Counts | `tests/phase6.test.js` | 18 | 18 | 0 | **PASS** |
| Phase 7: Structured AI Summarization | `tests/phase7.test.js` | 13 | 13 | 0 | **PASS** |
| Phase 8: Similarity & Novelty Screening | `tests/phase8.test.js` | 12 | 12 | 0 | **PASS** |
| Phase 9: Research Trend Analysis | `tests/phase9.test.js` | 14 | 14 | 0 | **PASS** |
| Phase 10: Research Gap Analysis | `tests/phase10.test.js` | 17 | 17 | 0 | **PASS** |
| Phase 11: Research Recommendations Suite | `tests/phase11.test.js` | 19 | 19 | 0 | **PASS** |
| Phase 12: PDF Research Report & Citations | `tests/phase12.test.js` | 18 | 18 | 0 | **PASS** |
| **Total Backend Tests** | | **152** | **152** | **0** | **PASS** |

### Python NLP Microservice Tests (pytest)

| Test Module | File | Tests Run | Passed | Failed | Status |
|---|---|:---:|:---:|:---:|:---:|
| Keyword Extraction & Tokenization | `tests/test_keywords.py` | 18 | 18 | 0 | **PASS** |
| TF-IDF Cosine Similarity & Overlap | `tests/test_similarity.py` | 6 | 6 | 0 | **PASS** |
| **Total Python NLP Tests** | | **24** | **24** | **0** | **PASS** |

### Dedicated PyMuPDF PDF Binary Verification (`server/tests/verify_generated_pdfs.py`)
- **Populated Report PDF**: 2 pages, 21,275 bytes, 3,987 characters. Verified all 8 sections, keyword scores, structured summary, similarity, trends, gaps, recommendations, and references.
- **Empty Corpus Report PDF**: 1 page, 8,685 bytes, 1,758 characters. Verified honest empty corpus status and disclosures.
- **Result**: **ALL PDF VERIFICATION CHECKS PASSED**

---

## 2. Dedicated Keyword Count Verification Cases

As mandated by Section 4 of the audit specification, specific controlled test cases were constructed to verify that keyword counts are calculated dynamically and never artificially capped:

| Test Case | Description | Input Conditions | Expected Output | Actual Output | Verification Status |
|---|---|---|:---:|:---:|:---:|
| **Paper A** | 12 unique keywords | Text with 12 distinct valid tokens | Total count: **12** | Total count: **12** | **PASS** |
| **Paper B** | 30 unique keywords | Text with 30 distinct valid tokens | Total count: **30** | Total count: **30** | **PASS** |
| **Paper C** | 47 unique keywords (cap test) | Text with 47 distinct valid tokens | Total count: **47** (not capped at 30) | Total count: **47** | **PASS** |
| **Paper D** | Duplicate & casing normalization | `"Quantum QUANTUM quantum qUaNtUm Neural neural NEURAL Transformer"` | Total count: **3** unique terms (`quantum`, `neural`, `transformer`) | Total count: **3** | **PASS** |
| **Paper E** | Zero valid keywords | Stop-words only (`"the and of in is for on with at"`) | Total count: **0** (empty array `[]`) | Total count: **0** | **PASS** |
| **Project Aggregation** | Multi-paper union | Paper with 12 + Paper with 47 with 5 overlapping terms | Total unique: **54**; single-paper presence: no double count | Total unique: **54** | **PASS** |
| **Failed Paper Exclusion** | Non-completed paper isolation | Completed paper (2 keywords) + Failed paper (2 keywords) | Project count: **2** (failed paper keywords excluded) | Project count: **2** | **PASS** |
| **Paper Deletion** | Dynamic recalculation on delete | Delete paper with analysis via `DELETE /api/papers/:id` | Paper deleted; Project count drops to **0** | Project count: **0** | **PASS** |
| **Paper Reprocess** | Dynamic re-extraction | Existing paper reprocessed via `POST /api/papers/:id/reprocess` | Re-extracted keywords updated & returned | Analysis updated: **PASS** |

---

## 3. AI / NLP Result Accuracy Validation

### A. PDF Text Extraction Accuracy
- **Tested with**: `test_real.pdf` (quantum networking research text), empty PDFs, corrupted files, and multi-page reports.
- **Accuracy Findings**: PyMuPDF extracts text streams preserving word boundaries and paragraph separation. Mathematical symbols and unicode accents decompose cleanly via `unicodedata.normalize("NFKD")`.
- **Handling of Non-extractable PDFs**: Explicit error codes returned: `EMPTY_PDF`, `CORRUPTED_PDF`, and `SCANNED_PDF_UNSUPPORTED` (with OCR fallback for rasterized text).

### B. Keyword Relevance & Stop-Word Filtering
- **Formula**: $\text{TF}(t, d) = 1 + \ln(1 + f_{t,d} / N) \cdot \ln(f_{t,d} + 1)$
- **Domain Stop-Words**: Excludes generic paper structure words (`introduction`, `methodology`, `results`, `conclusion`, `references`, `doi`, `arxiv`, `page`, `vol`, `university`, `department`, `author`).
- **Administrative Noise Filtering**: Excludes student lab metadata (`practical`, `roll`, `semester`, `viva`, `marks`).

### C. Similarity Screening (TF-IDF + Cosine Similarity)
- **Mathematical Accuracy**: Cross-validated against standard `scikit-learn` `TfidfVectorizer` and `cosine_similarity`.
- **Thresholds**: Configurable via environment (`HIGH >= 0.60`, `MODERATE >= 0.30`).
- **Plagiarism Disclaimer**: Results are explicitly branded as "Textual Corpus Similarity", not a definitive plagiarism or copyright verdict.

### D. Trend Analysis Accuracy
- **Prevalence vs. Occurrences**: Explicitly separates:
  - **Paper Count**: Number of distinct papers mentioning the topic.
  - **Prevalence %**: Percentage of corpus papers containing the term.
  - **Occurrences**: Verbatim keyword occurrences across document bodies.
- **Missing Year Disclosures**: Documents without publication years (1900–2100) are explicitly grouped and excluded from multi-year timeline charts, with user-facing warnings displayed.

### E. Research Gap Evidence Traceability
- **Grounding**: Every gap and recommendation contains:
  - Citing paper ID, title, and authors.
  - Verbatim excerpt snippet (bounded to 300 characters).
  - Classification (`EXPLICIT_LIMITATION`, `FUTURE_WORK`, `METHODOLOGICAL_GAP`, `CORPUS_OPPORTUNITY`).
  - Confidence score calibrated from 0.0 to 1.0 based on cue phrases and sentiment analysis.

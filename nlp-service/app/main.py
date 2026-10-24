import os
import fitz  # PyMuPDF
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.nlp.keywords import extract_keywords

app = FastAPI(title="ResearchLens NLP Service")


@app.get("/health")
@app.get("/health/")
def health_check():
    return {"status": "ok", "service": "nlp-service"}


class ProcessRequest(BaseModel):
    paper_id: str
    stored_filename: str
    upload_dir: str


@app.post("/process-pdf")
@app.post("/process-pdf/")
def process_pdf(req: ProcessRequest):
    """
    Phase 5: Extract text and metadata from a PDF using PyMuPDF.
    Text + metadata extraction with OCR fallback for scanned/rasterized documents.
    """
    # Build safe path — only use the basename of stored_filename to prevent traversal
    safe_filename = os.path.basename(req.stored_filename)
    file_path = os.path.join(req.upload_dir, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        return {"error": f"CORRUPTED_PDF: Could not open PDF — {str(e)}"}

    if doc.page_count == 0:
        doc.close()
        return {"error": "EMPTY_PDF: PDF has no pages"}

    # Extract text from all pages
    full_text_parts = []
    for page in doc:
        text = page.get_text("text")
        if text:
            full_text_parts.append(text.strip())

    extracted_text = "\n\n".join(full_text_parts).strip()

    # If no standard text found (e.g. rasterized or vector-outline PDF), attempt OCR fallback
    if not extracted_text:
        try:
            import asyncio
            import io
            import PIL.Image
            import winocr

            ocr_parts = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img = PIL.Image.open(io.BytesIO(pix.tobytes("png")))
                ocr_res = asyncio.run(winocr.recognize_pil(img))
                if ocr_res and ocr_res.text and ocr_res.text.strip():
                    ocr_parts.append(ocr_res.text.strip())
            if ocr_parts:
                extracted_text = "\n\n".join(ocr_parts).strip()
        except Exception:
            pass

    # Detect scanned/image-only PDF where no extractable text could be found
    if not extracted_text:
        doc.close()
        return {"error": "SCANNED_PDF_UNSUPPORTED: No extractable text found. OCR is not supported in this version."}

    # Extract PDF metadata
    raw_meta = doc.metadata or {}
    doc.close()

    def safe_str(val):
        if not val or not str(val).strip():
            return None
        return str(val).strip()

    # Attempt to parse year from the date string (e.g. "D:20210315...")
    year = None
    date_str = raw_meta.get("creationDate") or raw_meta.get("modDate") or ""
    if date_str:
        # PDF dates are often "D:YYYYMMDDHHmmSS..."
        cleaned = date_str.lstrip("D:").lstrip("d:")
        if len(cleaned) >= 4 and cleaned[:4].isdigit():
            candidate = int(cleaned[:4])
            if 1900 <= candidate <= 2100:
                year = candidate

    metadata = {
        "title": safe_str(raw_meta.get("title")),
        "authors": [a.strip() for a in (raw_meta.get("author") or "").split(";") if a.strip()] or None,
        "abstract": None,  # Abstract extraction is Phase 6+ (NLP)
        "year": year,
    }

    return {
        "paper_id": req.paper_id,
        "text": extracted_text,
        "metadata": metadata,
    }


# ---------------------------------------------------------------------------
# Phase 6: Keyword Extraction
# ---------------------------------------------------------------------------

class KeywordRequest(BaseModel):
    paper_id: Optional[str] = None
    text: str
    top_n: Optional[int] = 50


@app.post("/extract-keywords")
@app.post("/extract-keywords/")
def extract_keywords_endpoint(req: KeywordRequest):
    """
    Phase 6: Extract and rank keywords from paper text.
    Returns ranked keyword list: [{term, score, rank}, ...]
    Enforces maximum of 50 unique keywords per paper.
    """
    if not req.text or not req.text.strip():
        return {
            "paper_id": req.paper_id,
            "keywords": [],
            "total": 0,
        }

    top_n = req.top_n if (req.top_n is not None and req.top_n > 0) else 50
    keywords = extract_keywords(req.text, top_n=top_n)

    return {
        "paper_id": req.paper_id,
        "keywords": keywords,
        "total": len(keywords),
    }


# ---------------------------------------------------------------------------
# Phase 8: Similarity Screening (TF-IDF + Cosine Similarity)
# ---------------------------------------------------------------------------

from app.nlp.similarity import compute_similarity_screening, DEFAULT_HIGH_THRESHOLD, DEFAULT_MODERATE_THRESHOLD


class SimilarityScreeningRequest(BaseModel):
    project_id: Optional[str] = None
    research_idea: str
    papers: list = []
    high_threshold: Optional[float] = DEFAULT_HIGH_THRESHOLD
    moderate_threshold: Optional[float] = DEFAULT_MODERATE_THRESHOLD


@app.post("/similarity-screening")
@app.post("/similarity-screening/")
@app.post("/novelty")
@app.post("/novelty/")
def similarity_screening_endpoint(req: SimilarityScreeningRequest):
    """
    Phase 8: Compute TF-IDF vectors and cosine similarity for research idea vs paper corpus.
    """
    result = compute_similarity_screening(
        research_idea=req.research_idea,
        papers=req.papers,
        high_threshold=req.high_threshold or DEFAULT_HIGH_THRESHOLD,
        moderate_threshold=req.moderate_threshold or DEFAULT_MODERATE_THRESHOLD,
    )
    if req.project_id:
        result["project_id"] = req.project_id
    return result


"""
Phase 8 — TF-IDF + Cosine Similarity Screening Module
Computes textual similarity between a candidate research idea and the project paper corpus.
Uses scikit-learn TfidfVectorizer and cosine_similarity.
Reuses the existing NLP text cleaning and stop-word filtering pipeline.
"""

import math
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.nlp.keywords import _clean_text, _STOP_WORDS

import os

DEFAULT_HIGH_THRESHOLD = float(os.getenv("SIMILARITY_HIGH_THRESHOLD", "0.60"))
DEFAULT_MODERATE_THRESHOLD = float(os.getenv("SIMILARITY_MODERATE_THRESHOLD", "0.30"))


def compute_similarity_screening(
    research_idea: str,
    papers: List[Dict[str, Any]],
    high_threshold: float = DEFAULT_HIGH_THRESHOLD,
    moderate_threshold: float = DEFAULT_MODERATE_THRESHOLD,
) -> Dict[str, Any]:
    """
    Computes TF-IDF vectors and cosine similarity for a research idea against
    a corpus of papers belonging to the selected project.

    Args:
        research_idea: Raw research idea text input from the user.
        papers: List of dicts, each with keys 'id', 'title', 'text'.
        high_threshold: Threshold above which similarity is considered High.
        moderate_threshold: Threshold above which similarity is Moderate.

    Returns:
        Structured result dict matching Phase 8 specifications.
    """
    cleaned_idea = _clean_text(research_idea or "")

    # Handle empty research idea
    if not cleaned_idea:
        return {
            "research_idea": research_idea or "",
            "overall_similarity_score": 0.0,
            "overall_similarity_percentage": 0.0,
            "interpretation": "Low",
            "interpretation_text": "Please provide a research idea to screen against the project corpus.",
            "status_badge": "LOW OVERLAP",
            "explanation": "This score reflects textual similarity to the available project corpus.",
            "similar_papers": [],
            "matching_keywords": [],
            "total_papers_analyzed": 0,
            "has_error": True,
            "error_message": "Research idea text is empty or contains no valid words.",
        }

    # Clean and filter corpus papers
    valid_papers = []
    for p in (papers or []):
        paper_text = p.get("text") or ""
        cleaned_paper = _clean_text(paper_text)
        if cleaned_paper:
            valid_papers.append({
                "id": str(p.get("id") or ""),
                "title": p.get("title") or "Untitled Document",
                "original_filename": p.get("original_filename") or "",
                "cleaned_text": cleaned_paper,
            })

    # Handle empty paper corpus
    if not valid_papers:
        return {
            "research_idea": research_idea,
            "overall_similarity_score": 0.0,
            "overall_similarity_percentage": 0.0,
            "interpretation": "Low",
            "interpretation_text": "No analyzed papers with extractable text are available in this project corpus.",
            "status_badge": "NO PAPERS AVAILABLE",
            "explanation": "This score reflects textual similarity to the available project corpus.",
            "similar_papers": [],
            "matching_keywords": [],
            "total_papers_analyzed": 0,
            "has_error": False,
        }

    # Build TF-IDF corpus: index 0 is idea, indices 1..N are papers
    corpus = [cleaned_idea] + [p["cleaned_text"] for p in valid_papers]

    try:
        vectorizer = TfidfVectorizer(
            stop_words=list(_STOP_WORDS),
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        tfidf_matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        # Handles cases where all tokens across idea and corpus were stop words
        return {
            "research_idea": research_idea,
            "overall_similarity_score": 0.0,
            "overall_similarity_percentage": 0.0,
            "interpretation": "Low",
            "interpretation_text": "No significant distinctive vocabulary found to compare.",
            "status_badge": "LOW OVERLAP",
            "explanation": "This score reflects textual similarity to the available project corpus.",
            "similar_papers": [],
            "matching_keywords": [],
            "total_papers_analyzed": len(valid_papers),
            "has_error": False,
        }

    idea_vector = tfidf_matrix[0:1]
    paper_vectors = tfidf_matrix[1:]

    # Check for zero vector in idea
    if idea_vector.nnz == 0:
        return {
            "research_idea": research_idea,
            "overall_similarity_score": 0.0,
            "overall_similarity_percentage": 0.0,
            "interpretation": "Low",
            "interpretation_text": "The research idea contained only generic stop words.",
            "status_badge": "LOW OVERLAP",
            "explanation": "This score reflects textual similarity to the available project corpus.",
            "similar_papers": [],
            "matching_keywords": [],
            "total_papers_analyzed": len(valid_papers),
            "has_error": False,
        }

    # Cosine similarity matrix between idea and all papers
    sim_matrix = cosine_similarity(idea_vector, paper_vectors)[0]
    feature_names = vectorizer.get_feature_names_out()

    all_matching_keywords_set = set()
    scored_papers = []

    for idx, paper in enumerate(valid_papers):
        raw_sim = float(sim_matrix[idx])
        # Clamp between 0.0 and 1.0
        score = max(0.0, min(1.0, round(raw_sim, 4)))
        percentage = round(score * 100, 1)

        # Extract matching keywords for this paper (overlap product of TF-IDF weights)
        paper_vec = paper_vectors[idx : idx + 1]
        overlap_sparse = idea_vector.multiply(paper_vec)

        overlap_terms = []
        if overlap_sparse.nnz > 0:
            cx = overlap_sparse.tocoo()
            term_scores = []
            for col, val in zip(cx.col, cx.data):
                term = feature_names[col]
                term_scores.append((term, val))
            term_scores.sort(key=lambda x: -x[1])
            overlap_terms = [t[0] for t in term_scores[:8]]
            for t in overlap_terms:
                all_matching_keywords_set.add(t)

        scored_papers.append({
            "paper_id": paper["id"],
            "title": paper["title"],
            "original_filename": paper["original_filename"],
            "similarity_score": score,
            "similarity_percentage": percentage,
            "matching_keywords": overlap_terms,
        })

    # Rank papers by descending similarity score
    scored_papers.sort(key=lambda p: (-p["similarity_score"], p["title"]))

    # Assign rank 1..N
    for rank, p in enumerate(scored_papers, start=1):
        p["rank"] = rank

    # Overall similarity score is the maximum similarity to any paper in corpus
    max_score = scored_papers[0]["similarity_score"] if scored_papers else 0.0
    overall_percentage = round(max_score * 100, 1)

    # Threshold interpretation
    if max_score >= high_threshold:
        interpretation = "High"
        interpretation_text = "The research idea has high textual similarity to papers in the current project corpus, indicating substantial existing coverage."
        status_badge = "HIGH OVERLAP"
    elif max_score >= moderate_threshold:
        interpretation = "Moderate"
        interpretation_text = "The research idea shows moderate textual overlap with some papers in the corpus, with shared conceptual intersections."
        status_badge = "MODERATE OVERLAP"
    else:
        interpretation = "Low"
        interpretation_text = "The research idea shows low textual similarity to existing papers in the corpus, reflecting distinct conceptual space within this project."
        status_badge = "LOW OVERLAP"

    return {
        "research_idea": research_idea,
        "overall_similarity_score": round(max_score, 4),
        "overall_similarity_percentage": overall_percentage,
        "interpretation": interpretation,
        "interpretation_text": interpretation_text,
        "status_badge": status_badge,
        "explanation": "This score reflects textual similarity to the available project corpus.",
        "similar_papers": scored_papers,
        "matching_keywords": sorted(list(all_matching_keywords_set))[:15],
        "total_papers_analyzed": len(valid_papers),
        "thresholds_used": {
            "high": high_threshold,
            "moderate": moderate_threshold,
        },
        "has_error": False,
    }

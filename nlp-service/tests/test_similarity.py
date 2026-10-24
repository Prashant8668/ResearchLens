"""
Tests for Phase 8: TF-IDF + Cosine Similarity Screening
"""

import pytest
from app.nlp.similarity import compute_similarity_screening


def test_similarity_high_overlap():
    papers = [
        {
            "id": "paper-1",
            "title": "Quantum Key Distribution Protocols",
            "text": "Quantum key distribution protocols utilize quantum mechanics for secure cryptography networks.",
        },
        {
            "id": "paper-2",
            "title": "Agricultural Crop Yield Prediction",
            "text": "Soil moisture sensors and satellite imagery predict agricultural crop yields in wheat fields.",
        },
    ]

    idea = "Quantum cryptography and key distribution in optical networks"
    res = compute_similarity_screening(idea, papers)

    assert not res["has_error"]
    assert res["overall_similarity_percentage"] > 25.0
    assert len(res["similar_papers"]) == 2
    # First ranked paper should be the Quantum paper
    assert res["similar_papers"][0]["paper_id"] == "paper-1"
    assert res["similar_papers"][0]["similarity_score"] > res["similar_papers"][1]["similarity_score"]
    assert "quantum" in [k.lower() for k in res["matching_keywords"]]


def test_similarity_low_overlap():
    papers = [
        {
            "id": "paper-1",
            "title": "Marine Biology of Coral Reefs",
            "text": "Coral bleaching phenomena caused by rising ocean temperatures in tropical reefs.",
        }
    ]

    idea = "Compiler optimization for RISC-V processors using LLVM"
    res = compute_similarity_screening(idea, papers)

    assert not res["has_error"]
    assert res["interpretation"] == "Low"
    assert res["status_badge"] == "LOW OVERLAP"
    assert res["overall_similarity_percentage"] < 15.0


def test_empty_idea_handling():
    papers = [{"id": "p1", "title": "Test Paper", "text": "Some research content."}]
    res = compute_similarity_screening("", papers)

    assert res["has_error"]
    assert res["overall_similarity_score"] == 0.0
    assert res["similar_papers"] == []


def test_empty_corpus_handling():
    res = compute_similarity_screening("Deep learning for image classification", [])

    assert not res["has_error"]
    assert res["overall_similarity_score"] == 0.0
    assert res["status_badge"] == "NO PAPERS AVAILABLE"
    assert res["similar_papers"] == []


def test_papers_with_empty_text():
    papers = [
        {"id": "p1", "title": "Empty Paper", "text": "   "},
        {"id": "p2", "title": "Valid Paper", "text": "Deep reinforcement learning in robotic manipulation."},
    ]
    res = compute_similarity_screening("Robotics and reinforcement learning", papers)

    assert not res["has_error"]
    assert len(res["similar_papers"]) == 1
    assert res["similar_papers"][0]["paper_id"] == "p2"


def test_custom_thresholds():
    papers = [
        {"id": "p1", "title": "Distributed Systems", "text": "Distributed consensus using Raft and Paxos."}
    ]
    idea = "Consensus protocols in distributed ledgers"

    # With very low threshold, even small overlap is High
    res_low = compute_similarity_screening(idea, papers, high_threshold=0.1, moderate_threshold=0.05)
    assert res_low["interpretation"] in ["High", "Moderate"]

    # With very high threshold, it is Low
    res_high = compute_similarity_screening(idea, papers, high_threshold=0.95, moderate_threshold=0.90)
    assert res_high["interpretation"] == "Low"

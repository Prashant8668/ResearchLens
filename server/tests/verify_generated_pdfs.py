import os
import re
import pymupdf

def verify_pdf(pdf_path, is_empty=False):
    print(f"=== Verifying: {os.path.basename(pdf_path)} ===")
    assert os.path.exists(pdf_path), f"File {pdf_path} not found"
    
    doc = pymupdf.open(pdf_path)
    print(f"Total Pages: {len(doc)}")
    assert len(doc) >= 1, "PDF must have at least 1 page"

    full_text = ""
    for idx, page in enumerate(doc):
        text = page.get_text()
        full_text += f"\n--- PAGE {idx+1} ---\n" + text
        # Verify page footer
        assert "ResearchLens Academic Platform" in text, f"Page footer missing on page {idx+1}"
        assert f"Page {idx+1} of {len(doc)}" in text, f"Page number missing on page {idx+1}"

    print(f"Total text extracted: {len(full_text)} characters")

    # STRICT RULE VERIFICATION: Ensure NO internal software development phase mentions exist!
    # Regex checks for "Phase 1", "Phase 2", "Phase 11", "Phase 12", etc.
    phase_pattern = re.compile(r'\bPhase\s*\d+\b', re.IGNORECASE)
    matches = phase_pattern.findall(full_text)
    assert len(matches) == 0, f"Found forbidden Phase mentions in {pdf_path}: {matches}"

    # Verify absence of specific development-stage labels
    assert "Recommendations Suite" not in full_text, "Found forbidden 'Recommendations Suite'"
    assert "PDF Research Report" not in full_text, "Found forbidden 'PDF Research Report'"
    assert "Phase 11" not in full_text
    assert "Phase 12" not in full_text

    if is_empty:
        assert "ResearchLens Academic Research Report" in full_text
        assert "Nascent Astrophysics Investigation" in full_text
        assert "Empty Research Corpus" in full_text
        assert "Research Overview" in full_text
        # Ensure non-applicable sections are NOT rendered when there is no data
        assert "Research Keywords" not in full_text
        assert "Structured Research Summary" not in full_text
        assert "Research Trends" not in full_text
        assert "Research Gaps" not in full_text
        assert "Suggested Research Ideas" not in full_text
        assert "References" not in full_text
        print("[PASS] Empty PDF strictly verified: Clean academic overview with zero development phase labels.")
    else:
        assert "ResearchLens Academic Research Report" in full_text
        assert "Quantum Entanglement Distribution & Routing" in full_text
        assert "Fault-Tolerant Quantum Mesh Protocols" in full_text
        assert "Alice Vance, Bob Martinez, Carol Chen" in full_text
        
        # Verify clean academic section headings
        assert "Research Overview" in full_text
        assert "Papers Analyzed" in full_text
        assert "Research Keywords" in full_text
        assert "Structured Research Summary" in full_text
        assert "Corpus Similarity Analysis" in full_text
        assert "Research Trends" in full_text
        assert "Research Gaps" in full_text
        assert "Suggested Research Ideas" in full_text
        assert "References" in full_text
        
        # Verify academic grounding labels
        assert "Evidence-Grounded" in full_text
        assert "Physical Photonic Testbed Evaluation" in full_text
        assert "Cryogenic Photonic Repeaters Architecture" in full_text
        print("[PASS] Populated PDF strictly verified: Full academic sections with zero development phase labels.")

    doc.close()

if __name__ == "__main__":
    dir_path = os.path.dirname(os.path.abspath(__file__))
    pop_path = os.path.join(dir_path, "test_output_populated.pdf")
    empty_path = os.path.join(dir_path, "test_output_empty.pdf")
    
    verify_pdf(pop_path, is_empty=False)
    verify_pdf(empty_path, is_empty=True)
    print("\nALL PDF ACADEMIC VERIFICATIONS PASSED WITH ZERO PHASE LABELS!")

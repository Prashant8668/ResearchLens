"""
Phase 6 — Keyword Extraction Module
Implements a lightweight, dependency-efficient NLP pipeline:
  1. Text cleaning & unicode normalization
  2. Safe tokenization
  3. Stop-word removal (NLTK English stopwords + domain stop-words)
  4. TF (term-frequency) scoring
  5. Rank-ordered keyword list with capped results
"""

import re
import math
import unicodedata
from collections import Counter
from typing import List, Dict, Optional

# -----------------------------------------------------------------------
# English stop words & research-domain generic stop words
# -----------------------------------------------------------------------
_DOMAIN_STOP_WORDS = {
    "also", "use", "used", "using", "show", "shown", "result", "results",
    "fig", "figure", "table", "section", "paper", "work", "study",
    "propose", "proposed", "approach", "method", "model", "system",
    "et", "al", "vs", "eg", "ie", "new", "based", "however", "therefore",
    "thus", "whereas", "one", "two", "three", "may", "can", "data",
    "different", "well", "high", "low", "first", "second", "many", "much",
    "often", "given", "since", "within", "without", "per", "due", "let",
    "department", "laboratory", "practical", "report", "viva", "roll", "semester",
    "submission", "faculty", "student", "journal", "author", "authors", "editor",
    "page", "pages", "doi", "isbn", "issn", "vol", "volume", "issue", "abstract",
    "introduction", "conclusion", "references", "university", "college", "institution",
    "http", "https", "www", "com", "org", "edu", "sign", "marks", "syllabus",
    "studies", "topic", "topics", "gap", "gaps", "finding", "findings", "article", "articles",
}

_STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "ain", "all", "am",
    "an", "and", "any", "are", "aren", "aren't", "as", "at", "be", "because",
    "been", "before", "being", "below", "between", "both", "but", "by", "can",
    "couldn", "couldn't", "d", "did", "didn", "didn't", "do", "does", "doesn",
    "doesn't", "doing", "don", "don't", "down", "during", "each", "few", "for",
    "from", "further", "get", "had", "hadn", "hadn't", "has", "hasn", "hasn't",
    "have", "haven", "haven't", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is",
    "isn", "isn't", "it", "it's", "its", "itself", "just", "ll", "m", "ma",
    "me", "mightn", "mightn't", "more", "most", "mustn", "mustn't", "my",
    "myself", "needn", "needn't", "no", "nor", "not", "now", "o", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
    "over", "own", "re", "s", "same", "shan", "shan't", "she", "she's",
    "should", "should've", "shouldn", "shouldn't", "so", "some", "such", "t",
    "than", "that", "that'll", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too",
    "under", "until", "up", "us", "ve", "very", "was", "wasn", "wasn't", "we",
    "were", "weren", "weren't", "what", "when", "where", "which", "while",
    "who", "whom", "why", "will", "with", "won", "won't", "wouldn",
    "wouldn't", "y", "you", "you'd", "you'll", "you're", "you've", "your",
    "yours", "yourself", "yourselves",
} | _DOMAIN_STOP_WORDS

# Safely extend with NLTK stopwords if available
try:
    import nltk
    try:
        from nltk.corpus import stopwords
        _STOP_WORDS.update(stopwords.words("english"))
    except Exception:
        try:
            nltk.download("stopwords", quiet=True)
            from nltk.corpus import stopwords
            _STOP_WORDS.update(stopwords.words("english"))
        except Exception:
            pass
except Exception:
    pass


def _clean_text(text: str) -> str:
    """Normalize unicode, strip citations, urls, symbols, and punctuation."""
    if not text:
        return ""

    # Normalize unicode (decompose accents, convert ligatures etc.)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))

    # Strip URLs
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    # Strip citation markers like [1], [1-3], [12, 14]
    text = re.sub(r"\[[\d\s,–-]+\]", " ", text)
    # Strip author-year citations like (Smith, 2020)
    text = re.sub(r"\([A-Za-z\s.,]+,\s*\d{4}\)", " ", text)
    # Keep only letters, whitespace, and hyphens
    text = re.sub(r"[^a-zA-Z\-\s]", " ", text)
    # Collapse repeated hyphens and whitespace
    text = re.sub(r"-+", "-", text)
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def _tokenize(text: str) -> List[str]:
    """Tokenize into words, stripping extraneous hyphens."""
    if not text:
        return []
    tokens = []
    for tok in text.split():
        tok = tok.strip("-")
        if tok:
            tokens.append(tok)
    return tokens


def _is_valid_token(token: str) -> bool:
    """Accept tokens that are valid words (>= 3 chars, alphabetic/hyphenated, not stop word)."""
    if len(token) < 3:
        return False
    if token in _STOP_WORDS:
        return False
    # Must contain at least one letter and not start/end with hyphen
    if not re.search(r"[a-z]", token):
        return False
    if token.startswith("-") or token.endswith("-"):
        return False
    return True


def _tf_score(token: str, counts: Counter, total: int) -> float:
    """Normalized term frequency with logarithmic smoothing."""
    raw_tf = counts[token] / total if total > 0 else 0
    return round(1 + math.log(1 + raw_tf), 6)


DEFAULT_MAX_KEYWORDS = 50


def extract_keywords(
    text: str,
    top_n: Optional[int] = DEFAULT_MAX_KEYWORDS,
) -> List[Dict]:
    """
    Extract and rank keywords from research text (papers or ideas).

    Returns a list of dicts: [{term, score, rank}, ...]
    sorted descending by score. Each paper contains at most 50 unique keywords.
    If more than 50 valid candidates exist, selects the top 50 based on the
    existing keyword relevance/ranking algorithm.
    If fewer than 50 exist, keeps all valid extracted keywords.
    Does not artificially generate keywords.
    Safely handles empty, short, punctuation-only, and unusual text.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return []

    cleaned = _clean_text(text)
    if not cleaned:
        return []

    tokens = _tokenize(cleaned)
    valid_tokens = [t for t in tokens if _is_valid_token(t)]

    if not valid_tokens:
        return []

    total = len(valid_tokens)
    counts = Counter(valid_tokens)

    # Calculate scores: log-smoothed TF multiplied by log(frequency + 1)
    scored = []
    for term, freq in counts.items():
        score = _tf_score(term, counts, total) * math.log(freq + 1)
        scored.append({"term": term, "score": round(score, 6), "_freq": freq})

    # Sort descending by score, then alphabetical for deterministic ordering
    scored.sort(key=lambda x: (-x["score"], x["term"]))

    # Enforce per-paper keyword limit: at most 50 unique keywords
    limit = DEFAULT_MAX_KEYWORDS
    if top_n is not None and top_n > 0:
        limit = min(top_n, DEFAULT_MAX_KEYWORDS)
    top = scored[:limit]

    # Assign ranks 1..N
    result = []
    for rank, item in enumerate(top, start=1):
        result.append({"term": item["term"], "score": item["score"], "rank": rank})

    return result

import unittest
from app.nlp.keywords import extract_keywords, _clean_text, _tokenize, _is_valid_token


class TestKeywordExtraction(unittest.TestCase):
    def test_empty_and_whitespace_text(self):
        self.assertEqual(extract_keywords(""), [])
        self.assertEqual(extract_keywords("   \n\t  "), [])
        self.assertEqual(extract_keywords(None), [])

    def test_short_tokens_filtered(self):
        # Words with < 3 characters or stop words only
        self.assertEqual(extract_keywords("in on at to by AI ML"), [])

    def test_punctuation_and_symbols_only(self):
        self.assertEqual(extract_keywords("... !!! ??? --- *** ///"), [])
        self.assertEqual(extract_keywords("$$$ %%% ^^^ &&&"), [])

    def test_stop_words_removed(self):
        # Standard english + domain stop words
        text = "this is a paper about the study and method which was proposed also"
        results = extract_keywords(text)
        self.assertEqual(results, [])

    def test_duplicate_terms_and_scoring(self):
        # Term occurring more frequently must have higher score than less frequent
        text = (
            "transformer transformer transformer transformer "
            "attention attention "
            "convolution"
        )
        results = extract_keywords(text)
        self.assertGreaterEqual(len(results), 3)

        term_map = {r["term"]: r for r in results}
        self.assertIn("transformer", term_map)
        self.assertIn("attention", term_map)
        self.assertIn("convolution", term_map)

        self.assertGreater(term_map["transformer"]["score"], term_map["attention"]["score"])
        self.assertGreater(term_map["attention"]["score"], term_map["convolution"]["score"])

    def test_ranking_order(self):
        text = (
            "transformer transformer transformer transformer "
            "attention attention attention "
            "bert bert "
            "resnet"
        )
        results = extract_keywords(text)
        ranks = [r["rank"] for r in results]
        self.assertEqual(ranks, list(range(1, len(results) + 1)))

        # Highest scored term must be rank 1
        self.assertEqual(results[0]["term"], "transformer")
        self.assertEqual(results[0]["rank"], 1)
        self.assertEqual(results[1]["term"], "attention")
        self.assertEqual(results[1]["rank"], 2)

    def test_unusual_characters_and_emojis(self):
        text = (
            "naïve bayes classification 🚀🔥 with résumé dataset. "
            "Formula: ∑(x) = 100% α-β pruning algorithm."
        )
        results = extract_keywords(text)
        self.assertTrue(len(results) > 0)
        terms = [r["term"] for r in results]
        self.assertIn("naive", terms)
        self.assertIn("bayes", terms)
        self.assertIn("classification", terms)
        self.assertIn("dataset", terms)

    def test_top_n_capping(self):
        text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron"
        results = extract_keywords(text, top_n=5)
        self.assertLessEqual(len(results), 5)
        self.assertEqual(len(results), 5)

    def test_term_uniqueness(self):
        text = "deep learning deep learning deep learning neural networks neural networks"
        results = extract_keywords(text)
        terms = [r["term"] for r in results]
        self.assertEqual(len(terms), len(set(terms)))

    def test_paper_a_12_unique_keywords(self):
        words = ["term" + chr(ord('a') + i) * 3 for i in range(12)]
        text = " ".join(words)
        results = extract_keywords(text)
        self.assertEqual(len(results), 12)

    def test_paper_b_30_unique_keywords(self):
        words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
                 "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
                 "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
                 "xray", "yankee", "zulu", "quantum", "neural", "photon", "laser"]
        self.assertEqual(len(words), 30)
        text = " ".join(words)
        results = extract_keywords(text)
        self.assertEqual(len(results), 30)

    def test_paper_c_47_unique_keywords_not_capped_at_30(self):
        # Crucial test: 47 unique valid keywords must yield exactly 47 keywords, NOT 30
        base_words = [
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
            "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
            "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
            "xray", "yankee", "zulu", "quantum", "neural", "photon", "laser",
            "tensor", "matrix", "vector", "scalar", "entropy", "gradient", "manifold",
            "topology", "cluster", "lattice", "fermion", "boson", "hadron", "lepton",
            "baryon", "meson", "gluon"
        ]
        self.assertEqual(len(base_words), 47)
        self.assertEqual(len(set(base_words)), 47)
        text = " ".join(base_words)
        results = extract_keywords(text)
        self.assertEqual(len(results), 47)
        self.assertEqual(results[0]["rank"], 1)
        self.assertEqual(results[46]["rank"], 47)

    def test_acceptance_18_unique_keywords_yields_18(self):
        # 18 unique keywords -> count 18
        words = [
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
            "golf", "hotel", "india", "juliet", "kilo", "lima",
            "mike", "november", "oscar", "papa", "quebec", "romeo"
        ]
        self.assertEqual(len(words), 18)
        text = " ".join(words)
        results = extract_keywords(text)
        self.assertEqual(len(results), 18)
        self.assertEqual(results[0]["rank"], 1)
        self.assertEqual(results[17]["rank"], 18)

    def test_acceptance_35_unique_keywords_yields_35(self):
        # 35 unique keywords -> count 35
        words = [
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
            "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
            "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
            "xray", "yankee", "zulu", "quantum", "neural", "photon", "laser",
            "tensor", "matrix", "vector", "scalar", "entropy"
        ]
        self.assertEqual(len(words), 35)
        text = " ".join(words)
        results = extract_keywords(text)
        self.assertEqual(len(results), 35)
        self.assertEqual(results[0]["rank"], 1)
        self.assertEqual(results[34]["rank"], 35)

    def test_acceptance_50_unique_keywords_yields_50(self):
        # 50 unique keywords -> count 50
        words = [
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
            "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
            "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
            "xray", "yankee", "zulu", "quantum", "neural", "photon", "laser",
            "tensor", "matrix", "vector", "scalar", "entropy", "gradient", "manifold",
            "topology", "cluster", "lattice", "fermion", "boson", "hadron", "lepton",
            "baryon", "meson", "gluon", "plasma", "galaxy", "nebula"
        ]
        self.assertEqual(len(words), 50)
        text = " ".join(words)
        results = extract_keywords(text)
        self.assertEqual(len(results), 50)
        self.assertEqual(results[0]["rank"], 1)
        self.assertEqual(results[49]["rank"], 50)

    def test_acceptance_65_ranked_candidates_capped_at_top_50(self):
        # 65 unique valid candidate words
        # Make the first 5 words appear 10 times each to guarantee they are the top ranked candidates
        top_words = ["supernova", "blackhole", "singularity", "relativity", "gravitation"]
        other_words = [
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
            "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
            "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
            "xray", "yankee", "zulu", "quantum", "neural", "photon", "laser",
            "tensor", "matrix", "vector", "scalar", "entropy", "gradient", "manifold",
            "topology", "cluster", "lattice", "fermion", "boson", "hadron", "lepton",
            "baryon", "meson", "gluon", "plasma", "galaxy", "nebula", "pulsar",
            "quasar", "neutrino", "positron", "electron", "proton", "neutron", "photonics",
            "superconductor", "semiconductor"
        ]
        all_words = top_words + other_words
        self.assertEqual(len(all_words), 65)
        self.assertEqual(len(set(all_words)), 65)

        # Build text where top_words repeat 5 times to ensure higher relevance scores
        text_tokens = (top_words * 5) + other_words
        text = " ".join(text_tokens)

        results = extract_keywords(text)
        # MUST contain exactly 50 keywords (capped at 50, not 65)
        self.assertEqual(len(results), 50)
        # Ranks must be 1 to 50
        self.assertEqual([r["rank"] for r in results], list(range(1, 51)))

        # The 5 repeated words must be in the top 5
        top_5_terms = [r["term"] for r in results[:5]]
        for tw in top_words:
            self.assertIn(tw, top_5_terms)

    def test_acceptance_duplicate_keywords_normalization(self):
        # Duplicate keywords with case and whitespace -> count according to normalization rule
        text = "  QUANTUM   quantum   Quantum  \n\t  NEURAL   neural   Neural   TRANSFORMER "
        results = extract_keywords(text)
        self.assertEqual(len(results), 3)
        terms = [r["term"] for r in results]
        self.assertEqual(set(terms), {"quantum", "neural", "transformer"})

    def test_acceptance_empty_keywords_yields_zero(self):
        self.assertEqual(extract_keywords(""), [])
        self.assertEqual(extract_keywords("   \n\t  "), [])
        self.assertEqual(extract_keywords(None), [])
        self.assertEqual(extract_keywords("the of in and to with"), [])


if __name__ == "__main__":
    unittest.main()
